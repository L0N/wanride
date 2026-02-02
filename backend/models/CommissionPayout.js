const mongoose = require('mongoose');

/**
 * Commission Payout Model for WanRide PNG
 * 
 * Tracks weekly commission payouts for drivers with:
 * - Complete payout workflow (PENDING → APPROVED → PAID)
 * - Deduction management (fuel, damage, violations)
 * - Audit trail for all status changes
 * - K5-rounded amounts throughout
 * - PNG timezone handling
 */

const commissionPayoutSchema = new mongoose.Schema({
  // Driver reference
  driverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // Payout period (Monday to Sunday)
  period: {
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    weekNumber: { type: Number, required: true }, // Week of year (1-53)
    year: { type: Number, required: true }
  },
  
  // Rides included in this payout
  rides: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ride' 
  }],
  ridesCount: { type: Number, required: true, min: 0 },
  
  // Financial calculations (all K5-rounded)
  totalFares: { 
    type: Number, 
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        return v % 5 === 0; // Must be K5-rounded
      },
      message: 'Total fares must be K5-rounded'
    }
  },
  totalCommissionsBeforeRounding: { 
    type: Number, 
    required: true,
    min: 0 
  }, // For audit purposes
  totalCommissions: { 
    type: Number, 
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        return v % 5 === 0; // Must be K5-rounded
      },
      message: 'Total commissions must be K5-rounded'
    }
  },
  
  // Deductions (owner can add for fuel, damage, etc.)
  deductions: [{
    type: { 
      type: String, 
      enum: ['FUEL', 'DAMAGE', 'VIOLATION', 'ADVANCE', 'UNIFORM', 'MAINTENANCE', 'OTHER'],
      required: true
    },
    amount: { 
      type: Number, 
      required: true,
      min: 0,
      validate: {
        validator: function(v) {
          return v % 5 === 0; // Must be K5-rounded
        },
        message: 'Deduction amount must be K5-rounded'
      }
    },
    reason: { type: String, required: true, maxlength: 500 },
    date: { type: Date, default: Date.now },
    addedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true 
    },
    receiptNumber: String, // Optional receipt reference
    notes: { type: String, maxlength: 1000 }
  }],
  totalDeductions: { 
    type: Number, 
    default: 0,
    min: 0,
    validate: {
      validator: function(v) {
        return v % 5 === 0; // Must be K5-rounded
      },
      message: 'Total deductions must be K5-rounded'
    }
  },
  
  // Net payout (totalCommissions - totalDeductions)
  netPayout: { 
    type: Number, 
    required: true,
    validate: {
      validator: function(v) {
        return v % 5 === 0; // Must be K5-rounded
      },
      message: 'Net payout must be K5-rounded'
    }
  },
  
  // Payout status workflow
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'PAID', 'DISPUTED', 'CANCELLED'],
    default: 'PENDING',
    required: true,
    index: true
  },
  
  // Approval tracking
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  approvalNotes: { type: String, maxlength: 1000 },
  
  // Payment tracking
  paidAt: Date,
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paymentMethod: { 
    type: String, 
    enum: ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'SALARY_ADDITION'] 
  },
  paymentReference: String, // Bank reference, receipt number, etc.
  paymentNotes: { type: String, maxlength: 1000 },
  
  // Dispute tracking
  dispute: {
    exists: { type: Boolean, default: false },
    reason: { type: String, maxlength: 1000 },
    reportedAt: Date,
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolution: { type: String, maxlength: 1000 }
  },
  
  // Metadata
  notes: { type: String, maxlength: 1000 },
  generatedBy: { 
    type: String, 
    enum: ['AUTO', 'MANUAL'],
    default: 'AUTO'
  },
  
  // Audit trail for status changes
  statusHistory: [{
    status: { 
      type: String,
      enum: ['PENDING', 'APPROVED', 'PAID', 'DISPUTED', 'CANCELLED'],
      required: true
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true 
    },
    notes: { type: String, maxlength: 500 }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
commissionPayoutSchema.index({ driverId: 1, 'period.from': -1 });
commissionPayoutSchema.index({ status: 1, createdAt: -1 });
commissionPayoutSchema.index({ 'period.year': 1, 'period.weekNumber': 1 });
commissionPayoutSchema.index({ approvedBy: 1, approvedAt: -1 });
commissionPayoutSchema.index({ paidBy: 1, paidAt: -1 });

// Compound index for unique period per driver
commissionPayoutSchema.index({ 
  driverId: 1, 
  'period.year': 1, 
  'period.weekNumber': 1 
}, { unique: true });

// Virtual for driver details
commissionPayoutSchema.virtual('driver', {
  ref: 'User',
  localField: 'driverId',
  foreignField: '_id',
  justOne: true
});

// Virtual for commission rate calculation
commissionPayoutSchema.virtual('commissionRate').get(function() {
  if (this.totalFares > 0) {
    return parseFloat((this.totalCommissions / this.totalFares).toFixed(3));
  }
  return 0;
});

// Virtual for average commission per ride
commissionPayoutSchema.virtual('averageCommissionPerRide').get(function() {
  if (this.ridesCount > 0) {
    return Math.round(this.totalCommissions / this.ridesCount);
  }
  return 0;
});

// Pre-save middleware to calculate totals and validate
commissionPayoutSchema.pre('save', function(next) {
  // Calculate total deductions
  this.totalDeductions = this.deductions.reduce((sum, deduction) => {
    return sum + deduction.amount;
  }, 0);
  
  // Calculate net payout
  this.netPayout = this.totalCommissions - this.totalDeductions;
  
  // Ensure net payout is not negative
  if (this.netPayout < 0) {
    return next(new Error('Net payout cannot be negative. Total deductions exceed total commissions.'));
  }
  
  next();
});

// Instance method to add deduction
commissionPayoutSchema.methods.addDeduction = function(deduction) {
  // Validate deduction amount is K5-rounded
  if (deduction.amount % 5 !== 0) {
    throw new Error('Deduction amount must be K5-rounded');
  }
  
  this.deductions.push(deduction);
  return this.save();
};

// Instance method to remove deduction
commissionPayoutSchema.methods.removeDeduction = function(deductionId) {
  this.deductions = this.deductions.filter(
    d => d._id.toString() !== deductionId.toString()
  );
  return this.save();
};

// Instance method to update status with history tracking
commissionPayoutSchema.methods.updateStatus = function(newStatus, changedBy, notes) {
  // Add current status to history
  this.statusHistory.push({
    status: this.status,
    changedAt: new Date(),
    changedBy: changedBy,
    notes: notes
  });
  
  // Update status
  this.status = newStatus;
  
  // Set status-specific fields
  switch (newStatus) {
    case 'APPROVED':
      this.approvedBy = changedBy;
      this.approvedAt = new Date();
      if (notes) this.approvalNotes = notes;
      break;
    
    case 'PAID':
      this.paidBy = changedBy;
      this.paidAt = new Date();
      if (notes) this.paymentNotes = notes;
      break;
    
    case 'DISPUTED':
      this.dispute.exists = true;
      this.dispute.reportedBy = changedBy;
      this.dispute.reportedAt = new Date();
      if (notes) this.dispute.reason = notes;
      break;
  }
  
  return this.save();
};

// Instance method to resolve dispute
commissionPayoutSchema.methods.resolveDispute = function(resolvedBy, resolution) {
  if (!this.dispute.exists) {
    throw new Error('No dispute exists to resolve');
  }
  
  this.dispute.resolvedBy = resolvedBy;
  this.dispute.resolvedAt = new Date();
  this.dispute.resolution = resolution;
  
  // Update status back to previous state or APPROVED
  return this.updateStatus('APPROVED', resolvedBy, `Dispute resolved: ${resolution}`);
};

// Static method to find payouts by status
commissionPayoutSchema.statics.findByStatus = function(status, limit = 50) {
  return this.find({ status: status })
    .populate('driverId', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find pending payouts for approval
commissionPayoutSchema.statics.findPendingPayouts = function() {
  return this.find({ status: 'PENDING' })
    .populate('driverId', 'name email phone')
    .sort({ 'period.from': -1 });
};

// Static method to get payout statistics for a period
commissionPayoutSchema.statics.getPayoutStatistics = function(fromDate, toDate) {
  return this.aggregate([
    {
      $match: {
        'period.from': { $gte: fromDate },
        'period.to': { $lte: toDate }
      }
    },
    {
      $group: {
        _id: null,
        totalPayouts: { $sum: 1 },
        totalCommissions: { $sum: '$totalCommissions' },
        totalDeductions: { $sum: '$totalDeductions' },
        totalNetPayouts: { $sum: '$netPayout' },
        totalRides: { $sum: '$ridesCount' },
        averageCommissionPerPayout: { $avg: '$totalCommissions' },
        statusBreakdown: {
          $push: {
            status: '$status',
            count: 1
          }
        }
      }
    }
  ]);
};

// Static method to find driver's payout history
commissionPayoutSchema.statics.findDriverPayouts = function(driverId, limit = 20) {
  return this.find({ driverId: driverId })
    .sort({ 'period.from': -1 })
    .limit(limit)
    .select('-rides'); // Exclude rides array for performance
};

const CommissionPayout = mongoose.model('CommissionPayout', commissionPayoutSchema);

module.exports = CommissionPayout;
