const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  // Referral Code
  code: {
    type: String,
    required: [true, 'Referral code is required'],
    unique: true,
    uppercase: true,
    trim: true
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
  isActive: { type: Boolean, default: true },
  
  // Usage Tracking - Applied by clients
  appliedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    appliedAt: { type: Date, default: Date.now },
    // Track when earnings started (from first ride)
    earningsStartDate: Date,
    // Track when earnings will end (1 year from first ride)
    earningsEndDate: Date,
    // Track if this referral is still earning
    isEarning: { type: Boolean, default: true }
  }],
  
  // Earnings Tracking
  totalEarnings: { type: Number, default: 0, min: 0 },
  
  // Monthly earnings breakdown
  monthlyEarnings: [{
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    amount: { type: Number, default: 0, min: 0 },
    ridesCount: { type: Number, default: 0, min: 0 }
  }],
  
  // Performance Metrics
  metrics: {
    totalApplications: { type: Number, default: 0 },
    activeReferrals: { type: Number, default: 0 },
    totalRidesGenerated: { type: Number, default: 0 },
    averageEarningsPerReferral: { type: Number, default: 0 }
  },
  
  // Metadata
  notes: String,
  
  // System flags
  isPromotional: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false }

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
referralSchema.index({ 'appliedBy.user': 1 });
referralSchema.index({ totalEarnings: -1 });

// Virtual for active applications count
referralSchema.virtual('activeApplicationsCount').get(function() {
  return this.appliedBy.filter(app => app.isEarning).length;
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

// Pre-save middleware to update metrics
referralSchema.pre('save', function(next) {
  this.metrics.totalApplications = this.appliedBy.length;
  this.metrics.activeReferrals = this.appliedBy.filter(app => app.isEarning).length;
  
  if (this.metrics.activeReferrals > 0) {
    this.metrics.averageEarningsPerReferral = this.totalEarnings / this.metrics.activeReferrals;
  }
  
  next();
});

// Method to apply referral code
referralSchema.methods.applyReferral = function(userId) {
  if (!this.isActive) {
    throw new Error('Referral code is inactive');
  }
  
  // Check if user has already applied this referral
  const existingApplication = this.appliedBy.find(
    app => app.user.toString() === userId.toString()
  );
  
  if (existingApplication) {
    throw new Error('User has already applied this referral code');
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
  
  // Add to total earnings
  this.totalEarnings += amount;
  
  // Update monthly earnings
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
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
    isActive: true
  });
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

