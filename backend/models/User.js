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
  
  // Role Management
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
      firstName: {
        type: String,
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
      },
      lastName: {
        type: String,
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
      },
      dateOfBirth: Date,
      referralCode: {
        type: String,
        trim: true,
        uppercase: true
      },
      appliedReferral: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Referral'
      },
      totalRides: {
        type: Number,
        default: 0
      },
      totalSpent: {
        type: Number,
        default: 0
      }
    },
    
    // Driver Profile
    driver: {
      firstName: {
        type: String,
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
      },
      lastName: {
        type: String,
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
      },
      dateOfBirth: Date,
      licenseNumber: {
        type: String,
        trim: true,
        uppercase: true
      },
      licenseExpiry: Date,
      vehicleInfo: {
        make: String,
        model: String,
        year: Number,
        color: String,
        plateNumber: {
          type: String,
          uppercase: true,
          trim: true
        }
      },
      documents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
      }],
      company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      isAvailable: {
        type: Boolean,
        default: false
      },
      currentLocation: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: [0, 0]
        }
      },
      totalRides: {
        type: Number,
        default: 0
      },
      totalEarnings: {
        type: Number,
        default: 0
      },
      rating: {
        average: {
          type: Number,
          default: 0,
          min: 0,
          max: 5
        },
        count: {
          type: Number,
          default: 0
        }
      }
    },
    
    // Company Profile
    company: {
      companyName: {
        type: String,
        trim: true,
        maxlength: [100, 'Company name cannot exceed 100 characters']
      },
      businessRegNo: {
        type: String,
        trim: true,
        uppercase: true
      },
      tinNumber: {
        type: String,
        trim: true,
        uppercase: true
      },
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
      },
      contactPerson: {
        firstName: String,
        lastName: String,
        position: String
      },
      drivers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      totalDrivers: {
        type: Number,
        default: 0
      },
      totalRides: {
        type: Number,
        default: 0
      },
      totalEarnings: {
        type: Number,
        default: 0
      }
    },
    
    // Admin Profile
    admin: {
      firstName: {
        type: String,
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
      },
      lastName: {
        type: String,
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
      },
      permissions: [{
        type: String,
        enum: [
          'read:users', 'write:users', 'delete:users',
          'read:rides', 'write:rides', 'delete:rides',
          'read:documents', 'write:documents', 'verify:documents',
          'read:referrals', 'write:referrals',
          'admin:system', 'admin:reports'
        ]
      }],
      lastLogin: Date
    }
  },
  
  // Verification Status
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  verificationNotes: {
    type: String,
    trim: true
  },
  
  // Phone Verification
  phoneVerified: {
    type: Boolean,
    default: false
  },
  
  phoneVerificationCode: {
    type: String,
    select: false
  },
  
  phoneVerificationExpires: {
    type: Date,
    select: false
  },
  
  // Email Verification
  emailVerified: {
    type: Boolean,
    default: false
  },
  
  emailVerificationToken: {
    type: String,
    select: false
  },
  
  // Password Reset
  passwordResetToken: {
    type: String,
    select: false
  },
  
  passwordResetExpires: {
    type: Date,
    select: false
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isBlocked: {
    type: Boolean,
    default: false
  },
  
  blockReason: {
    type: String,
    trim: true
  },
  
  // Referral System
  referralCode: {
    type: String,
    unique: true,
    sparse: true, // Only enforce uniqueness for non-null values
    uppercase: true,
    trim: true
  },
  
  // Metadata
  lastLogin: Date,
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
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
userSchema.index({ isActive: 1, isBlocked: 1 });

// Virtual for full name (works for all roles)
userSchema.virtual('fullName').get(function() {
  const profile = this.profile[this.role];
  if (profile && profile.firstName && profile.lastName) {
    return `${profile.firstName} ${profile.lastName}`;
  }
  if (this.role === 'company' && profile && profile.companyName) {
    return profile.companyName;
  }
  return this.email;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash password if it's modified
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

// Pre-save middleware to generate referral code for drivers and companies
userSchema.pre('save', function(next) {
  if ((this.role === 'driver' || this.role === 'company') && !this.referralCode) {
    // Generate unique referral code
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

// Method to verify phone code
userSchema.methods.verifyPhoneCode = function(code) {
  if (!this.phoneVerificationCode || !this.phoneVerificationExpires) {
    return false;
  }
  
  if (Date.now() > this.phoneVerificationExpires) {
    return false;
  }
  
  return this.phoneVerificationCode === code;
};

// Method to handle failed login attempts
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
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
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
        $maxDistance: maxDistance // meters
      }
    }
  });
};

// Static method to get user stats by role
userSchema.statics.getStatsByRole = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        verified: {
          $sum: {
            $cond: [{ $eq: ['$verificationStatus', 'approved'] }, 1, 0]
          }
        },
        active: {
          $sum: {
            $cond: [{ $and: ['$isActive', { $not: '$isBlocked' }] }, 1, 0]
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('User', userSchema);
