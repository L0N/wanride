const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  // Document Owner
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Document owner is required']
  },
  
  // Document Type
  type: {
    type: String,
    enum: [
      'driver-license',
      'vehicle-registration',
      'insurance-certificate',
      'vehicle-inspection',
      'identity-card',
      'passport',
      'business-registration',
      'tax-certificate',
      'bank-statement',
      'utility-bill',
      'profile-photo',
      'vehicle-photo',
      'other'
    ],
    required: [true, 'Document type is required']
  },
  
  // Document Category
  category: {
    type: String,
    enum: ['identity', 'vehicle', 'business', 'financial', 'photo', 'other'],
    required: [true, 'Document category is required']
  },
  
  // File Information
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true
  },
  
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true
  },
  
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
    enum: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'image/heic',
      'image/heif'
    ]
  },
  
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative'],
    max: [10 * 1024 * 1024, 'File size cannot exceed 10MB'] // 10MB limit
  },
  
  // Cloud Storage Information
  cloudinary: {
    publicId: {
      type: String,
      required: [true, 'Cloudinary public ID is required']
    },
    url: {
      type: String,
      required: [true, 'Cloudinary URL is required']
    },
    secureUrl: {
      type: String,
      required: [true, 'Cloudinary secure URL is required']
    },
    format: String,
    width: Number,
    height: Number,
    bytes: Number,
    resourceType: {
      type: String,
      enum: ['image', 'raw'],
      default: 'image'
    }
  },
  
  // Document Verification
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  verifiedAt: Date,
  
  verificationNotes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Verification notes cannot exceed 1000 characters']
  },
  
  rejectionReason: {
    type: String,
    enum: [
      'poor-quality',
      'unreadable',
      'expired',
      'invalid-document',
      'wrong-type',
      'incomplete-information',
      'fraudulent',
      'other'
    ]
  },
  
  // Document Expiry (for documents that have expiry dates)
  expiryDate: Date,
  
  isExpired: {
    type: Boolean,
    default: false
  },
  
  // Document Details (extracted information)
  extractedData: {
    // For driver's license
    licenseNumber: String,
    licenseClass: String,
    issueDate: Date,
    expiryDate: Date,
    
    // For identity documents
    idNumber: String,
    fullName: String,
    dateOfBirth: Date,
    address: String,
    
    // For vehicle documents
    vehicleRegNumber: String,
    vehicleMake: String,
    vehicleModel: String,
    vehicleYear: Number,
    vehicleColor: String,
    
    // For business documents
    businessName: String,
    businessRegNumber: String,
    tinNumber: String,
    
    // Generic fields
    issuer: String,
    country: String,
    state: String
  },
  
  // OCR and AI Processing
  ocrProcessed: {
    type: Boolean,
    default: false
  },
  
  ocrData: {
    text: String,
    confidence: Number,
    processedAt: Date,
    service: {
      type: String,
      enum: ['google-vision', 'aws-textract', 'azure-cognitive', 'tesseract']
    }
  },
  
  // Security and Compliance
  isEncrypted: {
    type: Boolean,
    default: false
  },
  
  encryptionKey: {
    type: String,
    select: false // Never include in queries
  },
  
  accessLog: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    action: {
      type: String,
      enum: ['view', 'download', 'verify', 'reject', 'delete']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }],
  
  // Document Versions (for re-uploads)
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  
  previousVersions: [{
    version: Number,
    filename: String,
    cloudinaryPublicId: String,
    uploadedAt: Date,
    verificationStatus: String,
    rejectionReason: String
  }],
  
  // Metadata
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  
  // System flags
  isRequired: {
    type: Boolean,
    default: false
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  isArchived: {
    type: Boolean,
    default: false
  },
  
  archivedAt: Date,
  
  // Compliance tracking
  gdprConsent: {
    type: Boolean,
    default: false
  },
  
  retentionPeriod: {
    type: Number, // in days
    default: 2555 // ~7 years default retention
  },
  
  scheduledDeletion: Date

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
documentSchema.index({ owner: 1, type: 1 });
documentSchema.index({ owner: 1, verificationStatus: 1 });
documentSchema.index({ verificationStatus: 1, createdAt: -1 });
documentSchema.index({ type: 1, verificationStatus: 1 });
documentSchema.index({ expiryDate: 1 });
documentSchema.index({ isExpired: 1 });
documentSchema.index({ 'cloudinary.publicId': 1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ priority: 1, verificationStatus: 1 });

// Compound indexes
documentSchema.index({ owner: 1, category: 1, verificationStatus: 1 });
documentSchema.index({ verifiedBy: 1, verifiedAt: -1 });

// Virtual for document age in days
documentSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for time until expiry
documentSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiryDate) return null;
  return Math.floor((this.expiryDate - Date.now()) / (1000 * 60 * 60 * 24));
});

// Virtual for verification duration
documentSchema.virtual('verificationDuration').get(function() {
  if (!this.verifiedAt) return null;
  return Math.floor((this.verifiedAt - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for file size in human readable format
documentSchema.virtual('fileSizeFormatted').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Pre-save middleware to check expiry
documentSchema.pre('save', function(next) {
  // Check if document is expired
  if (this.expiryDate && this.expiryDate < new Date()) {
    this.isExpired = true;
    if (this.verificationStatus === 'approved') {
      this.verificationStatus = 'expired';
    }
  }
  
  // Set scheduled deletion based on retention period
  if (!this.scheduledDeletion && this.retentionPeriod) {
    this.scheduledDeletion = new Date(Date.now() + this.retentionPeriod * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Method to verify document
documentSchema.methods.verify = function(verifierId, notes = '') {
  this.verificationStatus = 'approved';
  this.verifiedBy = verifierId;
  this.verifiedAt = new Date();
  this.verificationNotes = notes;
  this.rejectionReason = undefined;
  
  // Log the verification action
  this.accessLog.push({
    user: verifierId,
    action: 'verify',
    timestamp: new Date()
  });
  
  return this.save();
};

// Method to reject document
documentSchema.methods.reject = function(verifierId, reason, notes = '') {
  this.verificationStatus = 'rejected';
  this.verifiedBy = verifierId;
  this.verifiedAt = new Date();
  this.rejectionReason = reason;
  this.verificationNotes = notes;
  
  // Log the rejection action
  this.accessLog.push({
    user: verifierId,
    action: 'reject',
    timestamp: new Date()
  });
  
  return this.save();
};

// Method to log access
documentSchema.methods.logAccess = function(userId, action, ipAddress = '', userAgent = '') {
  this.accessLog.push({
    user: userId,
    action,
    timestamp: new Date(),
    ipAddress,
    userAgent
  });
  
  return this.save();
};

// Method to create new version
documentSchema.methods.createNewVersion = function(newDocumentData) {
  // Archive current version
  this.previousVersions.push({
    version: this.version,
    filename: this.filename,
    cloudinaryPublicId: this.cloudinary.publicId,
    uploadedAt: this.createdAt,
    verificationStatus: this.verificationStatus,
    rejectionReason: this.rejectionReason
  });
  
  // Update with new version
  this.version += 1;
  this.filename = newDocumentData.filename;
  this.originalName = newDocumentData.originalName;
  this.mimeType = newDocumentData.mimeType;
  this.size = newDocumentData.size;
  this.cloudinary = newDocumentData.cloudinary;
  this.verificationStatus = 'pending';
  this.verifiedBy = undefined;
  this.verifiedAt = undefined;
  this.verificationNotes = '';
  this.rejectionReason = undefined;
  
  return this.save();
};

// Method to archive document
documentSchema.methods.archive = function() {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

// Static method to find documents by owner and type
documentSchema.statics.findByOwnerAndType = function(ownerId, type, status = null) {
  const query = { owner: ownerId, type, isArchived: false };
  if (status) {
    query.verificationStatus = status;
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find pending documents
documentSchema.statics.findPending = function(limit = 50) {
  return this.find({
    verificationStatus: 'pending',
    isArchived: false
  })
  .populate('owner', 'email role fullName')
  .sort({ priority: -1, createdAt: 1 })
  .limit(limit);
};

// Static method to find expiring documents
documentSchema.statics.findExpiring = function(daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    expiryDate: { $lte: futureDate, $gt: new Date() },
    verificationStatus: 'approved',
    isArchived: false
  })
  .populate('owner', 'email role fullName')
  .sort({ expiryDate: 1 });
};

// Static method to find expired documents
documentSchema.statics.findExpired = function() {
  return this.find({
    $or: [
      { isExpired: true },
      { expiryDate: { $lt: new Date() } }
    ],
    isArchived: false
  })
  .populate('owner', 'email role fullName')
  .sort({ expiryDate: 1 });
};

// Static method to get document statistics
documentSchema.statics.getDocumentStats = function(ownerId = null) {
  const matchStage = { isArchived: false };
  if (ownerId) {
    matchStage.owner = new mongoose.Types.ObjectId(ownerId);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$verificationStatus',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' },
        avgProcessingTime: {
          $avg: {
            $cond: [
              { $ne: ['$verifiedAt', null] },
              { $subtract: ['$verifiedAt', '$createdAt'] },
              null
            ]
          }
        }
      }
    }
  ]);
};

// Static method to cleanup old documents
documentSchema.statics.cleanupExpiredRetention = function() {
  const now = new Date();
  
  return this.find({
    scheduledDeletion: { $lt: now },
    isArchived: false
  });
};

// Static method to get documents by category
documentSchema.statics.findByCategory = function(category, status = null, limit = 100) {
  const query = { category, isArchived: false };
  if (status) {
    query.verificationStatus = status;
  }
  
  return this.find(query)
    .populate('owner', 'email role fullName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Document', documentSchema);
