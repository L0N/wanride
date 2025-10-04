const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Cloudinary service for file management
 */
class CloudinaryService {
  constructor() {
    this.isConfigured = this.checkConfiguration();
  }

  /**
   * Check if Cloudinary is properly configured
   */
  checkConfiguration() {
    const requiredEnvVars = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn(`Cloudinary not configured. Missing environment variables: ${missingVars.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * Create Cloudinary storage for multer
   */
  createStorage(options = {}) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    const defaultOptions = {
      folder: 'wanrides/documents',
      allowedFormats: ['jpg', 'jpeg', 'png', 'pdf', 'webp', 'heic', 'heif'],
      transformation: [
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    };

    const storageOptions = { ...defaultOptions, ...options };

    return new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: storageOptions.folder,
        allowed_formats: storageOptions.allowedFormats,
        transformation: storageOptions.transformation,
        public_id: (req, file) => {
          // Generate unique filename
          const timestamp = Date.now();
          const userId = req.user?._id || 'anonymous';
          const originalName = file.originalname.split('.')[0];
          return `${userId}_${timestamp}_${originalName}`;
        }
      }
    });
  }

  /**
   * Upload file directly to Cloudinary
   */
  async uploadFile(filePath, options = {}) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    try {
      const defaultOptions = {
        folder: 'wanrides/documents',
        quality: 'auto',
        fetch_format: 'auto'
      };

      const uploadOptions = { ...defaultOptions, ...options };
      const result = await cloudinary.uploader.upload(filePath, uploadOptions);

      return {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        resourceType: result.resource_type
      };
    } catch (error) {
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  }

  /**
   * Upload buffer to Cloudinary
   */
  async uploadBuffer(buffer, options = {}) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    return new Promise((resolve, reject) => {
      const defaultOptions = {
        folder: 'wanrides/documents',
        quality: 'auto',
        fetch_format: 'auto'
      };

      const uploadOptions = { ...defaultOptions, ...options };

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            resolve({
              publicId: result.public_id,
              url: result.url,
              secureUrl: result.secure_url,
              format: result.format,
              width: result.width,
              height: result.height,
              bytes: result.bytes,
              resourceType: result.resource_type
            });
          }
        }
      ).end(buffer);
    });
  }

  /**
   * Delete file from Cloudinary
   */
  async deleteFile(publicId) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (error) {
      throw new Error(`Cloudinary delete failed: ${error.message}`);
    }
  }

  /**
   * Generate transformation URL
   */
  generateUrl(publicId, transformations = {}) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    return cloudinary.url(publicId, {
      secure: true,
      ...transformations
    });
  }

  /**
   * Generate thumbnail URL
   */
  generateThumbnail(publicId, width = 200, height = 200) {
    return this.generateUrl(publicId, {
      width,
      height,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto'
    });
  }

  /**
   * Get file info from Cloudinary
   */
  async getFileInfo(publicId) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    try {
      const result = await cloudinary.api.resource(publicId);
      return {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        createdAt: result.created_at,
        resourceType: result.resource_type
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  /**
   * List files in folder
   */
  async listFiles(folder = 'wanrides/documents', maxResults = 100) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: maxResults
      });

      return result.resources.map(resource => ({
        publicId: resource.public_id,
        url: resource.url,
        secureUrl: resource.secure_url,
        format: resource.format,
        bytes: resource.bytes,
        createdAt: resource.created_at
      }));
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Create signed upload URL for direct client uploads
   */
  generateSignedUploadUrl(options = {}) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary is not configured');
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
      timestamp,
      folder: 'wanrides/documents',
      ...options
    };

    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    return {
      url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/upload`,
      params: {
        ...params,
        signature,
        api_key: process.env.CLOUDINARY_API_KEY
      }
    };
  }
}

/**
 * Create multer middleware with Cloudinary storage
 */
const createUploadMiddleware = (options = {}) => {
  const cloudinaryService = new CloudinaryService();
  
  if (!cloudinaryService.isConfigured) {
    // Return a middleware that rejects uploads when Cloudinary is not configured
    return (req, res, next) => {
      return res.status(500).json({
        success: false,
        message: 'File upload service is not configured'
      });
    };
  }

  const storage = cloudinaryService.createStorage(options);
  
  const defaultMulterOptions = {
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 5 // Maximum 5 files per request
    },
    fileFilter: (req, file, cb) => {
      // Allowed MIME types
      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
        'application/pdf'
      ];

      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
      }
    }
  };

  const multerOptions = { ...defaultMulterOptions, ...options };
  return multer(multerOptions);
};

module.exports = {
  cloudinary,
  CloudinaryService,
  createUploadMiddleware
};

