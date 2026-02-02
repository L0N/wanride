const cron = require('node-cron');
const moment = require('moment-timezone');
const CommissionPayout = require('../models/CommissionPayout');
const User = require('../models/User');
const { 
  calculateDriverCommissions, 
  getLastWeekRange 
} = require('../services/commissionService');

const PNG_TIMEZONE = 'Pacific/Port_Moresby';

/**
 * Weekly Payout Generation for WanRide PNG
 * 
 * Automatically generates commission payouts for all drivers:
 * - Runs every Friday at 6pm PNG time
 * - Calculates commissions for previous week (Monday-Sunday)
 * - Creates payout records with PENDING status
 * - Notifies owners via Socket.io
 * - Prevents duplicate payouts with unique constraints
 */

/**
 * Generate commission payouts for all drivers for the previous week
 * @param {Object} io - Socket.io instance for notifications
 * @returns {Promise<Object>} Generation result
 */
async function generateWeeklyPayouts(io) {
  console.log('\n=== Weekly Payout Generation Started ===');
  console.log(`Time: ${moment().tz(PNG_TIMEZONE).format('YYYY-MM-DD HH:mm:ss')} PNG`);
  
  try {
    // Get last week's date range (Monday - Sunday)
    const { from, to } = getLastWeekRange();
    
    const weekMoment = moment(from).tz(PNG_TIMEZONE);
    const weekNumber = weekMoment.week();
    const year = weekMoment.year();
    
    console.log(`Generating payouts for Week ${weekNumber}, ${year}`);
    console.log(`Period: ${moment(from).tz(PNG_TIMEZONE).format('MMM DD')} - ${moment(to).tz(PNG_TIMEZONE).format('MMM DD, YYYY')}`);
    
    // Find all active drivers
    const activeDrivers = await User.find({ 
      roles: 'DRIVER',
      // Add any additional filters for active drivers if needed
    }).select('_id name email phone');
    
    console.log(`Found ${activeDrivers.length} drivers to process`);
    
    let payoutsCreated = 0;
    let payoutsSkipped = 0;
    let totalCommissions = 0;
    const payoutNotifications = [];
    const errors = [];
    
    for (const driver of activeDrivers) {
      try {
        // Check if payout already exists for this period
        const existingPayout = await CommissionPayout.findOne({
          driverId: driver._id,
          'period.year': year,
          'period.weekNumber': weekNumber
        });
        
        if (existingPayout) {
          console.log(`⏭️  Payout already exists for ${driver.name} (Week ${weekNumber}, ${year})`);
          payoutsSkipped++;
          continue;
        }
        
        // Calculate commissions for this driver
        const commissionData = await calculateDriverCommissions(
          driver._id,
          from,
          to
        );
        
        // Only create payout if driver completed rides with collected payments
        if (commissionData.ridesCompleted > 0) {
          const payout = new CommissionPayout({
            driverId: driver._id,
            period: {
              from: from,
              to: to,
              weekNumber: weekNumber,
              year: year
            },
            rides: commissionData.details.map(d => d.rideId),
            ridesCount: commissionData.ridesCompleted,
            totalFares: commissionData.totalFares,
            totalCommissionsBeforeRounding: commissionData.totalCommissionsBeforeRounding,
            totalCommissions: commissionData.totalCommissions,
            deductions: [], // Owner can add deductions later
            totalDeductions: 0,
            netPayout: commissionData.totalCommissions,
            status: 'PENDING',
            generatedBy: 'AUTO',
            notes: `Auto-generated payout for Week ${weekNumber}, ${year}`
          });
          
          await payout.save();
          
          payoutsCreated++;
          totalCommissions += commissionData.totalCommissions;
          
          payoutNotifications.push({
            payoutId: payout._id,
            driverId: driver._id,
            driverName: driver.name,
            driverEmail: driver.email,
            amount: commissionData.totalCommissions,
            ridesCount: commissionData.ridesCompleted,
            period: {
              from: from,
              to: to,
              weekNumber: weekNumber,
              year: year
            }
          });
          
          console.log(`✅ Created payout for ${driver.name}: K${commissionData.totalCommissions} (${commissionData.ridesCompleted} rides)`);
        } else {
          console.log(`⏭️  No rides for ${driver.name}, skipping payout`);
          payoutsSkipped++;
        }
      } catch (driverError) {
        console.error(`❌ Error generating payout for driver ${driver.name} (${driver._id}):`, driverError.message);
        errors.push({
          driverId: driver._id,
          driverName: driver.name,
          error: driverError.message
        });
      }
    }
    
    console.log('\n=== Payout Generation Summary ===');
    console.log(`✅ Payouts created: ${payoutsCreated}`);
    console.log(`⏭️  Payouts skipped: ${payoutsSkipped}`);
    console.log(`💰 Total commissions: K${totalCommissions}`);
    console.log(`❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\nErrors encountered:');
      errors.forEach(error => {
        console.log(`  - ${error.driverName}: ${error.error}`);
      });
    }
    
    // Notify owners via Socket.io if payouts were created
    if (payoutsCreated > 0 && io) {
      const notification = {
        type: 'WEEKLY_PAYOUTS_GENERATED',
        weekNumber: weekNumber,
        year: year,
        period: { 
          from: from, 
          to: to,
          formatted: `${moment(from).tz(PNG_TIMEZONE).format('MMM DD')} - ${moment(to).tz(PNG_TIMEZONE).format('MMM DD, YYYY')}`
        },
        summary: {
          payoutsCreated: payoutsCreated,
          totalCommissions: totalCommissions,
          driversCount: payoutsCreated
        },
        payouts: payoutNotifications,
        generatedAt: new Date(),
        message: `${payoutsCreated} commission payouts ready for approval`
      };
      
      // Emit to owners and dispatchers
      io.to('owners').emit('commission:payouts:ready', notification);
      io.to('dispatchers').emit('commission:payouts:ready', notification);
      
      console.log(`📡 Notified owners and dispatchers of ${payoutsCreated} pending payouts`);
    }
    
    return {
      success: true,
      payoutsCreated: payoutsCreated,
      payoutsSkipped: payoutsSkipped,
      totalCommissions: totalCommissions,
      errors: errors,
      notifications: payoutNotifications
    };
    
  } catch (error) {
    console.error('❌ Weekly payout generation failed:', error);
    
    // Notify owners of failure
    if (io) {
      io.to('owners').emit('commission:payouts:error', {
        type: 'PAYOUT_GENERATION_FAILED',
        error: error.message,
        timestamp: new Date()
      });
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Schedule the weekly payout generation cron job
 * Runs every Friday at 18:00 (6pm) PNG time
 * @param {Object} io - Socket.io instance
 * @returns {Object} Cron job instance
 */
function scheduleWeeklyPayouts(io) {
  // Cron expression: '0 18 * * 5' = At 18:00 on Friday
  // PNG is UTC+10, so we need to account for timezone
  
  const cronExpression = '0 18 * * 5'; // 6pm every Friday
  
  const job = cron.schedule(cronExpression, async () => {
    console.log('\n🕕 Weekly Payout Generation Triggered by Cron Job');
    console.log(`Current PNG Time: ${moment().tz(PNG_TIMEZONE).format('YYYY-MM-DD HH:mm:ss')}`);
    
    await generateWeeklyPayouts(io);
  }, {
    timezone: PNG_TIMEZONE,
    scheduled: true
  });
  
  console.log('✅ Weekly payout generation scheduled for Fridays at 6pm PNG time');
  console.log(`Next run: ${moment().tz(PNG_TIMEZONE).day(5).hour(18).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss')} PNG`);
  
  return job;
}

/**
 * Manually trigger payout generation (for testing or manual runs)
 * @param {Object} io - Socket.io instance
 * @returns {Promise<Object>} Generation result
 */
async function manualPayoutGeneration(io) {
  console.log('🔧 Manual payout generation triggered');
  return await generateWeeklyPayouts(io);
}

/**
 * Get next scheduled payout generation time
 * @returns {Object} Next run information
 */
function getNextPayoutTime() {
  const now = moment().tz(PNG_TIMEZONE);
  let nextFriday = now.clone().day(5).hour(18).minute(0).second(0);
  
  // If it's past Friday 6pm this week, get next Friday
  if (nextFriday.isBefore(now)) {
    nextFriday.add(1, 'week');
  }
  
  return {
    nextRun: nextFriday.toDate(),
    formatted: nextFriday.format('YYYY-MM-DD HH:mm:ss'),
    fromNow: nextFriday.fromNow(),
    timezone: PNG_TIMEZONE
  };
}

/**
 * Get payout generation status and history
 * @returns {Promise<Object>} Status information
 */
async function getPayoutGenerationStatus() {
  try {
    // Get last week's range
    const { from, to } = getLastWeekRange();
    const weekMoment = moment(from).tz(PNG_TIMEZONE);
    const weekNumber = weekMoment.week();
    const year = weekMoment.year();
    
    // Check if payouts exist for last week
    const lastWeekPayouts = await CommissionPayout.find({
      'period.year': year,
      'period.weekNumber': weekNumber
    }).countDocuments();
    
    // Get recent payout generation stats
    const recentPayouts = await CommissionPayout.aggregate([
      {
        $group: {
          _id: {
            year: '$period.year',
            weekNumber: '$period.weekNumber'
          },
          count: { $sum: 1 },
          totalCommissions: { $sum: '$totalCommissions' },
          generatedAt: { $min: '$createdAt' }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.weekNumber': -1 }
      },
      {
        $limit: 5
      }
    ]);
    
    return {
      nextRun: getNextPayoutTime(),
      lastWeek: {
        weekNumber: weekNumber,
        year: year,
        payoutsGenerated: lastWeekPayouts,
        period: { from, to }
      },
      recentGenerations: recentPayouts
    };
    
  } catch (error) {
    console.error('Error getting payout generation status:', error);
    return {
      error: error.message
    };
  }
}

module.exports = {
  scheduleWeeklyPayouts,
  manualPayoutGeneration,
  generateWeeklyPayouts,
  getNextPayoutTime,
  getPayoutGenerationStatus
};
