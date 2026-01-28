const mongoose = require('mongoose');

const driverProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true
  },
  
  license: {
    type: String,
    required: [true, 'Driver license is required'],
    trim: true,
    unique: true
  },
  
  status: {
    type: String,
    enum: ['APPLIED', 'VERIFIED', 'ASSIGNED_VEHICLE', 'ACTIVE', 'SUSPENDED', 'TERMINATED'],
    default: 'APPLIED',
    required: true
  },
  
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [147.1803, -9.4438] // Port Moresby default coordinates
    }
  },
  
  assignedVehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    default: null
  },
  
  isOnline: {
    type: Boolean,
    default: false
  },
  
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    default: 5.0
  },
  
  totalRides: {
    type: Number,
    default: 0,
    min: [0, 'Total rides cannot be negative']
  },
  
  totalEarnings: {
    type: Number,
    default: 0,
    min: [0, 'Total earnings cannot be negative']
  },
  
  // Commission rate based on rating
  commissionRate: {
    type: Number,
    min: [0.15, 'Commission rate cannot be less than 15%'],
    max: [0.30, 'Commission rate cannot be more than 30%'],
    default: 0.15
  },
  
  // Weekly salary (fixed amount)
  weeklySalary: {
    type: Number,
    default: 0,
    min: [0, 'Weekly salary cannot be negative']
  },
  
  // Last location update timestamp
  lastLocationUpdate: {
    type: Date,
    default: Date.now
  },
  
  // Driver availability schedule
  workingHours: {
    start: {
      type: String,
      default: '06:00' // 6 AM
    },
    end: {
      type: String,
      default: '22:00' // 10 PM
    }
  },
  
  // Emergency contact
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  
  // Documents and verification
  documents: {
    licensePhoto: String, // Cloudinary URL
    profilePhoto: String, // Cloudinary URL
    backgroundCheck: String, // Cloudinary URL
    medicalCertificate: String // Cloudinary URL
  },
  
  // Performance metrics
  performance: {
    averageResponseTime: { type: Number, default: 0 }, // in minutes
    completionRate: { type: Number, default: 100 }, // percentage
    cancellationRate: { type: Number, default: 0 }, // percentage
    customerRatingAverage: { type: Number, default: 5.0 },
    totalCustomerRatings: { type: Number, default: 0 }
  },
  
  // Status change history
  statusHistory: [{
    status: {
      type: String,
      enum: ['APPLIED', 'VERIFIED', 'ASSIGNED_VEHICLE', 'ACTIVE', 'SUSPENDED', 'TERMINATED']
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Suspension details
  suspension: {
    reason: String,
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    suspendedAt: Date,
    suspendedUntil: Date
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Geospatial index for location queries
driverProfileSchema.index({ currentLocation: '2dsphere' });

// Indexes for performance
driverProfileSchema.index({ userId: 1 });
driverProfileSchema.index({ status: 1 });
driverProfileSchema.index({ assignedVehicleId: 1 });
driverProfileSchema.index({ isOnline: 1 });
driverProfileSchema.index({ rating: -1 });
driverProfileSchema.index({ license: 1 });

// Compound indexes
driverProfileSchema.index({ status: 1, isOnline: 1 });
driverProfileSchema.index({ status: 1, assignedVehicleId: 1 });

// Virtual for user details
driverProfileSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for assigned vehicle details
driverProfileSchema.virtual('assignedVehicle', {
  ref: 'Vehicle',
  localField: 'assignedVehicleId',
  foreignField: '_id',
  justOne: true
});

// Virtual to check if driver can go online
driverProfileSchema.virtual('canGoOnline').get(function() {
  return this.status === 'ACTIVE' && this.assignedVehicleId !== null;
});

// Virtual to calculate commission rate based on rating
driverProfileSchema.virtual('calculatedCommissionRate').get(function() {
  if (this.rating < 4.2) return 0.15; // 15%
  if (this.rating < 4.6) return 0.20; // 20%
  if (this.rating < 4.8) return 0.25; // 25%
  return 0.30; // 30%
});

// Pre-save middleware to update commission rate based on rating
driverProfileSchema.pre('save', function(next) {
  // Update commission rate based on rating
  if (this.isModified('rating')) {
    this.commissionRate = this.calculatedCommissionRate;
  }
  
  // Update timestamp
  this.updatedAt = Date.now();
  
  // Update location timestamp if location changed
  if (this.isModified('currentLocation')) {
    this.lastLocationUpdate = Date.now();
  }
  
  next();
});

// Instance method to update location
driverProfileSchema.methods.updateLocation = function(longitude, latitude) {
  this.currentLocation = {
    type: 'Point',
    coordinates: [longitude, latitude]
  };
  this.lastLocationUpdate = Date.now();
  return this.save();
};

// Instance method to change status
driverProfileSchema.methods.changeStatus = function(newStatus, changedBy, reason) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  // Add to status history
  this.statusHistory.push({
    status: newStatus,
    changedBy: changedBy,
    reason: reason,
    timestamp: new Date()
  });
  
  // Handle suspension
  if (newStatus === 'SUSPENDED') {
    this.suspension = {
      reason: reason,
      suspendedBy: changedBy,
      suspendedAt: new Date()
    };
    this.isOnline = false; // Force offline when suspended
  }
  
  // Clear suspension when reactivated
  if (oldStatus === 'SUSPENDED' && newStatus === 'ACTIVE') {
    this.suspension = {};
  }
  
  return this.save();
};

// Instance method to assign vehicle
driverProfileSchema.methods.assignVehicle = function(vehicleId, assignedBy) {
  this.assignedVehicleId = vehicleId;
  
  // Update status if driver was verified
  if (this.status === 'VERIFIED') {
    this.status = 'ASSIGNED_VEHICLE';
  }
  
  // Add to status history
  this.statusHistory.push({
    status: 'ASSIGNED_VEHICLE',
    changedBy: assignedBy,
    reason: `Assigned vehicle ${vehicleId}`,
    timestamp: new Date()
  });
  
  return this.save();
};

// Instance method to go online
driverProfileSchema.methods.goOnline = function() {
  if (!this.canGoOnline) {
    throw new Error('Driver cannot go online. Must be ACTIVE status with assigned vehicle.');
  }
  
  this.isOnline = true;
  return this.save();
};

// Instance method to go offline
driverProfileSchema.methods.goOffline = function() {
  this.isOnline = false;
  return this.save();
};

// Instance method to update rating
driverProfileSchema.methods.updateRating = function(newRating) {
  const totalRatings = this.performance.totalCustomerRatings;
  const currentAverage = this.performance.customerRatingAverage;
  
  // Calculate new average
  const newAverage = ((currentAverage * totalRatings) + newRating) / (totalRatings + 1);
  
  this.performance.customerRatingAverage = newAverage;
  this.performance.totalCustomerRatings = totalRatings + 1;
  this.rating = newAverage;
  
  return this.save();
};

// Static method to find nearby available drivers
driverProfileSchema.statics.findNearbyAvailableDrivers = function(longitude, latitude, maxDistance = 5000) {
  return this.find({
    status: 'ACTIVE',
    isOnline: true,
    assignedVehicleId: { $ne: null },
    currentLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  }).populate('user assignedVehicle');
};

// Static method to find drivers by status
driverProfileSchema.statics.findByStatus = function(status) {
  return this.find({ status: status }).populate('user assignedVehicle');
};

// Static method to find online drivers
driverProfileSchema.statics.findOnlineDrivers = function() {
  return this.find({ 
    isOnline: true, 
    status: 'ACTIVE',
    assignedVehicleId: { $ne: null }
  }).populate('user assignedVehicle');
};

// Static method to get driver performance stats
driverProfileSchema.statics.getPerformanceStats = function() {
  return this.aggregate([
    {
      $match: { status: 'ACTIVE' }
    },
    {
      $group: {
        _id: null,
        totalDrivers: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        totalRides: { $sum: '$totalRides' },
        totalEarnings: { $sum: '$totalEarnings' },
        averageCommissionRate: { $avg: '$commissionRate' }
      }
    }
  ]);
};

module.exports = mongoose.model('DriverProfile', driverProfileSchema);
