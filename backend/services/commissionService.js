const moment = require('moment-timezone');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { roundToK5, calculatePercentageK5 } = require('../utils/k5Rounding');

const PNG_TIMEZONE = 'Pacific/Port_Moresby';
const DEFAULT_COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE) || 0.20;

/**
 * Commission Calculation Service for WanRide PNG
 * 
 * Implements transparent commission tracking:
 * - 20% commission rate for all drivers
 * - K5 rounding on all commission amounts
 * - Weekly payout generation (Fridays 6pm PNG)
 * - Ride-by-ride breakdown for transparency
 * - Period-based commission queries
 */

/**
 * Calculate commission for a single ride
 * @param {Object} ride - Ride document
 * @returns {Object} Commission calculation details
 */
function calculateRideCommission(ride) {
  if (!ride.fareCalculation || !ride.fareCalculation.finalFare) {
    throw new Error('Ride must have fare calculation');
  }
  
  if (ride.payment.status !== 'COLLECTED') {
    throw new Error('Commission only calculated for collected payments');
  }
  
  const fare = ride.fareCalculation.finalFare; // Already K5-rounded
  const commissionRate = DEFAULT_COMMISSION_RATE;
  
  // Calculate commission using K5 rounding utility
  const commissionBeforeRounding = fare * commissionRate;
  const commission = roundToK5(commissionBeforeRounding);
  
  // Calculate company's net (what remains after commission)
  const netToCompany = fare - commission;
  
  return {
    rideId: ride._id,
    fare: fare,
    commissionRate: commissionRate,
    commissionBeforeRounding: parseFloat(commissionBeforeRounding.toFixed(2)),
    commission: commission,
    netToCompany: netToCompany,
    calculatedAt: new Date()
  };
}

/**
 * Calculate total commissions for a driver over a period
 * @param {ObjectId} driverId - Driver's user ID
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Object>} Commission summary
 */
async function calculateDriverCommissions(driverId, fromDate, toDate) {
  // Find all completed rides with collected payment in date range
  const rides = await Ride.find({
    driverId: driverId,
    status: 'COMPLETED',
    'payment.status': 'COLLECTED',
    'payment.collectedAt': { 
      $gte: fromDate, 
      $lte: toDate 
    }
  })
  .populate('passenger', 'name phone')
  .sort({ 'payment.collectedAt': 1 });
  
  if (rides.length === 0) {
    return {
      driverId,
      period: { from: fromDate, to: toDate },
      ridesCompleted: 0,
      totalFares: 0,
      totalCommissionsBeforeRounding: 0,
      totalCommissions: 0,
      netToCompany: 0,
      averageCommissionPerRide: 0,
      details: []
    };
  }
  
  let totalFares = 0;
  let totalCommissionsBeforeRounding = 0;
  const commissionDetails = [];
  
  // Calculate commission for each ride
  rides.forEach(ride => {
    const rideCommission = calculateRideCommission(ride);
    totalFares += rideCommission.fare;
    totalCommissionsBeforeRounding += rideCommission.commissionBeforeRounding;
    
    commissionDetails.push({
      rideId: ride._id,
      date: ride.payment.collectedAt,
      passenger: {
        name: ride.passenger.name,
        phone: ride.passenger.phone
      },
      fare: rideCommission.fare,
      commission: rideCommission.commission,
      pickup: ride.pickup.address,
      destination: ride.destination.address,
      fareMethod: ride.fareCalculation.method
    });
  });
  
  // Round total commission to K5
  const totalCommissions = roundToK5(totalCommissionsBeforeRounding);
  const netToCompany = totalFares - totalCommissions;
  const averageCommissionPerRide = rides.length > 0 ? roundToK5(totalCommissions / rides.length) : 0;
  
  return {
    driverId,
    period: { from: fromDate, to: toDate },
    ridesCompleted: rides.length,
    totalFares: totalFares,
    totalCommissionsBeforeRounding: parseFloat(totalCommissionsBeforeRounding.toFixed(2)),
    totalCommissions: totalCommissions,
    netToCompany: netToCompany,
    averageCommissionPerRide: averageCommissionPerRide,
    details: commissionDetails
  };
}

/**
 * Get current week's date range (Monday to Sunday PNG time)
 * @returns {Object} { from, to }
 */
function getCurrentWeekRange() {
  const now = moment().tz(PNG_TIMEZONE);
  const startOfWeek = now.clone().startOf('week').add(1, 'day'); // Monday
  const endOfWeek = now.clone().endOf('week').add(1, 'day'); // Sunday
  
  return {
    from: startOfWeek.toDate(),
    to: endOfWeek.toDate()
  };
}

/**
 * Get last week's date range (Monday to Sunday PNG time)
 * @returns {Object} { from, to }
 */
function getLastWeekRange() {
  const now = moment().tz(PNG_TIMEZONE);
  const startOfLastWeek = now.clone().subtract(1, 'week').startOf('week').add(1, 'day');
  const endOfLastWeek = now.clone().subtract(1, 'week').endOf('week').add(1, 'day');
  
  return {
    from: startOfLastWeek.toDate(),
    to: endOfLastWeek.toDate()
  };
}

/**
 * Get current month's date range
 * @returns {Object} { from, to }
 */
function getCurrentMonthRange() {
  const now = moment().tz(PNG_TIMEZONE);
  const startOfMonth = now.clone().startOf('month');
  const endOfMonth = now.clone().endOf('month');
  
  return {
    from: startOfMonth.toDate(),
    to: endOfMonth.toDate()
  };
}

/**
 * Get today's date range (PNG timezone)
 * @returns {Object} { from, to }
 */
function getTodayRange() {
  const now = moment().tz(PNG_TIMEZONE);
  const startOfDay = now.clone().startOf('day');
  const endOfDay = now.clone().endOf('day');
  
  return {
    from: startOfDay.toDate(),
    to: endOfDay.toDate()
  };
}

/**
 * Calculate commissions for all active drivers in a period
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Array>} Array of driver commission summaries
 */
async function calculateAllDriverCommissions(fromDate, toDate) {
  // Find all drivers who completed rides in the period
  const driversWithRides = await Ride.distinct('driverId', {
    status: 'COMPLETED',
    'payment.status': 'COLLECTED',
    'payment.collectedAt': { $gte: fromDate, $lte: toDate }
  });
  
  const commissionSummaries = [];
  
  for (const driverId of driversWithRides) {
    try {
      const summary = await calculateDriverCommissions(driverId, fromDate, toDate);
      if (summary.ridesCompleted > 0) {
        // Get driver details
        const driver = await User.findById(driverId).select('name email phone');
        summary.driver = driver;
        commissionSummaries.push(summary);
      }
    } catch (error) {
      console.error(`Error calculating commissions for driver ${driverId}:`, error);
    }
  }
  
  // Sort by total commissions (highest first)
  commissionSummaries.sort((a, b) => b.totalCommissions - a.totalCommissions);
  
  return commissionSummaries;
}

/**
 * Get commission statistics for a period
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Promise<Object>} Commission statistics
 */
async function getCommissionStatistics(fromDate, toDate) {
  const allCommissions = await calculateAllDriverCommissions(fromDate, toDate);
  
  const totalDrivers = allCommissions.length;
  const totalRides = allCommissions.reduce((sum, c) => sum + c.ridesCompleted, 0);
  const totalFares = allCommissions.reduce((sum, c) => sum + c.totalFares, 0);
  const totalCommissions = allCommissions.reduce((sum, c) => sum + c.totalCommissions, 0);
  const totalNetToCompany = totalFares - totalCommissions;
  
  const averageCommissionPerDriver = totalDrivers > 0 ? roundToK5(totalCommissions / totalDrivers) : 0;
  const averageRidesPerDriver = totalDrivers > 0 ? Math.round(totalRides / totalDrivers) : 0;
  
  return {
    period: { from: fromDate, to: toDate },
    totalDrivers,
    totalRides,
    totalFares,
    totalCommissions,
    totalNetToCompany,
    averageCommissionPerDriver,
    averageRidesPerDriver,
    commissionRate: DEFAULT_COMMISSION_RATE,
    topDrivers: allCommissions.slice(0, 5) // Top 5 earners
  };
}

/**
 * Validate commission calculation for a ride
 * @param {Object} ride - Ride document
 * @returns {Object} Validation result
 */
function validateCommissionCalculation(ride) {
  try {
    const commission = calculateRideCommission(ride);
    
    // Validate K5 rounding
    if (commission.commission % 5 !== 0) {
      return {
        valid: false,
        error: 'Commission amount is not K5-rounded',
        commission
      };
    }
    
    // Validate commission rate
    if (commission.commissionRate !== DEFAULT_COMMISSION_RATE) {
      return {
        valid: false,
        error: 'Commission rate does not match default rate',
        commission
      };
    }
    
    // Validate calculation
    const expectedCommission = roundToK5(commission.fare * DEFAULT_COMMISSION_RATE);
    if (commission.commission !== expectedCommission) {
      return {
        valid: false,
        error: 'Commission calculation is incorrect',
        commission,
        expected: expectedCommission
      };
    }
    
    return {
      valid: true,
      commission
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

module.exports = {
  calculateRideCommission,
  calculateDriverCommissions,
  calculateAllDriverCommissions,
  getCommissionStatistics,
  validateCommissionCalculation,
  getCurrentWeekRange,
  getLastWeekRange,
  getCurrentMonthRange,
  getTodayRange,
  DEFAULT_COMMISSION_RATE,
  PNG_TIMEZONE
};
