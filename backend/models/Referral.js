const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  // Referral Code
  code: {
    type: String,
    required: [true, 'Referral code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [6, 'Referral code must be at least 6 characters'],
    maxlength: [12, 'Referral code cannot exceed 12 characters']
  },
  
  // Referrer Information
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Referrer is required']
  },
  
  referrerType: {
    type: String,
    enum: ['driver', 'company'],
    required: [true, 'Referrer type is required']
  },
  
  // Referral Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Expiry Information
  expiresAt: {
    type: Date,
    default: function() {
      // Default expiry: 1 year from creation
      return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }
  },
  
  // Usage Tracking
  appliedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    // Track the first ride that generated earnings
    firstRide: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride'
    },
    // Track when earnings started (from first ride)
    earningsStartDate: Date,
    // Track when earnings will end (1 year from first ride)
    earningsEndDate: Date,
    // Track if this referral is still earning
    isEarning: {
      type: Boolean,
      default: true
    }
  }],
  
  // Earnings Tracking
  totalEarnings: {
    type: Number,
    default: 0,
    min: [0, 'Total earnings cannot be negative']
  },
  
  // Monthly earnings breakdown
  monthlyEarnings: [{
    year: {
      type: Number,
      required: true
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Monthly earnings cannot be negative']
    },
    ridesCount: {
      type: Number,
      default: 0,
      min: [0, 'Rides count cannot be negative']
    }
  }],
  
  // Performance Metrics
  metrics: {
    totalApplications: {
      type: Number,
      default: 0
    },
    activeReferrals: {
      type: Number,
      default: 0
    },
    totalRidesGenerated: {
      type: Number,
      default: 0
    },
    averageEarningsPerReferral: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0 // Percentage of applications that resulted in rides
    }
  },
  
  // Referral Campaign Information (optional)
  campaign: {
    name: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    bonusMultiplier: {
      type: Number,
      default: 1,
      min: [1, 'Bonus multiplier cannot be less than 1']
    }
  },
  
  // Geographic restrictions (optional)
  geographicRestrictions: {
    allowedCities: [{
      type: String,
      trim: true
    }],
    allowedCountries: [{
      type: String,
      trim: true,
      uppercase: true
    }],
    restrictedAreas: [{
      name: String,
      coordinates: {
        type: {
          type: String,
          enum: ['Polygon'],
          default: 'Polygon'
        },
        coordinates: [[[Number]]] // GeoJSON Polygon format
      }
    }]
  },
  
  // Usage limits
  limits: {
    maxApplications: {
      type: Number,
      default: null // null means unlimited
    },
    maxEarningsPerMonth: {
      type: Number,
      default: null // null means unlimited
    },
    maxTotalEarnings: {
      type: Number,
      default: null // null means unlimited
    }
  },
  
  // Metadata
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  
  // System flags
  isPromotional: {
    type: Boolean,
    default: false
  },
  
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
referralSchema.index({ code: 1 });
referralSchema.index({ referrer: 1 });
referralSchema.index({ referrerType: 1 });
referralSchema.index({ isActive: 1 });
referralSchema.index({ expiresAt: 1 });
referralSchema.index({ 'appliedBy.user': 1 });
referralSchema.index({ 'appliedBy.appliedAt': -1 });
referralSchema.index({ totalEarnings: -1 });
referralSchema.index({ createdAt: -1 });

// Compound indexes
referralSchema.index({ referrer: 1, isActive: 1 });
referralSchema.index({ referrerType: 1, isActive: 1 });
referralSchema.index({ 'appliedBy.isEarning': 1, 'appliedBy.earningsEndDate': 1 });

// Virtual for active applications count
referralSchema.virtual('activeApplicationsCount').get(function() {
  return this.appliedBy.filter(app => app.isEarning).length;
});

// Virtual for expired applications count
referralSchema.virtual('expiredApplicationsCount').get(function() {
  return this.appliedBy.filter(app => !app.isEarning).length;
});

// Virtual for current month earnings
referralSchema.virtual('currentMonthEarnings').get(function() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const monthlyRecord = this.monthlyEarnings.find(
    record => record.year === currentYear && record.month === currentMonth
  );
  
  return monthlyRecord ? monthlyRecord.amount : 0;
});

// Virtual for earnings this year
referralSchema.virtual('yearlyEarnings').get(function() {
  const currentYear = new Date().getFullYear();
  return this.monthlyEarnings
    .filter(record => record.year === currentYear)
    .reduce((total, record) => total + record.amount, 0);
});

// Virtual for referral status
referralSchema.virtual('status').get(function() {
  const now = new Date();
  
  if (!this.isActive) return 'inactive';
  if (this.expiresAt && this.expiresAt < now) return 'expired';
  if (this.limits.maxApplications && this.appliedBy.length >= this.limits.maxApplications) return 'limit-reached';
  
  return 'active';
});

// Pre-save middleware to update metrics
referralSchema.pre('save', function(next) {
  // Update total applications
  this.metrics.totalApplications = this.appliedBy.length;
  
  // Update active referrals
  this.metrics.activeReferrals = this.appliedBy.filter(app => app.isEarning).length;
  
  // Calculate average earnings per referral
  if (this.metrics.activeReferrals > 0) {
    this.metrics.averageEarningsPerReferral = this.totalEarnings / this.metrics.activeReferrals;
  }
  
  next();
});

// Method to apply referral code
referralSchema.methods.applyReferral = function(userId) {
  // Check if referral is active and not expired
  if (!this.isActive) {
    throw new Error('Referral code is inactive');
  }
  
  if (this.expiresAt && this.expiresAt < new Date()) {
    throw new Error('Referral code has expired');
  }
  
  // Check if user has already applied this referral
  const existingApplication = this.appliedBy.find(
    app => app.user.toString() === userId.toString()
  );
  
  if (existingApplication) {
    throw new Error('User has already applied this referral code');
  }
  
  // Check application limits
  if (this.limits.maxApplications && this.appliedBy.length >= this.limits.maxApplications) {
    throw new Error('Referral code has reached maximum applications limit');
  }
  
  // Add new application
  this.appliedBy.push({
    user: userId,
    appliedAt: new Date(),
    isEarning: false // Will be set to true when first ride is completed
  });
  
  return this.save();
};

// Method to start earnings for a user (called when first ride is completed)
referralSchema.methods.startEarnings = function(userId, rideId) {
  const application = this.appliedBy.find(
    app => app.user.toString() === userId.toString()
  );
  
  if (!application) {
    throw new Error('User has not applied this referral code');
  }
  
  if (application.isEarning) {
    throw new Error('Earnings already started for this user');
  }
  
  const now = new Date();
  const earningsEndDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
  
  application.firstRide = rideId;
  application.earningsStartDate = now;
  application.earningsEndDate = earningsEndDate;
  application.isEarning = true;
  
  return this.save();
};

// Method to add earnings from a ride
referralSchema.methods.addEarnings = function(userId, amount, rideId) {
  const application = this.appliedBy.find(
    app => app.user.toString() === userId.toString()
  );
  
  if (!application) {
    throw new Error('User has not applied this referral code');
  }
  
  if (!application.isEarning) {
    throw new Error('Earnings not started for this user');
  }
  
  // Check if earnings period has expired
  if (application.earningsEndDate && application.earningsEndDate < new Date()) {
    application.isEarning = false;
    return this.save();
  }
  
  // Check monthly earnings limit
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  if (this.limits.maxEarningsPerMonth) {
    const monthlyRecord = this.monthlyEarnings.find(
      record => record.year === currentYear && record.month === currentMonth
    );
    
    const currentMonthEarnings = monthlyRecord ? monthlyRecord.amount : 0;
    
    if (currentMonthEarnings + amount > this.limits.maxEarningsPerMonth) {
      throw new Error('Monthly earnings limit exceeded');
    }
  }
  
  // Check total earnings limit
  if (this.limits.maxTotalEarnings && this.totalEarnings + amount > this.limits.maxTotalEarnings) {
    throw new Error('Total earnings limit exceeded');
  }
  
  // Add to total earnings
  this.totalEarnings += amount;
  
  // Update monthly earnings
  let monthlyRecord = this.monthlyEarnings.find(
    record => record.year === currentYear && record.month === currentMonth
  );
  
  if (!monthlyRecord) {
    monthlyRecord = {
      year: currentYear,
      month: currentMonth,
      amount: 0,
      ridesCount: 0
    };
    this.monthlyEarnings.push(monthlyRecord);
  }
  
  monthlyRecord.amount += amount;
  monthlyRecord.ridesCount += 1;
  
  // Update total rides generated
  this.metrics.totalRidesGenerated += 1;
  
  return this.save();
};

// Method to check if user can earn from referral
referralSchema.methods.canEarn = function(userId) {
  const application = this.appliedBy.find(
    app => app.user.toString() === userId.toString()
  );
  
  if (!application || !application.isEarning) {
    return false;
  }
  
  // Check if earnings period has expired
  if (application.earningsEndDate && application.earningsEndDate < new Date()) {
    return false;
  }
  
  return true;
};

// Static method to find active referrals by referrer
referralSchema.statics.findActiveByReferrer = function(referrerId) {
  return this.find({
    referrer: referrerId,
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

// Static method to get referral statistics
referralSchema.statics.getReferralStats = function(referrerId = null) {
  const matchStage = {};
  if (referrerId) {
    matchStage.referrer = new mongoose.Types.ObjectId(referrerId);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$referrerType',
        totalCodes: { $sum: 1 },
        activeCodes: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$isActive', true] },
                  {
                    $or: [
                      { $eq: ['$expiresAt', null] },
                      { $gt: ['$expiresAt', new Date()] }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        totalEarnings: { $sum: '$totalEarnings' },
        totalApplications: { $sum: '$metrics.totalApplications' },
        totalRides: { $sum: '$metrics.totalRidesGenerated' }
      }
    }
  ]);
};

// Static method to cleanup expired earnings
referralSchema.statics.cleanupExpiredEarnings = function() {
  const now = new Date();
  
  return this.updateMany(
    {
      'appliedBy.isEarning': true,
      'appliedBy.earningsEndDate': { $lt: now }
    },
    {
      $set: { 'appliedBy.$.isEarning': false }
    }
  );
};

// Static method to generate unique referral code
referralSchema.statics.generateUniqueCode = async function(prefix = '') {
  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!isUnique && attempts < maxAttempts) {
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    code = prefix ? `${prefix}${randomString}` : randomString;
    
    const existing = await this.findOne({ code });
    if (!existing) {
      isUnique = true;
    }
    
    attempts++;
  }
  
  if (!isUnique) {
    throw new Error('Unable to generate unique referral code');
  }
  
  return code;
};

module.exports = mongoose.model('Referral', referralSchema);
