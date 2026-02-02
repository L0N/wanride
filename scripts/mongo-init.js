// MongoDB Initialization Script for WanRide Production
// This script runs when MongoDB container starts for the first time

// Switch to admin database
db = db.getSiblingDB('admin');

// Create application user with read/write access to wanride database
db.createUser({
  user: 'wanride_user',
  pwd: process.env.MONGO_ROOT_PASSWORD || 'changeme',
  roles: [
    {
      role: 'readWrite',
      db: 'wanride'
    },
    {
      role: 'dbAdmin',
      db: 'wanride'
    }
  ]
});

// Switch to wanride database
db = db.getSiblingDB('wanride');

// Create collections with validation schemas
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['phone', 'name', 'role'],
      properties: {
        phone: {
          bsonType: 'string',
          pattern: '^\\+675[0-9]{8}$',
          description: 'Must be a valid PNG phone number'
        },
        name: {
          bsonType: 'string',
          minLength: 2,
          maxLength: 100,
          description: 'Must be a string between 2-100 characters'
        },
        role: {
          enum: ['PASSENGER', 'DRIVER', 'DISPATCHER', 'OWNER'],
          description: 'Must be a valid user role'
        },
        email: {
          bsonType: ['string', 'null'],
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'Must be a valid email address if provided'
        }
      }
    }
  }
});

db.createCollection('rides', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['passengerId', 'pickup', 'destination', 'status'],
      properties: {
        status: {
          enum: ['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
          description: 'Must be a valid ride status'
        },
        fare: {
          bsonType: ['number', 'null'],
          minimum: 5,
          multipleOf: 5,
          description: 'Must be K5-rounded if provided'
        }
      }
    }
  }
});

db.createCollection('vehicles', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['licensePlate', 'make', 'model', 'year', 'ownerId'],
      properties: {
        licensePlate: {
          bsonType: 'string',
          pattern: '^[A-Z]{3}[0-9]{3}$',
          description: 'Must be valid PNG license plate format (ABC123)'
        },
        year: {
          bsonType: 'int',
          minimum: 1990,
          maximum: 2030,
          description: 'Must be between 1990-2030'
        }
      }
    }
  }
});

// Create indexes for performance
print('Creating indexes...');

// Users indexes
db.users.createIndex({ phone: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ 'location.coordinates': '2dsphere' });

// Rides indexes
db.rides.createIndex({ passengerId: 1 });
db.rides.createIndex({ driverId: 1 });
db.rides.createIndex({ status: 1 });
db.rides.createIndex({ createdAt: -1 });
db.rides.createIndex({ completedAt: -1 });
db.rides.createIndex({ 'pickup.coordinates': '2dsphere' });
db.rides.createIndex({ 'destination.coordinates': '2dsphere' });

// Vehicles indexes
db.vehicles.createIndex({ licensePlate: 1 }, { unique: true });
db.vehicles.createIndex({ ownerId: 1 });
db.vehicles.createIndex({ driverId: 1 });
db.vehicles.createIndex({ status: 1 });

// Commission payouts indexes
db.commissionpayouts.createIndex({ driverId: 1 });
db.commissionpayouts.createIndex({ status: 1 });
db.commissionpayouts.createIndex({ 'period.from': 1, 'period.to': 1 });
db.commissionpayouts.createIndex({ createdAt: -1 });

// Shifts indexes
db.shifts.createIndex({ driverId: 1 });
db.shifts.createIndex({ status: 1 });
db.shifts.createIndex({ startedAt: -1 });
db.shifts.createIndex({ endedAt: -1 });

// Create compound indexes for common queries
db.rides.createIndex({ driverId: 1, status: 1, completedAt: -1 });
db.rides.createIndex({ passengerId: 1, createdAt: -1 });
db.commissionpayouts.createIndex({ driverId: 1, status: 1 });

// Insert default admin user (change password in production!)
db.users.insertOne({
  phone: '+67512345678',
  name: 'WanRide Admin',
  email: 'admin@wanride.com.pg',
  role: 'OWNER',
  password: '$2b$10$example.hash.change.in.production',
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Insert sample NCD boundaries for reference
db.settings.insertOne({
  _id: 'ncd_boundaries',
  name: 'NCD Boundaries (Port Moresby)',
  boundaries: {
    north: -9.3,
    south: -9.6,
    east: 147.3,
    west: 147.0
  },
  description: 'National Capital District boundaries for fare calculation',
  createdAt: new Date(),
  updatedAt: new Date()
});

// Insert default fare settings
db.settings.insertOne({
  _id: 'fare_settings',
  name: 'Fare Configuration',
  settings: {
    ncdFlatRate: 30,
    baseFare: 30,
    distanceRate: 2.00,
    timeRate: 0.50,
    freeDistanceKm: 10,
    returnFeePercentage: 25,
    airportAddon: 10,
    commissionRate: 0.20
  },
  description: 'K5-compliant fare calculation settings',
  createdAt: new Date(),
  updatedAt: new Date()
});

print('MongoDB initialization completed successfully!');
print('Collections created: users, rides, vehicles, commissionpayouts, shifts, settings');
print('Indexes created for optimal performance');
print('Default admin user created (change password!)');
print('Default settings configured');

// Display collection stats
print('\nCollection statistics:');
db.runCommand('listCollections').cursor.firstBatch.forEach(function(collection) {
  print('- ' + collection.name + ': ' + db.getCollection(collection.name).countDocuments() + ' documents');
});
