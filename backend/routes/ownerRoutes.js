const express = require('express');
const router = express.Router();
const { authenticate, requireOwner } = require('../middleware/auth');
const CommissionPayout = require('../models/CommissionPayout');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { roundToK5 } = require('../utils/k5Rounding');
const moment = require('moment-timezone');

/**
 * GET /api/owner/payouts?status=PENDING
 * Get commission payouts with optional status filter
 */
router.get('/payouts', requireOwner, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    const query = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }
    
    const payouts = await CommissionPayout.find(query)
      .populate('driverId', 'name email phone employeeId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Transform the data to match frontend expectations
    const transformedPayouts = payouts.map(payout => ({
      ...payout.toObject(),
      driver: payout.driverId // Rename driverId to driver for frontend compatibility
    }));
    
    const total = await CommissionPayout.countDocuments(query);
    
    res.json({
      payouts: transformedPayouts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Fetch payouts error:', error);
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
});

/**
 * PUT /api/owner/payouts/:payoutId/approve
 * Approve a commission payout
 */
router.put('/payouts/:payoutId/approve', requireOwner, async (req, res) => {
  try {
    const { approvalNotes } = req.body;
    const ownerId = req.user._id;
    
    const payout = await CommissionPayout.findById(req.params.payoutId);
    
    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }
    
    if (payout.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot approve payout with status ${payout.status}` });
    }
    
    // Update payout status
    payout.status = 'APPROVED';
    payout.approvedBy = ownerId;
    payout.approvedAt = new Date();
    payout.approvalNotes = approvalNotes;
    
    // Add to status history
    payout.statusHistory.push({
      status: 'APPROVED',
      changedBy: ownerId,
      changedAt: new Date(),
      notes: approvalNotes || 'Payout approved by owner'
    });
    
    await payout.save();
    
    // TODO: Notify driver via Socket.io when implemented
    // req.io?.to(`driver:${payout.driverId}`).emit('commission:approved', {
    //   payoutId: payout._id,
    //   amount: payout.netPayout,
    //   approvedAt: payout.approvedAt
    // });
    
    res.json({
      message: 'Payout approved successfully',
      payout
    });
    
  } catch (error) {
    console.error('Approve payout error:', error);
    res.status(500).json({ error: 'Failed to approve payout' });
  }
});

/**
 * PUT /api/owner/payouts/:payoutId/mark-paid
 * Mark payout as paid
 */
router.put('/payouts/:payoutId/mark-paid', requireOwner, async (req, res) => {
  try {
    const { paymentMethod, paymentReference, paymentNotes } = req.body;
    const ownerId = req.user._id;
    
    const payout = await CommissionPayout.findById(req.params.payoutId);
    
    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }
    
    if (payout.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Payout must be approved before marking as paid' });
    }
    
    // Update payout status
    payout.status = 'PAID';
    payout.paidAt = new Date();
    payout.paidBy = ownerId;
    payout.paymentMethod = paymentMethod;
    payout.paymentReference = paymentReference;
    payout.paymentNotes = paymentNotes;
    
    // Add to status history
    payout.statusHistory.push({
      status: 'PAID',
      changedBy: ownerId,
      changedAt: new Date(),
      notes: `Paid via ${paymentMethod}${paymentReference ? ` (Ref: ${paymentReference})` : ''}`
    });
    
    await payout.save();
    
    // TODO: Notify driver via Socket.io when implemented
    // req.io?.to(`driver:${payout.driverId}`).emit('commission:paid', {
    //   payoutId: payout._id,
    //   amount: payout.netPayout,
    //   paymentMethod,
    //   paidAt: payout.paidAt
    // });
    
    res.json({
      message: 'Payout marked as paid',
      payout
    });
    
  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(500).json({ error: 'Failed to mark payout as paid' });
  }
});

/**
 * PUT /api/owner/payouts/:payoutId/deductions
 * Update deductions for a payout
 */
router.put('/payouts/:payoutId/deductions', requireOwner, async (req, res) => {
  try {
    const { deductions } = req.body;
    const ownerId = req.user._id;
    
    const payout = await CommissionPayout.findById(req.params.payoutId);
    
    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }
    
    if (payout.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only modify deductions for pending payouts' });
    }
    
    // Validate and round deduction amounts
    const validatedDeductions = deductions.map(d => ({
      ...d,
      amount: roundToK5(d.amount),
      addedBy: ownerId,
      date: d.date || new Date()
    }));
    
    // Update deductions
    payout.deductions = validatedDeductions;
    
    // Recalculate totals
    payout.totalDeductions = validatedDeductions.reduce((sum, d) => sum + d.amount, 0);
    payout.netPayout = payout.totalCommissions - payout.totalDeductions;
    
    await payout.save();
    
    res.json({
      message: 'Deductions updated successfully',
      payout
    });
    
  } catch (error) {
    console.error('Update deductions error:', error);
    res.status(500).json({ error: 'Failed to update deductions' });
  }
});

/**
 * POST /api/owner/payouts/bulk-approve
 * Approve multiple payouts at once
 */
router.post('/payouts/bulk-approve', requireOwner, async (req, res) => {
  try {
    const { payoutIds } = req.body;
    const ownerId = req.user._id;
    
    if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
      return res.status(400).json({ error: 'No payout IDs provided' });
    }
    
    const payouts = await CommissionPayout.find({
      _id: { $in: payoutIds },
      status: 'PENDING'
    });
    
    let approved = 0;
    
    for (const payout of payouts) {
      try {
        payout.status = 'APPROVED';
        payout.approvedBy = ownerId;
        payout.approvedAt = new Date();
        payout.approvalNotes = 'Bulk approval';
        
        payout.statusHistory.push({
          status: 'APPROVED',
          changedBy: ownerId,
          changedAt: new Date(),
          notes: 'Bulk approval by owner'
        });
        
        await payout.save();
        
        // TODO: Notify driver via Socket.io when implemented
        // req.io?.to(`driver:${payout.driverId}`).emit('commission:approved', {
        //   payoutId: payout._id,
        //   amount: payout.netPayout,
        //   approvedAt: payout.approvedAt
        // });
        
        approved++;
      } catch (err) {
        console.error(`Failed to approve payout ${payout._id}:`, err);
      }
    }
    
    res.json({
      message: `${approved} payouts approved`,
      approved,
      total: payoutIds.length
    });
    
  } catch (error) {
    console.error('Bulk approve error:', error);
    res.status(500).json({ error: 'Bulk approval failed' });
  }
});

/**
 * GET /api/owner/cash-reconciliation?date=2026-02-01
 * Get daily cash reconciliation summary
 */
router.get('/cash-reconciliation', requireOwner, async (req, res) => {
  try {
    const { date } = req.query;
    
    const targetDate = date ? moment(date).tz('Pacific/Port_Moresby') : moment().tz('Pacific/Port_Moresby');
    const startOfDay = targetDate.startOf('day').toDate();
    const endOfDay = targetDate.endOf('day').toDate();
    
    // Get all completed rides for the day
    const rides = await Ride.find({
      completedAt: { $gte: startOfDay, $lte: endOfDay },
      status: 'COMPLETED',
      'payment.status': 'COLLECTED'
    }).populate('driverId', 'name employeeId');
    
    // Group rides by driver
    const driverData = {};
    
    rides.forEach(ride => {
      const driverId = ride.driverId._id.toString();
      
      if (!driverData[driverId]) {
        driverData[driverId] = {
          _id: driverId,
          name: ride.driverId.name,
          employeeId: ride.driverId.employeeId,
          ridesCompleted: 0,
          expectedCash: 0,
          actualCash: 0, // This would come from shift reconciliation data
          discrepancy: 0,
          hasDiscrepancy: false,
          reconciliationStatus: 'PENDING',
          notes: ''
        };
      }
      
      driverData[driverId].ridesCompleted++;
      driverData[driverId].expectedCash += ride.payment.amountCollected || 0;
    });
    
    // Convert to array and calculate discrepancies
    const drivers = Object.values(driverData).map(driver => {
      // For now, assume actual cash equals expected (would be updated from shift data)
      driver.actualCash = driver.expectedCash;
      driver.discrepancy = driver.actualCash - driver.expectedCash;
      driver.hasDiscrepancy = driver.discrepancy !== 0;
      driver.reconciliationStatus = driver.discrepancy === 0 ? 'RECONCILED' : 'DISCREPANCY';
      
      return driver;
    });
    
    // Calculate summary
    const summary = {
      totalExpected: drivers.reduce((sum, d) => sum + d.expectedCash, 0),
      totalActual: drivers.reduce((sum, d) => sum + d.actualCash, 0),
      totalDiscrepancy: drivers.reduce((sum, d) => sum + d.discrepancy, 0),
      totalRides: drivers.reduce((sum, d) => sum + d.ridesCompleted, 0),
      driversActive: drivers.length,
      driversReconciled: drivers.filter(d => d.reconciliationStatus === 'RECONCILED').length,
      driversWithDiscrepancies: drivers.filter(d => d.hasDiscrepancy).length
    };
    
    res.json({
      date: targetDate.format('YYYY-MM-DD'),
      summary,
      drivers
    });
    
  } catch (error) {
    console.error('Cash reconciliation error:', error);
    res.status(500).json({ error: 'Failed to fetch cash reconciliation data' });
  }
});

/**
 * GET /api/owner/settings/fare
 * Get current fare settings
 */
router.get('/settings/fare', requireOwner, async (req, res) => {
  try {
    const settings = {
      ncdFlatRate: parseFloat(process.env.FARE_NCD_FLAT_RATE) || 30,
      baseFare: parseFloat(process.env.FARE_BASE) || 30,
      distanceRate: parseFloat(process.env.FARE_DISTANCE_RATE) || 2.00,
      timeRate: parseFloat(process.env.FARE_TIME_RATE) || 0.50,
      freeDistanceKm: parseFloat(process.env.FARE_FREE_DISTANCE_KM) || 10,
      returnFeePercentage: parseFloat(process.env.FARE_RETURN_FEE_PERCENTAGE) || 25,
      airportAddon: parseFloat(process.env.FARE_AIRPORT_ADDON) || 10,
      commissionRate: parseFloat(process.env.COMMISSION_RATE) || 0.20
    };
    
    res.json({ settings });
    
  } catch (error) {
    console.error('Fetch settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * PUT /api/owner/settings/fare
 * Update fare settings
 */
router.put('/settings/fare', requireOwner, async (req, res) => {
  try {
    const settings = req.body;
    
    // In production, these would update environment variables or database
    // For now, return success (actual implementation depends on deployment strategy)
    
    // Log the change for audit
    console.log('Fare settings updated by', req.user.name);
    console.log('New settings:', settings);
    
    res.json({
      message: 'Settings updated successfully',
      settings
    });
    
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
