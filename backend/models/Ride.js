const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  // Participants
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Client is required']
  },
  
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Ride Status Flow
  status: {
    type: String,
    enum: [
      'requested',      // Client has requested a ride
      'accepted',       // Driver has accepted the ride
      'driver-en-route', // Driver is on the way to pickup
      'arrived',        // Driver has arrived at pickup location
      'in-progress',    // Ride is in progress
      'completed',      // Ride completed successfully
      'cancelled'       // Ride was cancelled
    ],
    default: 'requested',
    required: true
  },
  
  // Cancellation Details
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  cancellationReason: {
    type: String,
    enum: [
      'client-cancelled',
      'driver-cancelled', 
      'no-driver-found',
      'payment-failed',
      'emergency',
      'other'
    ]
  },
  
  cancellationNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation notes cannot exceed 500 characters']
  },
  
  // Location Information
  pickup: {
    address: {
      type: String,
      required: [true, 'Pickup address is required'],
      trim: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    landmark: {
      type: String,
      trim: true
    }
  },
  
  destination: {
    address: {
      type: String,
      required: [true, 'Destination address is required'],
      trim: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    landmark: {
      type: String,
      trim: true
    }
  },
  
  // Distance and Duration
  estimatedDistance: {
    type: Number, // in kilometers
    required: true,
    min: [0, 'Distance cannot be negative']
  },
  
  actualDistance: {
    type: Number, // in kilometers
    min: [0, 'Distance cannot be negative']
  },
  
  estimatedDuration: {
    type: Number, // in minutes
    required: true,
    min: [0, 'Duration cannot be negative']
  },
  
  actualDuration: {
    type: Number, // in minutes
    min: [0, 'Duration cannot be negative']
  },
  
  // Pricing
  baseFare: {
    type: Number,
    required: true,
    min: [0, 'Base fare cannot be negative']
  },
  
  distanceFare: {
    type: Number,
    required: true,
    min: [0, 'Distance fare cannot be negative']
  },
  
  timeFare: {
    type: Number,
    default: 0,
    min: [0, 'Time fare cannot be negative']
  },
  
  surgePricing: {
    multiplier: {
      type: Number,
      default: 1,
      min: [1, 'Surge multiplier cannot be less than 1']
    },
    reason: {
      type: String,
      enum: ['high-demand', 'weather', 'event', 'peak-hours', 'none'],
      default: 'none'
    }
  },
  
  totalFare: {
    type: Number,
    required: true,
    min: [0, 'Total fare cannot be negative']
  },
  
  // Profit Calculation
  operationalCostPercentage: {
    type: Number,
    default: 20, // 20% operational cost
    min: [0, 'Operational cost percentage cannot be negative'],
    max: [100, 'Operational cost percentage cannot exceed 100']
  },
  
  profit: {
    type: Number,
    default: 0
  },
  
  // Referral Earnings (0.25% of profit for one year)
  referralEarnings: {
    amount: {
      type: Number,
      default: 0
    },
    referralCode: {
      type: String,
      uppercase: true
    },
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Driver Earnings
  driverEarnings: {
    type: Number,
    default: 0
  },
  
  // Company Commission (if driver belongs to a company)
  companyCommission: {
    amount: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Payment Information
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'mobile-money', 'wallet'],
    required: true
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  
  paymentReference: {
    type: String,
    trim: true
  },
  
  // Timestamps for ride lifecycle
  requestedAt: {
    type: Date,
    default: Date.now
  },
  
  acceptedAt: Date,
  
  driverEnRouteAt: Date,
  
  driverArrivedAt: Date,
  
  rideStartedAt: Date,
  
  rideCompletedAt: Date,
  
  cancelledAt: Date,
  
  // Rating and Feedback
  clientRating: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: [500, 'Feedback cannot exceed 500 characters']
    },
    ratedAt: Date
  },
  
  driverRating: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: [500, 'Feedback cannot exceed 500 characters']
    },
    ratedAt: Date
  },
  
  // Route Tracking
  route: [{
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    speed: Number, // km/h
    heading: Number // degrees
  }],
  
  // Special Requirements
  specialRequirements: [{
    type: String,
    enum: [
      'wheelchair-accessible',
      'child-seat',
      'pet-friendly',
      'large-luggage',
      'multiple-stops',
      'silent-ride'
    ]
  }],
  
  // Additional Stops
  additionalStops: [{
    address: {
      type: String,
      trim: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number] // [longitude, latitude]
      }
    },
    waitTime: {
      type: Number, // minutes
      default: 0
    },
    arrivedAt: Date,
    leftAt: Date
  }],
  
  // Metadata
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  
  // System flags
  isDisputed: {
    type: Boolean,
    default: false
  },
  
  disputeReason: {
    type: String,
    trim: true
  },
  
  isEmergency: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
rideSchema.index({ client: 1, createdAt: -1 });
rideSchema.index({ driver: 1, createdAt: -1 });
rideSchema.index({ status: 1 });
rideSchema.index({ 'pickup.coordinates': '2dsphere' });
rideSchema.index({ 'destination.coordinates': '2dsphere' });
rideSchema.index({ requestedAt: -1 });
rideSchema.index({ paymentStatus: 1 });
rideSchema.index({ 'referralEarnings.referrer': 1 });

// Virtual for ride duration in minutes
rideSchema.virtual('rideDuration').get(function() {
  if (this.rideStartedAt && this.rideCompletedAt) {
    return Math.round((this.rideCompletedAt - this.rideStartedAt) / (1000 * 60));
  }
  return null;
});

// Virtual for total wait time
rideSchema.virtual('totalWaitTime').get(function() {
  let waitTime = 0;
  
  // Wait time from request to start
  if (this.requestedAt && this.rideStartedAt) {
    waitTime += Math.round((this.rideStartedAt - this.requestedAt) / (1000 * 60));
  }
  
  // Additional stops wait time
  if (this.additionalStops && this.additionalStops.length > 0) {
    waitTime += this.additionalStops.reduce((total, stop) => total + (stop.waitTime || 0), 0);
  }
  
  return waitTime;
});

// Virtual for ride efficiency (actual vs estimated)
rideSchema.virtual('efficiency').get(function() {
  if (!this.actualDuration || !this.estimatedDuration) return null;
  
  return {
    timeEfficiency: Math.round((this.estimatedDuration / this.actualDuration) * 100),
    distanceEfficiency: this.actualDistance && this.estimatedDistance ? 
      Math.round((this.estimatedDistance / this.actualDistance) * 100) : null
  };
});

// Pre-save middleware to calculate profit and earnings
rideSchema.pre('save', function(next) {
  // Calculate profit
  if (this.totalFare && this.operationalCostPercentage) {
    this.profit = this.totalFare * (1 - this.operationalCostPercentage / 100);
  }
  
  // Calculate referral earnings (0.25% of profit)
  if (this.profit && this.referralEarnings.referrer) {
    this.referralEarnings.amount = this.profit * 0.0025;
  }
  
  // Calculate driver earnings (profit minus referral earnings and company commission)
  if (this.profit) {
    let driverShare = this.profit;
    
    // Subtract referral earnings
    if (this.referralEarnings.amount) {
      driverShare -= this.referralEarnings.amount;
    }
    
    // Subtract company commission
    if (this.companyCommission.amount) {
      driverShare -= this.companyCommission.amount;
    }
    
    this.driverEarnings = Math.max(0, driverShare);
  }
  
  next();
});

// Method to update ride status with timestamp
rideSchema.methods.updateStatus = function(newStatus, userId = null) {
  const validTransitions = {
    'requested': ['accepted', 'cancelled'],
    'accepted': ['driver-en-route', 'cancelled'],
    'driver-en-route': ['arrived', 'cancelled'],
    'arrived': ['in-progress', 'cancelled'],
    'in-progress': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': []
  };
  
  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }
  
  this.status = newStatus;
  
  // Set appropriate timestamp
  const now = new Date();
  switch (newStatus) {
    case 'accepted':
      this.acceptedAt = now;
      break;
    case 'driver-en-route':
      this.driverEnRouteAt = now;
      break;
    case 'arrived':
      this.driverArrivedAt = now;
      break;
    case 'in-progress':
      this.rideStartedAt = now;
      break;
    case 'completed':
      this.rideCompletedAt = now;
      this.paymentStatus = 'completed';
      break;
    case 'cancelled':
      this.cancelledAt = now;
      this.cancelledBy = userId;
      break;
  }
  
  return this.save();
};

// Method to add route point
rideSchema.methods.addRoutePoint = function(longitude, latitude, speed = null, heading = null) {
  this.route.push({
    coordinates: [longitude, latitude],
    timestamp: new Date(),
    speed,
    heading
  });
  
  return this.save();
};

// Method to calculate fare based on distance and time
rideSchema.statics.calculateFare = function(distance, duration, surgeMultiplier = 1) {
  const baseFare = 50; // Base fare in currency units
  const perKmRate = 25; // Rate per kilometer
  const perMinuteRate = 2; // Rate per minute
  
  const distanceFare = distance * perKmRate;
  const timeFare = duration * perMinuteRate;
  const subtotal = baseFare + distanceFare + timeFare;
  
  return {
    baseFare,
    distanceFare,
    timeFare,
    subtotal,
    surgeMultiplier,
    totalFare: Math.round(subtotal * surgeMultiplier)
  };
};

// Static method to get ride statistics
rideSchema.statics.getRideStats = function(startDate, endDate) {
  const matchStage = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalFare: { $sum: '$totalFare' },
        totalProfit: { $sum: '$profit' },
        avgDistance: { $avg: '$actualDistance' },
        avgDuration: { $avg: '$actualDuration' }
      }
    }
  ]);
};

// Static method to find rides by location
rideSchema.statics.findRidesByLocation = function(longitude, latitude, radius = 5000) {
  return this.find({
    $or: [
      {
        'pickup.coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: radius
          }
        }
      },
      {
        'destination.coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: radius
          }
        }
      }
    ]
  });
};

module.exports = mongoose.model('Ride', rideSchema);
