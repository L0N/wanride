const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const rideController = require('../controllers/rideController');

const router = express.Router();

// Validation schemas
const rideRequestValidation = [
  body('pickupLocation.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Pickup coordinates must be [longitude, latitude]'),
  body('pickupAddress')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Pickup address must be between 5 and 200 characters'),
  body('dropoffLocation.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Dropoff coordinates must be [longitude, latitude]'),
  body('dropoffAddress')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Dropoff address must be between 5 and 200 characters'),
  body('estimatedDistance')
    .isNumeric()
    .isFloat({ min: 100 })
    .withMessage('Estimated distance must be at least 100 meters'),
  body('estimatedDuration')
    .isNumeric()
    .isFloat({ min: 1 })
    .withMessage('Estimated duration must be at least 1 minute'),
  body('priority')
    .optional()
    .isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
    .withMessage('Priority must be LOW, NORMAL, HIGH, or URGENT'),
  body('specialRequests')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Special requests cannot exceed 500 characters'),
  body('passengerNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Passenger notes cannot exceed 500 characters')
];

const rideIdValidation = [
  param('rideId')
    .isMongoId()
    .withMessage('Invalid ride ID format')
];

const rideStatusValidation = [
  body('status')
    .isIn(['ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    .withMessage('Invalid status')
];

const rideCompletionValidation = [
  body('actualDistance')
    .optional()
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Actual distance must be a positive number'),
  body('finalFare')
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Final fare must be a positive number'),
  body('paidAmount')
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Paid amount must be a positive number'),
  body('paymentMethod')
    .optional()
    .isIn(['CASH', 'MOBILE_MONEY'])
    .withMessage('Payment method must be CASH or MOBILE_MONEY'),
  body('driverNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Driver notes cannot exceed 500 characters')
];

const ratingValidation = [
  body('rating')
    .isNumeric()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Feedback cannot exceed 500 characters')
];

// Routes

/**
 * @route   POST /api/rides/request
 * @desc    Request a new ride
 * @access  Private (Passenger)
 */
router.post('/request',
  authenticate,
  authorize(['PASSENGER']),
  rideRequestValidation,
  validateRequest,
  rideController.requestRide
);

/**
 * @route   GET /api/rides/:rideId
 * @desc    Get ride details
 * @access  Private (Passenger, Driver, Dispatcher, Owner)
 */
router.get('/:rideId',
  authenticate,
  authorize(['PASSENGER', 'DRIVER', 'DISPATCHER', 'OWNER']),
  rideIdValidation,
  validateRequest,
  rideController.getRideDetails
);

/**
 * @route   PUT /api/rides/:rideId/accept
 * @desc    Accept a ride assignment (Driver)
 * @access  Private (Driver)
 */
router.put('/:rideId/accept',
  authenticate,
  authorize(['DRIVER']),
  rideIdValidation,
  validateRequest,
  rideController.acceptRide
);

/**
 * @route   PUT /api/rides/:rideId/arrived
 * @desc    Mark driver as arrived at pickup location
 * @access  Private (Driver)
 */
router.put('/:rideId/arrived',
  authenticate,
  authorize(['DRIVER']),
  rideIdValidation,
  validateRequest,
  rideController.markArrived
);

/**
 * @route   PUT /api/rides/:rideId/start
 * @desc    Start the ride
 * @access  Private (Driver)
 */
router.put('/:rideId/start',
  authenticate,
  authorize(['DRIVER']),
  rideIdValidation,
  validateRequest,
  rideController.startRide
);

/**
 * @route   PUT /api/rides/:rideId/complete
 * @desc    Complete the ride
 * @access  Private (Driver)
 */
router.put('/:rideId/complete',
  authenticate,
  authorize(['DRIVER']),
  rideIdValidation,
  rideCompletionValidation,
  validateRequest,
  rideController.completeRide
);

/**
 * @route   PUT /api/rides/:rideId/cancel
 * @desc    Cancel a ride
 * @access  Private (Passenger, Driver, Dispatcher)
 */
router.put('/:rideId/cancel',
  authenticate,
  authorize(['PASSENGER', 'DRIVER', 'DISPATCHER']),
  rideIdValidation,
  [
    body('reason')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Cancellation reason must be between 5 and 200 characters')
  ],
  validateRequest,
  rideController.cancelRide
);

/**
 * @route   POST /api/rides/:rideId/rate
 * @desc    Rate a completed ride
 * @access  Private (Passenger, Driver)
 */
router.post('/:rideId/rate',
  authenticate,
  authorize(['PASSENGER', 'DRIVER']),
  rideIdValidation,
  ratingValidation,
  validateRequest,
  rideController.rateRide
);

/**
 * @route   GET /api/rides/history
 * @desc    Get ride history for user
 * @access  Private (Passenger, Driver)
 */
router.get('/history',
  authenticate,
  authorize(['PASSENGER', 'DRIVER']),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['PENDING', 'ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
      .withMessage('Invalid status filter'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
  ],
  validateRequest,
  rideController.getRideHistory
);

/**
 * @route   GET /api/rides/active
 * @desc    Get active ride for user
 * @access  Private (Passenger, Driver)
 */
router.get('/active',
  authenticate,
  authorize(['PASSENGER', 'DRIVER']),
  rideController.getActiveRide
);

/**
 * @route   GET /api/rides/:rideId/tracking
 * @desc    Get real-time tracking data for a ride
 * @access  Private (Passenger, Driver, Dispatcher)
 */
router.get('/:rideId/tracking',
  authenticate,
  authorize(['PASSENGER', 'DRIVER', 'DISPATCHER']),
  rideIdValidation,
  validateRequest,
  rideController.getRideTracking
);

module.exports = router;
