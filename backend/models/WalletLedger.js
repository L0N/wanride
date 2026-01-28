const mongoose = require('mongoose');

const walletLedgerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    default: null // null for non-ride related transactions
  },
  
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    validate: {
      validator: function(value) {
        return value !== 0;
      },
      message: 'Amount cannot be zero'
    }
  },
  
  type: {
    type: String,
    enum: ['COLLECTED', 'COMMISSION', 'ADJUSTMENT', 'SALARY', 'BONUS', 'DEDUCTION'],
    required: [true, 'Transaction type is required']
  },
  
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Reference to the person/system that created this entry
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  },
  
  // For tracking cash collection variance
  expectedAmount: {
    type: Number,
    default: null // Only used for COLLECTED type
  },
  
  variance: {
    type: Number,
    default: 0 // Calculated as amount - expectedAmount
  },
  
  // Weekly payroll tracking
  payrollWeek: {
    startDate: Date,
    endDate: Date,
    weekNumber: Number,
    year: Number
  },
  
  // Status for tracking
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'DISPUTED', 'RESOLVED'],
    default: 'CONFIRMED'
  },
  
  // Dispute information
  dispute: {
    reason: String,
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    raisedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolution: String
  },
  
  // Additional metadata
  metadata: {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriverProfile'
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle'
    },
    commissionRate: Number,
    originalFare: Number,
    paymentMethod: {
      type: String,
      enum: ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER'],
      default: 'CASH'
    }
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

// Indexes for performance
walletLedgerSchema.index({ userId: 1 });
walletLedgerSchema.index({ rideId: 1 });
walletLedgerSchema.index({ type: 1 });
walletLedgerSchema.index({ createdAt: -1 });
walletLedgerSchema.index({ status: 1 });
walletLedgerSchema.index({ 'payrollWeek.year': 1, 'payrollWeek.weekNumber': 1 });

// Compound indexes for common queries
walletLedgerSchema.index({ userId: 1, type: 1 });
walletLedgerSchema.index({ userId: 1, createdAt: -1 });
walletLedgerSchema.index({ type: 1, createdAt: -1 });
walletLedgerSchema.index({ 'metadata.driverId': 1, type: 1 });

// Virtual for user details
walletLedgerSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for ride details
walletLedgerSchema.virtual('ride', {
  ref: 'Ride',
  localField: 'rideId',
  foreignField: '_id',
  justOne: true
});

// Virtual for driver details
walletLedgerSchema.virtual('driver', {
  ref: 'DriverProfile',
  localField: 'metadata.driverId',
  foreignField: '_id',
  justOne: true
});

// Virtual for vehicle details
walletLedgerSchema.virtual('vehicle', {
  ref: 'Vehicle',
  localField: 'metadata.vehicleId',
  foreignField: '_id',
  justOne: true
});

// Virtual to check if transaction is positive (credit) or negative (debit)
walletLedgerSchema.virtual('isCredit').get(function() {
  return this.amount > 0;
});

// Virtual to check if transaction is disputed
walletLedgerSchema.virtual('isDisputed').get(function() {
  return this.status === 'DISPUTED';
});

// Pre-save middleware to calculate variance and update timestamps
walletLedgerSchema.pre('save', function(next) {
  // Calculate variance for COLLECTED transactions
  if (this.type === 'COLLECTED' && this.expectedAmount !== null) {
    this.variance = this.amount - this.expectedAmount;
  }
  
  // Update timestamp
  this.updatedAt = Date.now();
  
  next();
});

// Instance method to raise dispute
walletLedgerSchema.methods.raiseDispute = function(reason, raisedBy) {
  if (this.status === 'DISPUTED') {
    throw new Error('Transaction is already disputed');
  }
  
  this.status = 'DISPUTED';
  this.dispute = {
    reason: reason,
    raisedBy: raisedBy,
    raisedAt: new Date()
  };
  
  return this.save();
};

// Instance method to resolve dispute
walletLedgerSchema.methods.resolveDispute = function(resolution, resolvedBy) {
  if (this.status !== 'DISPUTED') {
    throw new Error('No dispute to resolve');
  }
  
  this.status = 'RESOLVED';
  this.dispute.resolution = resolution;
  this.dispute.resolvedBy = resolvedBy;
  this.dispute.resolvedAt = new Date();
  
  return this.save();
};

// Static method to create cash collection entry
walletLedgerSchema.statics.createCashCollection = function(rideId, driverId, actualAmount, expectedAmount, createdBy) {
  const variance = actualAmount - expectedAmount;
  
  return this.create({
    userId: driverId,
    rideId: rideId,
    amount: actualAmount,
    type: 'COLLECTED',
    description: `Cash collected for ride ${rideId}${variance !== 0 ? ` (Variance: K${variance})` : ''}`,
    expectedAmount: expectedAmount,
    variance: variance,
    createdBy: createdBy,
    metadata: {
      driverId: driverId,
      originalFare: expectedAmount,
      paymentMethod: 'CASH'
    }
  });
};

// Static method to create commission entry
walletLedgerSchema.statics.createCommission = function(rideId, driverId, commissionAmount, commissionRate, originalFare, createdBy) {
  return this.create({
    userId: driverId,
    rideId: rideId,
    amount: commissionAmount,
    type: 'COMMISSION',
    description: `Commission (${(commissionRate * 100).toFixed(1)}%) for ride ${rideId}`,
    createdBy: createdBy,
    metadata: {
      driverId: driverId,
      commissionRate: commissionRate,
      originalFare: originalFare
    }
  });
};

// Static method to create salary entry
walletLedgerSchema.statics.createSalaryEntry = function(driverId, amount, weekStart, weekEnd, createdBy) {
  const weekNumber = getWeekNumber(weekStart);
  const year = weekStart.getFullYear();
  
  return this.create({
    userId: driverId,
    amount: amount,
    type: 'SALARY',
    description: `Weekly salary for week ${weekNumber}, ${year}`,
    createdBy: createdBy,
    payrollWeek: {
      startDate: weekStart,
      endDate: weekEnd,
      weekNumber: weekNumber,
      year: year
    },
    metadata: {
      driverId: driverId
    }
  });
};

// Static method to create adjustment entry
walletLedgerSchema.statics.createAdjustment = function(userId, amount, description, createdBy, metadata = {}) {
  return this.create({
    userId: userId,
    amount: amount,
    type: 'ADJUSTMENT',
    description: description,
    createdBy: createdBy,
    metadata: metadata
  });
};

// Static method to get driver balance
walletLedgerSchema.statics.getDriverBalance = function(driverId) {
  return this.aggregate([
    {
      $match: { 
        userId: driverId,
        status: { $in: ['CONFIRMED', 'RESOLVED'] }
      }
    },
    {
      $group: {
        _id: null,
        totalBalance: { $sum: '$amount' },
        totalCollected: {
          $sum: {
            $cond: [{ $eq: ['$type', 'COLLECTED'] }, '$amount', 0]
          }
        },
        totalCommissions: {
          $sum: {
            $cond: [{ $eq: ['$type', 'COMMISSION'] }, '$amount', 0]
          }
        },
        totalSalary: {
          $sum: {
            $cond: [{ $eq: ['$type', 'SALARY'] }, '$amount', 0]
          }
        },
        totalAdjustments: {
          $sum: {
            $cond: [{ $eq: ['$type', 'ADJUSTMENT'] }, '$amount', 0]
          }
        },
        totalVariance: { $sum: '$variance' }
      }
    }
  ]);
};

// Static method to get weekly payroll report
walletLedgerSchema.statics.getWeeklyPayrollReport = function(year, weekNumber) {
  return this.aggregate([
    {
      $match: {
        'payrollWeek.year': year,
        'payrollWeek.weekNumber': weekNumber,
        type: { $in: ['SALARY', 'COMMISSION', 'BONUS', 'DEDUCTION'] }
      }
    },
    {
      $group: {
        _id: '$userId',
        totalSalary: {
          $sum: {
            $cond: [{ $eq: ['$type', 'SALARY'] }, '$amount', 0]
          }
        },
        totalCommissions: {
          $sum: {
            $cond: [{ $eq: ['$type', 'COMMISSION'] }, '$amount', 0]
          }
        },
        totalBonus: {
          $sum: {
            $cond: [{ $eq: ['$type', 'BONUS'] }, '$amount', 0]
          }
        },
        totalDeductions: {
          $sum: {
            $cond: [{ $eq: ['$type', 'DEDUCTION'] }, '$amount', 0]
          }
        },
        netPay: { $sum: '$amount' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $lookup: {
        from: 'driverprofiles',
        localField: '_id',
        foreignField: 'userId',
        as: 'driverProfile'
      }
    }
  ]);
};

// Static method to get cash variance report
walletLedgerSchema.statics.getCashVarianceReport = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        type: 'COLLECTED',
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: '$metadata.driverId',
        totalCollected: { $sum: '$amount' },
        totalExpected: { $sum: '$expectedAmount' },
        totalVariance: { $sum: '$variance' },
        transactionCount: { $sum: 1 },
        positiveVariances: {
          $sum: {
            $cond: [{ $gt: ['$variance', 0] }, 1, 0]
          }
        },
        negativeVariances: {
          $sum: {
            $cond: [{ $lt: ['$variance', 0] }, 1, 0]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'driverprofiles',
        localField: '_id',
        foreignField: '_id',
        as: 'driver'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'driver.userId',
        foreignField: '_id',
        as: 'user'
      }
    }
  ]);
};

// Static method to get financial summary
walletLedgerSchema.statics.getFinancialSummary = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        },
        status: { $in: ['CONFIRMED', 'RESOLVED'] }
      }
    },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
        averageAmount: { $avg: '$amount' }
      }
    }
  ]);
};

// Helper function to get week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = mongoose.model('WalletLedger', walletLedgerSchema);
