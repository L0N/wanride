const { body, param, query } = require('express-validator');

/**
 * Validation rules for user registration
 */
const validateRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('phone')
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number')
    .custom((value) => {
      // Additional PNG phone number validation
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.startsWith('675') || cleaned.startsWith('0') || cleaned.length >= 7) {
        return true;
      }
      throw new Error('Please provide a valid Papua New Guinea phone number');
    }),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  body('roles')
    .optional()
    .custom((value) => {
      const validRoles = ['PASSENGER', 'DRIVER', 'DISPATCHER', 'OWNER'];
      const roles = Array.isArray(value) ? value : [value];
      
      for (const role of roles) {
        if (!validRoles.includes(role)) {
          throw new Error(`Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`);
        }
      }
      
      return true;
    })
];

/**
 * Validation rules for user login
 */
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Validation rules for OTP verification
 */
const validateOTPVerification = [
  body('otpToken')
    .notEmpty()
    .withMessage('OTP token is required'),

  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number')
];

/**
 * Validation rules for OTP resend
 */
const validateOTPResend = [
  body('otpToken')
    .notEmpty()
    .withMessage('OTP token is required')
];

/**
 * Validation rules for token refresh
 */
const validateTokenRefresh = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

/**
 * Validation rules for SMS test
 */
const validateSMSTest = [
  body('phone')
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number')
];

/**
 * Validation rules for password reset request
 */
const validatePasswordResetRequest = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

/**
 * Validation rules for password reset
 */
const validatePasswordReset = [
  body('otpToken')
    .notEmpty()
    .withMessage('OTP token is required'),

  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

/**
 * Validation rules for profile update
 */
const validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number')
];

/**
 * Validation rules for driver profile update
 */
const validateDriverProfileUpdate = [
  body('license')
    .optional()
    .trim()
    .isLength({ min: 5, max: 50 })
    .withMessage('License number must be between 5 and 50 characters'),

  body('emergencyContact.name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Emergency contact name must be between 2 and 100 characters'),

  body('emergencyContact.phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid emergency contact phone number'),

  body('emergencyContact.relationship')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Relationship must be between 2 and 50 characters'),

  body('workingHours.start')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),

  body('workingHours.end')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format')
];

/**
 * Validation rules for location update
 */
const validateLocationUpdate = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
];

/**
 * Validation rules for ride request
 */
const validateRideRequest = [
  body('pickupLocation.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Pickup coordinates must be an array of [longitude, latitude]'),

  body('pickupLocation.coordinates.*')
    .isFloat()
    .withMessage('Coordinates must be valid numbers'),

  body('pickupLocation.address')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Pickup address must be between 5 and 200 characters'),

  body('dropoffLocation.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Dropoff coordinates must be an array of [longitude, latitude]'),

  body('dropoffLocation.coordinates.*')
    .isFloat()
    .withMessage('Coordinates must be valid numbers'),

  body('dropoffLocation.address')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Dropoff address must be between 5 and 200 characters'),

  body('specialRequests')
    .optional()
    .isArray()
    .withMessage('Special requests must be an array'),

  body('specialRequests.*')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Each special request must be less than 100 characters')
];

/**
 * Validation rules for payment confirmation
 */
const validatePaymentConfirmation = [
  body('amount')
    .isFloat({ min: 5 })
    .withMessage('Amount must be at least K5')
    .custom((value) => {
      // Check if amount is rounded to nearest K5
      if (value % 5 !== 0) {
        throw new Error('Amount must be rounded to the nearest K5');
      }
      return true;
    }),

  body('confirmedBy')
    .isIn(['PASSENGER', 'DRIVER'])
    .withMessage('Payment can only be confirmed by PASSENGER or DRIVER')
];

/**
 * Validation rules for rating
 */
const validateRating = [
  body('score')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating score must be between 1 and 5'),

  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comment must be less than 500 characters'),

  body('ratingType')
    .isIn(['PASSENGER', 'DRIVER'])
    .withMessage('Rating type must be either PASSENGER or DRIVER')
];

/**
 * Validation rules for SOS trigger
 */
const validateSOSTrigger = [
  body('location')
    .isArray({ min: 2, max: 2 })
    .withMessage('Location must be an array of [longitude, latitude]'),

  body('location.*')
    .isFloat()
    .withMessage('Location coordinates must be valid numbers'),

  body('triggeredBy')
    .isIn(['PASSENGER', 'DRIVER'])
    .withMessage('SOS can only be triggered by PASSENGER or DRIVER')
];

/**
 * Validation rules for MongoDB ObjectId parameters
 */
const validateObjectId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`${paramName} must be a valid ID`)
];

/**
 * Validation rules for pagination
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('sort')
    .optional()
    .isIn(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'name', '-name'])
    .withMessage('Invalid sort field')
];

/**
 * Validation rules for date range queries
 */
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) <= new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateOTPVerification,
  validateOTPResend,
  validateTokenRefresh,
  validateSMSTest,
  validatePasswordResetRequest,
  validatePasswordReset,
  validateProfileUpdate,
  validateDriverProfileUpdate,
  validateLocationUpdate,
  validateRideRequest,
  validatePaymentConfirmation,
  validateRating,
  validateSOSTrigger,
  validateObjectId,
  validatePagination,
  validateDateRange
};
