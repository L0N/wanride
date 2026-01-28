const RideRequest = require('../models/RideRequest');
const DriverProfile = require('../models/DriverProfile');
const DriverLocation = require('../models/DriverLocation');
const DispatchLog = require('../models/DispatchLog');
const User = require('../models/User');

class DispatchService {
  constructor() {
    this.maxSearchRadius = 10000; // 10km in meters
    this.maxDriversToConsider = 10;
    this.autoAssignTimeout = 30000; // 30 seconds
  }

  /**
   * Find the best available drivers for a ride request
   * @param {Object} pickupLocation - GeoJSON Point
   * @param {Number} maxDistance - Maximum search radius in meters
   * @param {Number} limit - Maximum number of drivers to return
   * @returns {Array} Array of available drivers with distance
   */
  async findNearestAvailableDrivers(pickupLocation, maxDistance = this.maxSearchRadius, limit = this.maxDriversToConsider) {
    try {
      const drivers = await DriverLocation.findNearbyDrivers(
        pickupLocation.coordinates,
        maxDistance,
        limit
      );

      // Filter out drivers who are not truly available
      const availableDrivers = [];
      
      for (const driverLocation of drivers) {
        const driverProfile = await DriverProfile.findOne({ 
          userId: driverLocation.driverId 
        }).populate('user');
        
        if (driverProfile && driverProfile.isAvailable()) {
          availableDrivers.push({
            driverId: driverLocation.driverId,
            driver: driverProfile.user,
            profile: driverProfile,
            location: driverLocation.location,
            distance: driverLocation.distance,
            rating: driverProfile.rating,
            totalRides: driverProfile.totalRides,
            lastLocationUpdate: driverLocation.timestamp
          });
        }
      }

      // Sort by a combination of distance and rating
      return this.rankDrivers(availableDrivers);
    } catch (error) {
      console.error('Error finding nearest drivers:', error);
      throw error;
    }
  }

  /**
   * Rank drivers based on distance, rating, and other factors
   * @param {Array} drivers - Array of driver objects
   * @returns {Array} Sorted array of drivers
   */
  rankDrivers(drivers) {
    return drivers.sort((a, b) => {
      // Calculate score for each driver
      const scoreA = this.calculateDriverScore(a);
      const scoreB = this.calculateDriverScore(b);
      
      return scoreB - scoreA; // Higher score first
    });
  }

  /**
   * Calculate a score for driver ranking
   * @param {Object} driver - Driver object with distance and rating
   * @returns {Number} Driver score
   */
  calculateDriverScore(driver) {
    const maxDistance = 5000; // 5km
    const maxRating = 5.0;
    
    // Normalize distance (closer = higher score)
    const distanceScore = Math.max(0, (maxDistance - driver.distance) / maxDistance);
    
    // Normalize rating
    const ratingScore = driver.rating / maxRating;
    
    // Experience factor (more rides = slightly higher score)
    const experienceScore = Math.min(1, driver.totalRides / 100);
    
    // Weighted combination
    const score = (distanceScore * 0.6) + (ratingScore * 0.3) + (experienceScore * 0.1);
    
    return score;
  }

  /**
   * Automatically assign a ride to the best available driver
   * @param {String} rideId - Ride request ID
   * @param {String} dispatcherId - Dispatcher ID (system for auto-assign)
   * @returns {Object} Assignment result
   */
  async autoAssignRide(rideId, dispatcherId = null) {
    const startTime = Date.now();
    
    try {
      const ride = await RideRequest.findById(rideId);
      if (!ride) {
        throw new Error('Ride request not found');
      }

      if (ride.status !== 'PENDING') {
        throw new Error('Ride is not in PENDING status');
      }

      // Find available drivers
      const availableDrivers = await this.findNearestAvailableDrivers(ride.pickupLocation);
      
      if (availableDrivers.length === 0) {
        // Log failed assignment
        await DispatchLog.logAction({
          rideId,
          dispatcherId: dispatcherId || 'SYSTEM',
          action: 'AUTO_ASSIGN',
          reason: 'No available drivers found',
          result: 'FAILED',
          processingTime: Date.now() - startTime,
          metadata: {
            nearbyDriversCount: 0,
            systemLoad: await this.getSystemLoad()
          }
        });

        return {
          success: false,
          message: 'No available drivers found',
          availableDrivers: 0
        };
      }

      // Select the best driver
      const selectedDriver = availableDrivers[0];
      
      // Assign the ride
      const assignmentResult = await this.assignRideToDriver(
        rideId, 
        selectedDriver.driverId, 
        dispatcherId || 'SYSTEM',
        'AUTO_ASSIGN'
      );

      // Log successful assignment
      await DispatchLog.logAction({
        rideId,
        dispatcherId: dispatcherId || 'SYSTEM',
        action: 'AUTO_ASSIGN',
        newDriverId: selectedDriver.driverId,
        reason: `Auto-assigned to nearest available driver (${selectedDriver.distance}m away)`,
        result: 'SUCCESS',
        processingTime: Date.now() - startTime,
        metadata: {
          nearbyDriversCount: availableDrivers.length,
          driverDistance: selectedDriver.distance,
          systemLoad: await this.getSystemLoad()
        }
      });

      return {
        success: true,
        message: 'Ride assigned successfully',
        assignedDriver: selectedDriver,
        availableDrivers: availableDrivers.length,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      // Log failed assignment
      await DispatchLog.logAction({
        rideId,
        dispatcherId: dispatcherId || 'SYSTEM',
        action: 'AUTO_ASSIGN',
        reason: `Assignment failed: ${error.message}`,
        result: 'FAILED',
        errorMessage: error.message,
        processingTime: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Manually assign a ride to a specific driver
   * @param {String} rideId - Ride request ID
   * @param {String} driverId - Driver ID
   * @param {String} dispatcherId - Dispatcher ID
   * @param {String} reason - Reason for manual assignment
   * @returns {Object} Assignment result
   */
  async manualAssignRide(rideId, driverId, dispatcherId, reason = 'Manual assignment') {
    const startTime = Date.now();
    
    try {
      const ride = await RideRequest.findById(rideId);
      if (!ride) {
        throw new Error('Ride request not found');
      }

      const driverProfile = await DriverProfile.findOne({ userId: driverId });
      if (!driverProfile) {
        throw new Error('Driver not found');
      }

      if (!driverProfile.isAvailable()) {
        throw new Error('Driver is not available');
      }

      // Assign the ride
      const assignmentResult = await this.assignRideToDriver(
        rideId, 
        driverId, 
        dispatcherId,
        'MANUAL_ASSIGN'
      );

      // Log manual assignment
      await DispatchLog.logAction({
        rideId,
        dispatcherId,
        action: 'MANUAL_ASSIGN',
        newDriverId: driverId,
        reason,
        result: 'SUCCESS',
        processingTime: Date.now() - startTime,
        metadata: {
          systemLoad: await this.getSystemLoad()
        }
      });

      return {
        success: true,
        message: 'Ride manually assigned successfully',
        assignedDriver: driverProfile,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      // Log failed assignment
      await DispatchLog.logAction({
        rideId,
        dispatcherId,
        action: 'MANUAL_ASSIGN',
        newDriverId: driverId,
        reason: `Manual assignment failed: ${error.message}`,
        result: 'FAILED',
        errorMessage: error.message,
        processingTime: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Reassign a ride from one driver to another
   * @param {String} rideId - Ride request ID
   * @param {String} newDriverId - New driver ID
   * @param {String} dispatcherId - Dispatcher ID
   * @param {String} reason - Reason for reassignment
   * @returns {Object} Reassignment result
   */
  async reassignRide(rideId, newDriverId, dispatcherId, reason = 'Reassignment') {
    const startTime = Date.now();
    
    try {
      const ride = await RideRequest.findById(rideId);
      if (!ride) {
        throw new Error('Ride request not found');
      }

      const previousDriverId = ride.assignedDriverId;
      
      if (!previousDriverId) {
        throw new Error('Ride is not currently assigned');
      }

      const newDriverProfile = await DriverProfile.findOne({ userId: newDriverId });
      if (!newDriverProfile || !newDriverProfile.isAvailable()) {
        throw new Error('New driver is not available');
      }

      // Remove ride from previous driver
      const previousDriverProfile = await DriverProfile.findOne({ userId: previousDriverId });
      if (previousDriverProfile) {
        previousDriverProfile.currentRideId = null;
        await previousDriverProfile.save();
      }

      // Assign to new driver
      await this.assignRideToDriver(rideId, newDriverId, dispatcherId, 'REASSIGN');

      // Log reassignment
      await DispatchLog.logAction({
        rideId,
        dispatcherId,
        action: 'REASSIGN',
        previousDriverId,
        newDriverId,
        reason,
        result: 'SUCCESS',
        processingTime: Date.now() - startTime,
        metadata: {
          systemLoad: await this.getSystemLoad()
        }
      });

      return {
        success: true,
        message: 'Ride reassigned successfully',
        previousDriver: previousDriverId,
        newDriver: newDriverId,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      // Log failed reassignment
      await DispatchLog.logAction({
        rideId,
        dispatcherId,
        action: 'REASSIGN',
        newDriverId,
        reason: `Reassignment failed: ${error.message}`,
        result: 'FAILED',
        errorMessage: error.message,
        processingTime: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Core method to assign a ride to a driver
   * @param {String} rideId - Ride request ID
   * @param {String} driverId - Driver ID
   * @param {String} dispatcherId - Dispatcher ID
   * @param {String} method - Assignment method
   * @returns {Object} Assignment result
   */
  async assignRideToDriver(rideId, driverId, dispatcherId, method = 'AUTO_ASSIGN') {
    try {
      // Update ride request
      const ride = await RideRequest.findByIdAndUpdate(
        rideId,
        {
          status: 'ASSIGNED',
          assignedDriverId: driverId,
          assignedAt: new Date(),
          dispatcherId,
          dispatchMethod: method === 'AUTO_ASSIGN' ? 'AUTO' : 'MANUAL'
        },
        { new: true }
      );

      // Update driver profile
      const driverProfile = await DriverProfile.findOne({ userId: driverId });
      await driverProfile.assignRide(rideId);

      return {
        ride,
        driver: driverProfile
      };
    } catch (error) {
      console.error('Error assigning ride to driver:', error);
      throw error;
    }
  }

  /**
   * Cancel a ride assignment
   * @param {String} rideId - Ride request ID
   * @param {String} dispatcherId - Dispatcher ID
   * @param {String} reason - Cancellation reason
   * @returns {Object} Cancellation result
   */
  async cancelRideAssignment(rideId, dispatcherId, reason = 'Assignment cancelled') {
    const startTime = Date.now();
    
    try {
      const ride = await RideRequest.findById(rideId);
      if (!ride) {
        throw new Error('Ride request not found');
      }

      const driverId = ride.assignedDriverId;
      
      // Update ride status
      ride.status = 'CANCELLED';
      ride.cancelledAt = new Date();
      ride.cancellationReason = reason;
      await ride.save();

      // Free up the driver
      if (driverId) {
        const driverProfile = await DriverProfile.findOne({ userId: driverId });
        if (driverProfile) {
          driverProfile.currentRideId = null;
          await driverProfile.save();
        }
      }

      // Log cancellation
      await DispatchLog.logAction({
        rideId,
        dispatcherId,
        action: 'CANCEL_ASSIGNMENT',
        previousDriverId: driverId,
        reason,
        result: 'SUCCESS',
        processingTime: Date.now() - startTime
      });

      return {
        success: true,
        message: 'Ride assignment cancelled successfully',
        cancelledRide: ride
      };

    } catch (error) {
      await DispatchLog.logAction({
        rideId,
        dispatcherId,
        action: 'CANCEL_ASSIGNMENT',
        reason: `Cancellation failed: ${error.message}`,
        result: 'FAILED',
        errorMessage: error.message,
        processingTime: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Get current system load for analytics
   * @returns {String} System load level
   */
  async getSystemLoad() {
    try {
      const [pendingRides, onlineDrivers] = await Promise.all([
        RideRequest.countDocuments({ status: 'PENDING' }),
        DriverProfile.countDocuments({ isOnline: true, status: 'ACTIVE' })
      ]);

      const ratio = onlineDrivers > 0 ? pendingRides / onlineDrivers : 999;
      
      if (ratio < 0.5) return 'LOW';
      if (ratio < 1.0) return 'MEDIUM';
      if (ratio < 2.0) return 'HIGH';
      return 'CRITICAL';
    } catch (error) {
      return 'UNKNOWN';
    }
  }

  /**
   * Get dispatch queue status
   * @returns {Object} Queue status information
   */
  async getQueueStatus() {
    try {
      const [pendingRides, assignedRides, onlineDrivers, availableDrivers] = await Promise.all([
        RideRequest.countDocuments({ status: 'PENDING' }),
        RideRequest.countDocuments({ status: { $in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } }),
        DriverProfile.countDocuments({ isOnline: true, status: 'ACTIVE' }),
        DriverProfile.countDocuments({ isOnline: true, status: 'ACTIVE', currentRideId: null })
      ]);

      return {
        pendingRides,
        assignedRides,
        onlineDrivers,
        availableDrivers,
        systemLoad: await this.getSystemLoad(),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting queue status:', error);
      throw error;
    }
  }

  /**
   * Calculate estimated fare for a ride
   * @param {Number} distance - Distance in meters
   * @param {Number} duration - Duration in minutes
   * @param {String} priority - Ride priority
   * @returns {Number} Estimated fare in PGK
   */
  calculateEstimatedFare(distance, duration, priority = 'NORMAL') {
    const baseFare = 5.0; // K5 base fare
    const perKmRate = 2.0; // K2 per kilometer
    const perMinuteRate = 0.5; // K0.50 per minute
    
    const distanceKm = distance / 1000;
    const distanceFare = distanceKm * perKmRate;
    const timeFare = duration * perMinuteRate;
    
    let totalFare = baseFare + distanceFare + timeFare;
    
    // Priority multiplier
    switch (priority) {
      case 'HIGH':
        totalFare *= 1.2;
        break;
      case 'URGENT':
        totalFare *= 1.5;
        break;
    }
    
    // Round to nearest K5
    return Math.ceil(totalFare / 5) * 5;
  }
}

module.exports = new DispatchService();
