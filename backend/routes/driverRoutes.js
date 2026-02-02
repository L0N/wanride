const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateJWT } = require('../middleware/auth');
const Ride = require('../models/Ride');
const CommissionPayout = require('../models/CommissionPayout');
const { generateReceipt, sendReceiptSMS, sendReceiptEmail } = require('../services/receiptService');
const { roundToK5, isK5Rounded } = require('../utils/k5Rounding');
const { 
  calculateDriverCommissions,
  getCurrentWeekRange,
  getLastWeekRange,
  getCurrentMonthRange,
  getTodayRange
} = require('../services/commissionService');
const moment = require('moment-timezone');

/**
 * Driver Routes for WanRide PNG - Week 2 & 3: Payment Collection & Commission System
 * 
 * Handles:
 * - Payment confirmation
 * - Payment disputes
 * - Receipt generation and retrieval
 * - Commission tracking and breakdown
 * - Payout history
 * - Driver-specific ride operations
 */

// Middleware to ensure user is a driver
const requireDriver = (req, res, next) => {
  if (!req.user.roles.includes('DRIVER')) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Driver role required'
    });
  }
  next();
};

/**
 * @route POST /api/driver/rides/:rideId/payment
 * @desc Confirm cash payment collection
 * @access Private (Driver only)
 */
router.post('/rides/:rideId/payment', [
  authenticateJWT,
  requireDriver,
  body('amountCollected')
    .isFloat({ min: 5 })
    .withMessage('Amount collected must be at least K5')
    .custom((value) => {
      if (!isK5Rounded(value)) {
        throw new Error('Amount collected must be K5-rounded (divisible by 5)');
      }
      return true;
    }),
  body('paymentMethod')
    .optional()
    .isIn(['CASH'])
    .withMessage('Payment method must be CASH'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment data',
        errors: errors.array()
      });
    }

    const { amountCollected, paymentMethod, notes } = req.body;
    const driverId = req.user._id;
    
    // Find ride and verify driver
    const ride = await Ride.findById(req.params.rideId)
      .populate('passenger', 'name phone email')
      .populate('driver', 'name employeeId')
      .populate('vehicle', 'make model licensePlate');
    
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }
    
    if (ride.driverId.toString() !== driverId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized for this ride'
      });
    }
    
    if (ride.status !== 'IN_PROGRESS' && ride.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Ride must be in progress or completed before collecting payment'
      });
    }
    
    if (ride.payment.status === 'COLLECTED') {
      return res.status(400).json({
        success: false,
        message: 'Payment has already been collected for this ride'
      });
    }
    
    // Validate amount matches expected fare
    const expectedAmount = ride.payment.amountDue || ride.fareCalculation.finalFare;
    const collectedAmount = roundToK5(amountCollected);
    
    if (collectedAmount !== expectedAmount) {
      return res.status(400).json({ 
        success: false,
        message: `Amount collected (K${collectedAmount}) does not match expected fare (K${expectedAmount}). Please report a dispute instead.`,
        expectedAmount: expectedAmount,
        collectedAmount: collectedAmount
      });
    }
    
    // Update payment status
    ride.payment.status = 'COLLECTED';
    ride.payment.amountCollected = collectedAmount;
    ride.payment.collectedAt = new Date();
    ride.payment.collectedBy = driverId;
    ride.payment.paymentMethod = paymentMethod || 'CASH';
    ride.payment.notes = notes;
    
    // Generate receipt number if not exists
    if (!ride.payment.receiptNumber) {
      ride.payment.receiptNumber = ride.generateReceiptNumber();
    }
    
    ride.payment.receiptGenerated = true;
    
    // Update ride status to completed if not already
    if (ride.status !== 'COMPLETED') {
      ride.status = 'COMPLETED';
      ride.timestamps.completed = new Date();
    }
    
    // Add to payment status history
    ride.payment.statusHistory.push({
      status: 'COLLECTED',
      changedAt: new Date(),
      changedBy: driverId,
      reason: 'Cash payment confirmed by driver'
    });
    
    await ride.save();
    
    // Generate receipt
    const receiptData = generateReceipt(ride);
    
    // Send receipt (SMS and/or email if available)
    const receiptSent = [];
    
    if (ride.passenger.phone && process.env.SMS_ENABLED === 'true') {
      const smsSent = await sendReceiptSMS(ride.passenger.phone, receiptData);
      if (smsSent) receiptSent.push('SMS');
    }
    
    if (ride.passenger.email && process.env.EMAIL_ENABLED === 'true') {
      const emailSent = await sendReceiptEmail(ride.passenger.email, receiptData);
      if (emailSent) receiptSent.push('EMAIL');
    }
    
    if (receiptSent.length > 0) {
      ride.payment.receiptSentVia = receiptSent;
      await ride.save();
    }
    
    // Emit Socket.io event (if io is available)
    if (req.io) {
      req.io.emit('ride:payment:collected', {
        rideId: ride._id,
        driverId: driverId,
        amount: collectedAmount,
        receiptNumber: ride.payment.receiptNumber,
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      message: 'Payment collected successfully',
      data: {
        ride: ride,
        receiptNumber: ride.payment.receiptNumber,
        receiptSentVia: receiptSent,
        receiptData: receiptData
      }
    });
    
  } catch (error) {
    console.error('Payment collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to collect payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route POST /api/driver/rides/:rideId/dispute
 * @desc Report payment dispute
 * @access Private (Driver only)
 */
router.post('/rides/:rideId/dispute', [
  authenticateJWT,
  requireDriver,
  body('reportedAmount')
    .isFloat({ min: 0 })
    .withMessage('Reported amount must be non-negative')
    .custom((value) => {
      if (!isK5Rounded(value)) {
        throw new Error('Reported amount must be K5-rounded (divisible by 5)');
      }
      return true;
    }),
  body('reason')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Reason must be between 10 and 1000 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid dispute data',
        errors: errors.array()
      });
    }

    const { reportedAmount, reason } = req.body;
    const driverId = req.user._id;
    
    // Find ride
    const ride = await Ride.findById(req.params.rideId)
      .populate('passenger', 'name phone')
      .populate('driver', 'name');
    
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }
    
    if (ride.driverId.toString() !== driverId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized for this ride'
      });
    }
    
    if (ride.payment.status === 'COLLECTED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot dispute payment that has already been collected'
      });
    }
    
    // Calculate difference
    const roundedReportedAmount = roundToK5(reportedAmount);
    const expectedAmount = ride.payment.amountDue || ride.fareCalculation.finalFare;
    const difference = expectedAmount - roundedReportedAmount;
    
    // Update payment with dispute
    ride.payment.status = 'DISPUTED';
    ride.payment.discrepancy.exists = true;
    ride.payment.discrepancy.reportedAmount = roundedReportedAmount;
    ride.payment.discrepancy.actualAmount = roundedReportedAmount;
    ride.payment.discrepancy.difference = difference;
    ride.payment.discrepancy.reason = reason;
    ride.payment.discrepancy.reportedAt = new Date();
    ride.payment.discrepancy.reportedBy = driverId;
    ride.payment.discrepancy.resolution.status = 'PENDING';
    
    // Update ride status to completed (dispute doesn't block completion)
    if (ride.status !== 'COMPLETED') {
      ride.status = 'COMPLETED';
      ride.timestamps.completed = new Date();
    }
    
    // Add to status history
    ride.payment.statusHistory.push({
      status: 'DISPUTED',
      changedAt: new Date(),
      changedBy: driverId,
      reason: `Payment dispute: ${reason}`
    });
    
    await ride.save();
    
    // Notify dispatcher via Socket.io (if available)
    if (req.io) {
      req.io.to('dispatchers').emit('payment:dispute', {
        rideId: ride._id,
        driver: {
          id: ride.driver._id,
          name: ride.driver.name
        },
        passenger: {
          id: ride.passenger._id,
          name: ride.passenger.name,
          phone: ride.passenger.phone
        },
        expectedAmount: expectedAmount,
        reportedAmount: roundedReportedAmount,
        difference: difference,
        reason: reason,
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      message: 'Payment dispute reported successfully',
      data: {
        dispute: ride.payment.discrepancy,
        ride: ride
      }
    });
    
  } catch (error) {
    console.error('Payment dispute error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report payment dispute',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/driver/rides/:rideId/receipt
 * @desc Get receipt data for a ride
 * @access Private (Driver only)
 */
router.get('/rides/:rideId/receipt', [
  authenticateJWT,
  requireDriver
], async (req, res) => {
  try {
    const driverId = req.user._id;
    
    const ride = await Ride.findById(req.params.rideId)
      .populate('passenger', 'name phone')
      .populate('driver', 'name employeeId')
      .populate('vehicle', 'make model licensePlate');
    
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }
    
    if (ride.driverId.toString() !== driverId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized for this ride'
      });
    }
    
    if (ride.payment.status !== 'COLLECTED' && ride.payment.status !== 'DISPUTED') {
      return res.status(400).json({
        success: false,
        message: 'No receipt available for this ride'
      });
    }
    
    const receiptData = generateReceipt(ride);
    
    res.json({
      success: true,
      data: {
        receiptData: receiptData,
        receiptNumber: ride.payment.receiptNumber,
        receiptSentVia: ride.payment.receiptSentVia || []
      }
    });
    
  } catch (error) {
    console.error('Receipt retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve receipt',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route POST /api/driver/rides/:rideId/receipt/send
 * @desc Resend receipt via SMS or email
 * @access Private (Driver only)
 */
router.post('/rides/:rideId/receipt/send', [
  authenticateJWT,
  requireDriver,
  body('method')
    .isIn(['SMS', 'EMAIL'])
    .withMessage('Method must be SMS or EMAIL')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid send method',
        errors: errors.array()
      });
    }

    const { method } = req.body;
    const driverId = req.user._id;
    
    const ride = await Ride.findById(req.params.rideId)
      .populate('passenger', 'name phone email')
      .populate('driver', 'name employeeId')
      .populate('vehicle', 'make model licensePlate');
    
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }
    
    if (ride.driverId.toString() !== driverId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized for this ride'
      });
    }
    
    if (!ride.payment.receiptGenerated) {
      return res.status(400).json({
        success: false,
        message: 'No receipt available to send'
      });
    }
    
    const receiptData = generateReceipt(ride);
    let sent = false;
    
    if (method === 'SMS') {
      if (!ride.passenger.phone) {
        return res.status(400).json({
          success: false,
          message: 'Passenger phone number not available'
        });
      }
      sent = await sendReceiptSMS(ride.passenger.phone, receiptData);
    } else if (method === 'EMAIL') {
      if (!ride.passenger.email) {
        return res.status(400).json({
          success: false,
          message: 'Passenger email not available'
        });
      }
      sent = await sendReceiptEmail(ride.passenger.email, receiptData);
    }
    
    if (sent) {
      // Update receiptSentVia if not already included
      if (!ride.payment.receiptSentVia.includes(method)) {
        ride.payment.receiptSentVia.push(method);
        await ride.save();
      }
    }
    
    res.json({
      success: true,
      message: sent ? `Receipt sent via ${method}` : `Failed to send receipt via ${method}`,
      data: {
        method: method,
        sent: sent,
        receiptNumber: ride.payment.receiptNumber
      }
    });
    
  } catch (error) {
    console.error('Receipt send error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send receipt',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/driver/rides/active
 * @desc Get driver's active rides
 * @access Private (Driver only)
 */
router.get('/rides/active', [
  authenticateJWT,
  requireDriver
], async (req, res) => {
  try {
    const driverId = req.user._id;
    
    const activeRides = await Ride.find({
      driverId: driverId,
      status: { $in: ['ASSIGNED', 'ARRIVED', 'IN_PROGRESS'] }
    })
    .populate('passenger', 'name phone')
    .populate('vehicle', 'make model licensePlate')
    .sort({ 'timestamps.requested': -1 });
    
    res.json({
      success: true,
      data: activeRides
    });
    
  } catch (error) {
    console.error('Active rides error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active rides',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/driver/rides/completed
 * @desc Get driver's completed rides with payment status
 * @access Private (Driver only)
 */
router.get('/rides/completed', [
  authenticateJWT,
  requireDriver
], async (req, res) => {
  try {
    const driverId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const completedRides = await Ride.find({
      driverId: driverId,
      status: 'COMPLETED'
    })
    .populate('passenger', 'name phone')
    .populate('vehicle', 'make model licensePlate')
    .sort({ 'timestamps.completed': -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Ride.countDocuments({
      driverId: driverId,
      status: 'COMPLETED'
    });
    
    res.json({
      success: true,
      data: {
        rides: completedRides,
        pagination: {
          page: page,
          limit: limit,
          total: total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Completed rides error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get completed rides',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/driver/commissions?period=THIS_WEEK
 * @desc Get driver's commission summary for a period
 * @access Private (Driver only)
 */
router.get('/commissions', authenticateJWT, requireDriver, async (req, res) => {
  try {
    const driverId = req.user._id;
    const { period = 'THIS_WEEK' } = req.query;
    
    let dateRange;
    
    switch (period) {
      case 'TODAY':
        dateRange = getTodayRange();
        break;
      
      case 'THIS_WEEK':
        dateRange = getCurrentWeekRange();
        break;
      
      case 'LAST_WEEK':
        dateRange = getLastWeekRange();
        break;
      
      case 'THIS_MONTH':
        dateRange = getCurrentMonthRange();
        break;
      
      default:
        return res.status(400).json({ 
          success: false,
          message: 'Invalid period specified. Use: TODAY, THIS_WEEK, LAST_WEEK, THIS_MONTH' 
        });
    }
    
    const commissionData = await calculateDriverCommissions(
      driverId,
      dateRange.from,
      dateRange.to
    );
    
    res.json({
      success: true,
      data: commissionData
    });
    
  } catch (error) {
    console.error('Commission data error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to retrieve commission data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/driver/payouts
 * @desc Get driver's payout history
 * @access Private (Driver only)
 */
router.get('/payouts', authenticateJWT, requireDriver, async (req, res) => {
  try {
    const driverId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { driverId: driverId };
    if (status) {
      query.status = status;
    }
    
    const payouts = await CommissionPayout.find(query)
      .sort({ 'period.from': -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-rides') // Exclude rides array for performance
      .lean();
    
    const total = await CommissionPayout.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        payouts: payouts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
    
  } catch (error) {
    console.error('Payout history error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to retrieve payout history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/driver/payouts/:payoutId
 * @desc Get detailed payout information
 * @access Private (Driver only)
 */
router.get('/payouts/:payoutId', authenticateJWT, requireDriver, async (req, res) => {
  try {
    const driverId = req.user._id;
    
    const payout = await CommissionPayout.findOne({
      _id: req.params.payoutId,
      driverId: driverId
    })
      .populate('driverId', 'name email phone')
      .populate({
        path: 'rides',
        select: 'pickup destination fareCalculation payment timestamps',
        populate: { 
          path: 'passenger', 
          select: 'name phone' 
        }
      })
      .populate('approvedBy', 'name')
      .populate('paidBy', 'name');
    
    if (!payout) {
      return res.status(404).json({ 
        success: false,
        message: 'Payout not found' 
      });
    }
    
    res.json({ 
      success: true,
      data: { payout } 
    });
    
  } catch (error) {
    console.error('Payout detail error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to retrieve payout details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/driver/commission-stats
 * @desc Get driver's commission statistics summary
 * @access Private (Driver only)
 */
router.get('/commission-stats', authenticateJWT, requireDriver, async (req, res) => {
  try {
    const driverId = req.user._id;
    
    // Get stats for different periods
    const thisWeek = await calculateDriverCommissions(driverId, ...Object.values(getCurrentWeekRange()));
    const lastWeek = await calculateDriverCommissions(driverId, ...Object.values(getLastWeekRange()));
    const thisMonth = await calculateDriverCommissions(driverId, ...Object.values(getCurrentMonthRange()));
    
    // Get recent payouts
    const recentPayouts = await CommissionPayout.find({ driverId: driverId })
      .sort({ 'period.from': -1 })
      .limit(5)
      .select('period totalCommissions netPayout status')
      .lean();
    
    res.json({
      success: true,
      data: {
        thisWeek: {
          rides: thisWeek.ridesCompleted,
          commissions: thisWeek.totalCommissions,
          average: thisWeek.averageCommissionPerRide
        },
        lastWeek: {
          rides: lastWeek.ridesCompleted,
          commissions: lastWeek.totalCommissions,
          average: lastWeek.averageCommissionPerRide
        },
        thisMonth: {
          rides: thisMonth.ridesCompleted,
          commissions: thisMonth.totalCommissions,
          average: thisMonth.averageCommissionPerRide
        },
        recentPayouts: recentPayouts
      }
    });
    
  } catch (error) {
    console.error('Commission stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to retrieve commission statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
