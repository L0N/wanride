const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false
  },
  
  roles: [{
    type: String,
    enum: ['PASSENGER', 'DRIVER', 'DISPATCHER', 'OWNER'],
    required: true
  }],
  
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    default: 5.0
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // SMS OTP verification
  otpCode: {
    type: String,
    select: false
  },
  
  otpExpires: {
    type: Date,
    select: false
  },
  
  otpVerified: {
    type: Boolean,
    default: false
  },
  
  lastLogin: Date,
  
  // Security tracking
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: Date,
  
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
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.otpCode;
      delete ret.otpExpires;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ isVerified: 1, isActive: 1 });
userSchema.index({ rating: -1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for driver profile (populated separately)
userSchema.virtual('driverProfile', {
  ref: 'DriverProfile',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update timestamps
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Instance method to check if user has specific role
userSchema.methods.hasRole = function(role) {
  return this.roles.includes(role);
};

// Instance method to add role
userSchema.methods.addRole = function(role) {
  if (!this.roles.includes(role)) {
    this.roles.push(role);
  }
  return this;
};

// Instance method to remove role
userSchema.methods.removeRole = function(role) {
  this.roles = this.roles.filter(r => r !== role);
  return this;
};

// Instance method to handle failed login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Instance method to generate OTP
userSchema.methods.generateOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otpCode = otp;
  this.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return otp;
};

// Instance method to verify OTP
userSchema.methods.verifyOTP = function(otp) {
  if (!this.otpCode || !this.otpExpires) {
    return false;
  }
  
  if (this.otpExpires < new Date()) {
    return false;
  }
  
  if (this.otpCode !== otp) {
    return false;
  }
  
  this.otpVerified = true;
  this.isVerified = true;
  this.otpCode = undefined;
  this.otpExpires = undefined;
  
  return true;
};

// Static method to find users by role
userSchema.statics.findByRole = function(role) {
  return this.find({ roles: role, isActive: true, isVerified: true });
};

// Static method to find verified users
userSchema.statics.findVerified = function() {
  return this.find({ isVerified: true, isActive: true });
};

// Static method to find available dispatchers
userSchema.statics.findAvailableDispatchers = function() {
  return this.find({ 
    roles: 'DISPATCHER', 
    isActive: true, 
    isVerified: true 
  }).select('name email phone');
};

// Static method to find active drivers
userSchema.statics.findActiveDrivers = function() {
  return this.find({ 
    roles: 'DRIVER', 
    isActive: true, 
    isVerified: true 
  }).populate('driverProfile');
};

// Static method to find owners
userSchema.statics.findOwners = function() {
  return this.find({ 
    roles: 'OWNER', 
    isActive: true, 
    isVerified: true 
  }).select('name email phone');
};

module.exports = mongoose.model('User', userSchema);
