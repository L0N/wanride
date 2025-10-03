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
  
  // Ride Status Flow as specified
  status: {
    type: String,
    enum: [
      'requested',      // Client has requested a ride
      'accepted',       // Driver has accepted the ride
      'driver-en-route', // Driver is on the way to pickup
      'in-progress',    // Ride is in progress
      'completed',      // Ride completed successfully
      'cancelled'       // Ride was cancelled
    ],
    default: 'requested',
    required: true
  },
  
  // Location Information
  pickup: {
    address: { type: String, required: true, trim: true },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }
    }
  },
  
  destination: {
    address: { type: String, required: true, trim: true },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }
    }
  },
  
  // Distance and Duration
  estimatedDistance: { type: Number, required: true, min: 0 },
  actualDistance: { type: Number, min: 0 },
  estimatedDuration: { type: Number, required: true, min: 0 },
  actualDuration: { type: Number, min: 0 },
  
  // Pricing and Profit Calculation
  baseFare: { type: Number, required: true, min: 0 },
  distanceFare: { type: Number, required: true, min: 0 },
  timeFare: { type: Number, default: 0, min: 0 },
  totalFare: { type: Number, required: true, min: 0 },
  
  // Profit Calculation as specified
  operationalCostPercentage: { type: Number, default: 20, min: 0, max: 100 },
  profit: { type: Number, default: 0 },
  
  // Referral Earnings (0.25% of profit for one year)
  referralEarnings: {
    amount: { type: Number, default: 0 },
    referralCode: String,
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Driver Earnings
  driverEarnings: { type: Number, default: 0 },
  
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
  
  // Timestamps for ride lifecycle
  requestedAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  driverEnRouteAt: Date,
  rideStartedAt: Date,
  rideCompletedAt: Date,
  cancelledAt: Date,
  
  // Rating and Feedback
  clientRating: {
    rating: { type: Number, min: 1, max: 5 },
    feedback: String,
    ratedAt: Date
  },
  
  driverRating: {
    rating: { type: Number, min: 1, max: 5 },
    feedback: String,
    ratedAt: Date
  },
  
  // Route Tracking
  route: [{
    coordinates: { type: [Number], required: true },
    timestamp: { type: Date, default: Date.now },
    speed: Number,
    heading: Number
  }],
  
  // Metadata
  notes: String,
  isDisputed: { type: Boolean, default: false },
  isEmergency: { type: Boolean, default: false }

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
rideSchema.index({ 'referralEarnings.referrer': 1 });

// Virtual for ride duration
rideSchema.virtual('rideDuration').get(function() {
  if (this.rideStartedAt && this.rideCompletedAt) {
    return Math.round((this.rideCompletedAt - this.rideStartedAt) / (1000 * 60));
  }
  return null;
});

// Pre-save middleware to calculate profit and earnings
rideSchema.pre('save', function(next) {
  // Calculate profit: Profit = Ride Fare - (Operational Cost %)
  if (this.totalFare && this.operationalCostPercentage) {
    this.profit = this.totalFare * (1 - this.operationalCostPercentage / 100);
  }
  
  // Calculate referral earnings (0.25% of profit)
  if (this.profit && this.referralEarnings.referrer) {
    this.referralEarnings.amount = this.profit * 0.0025;
  }
  
  // Calculate driver earnings (profit minus referral earnings)
  if (this.profit) {
    let driverShare = this.profit;
    if (this.referralEarnings.amount) {
      driverShare -= this.referralEarnings.amount;
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
    'driver-en-route': ['in-progress', 'cancelled'],
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
    case 'in-progress':
      this.rideStartedAt = now;
      break;
    case 'completed':
      this.rideCompletedAt = now;
      this.paymentStatus = 'completed';
      break;
    case 'cancelled':
      this.cancelledAt = now;
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

// Static method to calculate fare
rideSchema.statics.calculateFare = function(distance, duration, surgeMultiplier = 1) {
  const baseFare = 50; // Base fare
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

module.exports = mongoose.model('Ride', rideSchema);

