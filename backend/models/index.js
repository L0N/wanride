// Central export file for all database models
// This provides a clean way to import all models from a single location

const User = require('./User');
const DriverProfile = require('./DriverProfile');
const DriverLocation = require('./DriverLocation');
const Vehicle = require('./Vehicle');
const Ride = require('./Ride');
const RideRequest = require('./RideRequest');
const DispatchLog = require('./DispatchLog');
const WalletLedger = require('./WalletLedger');

module.exports = {
  User,
  DriverProfile,
  DriverLocation,
  Vehicle,
  Ride,
  RideRequest,
  DispatchLog,
  WalletLedger
};

// Model validation helper
module.exports.validateModels = () => {
  const models = [User, DriverProfile, DriverLocation, Vehicle, Ride, RideRequest, DispatchLog, WalletLedger];
  const results = {};
  
  models.forEach(Model => {
    try {
      // Check if model is properly defined
      if (!Model || !Model.modelName) {
        throw new Error(`Invalid model: ${Model}`);
      }
      
      // Check if model has required methods
      const requiredMethods = ['find', 'findOne', 'create', 'updateOne', 'deleteOne'];
      const missingMethods = requiredMethods.filter(method => typeof Model[method] !== 'function');
      
      if (missingMethods.length > 0) {
        throw new Error(`Missing methods: ${missingMethods.join(', ')}`);
      }
      
      results[Model.modelName] = {
        status: 'valid',
        schema: Model.schema ? Object.keys(Model.schema.paths).length : 0,
        indexes: Model.schema ? Model.schema.indexes().length : 0
      };
    } catch (error) {
      results[Model.modelName || 'unknown'] = {
        status: 'invalid',
        error: error.message
      };
    }
  });
  
  return results;
};

// Schema relationship helper
module.exports.getRelationships = () => {
  return {
    User: {
      hasMany: ['Ride', 'RideRequest', 'DriverProfile', 'WalletLedger'],
      references: ['Ride.passengerId', 'Ride.driverId', 'RideRequest.passengerId', 'RideRequest.driverId']
    },
    DriverProfile: {
      belongsTo: ['User', 'Vehicle'],
      hasMany: ['DriverLocation', 'Ride', 'RideRequest'],
      references: ['User.userId', 'Vehicle.assignedVehicleId']
    },
    DriverLocation: {
      belongsTo: ['DriverProfile'],
      references: ['DriverProfile.userId']
    },
    Vehicle: {
      hasMany: ['DriverProfile', 'Ride', 'RideRequest'],
      references: ['DriverProfile.assignedVehicleId', 'Ride.vehicleId', 'RideRequest.vehicleId']
    },
    Ride: {
      belongsTo: ['User', 'Vehicle'],
      hasMany: ['WalletLedger'],
      references: ['User.passengerId', 'User.driverId', 'Vehicle.vehicleId']
    },
    RideRequest: {
      belongsTo: ['User', 'Vehicle'],
      hasMany: ['DispatchLog'],
      references: ['User.passengerId', 'User.driverId', 'Vehicle.vehicleId']
    },
    DispatchLog: {
      belongsTo: ['RideRequest', 'User'],
      references: ['RideRequest.rideRequestId', 'User.dispatcherId']
    },
    WalletLedger: {
      belongsTo: ['User', 'Ride'],
      references: ['User.userId', 'Ride.rideId']
    }
  };
};
