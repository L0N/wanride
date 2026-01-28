const mongoose = require('mongoose');

const rideRequestSchema = new mongoose.Schema({
  passengerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;     // latitude
        },
        message: 'Invalid coordinates format'
      }
    }
  },
  
  pickupAddress: {
    type: String,
    required: true,
    trim: true
  },
  
  dropoffLocation: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;     // latitude
        },
        message: 'Invalid coordinates format'
      }
    }
  },
  
  dropoffAddress: {
    type: String,
    required: true,
    trim: true
  },
  
  status: {
    type: String,
    enum: ['PENDING', 'ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  
  requestedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  assignedDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  
  assignedAt: {
    type: Date,
    default: null
  },
  
  acceptedAt: {
    type: Date,
    default: null
  },
  
  arrivedAt: {
    type: Date,
    default: null
  },
  
  startedAt: {
    type: Date,
    default: null
  },
  
  completedAt: {
    type: Date,
    default: null
  },
  
  cancelledAt: {
    type: Date,
    default: null
  },
  
  cancellationReason: {
    type: String,
    trim: true
  },
  
  estimatedDistance: {
    type: Number, // in meters
    required: true,
    min: 0
  },
  
  actualDistance: {
    type: Number, // in meters
    default: null,
    min: 0
  },
  
  estimatedDuration: {
    type: Number, // in minutes
    required: true,
    min: 0
  },
  
  actualDuration: {
    type: Number, // in minutes
    default: null,
    min: 0
  },
  
  estimatedFare: {
    type: Number, // in PGK
    required: true,
    min: 0
  },
  
  finalFare: {
    type: Number, // in PGK
    default: null,
    min: 0
  },
  
  paidAmount: {
    type: Number, // in PGK
    default: null,
    min: 0
  },
  
  paymentMethod: {
    type: String,
    enum: ['CASH', 'MOBILE_MONEY'],
    default: 'CASH'
  },
  
  dispatcherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  dispatchMethod: {
    type: String,
    enum: ['AUTO', 'MANUAL'],
    default: 'AUTO'
  },
  
  priority: {
    type: String,
    enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
    default: 'NORMAL'
  },
  
  specialRequests: {
    type: String,
    trim: true
  },
  
  passengerNotes: {
    type: String,
    trim: true
  },
  
  driverNotes: {
    type: String,
    trim: true
  },
  
  rating: {
    passenger: {
      type: Number,
      min: 1,
      max: 5
    },
    driver: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  feedback: {
    passenger: {
      type: String,
      trim: true
    },
    driver: {
      type: String,
      trim: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Geospatial indexes for location-based queries
rideRequestSchema.index({ pickupLocation: '2dsphere' });
rideRequestSchema.index({ dropoffLocation: '2dsphere' });

// Compound indexes for efficient queries
rideRequestSchema.index({ status: 1, requestedAt: -1 });
rideRequestSchema.index({ passengerId: 1, requestedAt: -1 });
rideRequestSchema.index({ assignedDriverId: 1, requestedAt: -1 });
rideRequestSchema.index({ dispatcherId: 1, requestedAt: -1 });

// Virtual for ride duration
rideRequestSchema.virtual('rideDuration').get(function() {
  if (this.startedAt && this.completedAt) {
    return Math.round((this.completedAt - this.startedAt) / (1000 * 60)); // minutes
  }
  return null;
});

// Virtual for total wait time
rideRequestSchema.virtual('waitTime').get(function() {
  if (this.requestedAt && this.startedAt) {
    return Math.round((this.startedAt - this.requestedAt) / (1000 * 60)); // minutes
  }
  return null;
});

// Virtual for response time (request to assignment)
rideRequestSchema.virtual('responseTime').get(function() {
  if (this.requestedAt && this.assignedAt) {
    return Math.round((this.assignedAt - this.requestedAt) / 1000); // seconds
  }
  return null;
});

// Pre-save middleware to update timestamps
rideRequestSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.isModified('status')) {
    switch (this.status) {
      case 'ASSIGNED':
        if (!this.assignedAt) this.assignedAt = now;
        break;
      case 'ACCEPTED':
        if (!this.acceptedAt) this.acceptedAt = now;
        break;
      case 'ARRIVED':
        if (!this.arrivedAt) this.arrivedAt = now;
        break;
      case 'IN_PROGRESS':
        if (!this.startedAt) this.startedAt = now;
        break;
      case 'COMPLETED':
        if (!this.completedAt) this.completedAt = now;
        break;
      case 'CANCELLED':
        if (!this.cancelledAt) this.cancelledAt = now;
        break;
    }
  }
  
  next();
});

// Static method to find pending rides
rideRequestSchema.statics.findPendingRides = function() {
  return this.find({ status: 'PENDING' })
    .populate('passengerId', 'name phone')
    .sort({ priority: -1, requestedAt: 1 });
};

// Static method to find active rides for a driver
rideRequestSchema.statics.findActiveRideForDriver = function(driverId) {
  return this.findOne({
    assignedDriverId: driverId,
    status: { $in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] }
  }).populate('passengerId', 'name phone');
};

// Static method to find rides near location
rideRequestSchema.statics.findRidesNearLocation = function(coordinates, maxDistance = 5000) {
  return this.find({
    status: 'PENDING',
    pickupLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance
      }
    }
  }).populate('passengerId', 'name phone');
};

module.exports = mongoose.model('RideRequest', rideRequestSchema);
