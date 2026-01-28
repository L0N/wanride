const DriverLocation = require('../models/DriverLocation');
const DriverProfile = require('../models/DriverProfile');
const RideRequest = require('../models/RideRequest');
const dispatchService = require('../services/dispatchService');
const logger = require('../utils/logger');

/**
 * Socket.io event handlers for real-time dispatch system
 */
class SocketHandlers {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socketId mapping
    this.driverSockets = new Map(); // driverId -> socket mapping
    this.dispatcherSockets = new Set(); // Set of dispatcher socket IDs
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    logger.info(`New socket connection: ${socket.id}`);

    // Authentication middleware should have attached user to socket
    if (!socket.user) {
      logger.warn(`Unauthenticated socket connection: ${socket.id}`);
      socket.emit('error', { message: 'Authentication required' });
      socket.disconnect();
      return;
    }

    const user = socket.user;
    this.connectedUsers.set(user.id, socket.id);

    // Join appropriate rooms based on user roles
    this.joinRoleBasedRooms(socket, user);

    // Set up event listeners
    this.setupEventListeners(socket, user);

    // Send initial connection acknowledgment
    socket.emit('connected', {
      message: 'Connected to WanRide dispatch system',
      socketId: socket.id,
      userId: user.id,
      roles: user.roles
    });

    logger.info(`User ${user.id} (${user.roles.join(',')}) connected with socket ${socket.id}`);
  }

  /**
   * Join rooms based on user roles
   */
  joinRoleBasedRooms(socket, user) {
    // All users join their personal room
    socket.join(`user:${user.id}`);

    if (user.roles.includes('DRIVER')) {
      socket.join('drivers');
      this.driverSockets.set(user.id, socket);
      logger.info(`Driver ${user.id} joined drivers room`);
    }

    if (user.roles.includes('DISPATCHER')) {
      socket.join('dispatchers');
      this.dispatcherSockets.add(socket.id);
      logger.info(`Dispatcher ${user.id} joined dispatchers room`);
    }

    if (user.roles.includes('PASSENGER')) {
      socket.join('passengers');
      logger.info(`Passenger ${user.id} joined passengers room`);
    }

    if (user.roles.includes('OWNER')) {
      socket.join('owners');
      logger.info(`Owner ${user.id} joined owners room`);
    }
  }

  /**
   * Set up event listeners for a socket
   */
  setupEventListeners(socket, user) {
    // Driver events
    if (user.roles.includes('DRIVER')) {
      socket.on('driver:online', (data) => this.handleDriverOnline(socket, user, data));
      socket.on('driver:offline', (data) => this.handleDriverOffline(socket, user, data));
      socket.on('driver:location_update', (data) => this.handleLocationUpdate(socket, user, data));
      socket.on('ride:accept', (data) => this.handleRideAccept(socket, user, data));
      socket.on('ride:arrived', (data) => this.handleRideArrived(socket, user, data));
      socket.on('ride:start', (data) => this.handleRideStart(socket, user, data));
      socket.on('ride:complete', (data) => this.handleRideComplete(socket, user, data));
      socket.on('ride:cancel', (data) => this.handleRideCancel(socket, user, data));
    }

    // Passenger events
    if (user.roles.includes('PASSENGER')) {
      socket.on('ride:request', (data) => this.handleRideRequest(socket, user, data));
      socket.on('ride:cancel', (data) => this.handleRideCancel(socket, user, data));
    }

    // Dispatcher events
    if (user.roles.includes('DISPATCHER')) {
      socket.on('dispatcher:assign', (data) => this.handleManualAssign(socket, user, data));
      socket.on('dispatcher:reassign', (data) => this.handleReassign(socket, user, data));
      socket.on('dispatcher:cancel', (data) => this.handleDispatcherCancel(socket, user, data));
      socket.on('fleet:status_request', () => this.handleFleetStatusRequest(socket));
    }

    // Emergency events (all roles)
    socket.on('sos:trigger', (data) => this.handleSOSAlert(socket, user, data));

    // Disconnect handler
    socket.on('disconnect', (reason) => this.handleDisconnect(socket, user, reason));
  }

  /**
   * Handle driver going online
   */
  async handleDriverOnline(socket, user, data) {
    try {
      const { coordinates } = data;
      
      if (!coordinates || coordinates.length !== 2) {
        socket.emit('error', { message: 'Valid coordinates required' });
        return;
      }

      // Update driver profile
      const driverProfile = await DriverProfile.findOne({ userId: user.id });
      if (!driverProfile) {
        socket.emit('error', { message: 'Driver profile not found' });
        return;
      }

      if (!driverProfile.canGoOnline) {
        socket.emit('error', { message: 'Driver cannot go online. Check status and vehicle assignment.' });
        return;
      }

      // Set driver online
      await driverProfile.goOnline();
      await driverProfile.updateLocation(coordinates[0], coordinates[1]);

      // Update location tracking
      await DriverLocation.setDriverStatus(user.id, true, coordinates);

      // Notify dispatchers
      this.io.to('dispatchers').emit('driver:status_change', {
        driverId: user.id,
        driver: {
          id: user.id,
          name: user.name,
          phone: user.phone
        },
        status: 'ONLINE',
        location: {
          type: 'Point',
          coordinates
        },
        timestamp: new Date()
      });

      socket.emit('driver:online_success', {
        message: 'Successfully went online',
        status: 'ONLINE',
        timestamp: new Date()
      });

      logger.info(`Driver ${user.id} went online at coordinates [${coordinates.join(', ')}]`);

    } catch (error) {
      logger.error(`Error handling driver online: ${error.message}`);
      socket.emit('error', { message: 'Failed to go online' });
    }
  }

  /**
   * Handle driver going offline
   */
  async handleDriverOffline(socket, user, data) {
    try {
      // Update driver profile
      const driverProfile = await DriverProfile.findOne({ userId: user.id });
      if (driverProfile) {
        await driverProfile.goOffline();
      }

      // Update location tracking
      await DriverLocation.setDriverStatus(user.id, false);

      // Notify dispatchers
      this.io.to('dispatchers').emit('driver:status_change', {
        driverId: user.id,
        driver: {
          id: user.id,
          name: user.name,
          phone: user.phone
        },
        status: 'OFFLINE',
        timestamp: new Date()
      });

      socket.emit('driver:offline_success', {
        message: 'Successfully went offline',
        status: 'OFFLINE',
        timestamp: new Date()
      });

      logger.info(`Driver ${user.id} went offline`);

    } catch (error) {
      logger.error(`Error handling driver offline: ${error.message}`);
      socket.emit('error', { message: 'Failed to go offline' });
    }
  }

  /**
   * Handle driver location update
   */
  async handleLocationUpdate(socket, user, data) {
    try {
      const { coordinates, heading, speed, accuracy } = data;
      
      if (!coordinates || coordinates.length !== 2) {
        return; // Silently ignore invalid location updates
      }

      // Update driver location in database
      await DriverLocation.updateDriverLocation(user.id, {
        coordinates,
        heading,
        speed,
        accuracy
      });

      // Update driver profile location
      const driverProfile = await DriverProfile.findOne({ userId: user.id });
      if (driverProfile) {
        await driverProfile.updateLocation(coordinates[0], coordinates[1]);
      }

      // Broadcast to dispatchers (throttled)
      this.io.to('dispatchers').emit('driver:location_update', {
        driverId: user.id,
        location: {
          type: 'Point',
          coordinates
        },
        heading,
        speed,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error(`Error handling location update: ${error.message}`);
    }
  }

  /**
   * Handle ride request from passenger
   */
  async handleRideRequest(socket, user, data) {
    try {
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
      } = data;

      // Validate required fields
      if (!pickupLocation || !dropoffLocation || !pickupAddress || !dropoffAddress) {
        socket.emit('error', { message: 'Missing required ride request data' });
        return;
      }

      // Calculate estimated fare
      const estimatedFare = dispatchService.calculateEstimatedFare(
        estimatedDistance,
        estimatedDuration,
        priority
      );

      // Create ride request
      const rideRequest = new RideRequest({
        passengerId: user.id,
        pickupLocation,
        pickupAddress,
        dropoffLocation,
        dropoffAddress,
        estimatedDistance,
        estimatedDuration,
        estimatedFare,
        priority,
        specialRequests,
        passengerNotes
      });

      await rideRequest.save();

      // Notify dispatchers
      this.io.to('dispatchers').emit('ride:new_request', {
        rideId: rideRequest._id,
        passenger: {
          id: user.id,
          name: user.name,
          phone: user.phone
        },
        pickupLocation,
        pickupAddress,
        dropoffLocation,
        dropoffAddress,
        estimatedFare,
        priority,
        requestedAt: rideRequest.requestedAt
      });

      // Attempt auto-assignment
      setTimeout(async () => {
        try {
          const assignmentResult = await dispatchService.autoAssignRide(rideRequest._id);
          
          if (assignmentResult.success) {
            // Notify assigned driver
            const driverSocket = this.driverSockets.get(assignmentResult.assignedDriver.driverId);
            if (driverSocket) {
              driverSocket.emit('ride:assigned', {
                rideId: rideRequest._id,
                passenger: {
                  id: user.id,
                  name: user.name,
                  phone: user.phone
                },
                pickupLocation,
                pickupAddress,
                dropoffLocation,
                dropoffAddress,
                estimatedFare,
                distance: assignmentResult.assignedDriver.distance
              });
            }

            // Notify passenger
            socket.emit('ride:assigned', {
              rideId: rideRequest._id,
              driver: {
                id: assignmentResult.assignedDriver.driverId,
                name: assignmentResult.assignedDriver.driver.name,
                phone: assignmentResult.assignedDriver.driver.phone
              },
              estimatedArrival: Math.round(assignmentResult.assignedDriver.distance / 500) // rough estimate
            });

            // Notify dispatchers
            this.io.to('dispatchers').emit('ride:auto_assigned', {
              rideId: rideRequest._id,
              driverId: assignmentResult.assignedDriver.driverId,
              distance: assignmentResult.assignedDriver.distance,
              processingTime: assignmentResult.processingTime
            });
          }
        } catch (error) {
          logger.error(`Auto-assignment failed for ride ${rideRequest._id}: ${error.message}`);
        }
      }, 1000); // 1 second delay for auto-assignment

      socket.emit('ride:request_success', {
        rideId: rideRequest._id,
        message: 'Ride request submitted successfully',
        estimatedFare,
        status: 'PENDING'
      });

      logger.info(`Ride request created: ${rideRequest._id} by passenger ${user.id}`);

    } catch (error) {
      logger.error(`Error handling ride request: ${error.message}`);
      socket.emit('error', { message: 'Failed to create ride request' });
    }
  }

  /**
   * Handle ride acceptance by driver
   */
  async handleRideAccept(socket, user, data) {
    try {
      const { rideId } = data;
      
      const ride = await RideRequest.findById(rideId);
      if (!ride) {
        socket.emit('error', { message: 'Ride not found' });
        return;
      }

      if (ride.assignedDriverId.toString() !== user.id) {
        socket.emit('error', { message: 'Ride not assigned to you' });
        return;
      }

      if (ride.status !== 'ASSIGNED') {
        socket.emit('error', { message: 'Ride cannot be accepted in current status' });
        return;
      }

      // Update ride status
      ride.status = 'ACCEPTED';
      await ride.save();

      // Notify passenger
      this.io.to(`user:${ride.passengerId}`).emit('ride:accepted', {
        rideId: ride._id,
        driver: {
          id: user.id,
          name: user.name,
          phone: user.phone
        },
        acceptedAt: new Date()
      });

      // Notify dispatchers
      this.io.to('dispatchers').emit('ride:status_update', {
        rideId: ride._id,
        status: 'ACCEPTED',
        driverId: user.id,
        timestamp: new Date()
      });

      socket.emit('ride:accept_success', {
        rideId: ride._id,
        message: 'Ride accepted successfully'
      });

      logger.info(`Ride ${rideId} accepted by driver ${user.id}`);

    } catch (error) {
      logger.error(`Error handling ride accept: ${error.message}`);
      socket.emit('error', { message: 'Failed to accept ride' });
    }
  }

  /**
   * Handle manual assignment by dispatcher
   */
  async handleManualAssign(socket, user, data) {
    try {
      const { rideId, driverId, reason } = data;
      
      const result = await dispatchService.manualAssignRide(rideId, driverId, user.id, reason);
      
      if (result.success) {
        // Notify assigned driver
        const driverSocket = this.driverSockets.get(driverId);
        if (driverSocket) {
          const ride = await RideRequest.findById(rideId).populate('passengerId');
          driverSocket.emit('ride:assigned', {
            rideId,
            passenger: {
              id: ride.passengerId._id,
              name: ride.passengerId.name,
              phone: ride.passengerId.phone
            },
            pickupLocation: ride.pickupLocation,
            pickupAddress: ride.pickupAddress,
            dropoffLocation: ride.dropoffLocation,
            dropoffAddress: ride.dropoffAddress,
            estimatedFare: ride.estimatedFare,
            assignmentType: 'MANUAL'
          });
        }

        // Notify other dispatchers
        socket.to('dispatchers').emit('ride:manually_assigned', {
          rideId,
          driverId,
          dispatcherId: user.id,
          reason,
          timestamp: new Date()
        });

        socket.emit('dispatch:assign_success', {
          rideId,
          driverId,
          message: 'Ride manually assigned successfully'
        });
      }

    } catch (error) {
      logger.error(`Error handling manual assignment: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Handle SOS alert
   */
  async handleSOSAlert(socket, user, data) {
    try {
      const { location, message, rideId } = data;
      
      const sosAlert = {
        userId: user.id,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          roles: user.roles
        },
        location,
        message,
        rideId,
        timestamp: new Date(),
        alertId: `sos_${Date.now()}_${user.id}`
      };

      // Broadcast to all dispatchers and owners
      this.io.to('dispatchers').emit('sos:alert', sosAlert);
      this.io.to('owners').emit('sos:alert', sosAlert);

      // Log the SOS alert
      logger.error(`SOS ALERT from user ${user.id}: ${message} at location [${location?.coordinates?.join(', ')}]`);

      socket.emit('sos:alert_sent', {
        message: 'SOS alert sent successfully',
        alertId: sosAlert.alertId
      });

    } catch (error) {
      logger.error(`Error handling SOS alert: ${error.message}`);
      socket.emit('error', { message: 'Failed to send SOS alert' });
    }
  }

  /**
   * Handle fleet status request from dispatcher
   */
  async handleFleetStatusRequest(socket) {
    try {
      const queueStatus = await dispatchService.getQueueStatus();
      const onlineDrivers = await DriverLocation.getOnlineDrivers();
      
      socket.emit('fleet:status_update', {
        queue: queueStatus,
        drivers: onlineDrivers,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error(`Error handling fleet status request: ${error.message}`);
      socket.emit('error', { message: 'Failed to get fleet status' });
    }
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnect(socket, user, reason) {
    logger.info(`User ${user.id} disconnected: ${reason}`);
    
    // Clean up tracking
    this.connectedUsers.delete(user.id);
    
    if (user.roles.includes('DRIVER')) {
      this.driverSockets.delete(user.id);
    }
    
    if (user.roles.includes('DISPATCHER')) {
      this.dispatcherSockets.delete(socket.id);
    }

    // If driver disconnects, mark as offline after a delay
    if (user.roles.includes('DRIVER')) {
      setTimeout(async () => {
        try {
          // Check if driver reconnected
          if (!this.connectedUsers.has(user.id)) {
            const driverProfile = await DriverProfile.findOne({ userId: user.id });
            if (driverProfile && driverProfile.isOnline) {
              await driverProfile.goOffline();
              await DriverLocation.setDriverStatus(user.id, false);
              
              // Notify dispatchers
              this.io.to('dispatchers').emit('driver:status_change', {
                driverId: user.id,
                status: 'OFFLINE',
                reason: 'Connection lost',
                timestamp: new Date()
              });
            }
          }
        } catch (error) {
          logger.error(`Error handling driver disconnect cleanup: ${error.message}`);
        }
      }, 30000); // 30 second grace period
    }
  }

  // Additional helper methods for ride lifecycle events...
  async handleRideArrived(socket, user, data) {
    // Implementation for driver arrival
  }

  async handleRideStart(socket, user, data) {
    // Implementation for ride start
  }

  async handleRideComplete(socket, user, data) {
    // Implementation for ride completion
  }

  async handleRideCancel(socket, user, data) {
    // Implementation for ride cancellation
  }

  async handleReassign(socket, user, data) {
    // Implementation for ride reassignment
  }

  async handleDispatcherCancel(socket, user, data) {
    // Implementation for dispatcher cancellation
  }
}

module.exports = SocketHandlers;
