const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
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
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  
  // Role Management - Multi-role support as specified
  role: {
    type: String,
    enum: ['client', 'driver', 'company', 'admin'],
    required: [true, 'User role is required'],
    default: 'client'
  },
  
  // Role-specific Profile Data
  profile: {
    // Client Profile
    client: {
      firstName: String,
      lastName: String,
      referralCode: String,
      appliedReferral: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Referral'
      },
      totalRides: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 }
    },
    
    // Driver Profile
    driver: {
      firstName: String,
      lastName: String,
      license: String,
      documents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
      }],
      company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      isAvailable: { type: Boolean, default: false },
      currentLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
      },
      totalRides: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
      rating: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 }
      }
    },
    
    // Company Profile
    company: {
      businessRegNo: String,
      tinNumber: String,
      drivers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      totalDrivers: { type: Number, default: 0 },
      totalRides: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 }
    },
    
    // Admin Profile
    admin: {
      firstName: String,
      lastName: String,
      permissions: [String],
      lastLogin: Date
    }
  },
  
  // Verification Status
  isVerified: { type: Boolean, default: false },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Phone Verification
  phoneVerified: { type: Boolean, default: false },
  phoneVerificationCode: { type: String, select: false },
  phoneVerificationExpires: { type: Date, select: false },
  
  // Account Status
  isActive: { type: Boolean, default: true },
  isBlocked: { type: Boolean, default: false },
  
  // Referral System
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true
  },
  
  // Metadata
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ 'profile.driver.currentLocation': '2dsphere' });
userSchema.index({ verificationStatus: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  const profile = this.profile[this.role];
  if (profile && profile.firstName && profile.lastName) {
    return `${profile.firstName} ${profile.lastName}`;
  }
  return this.email;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to generate referral code
userSchema.pre('save', function(next) {
  if ((this.role === 'driver' || this.role === 'company') && !this.referralCode) {
    const prefix = this.role === 'driver' ? 'DRV' : 'CMP';
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.referralCode = `${prefix}${randomString}`;
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate phone verification code
userSchema.methods.generatePhoneVerificationCode = function() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.phoneVerificationCode = code;
  this.phoneVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return code;
};

// Method to update driver location
userSchema.methods.updateLocation = function(longitude, latitude) {
  if (this.role !== 'driver') {
    throw new Error('Only drivers can update location');
  }
  
  this.profile.driver.currentLocation = {
    type: 'Point',
    coordinates: [longitude, latitude]
  };
  
  return this.save();
};

// Static method to find nearby drivers
userSchema.statics.findNearbyDrivers = function(longitude, latitude, maxDistance = 5000) {
  return this.find({
    role: 'driver',
    'profile.driver.isAvailable': true,
    isActive: true,
    isBlocked: false,
    verificationStatus: 'approved',
    'profile.driver.currentLocation': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

module.exports = mongoose.model('User', userSchema);

