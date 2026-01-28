const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  plate: {
    type: String,
    required: [true, 'Vehicle plate number is required'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9\s-]+$/, 'Please enter a valid plate number']
  },
  
  model: {
    type: String,
    required: [true, 'Vehicle model is required'],
    trim: true,
    maxlength: [100, 'Vehicle model cannot exceed 100 characters']
  },
  
  vin: {
    type: String,
    required: [true, 'Vehicle VIN is required'],
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [17, 'VIN must be exactly 17 characters'],
    maxlength: [17, 'VIN must be exactly 17 characters']
  },
  
  status: {
    type: String,
    enum: ['ACTIVE', 'MAINTENANCE', 'RETIRED'],
    default: 'ACTIVE',
    required: true
  },
  
  assignedDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DriverProfile',
    default: null
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
  
  lastServiceDate: {
    type: Date,
    default: null
  },
  
  nextServiceDate: {
    type: Date,
    default: null
  },
  
  // Vehicle details
  details: {
    make: {
      type: String,
      required: [true, 'Vehicle make is required'],
      trim: true
    },
    year: {
      type: Number,
      required: [true, 'Vehicle year is required'],
      min: [1990, 'Vehicle year must be 1990 or later'],
      max: [new Date().getFullYear() + 1, 'Vehicle year cannot be in the future']
    },
    color: {
      type: String,
      required: [true, 'Vehicle color is required'],
      trim: true
    },
    fuelType: {
      type: String,
      enum: ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC'],
      default: 'PETROL'
    },
    transmission: {
      type: String,
      enum: ['MANUAL', 'AUTOMATIC'],
      default: 'MANUAL'
    },
    seats: {
      type: Number,
      required: [true, 'Number of seats is required'],
      min: [2, 'Vehicle must have at least 2 seats'],
      max: [8, 'Vehicle cannot have more than 8 seats'],
      default: 4
    }
  },
  
  // Registration and insurance
  registration: {
    number: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      trim: true
    },
    expiryDate: {
      type: Date,
      required: [true, 'Registration expiry date is required']
    },
    isValid: {
      type: Boolean,
      default: true
    }
  },
  
  insurance: {
    provider: {
      type: String,
      required: [true, 'Insurance provider is required'],
      trim: true
    },
    policyNumber: {
      type: String,
      required: [true, 'Insurance policy number is required'],
      trim: true
    },
    expiryDate: {
      type: Date,
      required: [true, 'Insurance expiry date is required']
    },
    isValid: {
      type: Boolean,
      default: true
    }
  },
  
  // Maintenance tracking
  maintenance: {
    odometer: {
      type: Number,
      default: 0,
      min: [0, 'Odometer reading cannot be negative']
    },
    lastOdometerUpdate: {
      type: Date,
      default: Date.now
    },
    serviceInterval: {
      type: Number,
      default: 10000 // kilometers
    },
    nextServiceOdometer: {
      type: Number,
      default: 10000
    }
  },
  
  // Performance metrics
  performance: {
    totalRides: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 }, // in kilometers
    totalRevenue: { type: Number, default: 0 },
    averageRating: { type: Number, default: 5.0 },
    totalRatings: { type: Number, default: 0 }
  },
  
  // Maintenance history
  maintenanceHistory: [{
    type: {
      type: String,
      enum: ['ROUTINE_SERVICE', 'REPAIR', 'INSPECTION', 'ACCIDENT_REPAIR', 'OTHER'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    cost: {
      type: Number,
      required: true,
      min: [0, 'Maintenance cost cannot be negative']
    },
    odometerReading: Number,
    performedBy: String,
    performedAt: {
      type: Date,
      default: Date.now
    },
    nextServiceDue: Date,
    documents: [String] // Cloudinary URLs for receipts/reports
  }],
  
  // Status change history
  statusHistory: [{
    status: {
      type: String,
      enum: ['ACTIVE', 'MAINTENANCE', 'RETIRED']
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
  
  // Assignment history
  assignmentHistory: [{
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriverProfile'
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    unassignedAt: Date,
    reason: String
  }],
  
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
vehicleSchema.index({ currentLocation: '2dsphere' });

// Indexes for performance
vehicleSchema.index({ plate: 1 });
vehicleSchema.index({ vin: 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ assignedDriverId: 1 });
vehicleSchema.index({ 'registration.number': 1 });
vehicleSchema.index({ 'registration.expiryDate': 1 });
vehicleSchema.index({ 'insurance.expiryDate': 1 });

// Compound indexes
vehicleSchema.index({ status: 1, assignedDriverId: 1 });

// Virtual for assigned driver details
vehicleSchema.virtual('assignedDriver', {
  ref: 'DriverProfile',
  localField: 'assignedDriverId',
  foreignField: '_id',
  justOne: true
});

// Virtual to check if vehicle is available for assignment
vehicleSchema.virtual('isAvailableForAssignment').get(function() {
  return this.status === 'ACTIVE' && this.assignedDriverId === null;
});

// Virtual to check if registration is expired
vehicleSchema.virtual('isRegistrationExpired').get(function() {
  return this.registration.expiryDate < new Date();
});

// Virtual to check if insurance is expired
vehicleSchema.virtual('isInsuranceExpired').get(function() {
  return this.insurance.expiryDate < new Date();
});

// Virtual to check if service is due
vehicleSchema.virtual('isServiceDue').get(function() {
  if (this.nextServiceDate && this.nextServiceDate < new Date()) {
    return true;
  }
  if (this.maintenance.nextServiceOdometer && this.maintenance.odometer >= this.maintenance.nextServiceOdometer) {
    return true;
  }
  return false;
});

// Virtual for vehicle display name
vehicleSchema.virtual('displayName').get(function() {
  return `${this.details.year} ${this.details.make} ${this.model} (${this.plate})`;
});

// Pre-save middleware to update timestamps and validations
vehicleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Update registration validity
  this.registration.isValid = !this.isRegistrationExpired;
  
  // Update insurance validity
  this.insurance.isValid = !this.isInsuranceExpired;
  
  // Auto-set status to MAINTENANCE if service is overdue
  if (this.isServiceDue && this.status === 'ACTIVE') {
    this.status = 'MAINTENANCE';
    this.statusHistory.push({
      status: 'MAINTENANCE',
      reason: 'Service overdue - automatically set to maintenance',
      timestamp: new Date()
    });
  }
  
  next();
});

// Instance method to assign driver
vehicleSchema.methods.assignDriver = function(driverId, assignedBy) {
  if (this.status !== 'ACTIVE') {
    throw new Error('Vehicle must be ACTIVE to assign a driver');
  }
  
  if (this.assignedDriverId) {
    throw new Error('Vehicle is already assigned to a driver');
  }
  
  // End previous assignment if exists
  if (this.assignmentHistory.length > 0) {
    const lastAssignment = this.assignmentHistory[this.assignmentHistory.length - 1];
    if (!lastAssignment.unassignedAt) {
      lastAssignment.unassignedAt = new Date();
      lastAssignment.reason = 'Reassigned to new driver';
    }
  }
  
  this.assignedDriverId = driverId;
  
  // Add to assignment history
  this.assignmentHistory.push({
    driverId: driverId,
    assignedBy: assignedBy,
    assignedAt: new Date()
  });
  
  return this.save();
};

// Instance method to unassign driver
vehicleSchema.methods.unassignDriver = function(reason) {
  if (!this.assignedDriverId) {
    throw new Error('Vehicle is not assigned to any driver');
  }
  
  // End current assignment
  if (this.assignmentHistory.length > 0) {
    const lastAssignment = this.assignmentHistory[this.assignmentHistory.length - 1];
    if (!lastAssignment.unassignedAt) {
      lastAssignment.unassignedAt = new Date();
      lastAssignment.reason = reason || 'Driver unassigned';
    }
  }
  
  this.assignedDriverId = null;
  
  return this.save();
};

// Instance method to change status
vehicleSchema.methods.changeStatus = function(newStatus, changedBy, reason) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  // Add to status history
  this.statusHistory.push({
    status: newStatus,
    changedBy: changedBy,
    reason: reason,
    timestamp: new Date()
  });
  
  // If setting to maintenance or retired, unassign driver
  if ((newStatus === 'MAINTENANCE' || newStatus === 'RETIRED') && this.assignedDriverId) {
    this.unassignDriver(`Vehicle status changed to ${newStatus}`);
  }
  
  return this.save();
};

// Instance method to add maintenance record
vehicleSchema.methods.addMaintenanceRecord = function(maintenanceData) {
  this.maintenanceHistory.push(maintenanceData);
  
  // Update last service date
  this.lastServiceDate = maintenanceData.performedAt || new Date();
  
  // Update odometer if provided
  if (maintenanceData.odometerReading) {
    this.maintenance.odometer = maintenanceData.odometerReading;
    this.maintenance.lastOdometerUpdate = new Date();
    this.maintenance.nextServiceOdometer = maintenanceData.odometerReading + this.maintenance.serviceInterval;
  }
  
  // Update next service date if provided
  if (maintenanceData.nextServiceDue) {
    this.nextServiceDate = maintenanceData.nextServiceDue;
  }
  
  // If maintenance is complete and vehicle was in maintenance, set back to active
  if (this.status === 'MAINTENANCE' && maintenanceData.type === 'ROUTINE_SERVICE') {
    this.status = 'ACTIVE';
    this.statusHistory.push({
      status: 'ACTIVE',
      reason: 'Maintenance completed',
      timestamp: new Date()
    });
  }
  
  return this.save();
};

// Instance method to update location
vehicleSchema.methods.updateLocation = function(longitude, latitude) {
  this.currentLocation = {
    type: 'Point',
    coordinates: [longitude, latitude]
  };
  return this.save();
};

// Static method to find available vehicles
vehicleSchema.statics.findAvailable = function() {
  return this.find({
    status: 'ACTIVE',
    assignedDriverId: null,
    'registration.isValid': true,
    'insurance.isValid': true
  });
};

// Static method to find vehicles by status
vehicleSchema.statics.findByStatus = function(status) {
  return this.find({ status: status }).populate('assignedDriver');
};

// Static method to find vehicles needing service
vehicleSchema.statics.findNeedingService = function() {
  const now = new Date();
  return this.find({
    $or: [
      { nextServiceDate: { $lte: now } },
      { $expr: { $gte: ['$maintenance.odometer', '$maintenance.nextServiceOdometer'] } }
    ]
  }).populate('assignedDriver');
};

// Static method to find vehicles with expired documents
vehicleSchema.statics.findWithExpiredDocuments = function() {
  const now = new Date();
  return this.find({
    $or: [
      { 'registration.expiryDate': { $lte: now } },
      { 'insurance.expiryDate': { $lte: now } }
    ]
  }).populate('assignedDriver');
};

// Static method to get fleet statistics
vehicleSchema.statics.getFleetStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRides: { $sum: '$performance.totalRides' },
        totalRevenue: { $sum: '$performance.totalRevenue' },
        averageRating: { $avg: '$performance.averageRating' }
      }
    }
  ]);
};

module.exports = mongoose.model('Vehicle', vehicleSchema);
