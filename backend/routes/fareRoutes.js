const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateJWT } = require('../middleware/auth');
const fareCalculationService = require('../services/fareCalculationService');
const { roundToK5 } = require('../utils/k5Rounding');

/**
 * @route POST /api/fare/calculate
 * @desc Calculate fare for a ride
 * @access Public (for passenger fare estimates)
 */
router.post('/calculate', [
  body('pickup.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Pickup latitude must be between -90 and 90'),
  body('pickup.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Pickup longitude must be between -180 and 180'),
  body('destination.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Destination latitude must be between -90 and 90'),
  body('destination.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Destination longitude must be between -180 and 180'),
  body('estimatedDuration')
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage('Estimated duration must be between 1 and 480 minutes')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: errors.array()
      });
    }

    const { pickup, destination, estimatedDuration } = req.body;

    // Validate inputs using service
    const validation = fareCalculationService.validateFareInputs(pickup, destination, estimatedDuration);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fare calculation inputs',
        errors: validation.errors
      });
    }

    // Calculate fare
    const fareCalculation = fareCalculationService.calculateFare(pickup, destination, estimatedDuration);

    res.json({
      success: true,
      data: fareCalculation
    });

  } catch (error) {
    console.error('Fare calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate fare',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route GET /api/fare/config
 * @desc Get current fare configuration
 * @access Private (Owner only)
 */
router.get('/config', authenticateJWT, async (req, res) => {
  try {
    // Check if user is owner
    if (!req.user.roles.includes('OWNER')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Owner role required'
      });
    }

    const config = fareCalculationService.getFareConfig();

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('Get fare config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get fare configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route PUT /api/fare/config
 * @desc Update fare configuration
 * @access Private (Owner only)
 */
router.put('/config', authenticateJWT, [
  body('ncdFlatRate')
    .optional()
    .isFloat({ min: 5 })
    .withMessage('NCD flat rate must be at least K5')
    .custom((value) => {
      if (value % 5 !== 0) {
        throw new Error('NCD flat rate must be K5-rounded');
      }
      return true;
    }),
  body('baseFare')
    .optional()
    .isFloat({ min: 5 })
    .withMessage('Base fare must be at least K5')
    .custom((value) => {
      if (value % 5 !== 0) {
        throw new Error('Base fare must be K5-rounded');
      }
      return true;
    }),
  body('distanceRate')
    .optional()
    .isFloat({ min: 0.5, max: 10 })
    .withMessage('Distance rate must be between K0.50 and K10 per km'),
  body('timeRate')
    .optional()
    .isFloat({ min: 0.1, max: 5 })
    .withMessage('Time rate must be between K0.10 and K5 per minute'),
  body('freeDistanceKm')
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage('Free distance must be between 0 and 50 km'),
  body('returnFeePercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Return fee percentage must be between 0 and 100'),
  body('airportAddon')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Airport addon must be non-negative')
    .custom((value) => {
      if (value % 5 !== 0) {
        throw new Error('Airport addon must be K5-rounded');
      }
      return true;
    })
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration data',
        errors: errors.array()
      });
    }

    // Check if user is owner
    if (!req.user.roles.includes('OWNER')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Owner role required'
      });
    }

    const updates = req.body;

    // Round any currency values to K5
    if (updates.ncdFlatRate) updates.ncdFlatRate = roundToK5(updates.ncdFlatRate);
    if (updates.baseFare) updates.baseFare = roundToK5(updates.baseFare);
    if (updates.airportAddon) updates.airportAddon = roundToK5(updates.airportAddon);

    // Update configuration
    fareCalculationService.updateFareConfig(updates);

    // Get updated configuration
    const updatedConfig = fareCalculationService.getFareConfig();

    // Log the configuration change
    console.log(`Fare configuration updated by user ${req.user.id}:`, updates);

    res.json({
      success: true,
      message: 'Fare configuration updated successfully',
      data: updatedConfig
    });

  } catch (error) {
    console.error('Update fare config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fare configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route POST /api/fare/validate-location
 * @desc Validate if location is within NCD or near airport
 * @access Public
 */
router.post('/validate-location', [
  body('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location data',
        errors: errors.array()
      });
    }

    const { lat, lng } = req.body;
    const location = { lat, lng };

    const isInNCD = fareCalculationService.isPointInNCD(location);
    const isNearAirport = fareCalculationService.isAirportTrip(location, location);

    res.json({
      success: true,
      data: {
        location: location,
        isInNCD: isInNCD,
        isNearAirport: isNearAirport,
        zone: isInNCD ? 'NCD (Port Moresby)' : 'Outside NCD',
        fareMethod: isInNCD ? 'Flat Rate' : 'Distance-Based'
      }
    });

  } catch (error) {
    console.error('Location validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route POST /api/fare/commission
 * @desc Calculate commission for a fare
 * @access Private (Driver, Dispatcher, Owner)
 */
router.post('/commission', authenticateJWT, [
  body('fare')
    .isFloat({ min: 5 })
    .withMessage('Fare must be at least K5')
    .custom((value) => {
      if (value % 5 !== 0) {
        throw new Error('Fare must be K5-rounded');
      }
      return true;
    }),
  body('commissionRate')
    .optional()
    .isFloat({ min: 0.1, max: 0.5 })
    .withMessage('Commission rate must be between 10% and 50%')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid commission data',
        errors: errors.array()
      });
    }

    const { fare, commissionRate } = req.body;

    // Calculate commission
    const commission = fareCalculationService.calculateCommission(fare, commissionRate);

    res.json({
      success: true,
      data: commission
    });

  } catch (error) {
    console.error('Commission calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate commission',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
