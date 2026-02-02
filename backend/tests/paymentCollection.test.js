const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Ride = require('../models/Ride');
const { roundToK5 } = require('../utils/k5Rounding');

/**
 * Payment Collection Tests - Week 2: Cash Payment Collection
 * 
 * Tests for:
 * - Payment confirmation API
 * - Payment dispute reporting
 * - Receipt generation
 * - K5 rounding validation
 * - Error handling
 */

describe('Payment Collection API', () => {
  let driverToken;
  let passengerToken;
  let driverId;
  let passengerId;
  let testRide;

  beforeAll(async () => {
    // Connect to test database
    try {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/wanride_test', {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000,
      });
    } catch (error) {
      console.error('Failed to connect to test database:', error.message);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clear test data
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({});
      await Ride.deleteMany({});
    }

    // Create test driver
    const driver = new User({
      name: 'Test Driver',
      email: 'driver@test.com',
      phone: '+67512345678',
      roles: ['DRIVER'],
      password: 'password123'
    });
    await driver.save();
    driverId = driver._id;

    // Create test passenger
    const passenger = new User({
      name: 'Test Passenger',
      email: 'passenger@test.com',
      phone: '+67587654321',
      roles: ['PASSENGER'],
      password: 'password123'
    });
    await passenger.save();
    passengerId = passenger._id;

    // Get auth tokens
    const driverLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'driver@test.com',
        password: 'password123'
      });
    driverToken = driverLogin.body.token;

    const passengerLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'passenger@test.com',
        password: 'password123'
      });
    passengerToken = passengerLogin.body.token;

    // Create test ride
    testRide = new Ride({
      passengerId: passengerId,
      driverId: driverId,
      vehicleId: new mongoose.Types.ObjectId(),
      pickup: {
        address: 'Test Pickup Location',
        coordinates: [-9.4438, 147.1803]
      },
      destination: {
        address: 'Test Destination',
        coordinates: [-9.4500, 147.1900]
      },
      status: 'IN_PROGRESS',
      fareCalculation: {
        method: 'FLAT_NCD',
        baseFare: 30,
        finalFare: 30,
        withinNCD: true,
        isAirportTrip: false,
        calculatedAt: new Date()
      },
      payment: {
        status: 'PENDING',
        amountDue: 30
      }
    });
    await testRide.save();
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
    } catch (error) {
      console.error('Error during test cleanup:', error.message);
    }
  });

  describe('POST /api/driver/rides/:rideId/payment', () => {
    test('should confirm payment collection successfully', async () => {
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          amountCollected: 30,
          paymentMethod: 'CASH',
          notes: 'Passenger paid exact amount'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ride.payment.status).toBe('COLLECTED');
      expect(response.body.data.ride.payment.amountCollected).toBe(30);
      expect(response.body.data.receiptNumber).toBeDefined();
      expect(response.body.data.receiptNumber).toMatch(/^WR-\d{8}-\d{4}$/);
    });

    test('should reject payment with wrong amount', async () => {
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          amountCollected: 25, // Wrong amount
          paymentMethod: 'CASH'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('does not match expected fare');
    });

    test('should reject non-K5-rounded amounts', async () => {
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          amountCollected: 27, // Not K5-rounded
          paymentMethod: 'CASH'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('K5-rounded');
    });

    test('should reject unauthorized driver', async () => {
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/payment`)
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({
          amountCollected: 30,
          paymentMethod: 'CASH'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Driver role required');
    });

    test('should reject payment for wrong driver', async () => {
      // Create another driver
      const otherDriver = new User({
        name: 'Other Driver',
        email: 'other@test.com',
        phone: '+67511111111',
        roles: ['DRIVER'],
        password: 'password123'
      });
      await otherDriver.save();

      const otherDriverLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@test.com',
          password: 'password123'
        });

      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/payment`)
        .set('Authorization', `Bearer ${otherDriverLogin.body.token}`)
        .send({
          amountCollected: 30,
          paymentMethod: 'CASH'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Not authorized for this ride');
    });

    test('should reject payment for already collected ride', async () => {
      // First payment
      await request(app)
        .post(`/api/driver/rides/${testRide._id}/payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          amountCollected: 30,
          paymentMethod: 'CASH'
        });

      // Second payment attempt
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          amountCollected: 30,
          paymentMethod: 'CASH'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already been collected');
    });

    test('should update ride status to COMPLETED', async () => {
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          amountCollected: 30,
          paymentMethod: 'CASH'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.ride.status).toBe('COMPLETED');
      expect(response.body.data.ride.timestamps.completed).toBeDefined();
    });
  });

  describe('POST /api/driver/rides/:rideId/dispute', () => {
    test('should report payment dispute successfully', async () => {
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/dispute`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          reportedAmount: 25,
          reason: 'Passenger only had K25 in cash and no change available'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.dispute.exists).toBe(true);
      expect(response.body.data.dispute.reportedAmount).toBe(25);
      expect(response.body.data.dispute.difference).toBe(5);
      expect(response.body.data.ride.payment.status).toBe('DISPUTED');
    });

    test('should reject non-K5-rounded dispute amounts', async () => {
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/dispute`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          reportedAmount: 27, // Not K5-rounded
          reason: 'Passenger paid wrong amount'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('K5-rounded');
    });

    test('should reject dispute with short reason', async () => {
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/dispute`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          reportedAmount: 25,
          reason: 'Short' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('between 10 and 1000 characters');
    });

    test('should complete ride despite dispute', async () => {
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/dispute`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          reportedAmount: 25,
          reason: 'Passenger only had K25 in cash'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.ride.status).toBe('COMPLETED');
      expect(response.body.data.ride.timestamps.completed).toBeDefined();
    });

    test('should calculate positive difference for short payment', async () => {
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/dispute`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          reportedAmount: 20, // K10 short
          reason: 'Passenger short-paid by K10'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.dispute.difference).toBe(10); // 30 - 20 = 10
    });

    test('should calculate negative difference for overpayment', async () => {
      const response = await request(app)
        .post(`/api/driver/rides/${testRide._id}/dispute`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          reportedAmount: 35, // K5 over
          reason: 'Passenger overpaid by K5'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.dispute.difference).toBe(-5); // 30 - 35 = -5
    });
  });

  describe('GET /api/driver/rides/:rideId/receipt', () => {
    beforeEach(async () => {
      // Collect payment first
      await request(app)
        .post(`/api/driver/rides/${testRide._id}/payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          amountCollected: 30,
          paymentMethod: 'CASH'
        });
    });

    test('should retrieve receipt data successfully', async () => {
      const response = await request(app)
        .get(`/api/driver/rides/${testRide._id}/receipt`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.receiptData).toBeDefined();
      expect(response.body.data.receiptNumber).toBeDefined();
      expect(response.body.data.receiptData.receiptNumber).toMatch(/^WR-\d{8}-\d{4}$/);
      expect(response.body.data.receiptData.fare.total).toBe('K30');
    });

    test('should reject receipt request for unpaid ride', async () => {
      // Create new unpaid ride
      const unpaidRide = new Ride({
        passengerId: passengerId,
        driverId: driverId,
        vehicleId: new mongoose.Types.ObjectId(),
        pickup: {
          address: 'Test Pickup',
          coordinates: [-9.4438, 147.1803]
        },
        destination: {
          address: 'Test Destination',
          coordinates: [-9.4500, 147.1900]
        },
        status: 'IN_PROGRESS',
        fareCalculation: {
          method: 'FLAT_NCD',
          finalFare: 30
        },
        payment: {
          status: 'PENDING',
          amountDue: 30
        }
      });
      await unpaidRide.save();

      const response = await request(app)
        .get(`/api/driver/rides/${unpaidRide._id}/receipt`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('No receipt available');
    });
  });

  describe('K5 Rounding Integration', () => {
    test('should handle distance-based fare with K5 rounding', async () => {
      // Create ride with distance-based fare
      const distanceRide = new Ride({
        passengerId: passengerId,
        driverId: driverId,
        vehicleId: new mongoose.Types.ObjectId(),
        pickup: {
          address: 'Port Moresby',
          coordinates: [-9.4438, 147.1803]
        },
        destination: {
          address: 'Outside NCD',
          coordinates: [-9.5000, 147.2500]
        },
        status: 'IN_PROGRESS',
        fareCalculation: {
          method: 'DISTANCE_BASED',
          baseFare: 30,
          distanceKm: 15.3,
          distanceCharge: 10.6, // 5.3km * K2/km
          timeMinutes: 25,
          timeCharge: 12.5, // 25min * K0.50/min
          subtotal: 53.1,
          returnFee: 13.275, // 25% of 53.1
          finalFare: roundToK5(53.1 + 13.275), // Should be K65
          withinNCD: false,
          isAirportTrip: false
        },
        payment: {
          status: 'PENDING',
          amountDue: roundToK5(53.1 + 13.275)
        }
      });
      await distanceRide.save();

      const response = await request(app)
        .post(`/api/driver/rides/${distanceRide._id}/payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          amountCollected: distanceRide.payment.amountDue,
          paymentMethod: 'CASH'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.ride.payment.amountCollected).toBe(distanceRide.payment.amountDue);
      expect(distanceRide.payment.amountDue % 5).toBe(0); // Must be K5-rounded
    });

    test('should handle airport fare with K5 rounding', async () => {
      // Create airport ride
      const airportRide = new Ride({
        passengerId: passengerId,
        driverId: driverId,
        vehicleId: new mongoose.Types.ObjectId(),
        pickup: {
          address: 'Port Moresby Hotel',
          coordinates: [-9.4438, 147.1803]
        },
        destination: {
          address: 'Jackson\'s International Airport',
          coordinates: [-9.4434, 147.2200]
        },
        status: 'IN_PROGRESS',
        fareCalculation: {
          method: 'FLAT_NCD_AIRPORT',
          baseFare: 30,
          airportAddon: 10,
          finalFare: 40, // K30 + K10
          withinNCD: true,
          isAirportTrip: true
        },
        payment: {
          status: 'PENDING',
          amountDue: 40
        }
      });
      await airportRide.save();

      const response = await request(app)
        .post(`/api/driver/rides/${airportRide._id}/payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          amountCollected: 40,
          paymentMethod: 'CASH'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.ride.payment.amountCollected).toBe(40);
      expect(response.body.data.receiptData.fare.items).toHaveLength(2); // Base + Airport
    });
  });

  describe('Receipt Generation', () => {
    test('should generate receipt with correct PNG timezone', async () => {
      await request(app)
        .post(`/api/driver/rides/${testRide._id}/payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          amountCollected: 30,
          paymentMethod: 'CASH'
        });

      const response = await request(app)
        .get(`/api/driver/rides/${testRide._id}/receipt`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.receiptData.dateTime).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
      expect(response.body.data.receiptData.company.name).toBe('WanRide');
    });

    test('should include fare breakdown in receipt', async () => {
      await request(app)
        .post(`/api/driver/rides/${testRide._id}/payment`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          amountCollected: 30,
          paymentMethod: 'CASH'
        });

      const response = await request(app)
        .get(`/api/driver/rides/${testRide._id}/receipt`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.receiptData.fare.items).toHaveLength(1);
      expect(response.body.data.receiptData.fare.items[0].description).toBe('Flat rate (Port Moresby)');
      expect(response.body.data.receiptData.fare.items[0].amount).toBe('K30');
    });
  });
});
