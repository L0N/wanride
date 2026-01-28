const { RideRequest, Ride, User, DriverProfile, Vehicle, DriverLocation, WalletLedger } = require('../models');
const DispatchService = require('../services/dispatchService');
const EmailService = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * Request a new ride
 * @route POST /api/rides/request
 */
const requestRide = async (req, res) => {
  try {
    const passengerId = req.user.id;
    const {
      pickupLocation,
      pickupAddress,
      dropoffLocation,
      dropoffAddress,
      estimatedDistance,
      estimatedDuration,
      priority = 'NORMAL',
      specialRequests,
      passengerNotes
    } = req.body;

    // Check if passenger has an active ride
    const activeRide = await RideRequest.findOne({
      passengerId,
      status: { $in: ['PENDING', 'ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] }
    });

    if (activeRide) {
      return res.status(400).json({
        error: 'Active ride exists',
        message: 'You already have an active ride request'
      });
    }

    // Calculate fare
    const baseFare = 5; // K5 base fare
    const perKmRate = 2; // K2 per km
    const perMinuteRate = 0.5; // K0.50 per minute
    
    const priorityMultipliers = {
      LOW: 0.9,
      NORMAL: 1.0,
      HIGH: 1.2,
      URGENT: 1.5
    };

    const distanceKm = estimatedDistance / 1000;
    const durationMinutes = estimatedDuration;
    
    let calculatedFare = baseFare + (distanceKm * perKmRate) + (durationMinutes * perMinuteRate);
    calculatedFare *= priorityMultipliers[priority];
    
    // Round to nearest K5
    const roundedFare = Math.round(calculatedFare / 5) * 5;

    // Create ride request
    const rideRequest = new RideRequest({
      passengerId,
      pickupLocation,
      pickupAddress,
      dropoffLocation,
      dropoffAddress,
      estimatedDistance,
      estimatedDuration,
      estimatedFare: roundedFare,
      priority,
      specialRequests,
      passengerNotes,
      status: 'PENDING'
    });

    await rideRequest.save();

    // Trigger dispatch process
    const dispatchService = new DispatchService();
    await dispatchService.processRideRequest(rideRequest._id);

    logger.info(`Ride request created: ${rideRequest._id} by passenger: ${passengerId}`);

    res.status(201).json({
      message: 'Ride request created successfully',
      rideRequest: {
        id: rideRequest._id,
        estimatedFare: roundedFare,
        priority,
        status: 'PENDING'
      }
    });

  } catch (error) {
    logger.error('Error creating ride request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create ride request'
    });
  }
};

/**
 * Get ride details
 * @route GET /api/rides/:rideId
 */
const getRideDetails = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;

    const rideRequest = await RideRequest.findById(rideId)
      .populate('passengerId', 'name phone')
      .populate('driverId', 'name phone')
      .populate('vehicleId', 'plate model');

    if (!rideRequest) {
      return res.status(404).json({
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    // Check authorization
    const userRoles = req.user.roles;
    const isAuthorized = userRoles.includes('DISPATCHER') || 
                        userRoles.includes('OWNER') ||
                        rideRequest.passengerId._id.toString() === userId ||
                        (rideRequest.driverId && rideRequest.driverId._id.toString() === userId);

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not authorized to view this ride'
      });
    }

    res.json({
      ride: rideRequest
    });

  } catch (error) {
    logger.error('Error getting ride details:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve ride details'
    });
  }
};

/**
 * Accept a ride assignment (Driver)
 * @route PUT /api/rides/:rideId/accept
 */
const acceptRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;

    const rideRequest = await RideRequest.findById(rideId);

    if (!rideRequest) {
      return res.status(404).json({
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    if (rideRequest.status !== 'ASSIGNED') {
      return res.status(400).json({
        error: 'Invalid ride status',
        message: 'This ride cannot be accepted'
      });
    }

    if (rideRequest.driverId.toString() !== driverId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'This ride is not assigned to you'
      });
    }

    // Update ride status
    rideRequest.status = 'ACCEPTED';
    rideRequest.acceptedAt = new Date();
    await rideRequest.save();

    logger.info(`Ride ${rideId} accepted by driver ${driverId}`);

    res.json({
      message: 'Ride accepted successfully',
      ride: {
        id: rideRequest._id,
        status: rideRequest.status,
        acceptedAt: rideRequest.acceptedAt
      }
    });

  } catch (error) {
    logger.error('Error accepting ride:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to accept ride'
    });
  }
};

/**
 * Mark driver as arrived at pickup location
 * @route PUT /api/rides/:rideId/arrived
 */
const markArrived = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;

    const rideRequest = await RideRequest.findById(rideId);

    if (!rideRequest) {
      return res.status(404).json({
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    if (rideRequest.status !== 'ACCEPTED') {
      return res.status(400).json({
        error: 'Invalid ride status',
        message: 'Driver must accept ride before marking as arrived'
      });
    }

    if (rideRequest.driverId.toString() !== driverId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'This ride is not assigned to you'
      });
    }

    // Update ride status
    rideRequest.status = 'ARRIVED';
    rideRequest.arrivedAt = new Date();
    await rideRequest.save();

    logger.info(`Driver ${driverId} arrived for ride ${rideId}`);

    res.json({
      message: 'Arrival confirmed',
      ride: {
        id: rideRequest._id,
        status: rideRequest.status,
        arrivedAt: rideRequest.arrivedAt
      }
    });

  } catch (error) {
    logger.error('Error marking arrival:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to mark arrival'
    });
  }
};

/**
 * Start the ride
 * @route PUT /api/rides/:rideId/start
 */
const startRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;

    const rideRequest = await RideRequest.findById(rideId);

    if (!rideRequest) {
      return res.status(404).json({
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    if (rideRequest.status !== 'ARRIVED') {
      return res.status(400).json({
        error: 'Invalid ride status',
        message: 'Driver must be at pickup location before starting ride'
      });
    }

    if (rideRequest.driverId.toString() !== driverId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'This ride is not assigned to you'
      });
    }

    // Update ride status
    rideRequest.status = 'IN_PROGRESS';
    rideRequest.startedAt = new Date();
    await rideRequest.save();

    logger.info(`Ride ${rideId} started by driver ${driverId}`);

    res.json({
      message: 'Ride started successfully',
      ride: {
        id: rideRequest._id,
        status: rideRequest.status,
        startedAt: rideRequest.startedAt
      }
    });

  } catch (error) {
    logger.error('Error starting ride:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to start ride'
    });
  }
};

/**
 * Complete the ride
 * @route PUT /api/rides/:rideId/complete
 */
const completeRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;
    const { actualDistance, actualDuration, paidAmount, paymentMethod = 'CASH' } = req.body;

    const rideRequest = await RideRequest.findById(rideId)
      .populate('passengerId', 'name email phone')
      .populate('driverId', 'name email phone')
      .populate('vehicleId', 'plate model');

    if (!rideRequest) {
      return res.status(404).json({
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    if (rideRequest.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        error: 'Invalid ride status',
        message: 'Ride must be in progress to complete'
      });
    }

    if (rideRequest.driverId._id.toString() !== driverId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'This ride is not assigned to you'
      });
    }

    // Update ride request
    rideRequest.status = 'COMPLETED';
    rideRequest.completedAt = new Date();
    rideRequest.actualDistance = actualDistance;
    rideRequest.actualDuration = actualDuration;
    rideRequest.paidAmount = paidAmount;
    rideRequest.paymentMethod = paymentMethod;
    await rideRequest.save();

    // Create completed ride record
    const ride = new Ride({
      passengerId: rideRequest.passengerId._id,
      driverId: rideRequest.driverId._id,
      vehicleId: rideRequest.vehicleId._id,
      pickupLocation: rideRequest.pickupLocation,
      dropoffLocation: rideRequest.dropoffLocation,
      distance: actualDistance,
      fare: rideRequest.estimatedFare,
      status: 'COMPLETED',
      paidAmount,
      paymentMethod,
      requestedAt: rideRequest.createdAt,
      completedAt: new Date()
    });

    await ride.save();

    // Create wallet ledger entry for cash collection
    const walletEntry = new WalletLedger({
      userId: driverId,
      rideId: ride._id,
      amount: paidAmount,
      type: 'COLLECTED',
      description: `Cash collected for ride ${ride._id}`,
      metadata: {
        estimatedFare: rideRequest.estimatedFare,
        actualDistance,
        actualDuration
      }
    });

    await walletEntry.save();

    // Send receipt email
    try {
      const emailService = new EmailService();
      await emailService.sendRideReceipt(
        rideRequest.passengerId.email,
        {
          rideId: ride._id,
          passengerName: rideRequest.passengerId.name,
          driverName: rideRequest.driverId.name,
          vehiclePlate: rideRequest.vehicleId.plate,
          pickupAddress: rideRequest.pickupAddress,
          dropoffAddress: rideRequest.dropoffAddress,
          distance: actualDistance,
          fare: rideRequest.estimatedFare,
          paidAmount,
          completedAt: new Date()
        }
      );
    } catch (emailError) {
      logger.error('Failed to send receipt email:', emailError);
      // Don't fail the ride completion if email fails
    }

    logger.info(`Ride ${rideId} completed by driver ${driverId}`);

    res.json({
      message: 'Ride completed successfully',
      ride: {
        id: ride._id,
        status: 'COMPLETED',
        fare: rideRequest.estimatedFare,
        paidAmount,
        completedAt: ride.completedAt
      }
    });

  } catch (error) {
    logger.error('Error completing ride:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to complete ride'
    });
  }
};

/**
 * Cancel a ride
 * @route PUT /api/rides/:rideId/cancel
 */
const cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const rideRequest = await RideRequest.findById(rideId);

    if (!rideRequest) {
      return res.status(404).json({
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    if (rideRequest.status === 'COMPLETED' || rideRequest.status === 'CANCELLED') {
      return res.status(400).json({
        error: 'Invalid ride status',
        message: 'This ride cannot be cancelled'
      });
    }

    // Check authorization
    const userRoles = req.user.roles;
    const isAuthorized = userRoles.includes('DISPATCHER') ||
                        rideRequest.passengerId.toString() === userId ||
                        (rideRequest.driverId && rideRequest.driverId.toString() === userId);

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not authorized to cancel this ride'
      });
    }

    // Update ride status
    rideRequest.status = 'CANCELLED';
    rideRequest.cancelledAt = new Date();
    rideRequest.cancellationReason = reason;
    rideRequest.cancelledBy = userId;
    await rideRequest.save();

    logger.info(`Ride ${rideId} cancelled by user ${userId}`);

    res.json({
      message: 'Ride cancelled successfully',
      ride: {
        id: rideRequest._id,
        status: rideRequest.status,
        cancelledAt: rideRequest.cancelledAt,
        reason
      }
    });

  } catch (error) {
    logger.error('Error cancelling ride:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to cancel ride'
    });
  }
};

/**
 * Rate a completed ride
 * @route POST /api/rides/:rideId/rate
 */
const rateRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;
    const { rating, comment } = req.body;

    const rideRequest = await RideRequest.findById(rideId);

    if (!rideRequest) {
      return res.status(404).json({
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    if (rideRequest.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Invalid ride status',
        message: 'Only completed rides can be rated'
      });
    }

    // Check if user is passenger or driver
    const isPassenger = rideRequest.passengerId.toString() === userId;
    const isDriver = rideRequest.driverId && rideRequest.driverId.toString() === userId;

    if (!isPassenger && !isDriver) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not authorized to rate this ride'
      });
    }

    // Update rating
    if (isPassenger) {
      rideRequest.passengerRating = rating;
      rideRequest.passengerComment = comment;
    } else {
      rideRequest.driverRating = rating;
      rideRequest.driverComment = comment;
    }

    await rideRequest.save();

    // Update driver's overall rating if passenger rated
    if (isPassenger && rideRequest.driverId) {
      const driverProfile = await DriverProfile.findOne({ userId: rideRequest.driverId });
      if (driverProfile) {
        const completedRides = await RideRequest.find({
          driverId: rideRequest.driverId,
          status: 'COMPLETED',
          passengerRating: { $exists: true }
        });

        const totalRating = completedRides.reduce((sum, ride) => sum + ride.passengerRating, 0);
        const averageRating = totalRating / completedRides.length;

        driverProfile.rating = Math.round(averageRating * 10) / 10; // Round to 1 decimal
        driverProfile.totalRides = completedRides.length;
        await driverProfile.save();
      }
    }

    logger.info(`Ride ${rideId} rated by user ${userId}`);

    res.json({
      message: 'Rating submitted successfully',
      rating: {
        value: rating,
        comment
      }
    });

  } catch (error) {
    logger.error('Error rating ride:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to submit rating'
    });
  }
};

/**
 * Get ride history for user
 * @route GET /api/rides/history
 */
const getRideHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;

    const query = {
      $or: [
        { passengerId: userId },
        { driverId: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const rides = await RideRequest.find(query)
      .populate('passengerId', 'name phone')
      .populate('driverId', 'name phone')
      .populate('vehicleId', 'plate model')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RideRequest.countDocuments(query);

    res.json({
      rides,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Error getting ride history:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve ride history'
    });
  }
};

/**
 * Get active ride for user
 * @route GET /api/rides/active
 */
const getActiveRide = async (req, res) => {
  try {
    const userId = req.user.id;

    const activeRide = await RideRequest.findOne({
      $or: [
        { passengerId: userId },
        { driverId: userId }
      ],
      status: { $in: ['PENDING', 'ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] }
    })
    .populate('passengerId', 'name phone')
    .populate('driverId', 'name phone')
    .populate('vehicleId', 'plate model');

    if (!activeRide) {
      return res.json({
        activeRide: null,
        message: 'No active ride found'
      });
    }

    res.json({
      activeRide
    });

  } catch (error) {
    logger.error('Error getting active ride:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve active ride'
    });
  }
};

/**
 * Get real-time tracking data for a ride
 * @route GET /api/rides/:rideId/tracking
 */
const getRideTracking = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;

    const rideRequest = await RideRequest.findById(rideId);

    if (!rideRequest) {
      return res.status(404).json({
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    // Check authorization
    const userRoles = req.user.roles;
    const isAuthorized = userRoles.includes('DISPATCHER') ||
                        rideRequest.passengerId.toString() === userId ||
                        (rideRequest.driverId && rideRequest.driverId.toString() === userId);

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not authorized to track this ride'
      });
    }

    // Get driver location if ride is assigned
    let driverLocation = null;
    if (rideRequest.driverId) {
      driverLocation = await DriverLocation.findOne({
        userId: rideRequest.driverId
      }).sort({ timestamp: -1 });
    }

    res.json({
      tracking: {
        rideId: rideRequest._id,
        status: rideRequest.status,
        pickupLocation: rideRequest.pickupLocation,
        dropoffLocation: rideRequest.dropoffLocation,
        driverLocation: driverLocation ? {
          coordinates: driverLocation.location.coordinates,
          heading: driverLocation.heading,
          speed: driverLocation.speed,
          timestamp: driverLocation.timestamp
        } : null,
        estimatedArrival: rideRequest.estimatedArrival,
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    logger.error('Error getting ride tracking:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve tracking data'
    });
  }
};

module.exports = {
  requestRide,
  getRideDetails,
  acceptRide,
  markArrived,
  startRide,
  completeRide,
  cancelRide,
  rateRide,
  getRideHistory,
  getActiveRide,
  getRideTracking
};
