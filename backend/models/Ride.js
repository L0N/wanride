const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  // Core Ride Information - Private Fleet Model
  passengerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Passenger is required']
  },
  
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DriverProfile',
    required: [true, 'Driver is required']
  },
  
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: [true, 'Vehicle is required']
  },
  
  // Dispatcher who assigned the ride
  dispatcherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for auto-assigned rides
  },
  
  // Ride Status Management - Private Fleet Workflow
  status: {
    type: String,
    enum: [
      'REQUESTED',    // Passenger has requested a ride
      'ASSIGNED',     // Dispatcher has assigned driver
      'ARRIVED',      // Driver has arrived at pickup
      'IN_PROGRESS',  // Ride is in progress
      'COMPLETED',    // Ride completed successfully
      'CANCELLED'     // Ride was cancelled
    ],
    default: 'REQUESTED',
    required: true
  },
  
  // Location Information
  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Pickup coordinates are required']
    },
    address: {
      type: String,
      required: [true, 'Pickup address is required']
    }
  },
  
  dropoffLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Dropoff coordinates are required']
    },
    address: {
      type: String,
      required: [true, 'Dropoff address is required']
    }
  },
  
  // Distance and Fare - Cash-based with K5 rounding
  distance: {
    type: Number, // in kilometers
    required: [true, 'Distance is required'],
    min: [0, 'Distance cannot be negative']
  },
  
  fare: {
    type: Number, // Rounded to nearest K5
    required: [true, 'Fare is required'],
    min: [5, 'Minimum fare is K5']
  },
  
  // WEEK 1: Fare calculation details (from Phase 9 foundation)
  fareCalculation: {
    method: { 
      type: String, 
      enum: ['FLAT_NCD', 'FLAT_NCD_AIRPORT', 'DISTANCE_BASED'],
      required: true 
    },
    baseFare: { type: Number, required: true },
    distanceKm: Number,
    distanceCharge: Number,
    timeMinutes: Number,
    timeCharge: Number,
    subtotal: Number,
    baseFareRounded: Number,
    returnFee: Number,
    airportAddon: Number,
    finalFare: { type: Number, required: true }, // K5-rounded
    withinNCD: { type: Boolean, default: true },
    isAirportTrip: { type: Boolean, default: false },
    breakdown: String,
    calculatedAt: { type: Date, default: Date.now }
  },
  
  // WEEK 2: Comprehensive payment tracking
  payment: {
    status: { 
      type: String, 
      enum: ['PENDING', 'COLLECTED', 'DISPUTED', 'WAIVED', 'REFUNDED'],
      default: 'PENDING',
      required: true
    },
    
    // Payment amounts
    amountDue: { type: Number, required: true }, // Same as fareCalculation.finalFare
    amountCollected: Number, // Actual cash collected by driver
    
    // Payment metadata
    collectedAt: Date,
    collectedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    }, // Driver who collected
    confirmedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    }, // Dispatcher/Owner who verified (if needed)
    paymentMethod: {
      type: String,
      enum: ['CASH'], // Future: 'CARD', 'MOBILE_MONEY'
      default: 'CASH'
    },
    
    // Discrepancy tracking
    discrepancy: {
      exists: { type: Boolean, default: false },
      reportedAmount: Number, // What passenger claims they paid
      actualAmount: Number, // What driver collected
      difference: Number, // Calculated difference
      reason: String,
      reportedAt: Date,
      reportedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
      }, // Usually driver
      resolution: {
        status: {
          type: String,
          enum: ['PENDING', 'RESOLVED', 'ESCALATED', 'CLOSED'],
          default: 'PENDING'
        },
        resolvedBy: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'User' 
        },
        resolvedAt: Date,
        resolutionNotes: String,
        action: {
          type: String,
          enum: ['DRIVER_PAYS_DIFFERENCE', 'COMPANY_ABSORBS', 'PASSENGER_CONTACTED', 'NO_ACTION']
        }
      }
    },
    
    // Notes and metadata
    notes: String, // Driver notes about payment
    receiptNumber: String, // Unique receipt identifier
    receiptGenerated: { type: Boolean, default: false },
    receiptSentVia: [String], // ['SMS', 'EMAIL', 'WHATSAPP']
    
    // Audit trail
    statusHistory: [{
      status: String,
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: String
    }]
  },
  
  // Legacy payment fields (kept for backward compatibility)
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  
  paymentConfirmed: {
    type: Boolean,
    default: false
  },
  
  paymentConfirmedBy: {
    passenger: { type: Boolean, default: false },
    driver: { type: Boolean, default: false }
  },
  
  // Commission and Earnings
  driverCommission: {
    type: Number,
    default: 0,
    min: [0, 'Driver commission cannot be negative']
  },
  
  commissionRate: {
    type: Number,
    min: [0.15, 'Commission rate cannot be less than 15%'],
    max: [0.30, 'Commission rate cannot be more than 30%'],
    default: 0.15
  },
  
  // Timestamps for ride lifecycle
  timestamps: {
    requested: {
      type: Date,
      default: Date.now
    },
    assigned: Date,
    arrived: Date,
    started: Date,
    completed: Date,
    cancelled: Date
  },
  
  // Duration tracking
  duration: {
    estimatedMinutes: Number,
    actualMinutes: Number,
    waitingTimeMinutes: { type: Number, default: 0 }
  },
  
  // Rating System
  rating: {
    passengerRating: {
      score: { type: Number, min: 1, max: 5 },
      comment: String,
      timestamp: Date
    },
    driverRating: {
      score: { type: Number, min: 1, max: 5 },
      comment: String,
      timestamp: Date
    }
  },
  
  // Cancellation Information
  cancellation: {
    cancelledBy: {
      type: String,
      enum: ['PASSENGER', 'DRIVER', 'DISPATCHER', 'SYSTEM']
    },
    reason: String,
    timestamp: Date
  },
  
  // Special Features
  specialRequests: [String],
  
  // SOS and Safety
  sosTriggered: {
    type: Boolean,
    default: false
  },
  
  sosDetails: {
    triggeredBy: {
      type: String,
      enum: ['PASSENGER', 'DRIVER']
    },
    timestamp: Date,
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number]
    },
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
  },
  
  // Receipt Information
  receipt: {
    generated: {
      type: Boolean,
      default: false
    },
    emailSent: {
      type: Boolean,
      default: false
    },
    receiptNumber: String,
    generatedAt: Date
  },
  
  // System tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Geospatial indexes for location queries
rideSchema.index({ pickupLocation: '2dsphere' });
rideSchema.index({ dropoffLocation: '2dsphere' });

// Indexes for performance
rideSchema.index({ passengerId: 1 });
rideSchema.index({ driverId: 1 });
rideSchema.index({ vehicleId: 1 });
rideSchema.index({ dispatcherId: 1 });
rideSchema.index({ status: 1 });
rideSchema.index({ 'timestamps.requested': -1 });
rideSchema.index({ sosTriggered: 1 });

// Compound indexes for common queries
rideSchema.index({ passengerId: 1, status: 1 });
rideSchema.index({ driverId: 1, status: 1 });
rideSchema.index({ status: 1, 'timestamps.requested': -1 });
rideSchema.index({ dispatcherId: 1, status: 1 });

// WEEK 2: Payment-specific indexes
rideSchema.index({ 'payment.status': 1, 'timestamps.completed': -1 });
rideSchema.index({ 'payment.collectedBy': 1, 'payment.collectedAt': -1 });
rideSchema.index({ 'payment.receiptNumber': 1 });
rideSchema.index({ 'payment.discrepancy.exists': 1, 'payment.discrepancy.reportedAt': -1 });

// Virtual for passenger details
rideSchema.virtual('passenger', {
  ref: 'User',
  localField: 'passengerId',
  foreignField: '_id',
  justOne: true
});

// Virtual for driver details
rideSchema.virtual('driver', {
  ref: 'DriverProfile',
  localField: 'driverId',
  foreignField: '_id',
  justOne: true
});

// Virtual for vehicle details
rideSchema.virtual('vehicle', {
  ref: 'Vehicle',
  localField: 'vehicleId',
  foreignField: '_id',
  justOne: true
});

// Virtual for dispatcher details
rideSchema.virtual('dispatcher', {
  ref: 'User',
  localField: 'dispatcherId',
  foreignField: '_id',
  justOne: true
});

// Virtual for ride duration in minutes
rideSchema.virtual('rideDurationMinutes').get(function() {
  if (this.timestamps.completed && this.timestamps.started) {
    return Math.round((this.timestamps.completed - this.timestamps.started) / (1000 * 60));
  }
  return null;
});

// Virtual for total trip time (from request to completion)
rideSchema.virtual('totalTripTime').get(function() {
  if (this.timestamps.completed && this.timestamps.requested) {
    return Math.round((this.timestamps.completed - this.timestamps.requested) / (1000 * 60));
  }
  return null;
});

// Virtual for cash variance (expected vs actual)
rideSchema.virtual('cashVariance').get(function() {
  return this.paidAmount - this.fare;
});

// Pre-save middleware to calculate commission and round fare
rideSchema.pre('save', async function(next) {
  try {
    // Round fare to nearest K5
    if (this.isModified('fare')) {
      this.fare = Math.round(this.fare / 5) * 5;
      if (this.fare < 5) this.fare = 5; // Minimum fare K5
    }
    
    // WEEK 2: Set payment amountDue from fareCalculation
    if (this.fareCalculation && this.fareCalculation.finalFare && this.isModified('fareCalculation')) {
      this.payment.amountDue = this.fareCalculation.finalFare;
    }
    
    // Calculate driver commission based on rating
    if (this.isModified('fare') || this.isModified('commissionRate')) {
      this.driverCommission = this.fare * this.commissionRate;
    }
    
    // Generate receipt number if completed
    if (this.status === 'COMPLETED' && !this.receipt.receiptNumber) {
      this.receipt.receiptNumber = `WR${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      this.receipt.generated = true;
      this.receipt.generatedAt = new Date();
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to update ride status
rideSchema.methods.updateStatus = function(newStatus, updatedBy) {
  const validTransitions = {
    'REQUESTED': ['ASSIGNED', 'CANCELLED'],
    'ASSIGNED': ['ARRIVED', 'CANCELLED'],
    'ARRIVED': ['IN_PROGRESS', 'CANCELLED'],
    'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
    'COMPLETED': [], // Terminal state
    'CANCELLED': []  // Terminal state
  };
  
  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }
  
  this.status = newStatus;
  this.lastUpdatedBy = updatedBy;
  
  // Update timestamps
  const now = new Date();
  switch (newStatus) {
    case 'ASSIGNED':
      this.timestamps.assigned = now;
      break;
    case 'ARRIVED':
      this.timestamps.arrived = now;
      break;
    case 'IN_PROGRESS':
      this.timestamps.started = now;
      break;
    case 'COMPLETED':
      this.timestamps.completed = now;
      this.duration.actualMinutes = this.rideDurationMinutes;
      break;
    case 'CANCELLED':
      this.timestamps.cancelled = now;
      break;
  }
  
  return this.save();
};

// Instance method to assign driver
rideSchema.methods.assignDriver = function(driverId, vehicleId, dispatcherId) {
  if (this.status !== 'REQUESTED') {
    throw new Error('Can only assign driver to requested rides');
  }
  
  this.driverId = driverId;
  this.vehicleId = vehicleId;
  this.dispatcherId = dispatcherId;
  this.status = 'ASSIGNED';
  this.timestamps.assigned = new Date();
  this.lastUpdatedBy = dispatcherId;
  
  return this.save();
};

// Instance method to cancel ride
rideSchema.methods.cancelRide = function(cancelledBy, reason) {
  if (this.status === 'COMPLETED' || this.status === 'CANCELLED') {
    throw new Error('Cannot cancel completed or already cancelled rides');
  }
  
  this.status = 'CANCELLED';
  this.cancellation = {
    cancelledBy: cancelledBy,
    reason: reason,
    timestamp: new Date()
  };
  this.timestamps.cancelled = new Date();
  
  return this.save();
};

// Instance method to confirm payment
rideSchema.methods.confirmPayment = function(amount, confirmedBy) {
  if (this.status !== 'COMPLETED') {
    throw new Error('Can only confirm payment for completed rides');
  }
  
  this.paidAmount = amount;
  
  if (confirmedBy === 'PASSENGER') {
    this.paymentConfirmedBy.passenger = true;
  } else if (confirmedBy === 'DRIVER') {
    this.paymentConfirmedBy.driver = true;
  }
  
  // Payment is confirmed when both parties agree
  this.paymentConfirmed = this.paymentConfirmedBy.passenger && this.paymentConfirmedBy.driver;
  
  return this.save();
};

// Instance method to trigger SOS
rideSchema.methods.triggerSOS = function(triggeredBy, location) {
  this.sosTriggered = true;
  this.sosDetails = {
    triggeredBy: triggeredBy,
    timestamp: new Date(),
    location: {
      type: 'Point',
      coordinates: location
    },
    resolved: false
  };
  
  return this.save();
};

// Instance method to resolve SOS
rideSchema.methods.resolveSOS = function(resolvedBy) {
  if (!this.sosTriggered) {
    throw new Error('No SOS to resolve');
  }
  
  this.sosDetails.resolved = true;
  this.sosDetails.resolvedBy = resolvedBy;
  this.sosDetails.resolvedAt = new Date();
  
  return this.save();
};

// Instance method to add rating
rideSchema.methods.addRating = function(ratingType, score, comment, ratedBy) {
  if (this.status !== 'COMPLETED') {
    throw new Error('Can only rate completed rides');
  }
  
  const ratingData = {
    score: score,
    comment: comment,
    timestamp: new Date()
  };
  
  if (ratingType === 'PASSENGER') {
    if (this.rating.passengerRating.score) {
      throw new Error('Passenger rating already exists');
    }
    this.rating.passengerRating = ratingData;
  } else if (ratingType === 'DRIVER') {
    if (this.rating.driverRating.score) {
      throw new Error('Driver rating already exists');
    }
    this.rating.driverRating = ratingData;
  }
  
  this.lastUpdatedBy = ratedBy;
  
  return this.save();
};

// Static method to find rides by status
rideSchema.statics.findByStatus = function(status) {
  return this.find({ status: status })
    .populate('passenger', 'name email phone')
    .populate('driver')
    .populate('vehicle')
    .populate('dispatcher', 'name email')
    .sort({ 'timestamps.requested': -1 });
};

// Static method to find active rides for dispatcher
rideSchema.statics.findActiveRides = function() {
  return this.find({
    status: { $in: ['REQUESTED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS'] }
  })
  .populate('passenger', 'name phone')
  .populate('driver')
  .populate('vehicle')
  .sort({ 'timestamps.requested': -1 });
};

// Static method to find SOS alerts
rideSchema.statics.findSOSAlerts = function() {
  return this.find({
    sosTriggered: true,
    'sosDetails.resolved': false
  })
  .populate('passenger', 'name phone')
  .populate('driver')
  .populate('vehicle')
  .sort({ 'sosDetails.timestamp': -1 });
};

// Static method to calculate cash variance report
rideSchema.statics.getCashVarianceReport = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        status: 'COMPLETED',
        'timestamps.completed': {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: '$driverId',
        totalRides: { $sum: 1 },
        expectedCash: { $sum: '$fare' },
        actualCash: { $sum: '$paidAmount' },
        totalCommission: { $sum: '$driverCommission' },
        variance: { $sum: { $subtract: ['$paidAmount', '$fare'] } }
      }
    },
    {
      $lookup: {
        from: 'driverprofiles',
        localField: '_id',
        foreignField: '_id',
        as: 'driver'
      }
    }
  ]);
};

// WEEK 2: Instance method to generate receipt number
rideSchema.methods.generateReceiptNumber = function() {
  const moment = require('moment-timezone');
  const PNG_TIMEZONE = 'Pacific/Port_Moresby';
  
  const date = moment().tz(PNG_TIMEZONE).format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `WR-${date}-${random}`;
};

module.exports = mongoose.model('Ride', rideSchema);
