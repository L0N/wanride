const mongoose = require('mongoose');

const driverLocationSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;     // latitude
        },
        message: 'Invalid coordinates format'
      }
    }
  },
  
  heading: {
    type: Number, // degrees (0-360)
    min: 0,
    max: 360,
    default: null
  },
  
  speed: {
    type: Number, // km/h
    min: 0,
    default: null
  },
  
  accuracy: {
    type: Number, // meters
    min: 0,
    default: null
  },
  
  altitude: {
    type: Number, // meters above sea level
    default: null
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  isOnline: {
    type: Boolean,
    default: true,
    index: true
  },
  
  batteryLevel: {
    type: Number, // percentage (0-100)
    min: 0,
    max: 100,
    default: null
  },
  
  signalStrength: {
    type: Number, // signal strength indicator
    default: null
  },
  
  source: {
    type: String,
    enum: ['GPS', 'NETWORK', 'PASSIVE'],
    default: 'GPS'
  }
}, {
  timestamps: true
});

// Geospatial index for location-based queries
driverLocationSchema.index({ location: '2dsphere' });

// Compound indexes for efficient queries
driverLocationSchema.index({ driverId: 1, timestamp: -1 });
driverLocationSchema.index({ isOnline: 1, timestamp: -1 });
driverLocationSchema.index({ driverId: 1, isOnline: 1 });

// TTL index to automatically remove old location data (keep for 24 hours)
driverLocationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });

// Static method to get latest location for a driver
driverLocationSchema.statics.getLatestLocation = function(driverId) {
  return this.findOne({ driverId })
    .sort({ timestamp: -1 })
    .populate('driverId', 'name phone');
};

// Static method to get all online drivers with their latest locations
driverLocationSchema.statics.getOnlineDrivers = function() {
  return this.aggregate([
    {
      $match: { isOnline: true }
    },
    {
      $sort: { driverId: 1, timestamp: -1 }
    },
    {
      $group: {
        _id: '$driverId',
        latestLocation: { $first: '$$ROOT' }
      }
    },
    {
      $replaceRoot: { newRoot: '$latestLocation' }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'driverId',
        foreignField: '_id',
        as: 'driver'
      }
    },
    {
      $unwind: '$driver'
    },
    {
      $lookup: {
        from: 'driverprofiles',
        localField: 'driverId',
        foreignField: 'userId',
        as: 'profile'
      }
    },
    {
      $unwind: '$profile'
    },
    {
      $match: {
        'profile.status': 'ACTIVE'
      }
    }
  ]);
};

// Static method to find drivers near a location
driverLocationSchema.statics.findNearbyDrivers = function(coordinates, maxDistance = 5000, limit = 10) {
  return this.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: coordinates
        },
        distanceField: 'distance',
        maxDistance: maxDistance,
        spherical: true,
        query: { isOnline: true }
      }
    },
    {
      $sort: { driverId: 1, timestamp: -1 }
    },
    {
      $group: {
        _id: '$driverId',
        latestLocation: { $first: '$$ROOT' }
      }
    },
    {
      $replaceRoot: { newRoot: '$latestLocation' }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'driverId',
        foreignField: '_id',
        as: 'driver'
      }
    },
    {
      $unwind: '$driver'
    },
    {
      $lookup: {
        from: 'driverprofiles',
        localField: 'driverId',
        foreignField: 'userId',
        as: 'profile'
      }
    },
    {
      $unwind: '$profile'
    },
    {
      $match: {
        'profile.status': 'ACTIVE',
        'profile.currentRideId': null // Only available drivers
      }
    },
    {
      $limit: limit
    },
    {
      $sort: { distance: 1 }
    }
  ]);
};

// Static method to update driver location
driverLocationSchema.statics.updateDriverLocation = function(driverId, locationData) {
  const {
    coordinates,
    heading,
    speed,
    accuracy,
    altitude,
    batteryLevel,
    signalStrength,
    source = 'GPS'
  } = locationData;

  return this.create({
    driverId,
    location: {
      type: 'Point',
      coordinates
    },
    heading,
    speed,
    accuracy,
    altitude,
    batteryLevel,
    signalStrength,
    source,
    timestamp: new Date()
  });
};

// Static method to set driver online/offline status
driverLocationSchema.statics.setDriverStatus = function(driverId, isOnline, coordinates = null) {
  const updateData = {
    driverId,
    isOnline,
    timestamp: new Date()
  };

  if (coordinates) {
    updateData.location = {
      type: 'Point',
      coordinates
    };
  }

  return this.create(updateData);
};

// Instance method to calculate distance to a point
driverLocationSchema.methods.distanceTo = function(coordinates) {
  const [lon1, lat1] = this.location.coordinates;
  const [lon2, lat2] = coordinates;
  
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

// Instance method to check if location is stale
driverLocationSchema.methods.isStale = function(maxAgeMinutes = 5) {
  const now = new Date();
  const ageMinutes = (now - this.timestamp) / (1000 * 60);
  return ageMinutes > maxAgeMinutes;
};

module.exports = mongoose.model('DriverLocation', driverLocationSchema);
