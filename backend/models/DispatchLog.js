const mongoose = require('mongoose');

const dispatchLogSchema = new mongoose.Schema({
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RideRequest',
    required: true,
    index: true
  },
  
  dispatcherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  action: {
    type: String,
    enum: [
      'AUTO_ASSIGN',
      'MANUAL_ASSIGN', 
      'REASSIGN',
      'CANCEL_ASSIGNMENT',
      'OVERRIDE_AUTO',
      'FORCE_COMPLETE',
      'EMERGENCY_REASSIGN'
    ],
    required: true,
    index: true
  },
  
  previousDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  newDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  reason: {
    type: String,
    required: true,
    trim: true
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  metadata: {
    // Additional context data
    nearbyDriversCount: {
      type: Number,
      default: null
    },
    
    averageResponseTime: {
      type: Number, // seconds
      default: null
    },
    
    driverDistance: {
      type: Number, // meters
      default: null
    },
    
    systemLoad: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: null
    },
    
    weatherConditions: {
      type: String,
      default: null
    },
    
    trafficConditions: {
      type: String,
      enum: ['LIGHT', 'MODERATE', 'HEAVY', 'SEVERE'],
      default: null
    },
    
    priorityOverride: {
      type: Boolean,
      default: false
    },
    
    emergencyFlag: {
      type: Boolean,
      default: false
    }
  },
  
  result: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'PARTIAL', 'CANCELLED'],
    default: 'SUCCESS'
  },
  
  errorMessage: {
    type: String,
    trim: true
  },
  
  processingTime: {
    type: Number, // milliseconds
    default: null
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
dispatchLogSchema.index({ rideId: 1, timestamp: -1 });
dispatchLogSchema.index({ dispatcherId: 1, timestamp: -1 });
dispatchLogSchema.index({ action: 1, timestamp: -1 });
dispatchLogSchema.index({ newDriverId: 1, timestamp: -1 });
dispatchLogSchema.index({ result: 1, timestamp: -1 });

// Index for analytics queries
dispatchLogSchema.index({ timestamp: -1, action: 1, result: 1 });

// Static method to log dispatch action
dispatchLogSchema.statics.logAction = function(actionData) {
  const {
    rideId,
    dispatcherId,
    action,
    previousDriverId = null,
    newDriverId = null,
    reason,
    metadata = {},
    result = 'SUCCESS',
    errorMessage = null,
    processingTime = null
  } = actionData;

  return this.create({
    rideId,
    dispatcherId,
    action,
    previousDriverId,
    newDriverId,
    reason,
    metadata,
    result,
    errorMessage,
    processingTime,
    timestamp: new Date()
  });
};

// Static method to get dispatch history for a ride
dispatchLogSchema.statics.getRideHistory = function(rideId) {
  return this.find({ rideId })
    .populate('dispatcherId', 'name')
    .populate('previousDriverId', 'name')
    .populate('newDriverId', 'name')
    .sort({ timestamp: 1 });
};

// Static method to get dispatcher activity
dispatchLogSchema.statics.getDispatcherActivity = function(dispatcherId, startDate, endDate) {
  const query = { dispatcherId };
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }
  
  return this.find(query)
    .populate('rideId', 'status estimatedFare')
    .populate('newDriverId', 'name')
    .sort({ timestamp: -1 });
};

// Static method to get dispatch analytics
dispatchLogSchema.statics.getDispatchAnalytics = function(startDate, endDate) {
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = startDate;
    if (endDate) matchStage.timestamp.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          action: '$action',
          result: '$result'
        },
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' },
        totalProcessingTime: { $sum: '$processingTime' }
      }
    },
    {
      $group: {
        _id: '$_id.action',
        results: {
          $push: {
            result: '$_id.result',
            count: '$count',
            avgProcessingTime: '$avgProcessingTime',
            totalProcessingTime: '$totalProcessingTime'
          }
        },
        totalCount: { $sum: '$count' }
      }
    },
    {
      $sort: { totalCount: -1 }
    }
  ]);
};

// Static method to get performance metrics
dispatchLogSchema.statics.getPerformanceMetrics = function(dispatcherId = null, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const matchStage = {
    timestamp: { $gte: startDate }
  };
  
  if (dispatcherId) {
    matchStage.dispatcherId = new mongoose.Types.ObjectId(dispatcherId);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          dispatcherId: '$dispatcherId'
        },
        totalActions: { $sum: 1 },
        successfulActions: {
          $sum: { $cond: [{ $eq: ['$result', 'SUCCESS'] }, 1, 0] }
        },
        failedActions: {
          $sum: { $cond: [{ $eq: ['$result', 'FAILED'] }, 1, 0] }
        },
        avgProcessingTime: { $avg: '$processingTime' },
        autoAssignments: {
          $sum: { $cond: [{ $eq: ['$action', 'AUTO_ASSIGN'] }, 1, 0] }
        },
        manualAssignments: {
          $sum: { $cond: [{ $eq: ['$action', 'MANUAL_ASSIGN'] }, 1, 0] }
        },
        reassignments: {
          $sum: { $cond: [{ $eq: ['$action', 'REASSIGN'] }, 1, 0] }
        }
      }
    },
    {
      $addFields: {
        successRate: {
          $multiply: [
            { $divide: ['$successfulActions', '$totalActions'] },
            100
          ]
        },
        manualOverrideRate: {
          $multiply: [
            { $divide: ['$manualAssignments', '$totalActions'] },
            100
          ]
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id.dispatcherId',
        foreignField: '_id',
        as: 'dispatcher'
      }
    },
    {
      $unwind: { path: '$dispatcher', preserveNullAndEmptyArrays: true }
    },
    {
      $sort: { '_id.date': -1, '_id.dispatcherId': 1 }
    }
  ]);
};

// Static method to detect patterns and anomalies
dispatchLogSchema.statics.detectAnomalies = function(hours = 24) {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);
  
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          hour: { $hour: '$timestamp' },
          action: '$action'
        },
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' },
        failureRate: {
          $avg: { $cond: [{ $eq: ['$result', 'FAILED'] }, 1, 0] }
        }
      }
    },
    {
      $match: {
        $or: [
          { failureRate: { $gt: 0.1 } }, // More than 10% failure rate
          { avgProcessingTime: { $gt: 5000 } }, // More than 5 seconds processing time
          { count: { $gt: 100 } } // More than 100 actions per hour
        ]
      }
    },
    {
      $sort: { '_id.hour': 1 }
    }
  ]);
};

module.exports = mongoose.model('DispatchLog', dispatchLogSchema);
