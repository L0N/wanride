const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  // Session Identification
  sessionId: {
    type: String,
    required: [true, 'Session ID is required'],
    unique: true,
    index: true
  },
  
  // User Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  
  // JWT Token Information
  accessToken: {
    type: String,
    required: [true, 'Access token is required'],
    select: false // Don't include in queries by default for security
  },
  
  refreshToken: {
    type: String,
    required: [true, 'Refresh token is required'],
    select: false // Don't include in queries by default for security
  },
  
  tokenType: {
    type: String,
    default: 'Bearer',
    enum: ['Bearer']
  },
  
  // Token Expiry
  accessTokenExpiresAt: {
    type: Date,
    required: [true, 'Access token expiry is required'],
    index: true
  },
  
  refreshTokenExpiresAt: {
    type: Date,
    required: [true, 'Refresh token expiry is required'],
    index: true
  },
  
  // Session Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  isRevoked: {
    type: Boolean,
    default: false,
    index: true
  },
  
  revokedAt: Date,
  
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  revocationReason: {
    type: String,
    enum: [
      'user-logout',
      'admin-revoke',
      'security-breach',
      'password-change',
      'account-deactivation',
      'token-refresh',
      'expired',
      'other'
    ]
  },
  
  // Device and Location Information
  deviceInfo: {
    userAgent: {
      type: String,
      trim: true
    },
    browser: {
      name: String,
      version: String
    },
    os: {
      name: String,
      version: String
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown'
    },
    platform: String,
    isMobile: {
      type: Boolean,
      default: false
    }
  },
  
  // IP and Location Tracking
  ipAddress: {
    type: String,
    required: [true, 'IP address is required'],
    trim: true
  },
  
  location: {
    country: String,
    countryCode: String,
    region: String,
    city: String,
    timezone: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    isp: String
  },
  
  // Security Information
  loginMethod: {
    type: String,
    enum: ['email-password', 'phone-otp', 'social-google', 'social-facebook', 'admin-impersonate'],
    required: [true, 'Login method is required']
  },
  
  twoFactorUsed: {
    type: Boolean,
    default: false
  },
  
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  riskFactors: [{
    type: String,
    enum: [
      'new-device',
      'new-location',
      'suspicious-ip',
      'multiple-failed-attempts',
      'unusual-time',
      'tor-network',
      'vpn-detected',
      'high-velocity'
    ]
  }],
  
  // Session Activity
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  activityCount: {
    type: Number,
    default: 1,
    min: 0
  },
  
  // Activity Log (last 10 activities)
  recentActivities: [{
    action: {
      type: String,
      enum: [
        'login',
        'api-call',
        'page-view',
        'data-access',
        'profile-update',
        'password-change',
        'logout',
        'token-refresh'
      ]
    },
    endpoint: String,
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    responseStatus: Number,
    duration: Number // in milliseconds
  }],
  
  // Session Metadata
  loginAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  logoutAt: Date,
  
  duration: {
    type: Number, // in seconds
    default: 0
  },
  
  // Concurrent Sessions Control
  maxConcurrentSessions: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  
  // Session Preferences
  preferences: {
    rememberMe: {
      type: Boolean,
      default: false
    },
    stayLoggedIn: {
      type: Boolean,
      default: false
    },
    sessionTimeout: {
      type: Number, // in minutes
      default: 60,
      min: 5,
      max: 1440 // 24 hours
    }
  },
  
  // Compliance and Audit
  gdprConsent: {
    type: Boolean,
    default: false
  },
  
  dataRetentionDays: {
    type: Number,
    default: 90 // 3 months
  },
  
  // System flags
  isSystemGenerated: {
    type: Boolean,
    default: false
  },
  
  isSuspicious: {
    type: Boolean,
    default: false
  },
  
  requiresReauth: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance and security
sessionSchema.index({ sessionId: 1 });
sessionSchema.index({ user: 1, isActive: 1 });
sessionSchema.index({ accessTokenExpiresAt: 1 });
sessionSchema.index({ refreshTokenExpiresAt: 1 });
sessionSchema.index({ isActive: 1, isRevoked: 1 });
sessionSchema.index({ lastActivity: -1 });
sessionSchema.index({ loginAt: -1 });
sessionSchema.index({ ipAddress: 1 });
sessionSchema.index({ 'deviceInfo.device': 1 });

// Compound indexes
sessionSchema.index({ user: 1, loginAt: -1 });
sessionSchema.index({ isActive: 1, lastActivity: -1 });
sessionSchema.index({ user: 1, isActive: 1, lastActivity: -1 });

// Virtual for session age in minutes
sessionSchema.virtual('ageInMinutes').get(function() {
  return Math.floor((Date.now() - this.loginAt) / (1000 * 60));
});

// Virtual for time until access token expires
sessionSchema.virtual('accessTokenExpiresInMinutes').get(function() {
  if (!this.accessTokenExpiresAt) return 0;
  return Math.max(0, Math.floor((this.accessTokenExpiresAt - Date.now()) / (1000 * 60)));
});

// Virtual for time until refresh token expires
sessionSchema.virtual('refreshTokenExpiresInMinutes').get(function() {
  if (!this.refreshTokenExpiresAt) return 0;
  return Math.max(0, Math.floor((this.refreshTokenExpiresAt - Date.now()) / (1000 * 60)));
});

// Virtual for session status
sessionSchema.virtual('status').get(function() {
  if (this.isRevoked) return 'revoked';
  if (!this.isActive) return 'inactive';
  if (this.accessTokenExpiresAt < new Date()) return 'access-expired';
  if (this.refreshTokenExpiresAt < new Date()) return 'refresh-expired';
  return 'active';
});

// Virtual for inactivity duration in minutes
sessionSchema.virtual('inactivityMinutes').get(function() {
  return Math.floor((Date.now() - this.lastActivity) / (1000 * 60));
});

// Pre-save middleware to calculate session duration
sessionSchema.pre('save', function(next) {
  if (this.logoutAt && this.loginAt) {
    this.duration = Math.floor((this.logoutAt - this.loginAt) / 1000);
  }
  
  // Limit recent activities to last 10
  if (this.recentActivities.length > 10) {
    this.recentActivities = this.recentActivities.slice(-10);
  }
  
  next();
});

// Method to revoke session
sessionSchema.methods.revoke = function(reason = 'user-logout', revokedBy = null) {
  this.isActive = false;
  this.isRevoked = true;
  this.revokedAt = new Date();
  this.logoutAt = new Date();
  this.revocationReason = reason;
  if (revokedBy) {
    this.revokedBy = revokedBy;
  }
  
  return this.save();
};

// Method to refresh tokens
sessionSchema.methods.refreshTokens = function(newAccessToken, newRefreshToken, accessTokenExpiry, refreshTokenExpiry) {
  // Revoke current session
  this.revoke('token-refresh');
  
  // Create new session data
  this.accessToken = newAccessToken;
  this.refreshToken = newRefreshToken;
  this.accessTokenExpiresAt = accessTokenExpiry;
  this.refreshTokenExpiresAt = refreshTokenExpiry;
  this.isActive = true;
  this.isRevoked = false;
  this.revokedAt = undefined;
  this.revocationReason = undefined;
  this.lastActivity = new Date();
  
  return this.save();
};

// Method to update activity
sessionSchema.methods.updateActivity = function(activityData = {}) {
  this.lastActivity = new Date();
  this.activityCount += 1;
  
  // Add to recent activities if provided
  if (activityData.action) {
    this.recentActivities.push({
      action: activityData.action,
      endpoint: activityData.endpoint,
      method: activityData.method,
      timestamp: new Date(),
      ipAddress: activityData.ipAddress,
      userAgent: activityData.userAgent,
      responseStatus: activityData.responseStatus,
      duration: activityData.duration
    });
    
    // Keep only last 10 activities
    if (this.recentActivities.length > 10) {
      this.recentActivities = this.recentActivities.slice(-10);
    }
  }
  
  return this.save();
};

// Method to check if session is expired
sessionSchema.methods.isExpired = function() {
  const now = new Date();
  return this.accessTokenExpiresAt < now || this.refreshTokenExpiresAt < now;
};

// Method to check if session needs refresh
sessionSchema.methods.needsRefresh = function() {
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  return this.accessTokenExpiresAt < new Date(now.getTime() + fiveMinutes);
};

// Method to check if session is inactive
sessionSchema.methods.isInactive = function(timeoutMinutes = null) {
  const timeout = timeoutMinutes || this.preferences.sessionTimeout || 60;
  const inactivityThreshold = timeout * 60 * 1000; // Convert to milliseconds
  
  return (Date.now() - this.lastActivity) > inactivityThreshold;
};

// Static method to find active sessions for user
sessionSchema.statics.findActiveByUser = function(userId) {
  return this.find({
    user: userId,
    isActive: true,
    isRevoked: false,
    accessTokenExpiresAt: { $gt: new Date() }
  }).sort({ lastActivity: -1 });
};

// Static method to cleanup expired sessions
sessionSchema.statics.cleanupExpired = function() {
  const now = new Date();
  
  return this.updateMany(
    {
      $or: [
        { accessTokenExpiresAt: { $lt: now } },
        { refreshTokenExpiresAt: { $lt: now } }
      ],
      isActive: true
    },
    {
      $set: {
        isActive: false,
        isRevoked: true,
        revokedAt: now,
        logoutAt: now,
        revocationReason: 'expired'
      }
    }
  );
};

// Static method to cleanup inactive sessions
sessionSchema.statics.cleanupInactive = function(inactivityMinutes = 60) {
  const inactivityThreshold = new Date(Date.now() - inactivityMinutes * 60 * 1000);
  
  return this.updateMany(
    {
      lastActivity: { $lt: inactivityThreshold },
      isActive: true,
      isRevoked: false
    },
    {
      $set: {
        isActive: false,
        isRevoked: true,
        revokedAt: new Date(),
        logoutAt: new Date(),
        revocationReason: 'inactive'
      }
    }
  );
};

// Static method to revoke all sessions for user
sessionSchema.statics.revokeAllForUser = function(userId, reason = 'security', revokedBy = null) {
  const updateData = {
    isActive: false,
    isRevoked: true,
    revokedAt: new Date(),
    logoutAt: new Date(),
    revocationReason: reason
  };
  
  if (revokedBy) {
    updateData.revokedBy = revokedBy;
  }
  
  return this.updateMany(
    {
      user: userId,
      isActive: true,
      isRevoked: false
    },
    { $set: updateData }
  );
};

// Static method to get session statistics
sessionSchema.statics.getSessionStats = function(userId = null, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const matchStage = { loginAt: { $gte: startDate } };
  if (userId) {
    matchStage.user = new mongoose.Types.ObjectId(userId);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$loginAt' } },
          device: '$deviceInfo.device'
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$user' },
        avgDuration: { $avg: '$duration' },
        suspiciousCount: {
          $sum: { $cond: ['$isSuspicious', 1, 0] }
        }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        totalSessions: { $sum: '$count' },
        uniqueUsers: { $sum: { $size: '$uniqueUsers' } },
        deviceBreakdown: {
          $push: {
            device: '$_id.device',
            count: '$count'
          }
        },
        avgDuration: { $avg: '$avgDuration' },
        suspiciousCount: { $sum: '$suspiciousCount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Static method to find suspicious sessions
sessionSchema.statics.findSuspicious = function(limit = 100) {
  return this.find({
    $or: [
      { isSuspicious: true },
      { riskScore: { $gte: 70 } },
      { riskFactors: { $exists: true, $not: { $size: 0 } } }
    ],
    isActive: true
  })
  .populate('user', 'email role fullName')
  .sort({ riskScore: -1, loginAt: -1 })
  .limit(limit);
};

module.exports = mongoose.model('Session', sessionSchema);
