const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Ride = require('../models/Ride');
const CommissionPayout = require('../models/CommissionPayout');
const { 
  calculateRideCommission,
  calculateDriverCommissions,
  getCurrentWeekRange,
  getLastWeekRange
} = require('../services/commissionService');
const { roundToK5 } = require('../utils/k5Rounding');

/**
 * Commission System Tests - Week 3: Commission Calculation & Payout
 * 
 * Tests for:
 * - Commission calculation (20% with K5 rounding)
 * - Driver commission API endpoints
 * - Weekly payout generation
 * - Commission tracking and breakdown
 * - K5 rounding validation
 */

describe('Commission System', () => {
  let driverToken;
  let driverId;
  let testRides = [];

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/wanride_test');
  });

  beforeEach(async () => {
    // Clear test data
    await User.deleteMany({});
    await Ride.deleteMany({});
    await CommissionPayout.deleteMany({});

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

    // Get auth token
    const driverLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'driver@test.com',
        password: 'password123'
      });
    driverToken = driverLogin.body.token;

    // Create test passenger
    const passenger = new User({
      name: 'Test Passenger',
      email: 'passenger@test.com',
      phone: '+67587654321',
      roles: ['PASSENGER'],
      password: 'password123'
    });
    await passenger.save();

    // Create completed rides with collected payments
    const rideData = [
      { finalFare: 30, method: 'FLAT_NCD' },
      { finalFare: 105, method: 'DISTANCE_BASED' },
      { finalFare: 40, method: 'FLAT_NCD_AIRPORT' },
      { finalFare: 75, method: 'DISTANCE_BASED' }
    ];

    for (const data of rideData) {
      const ride = new Ride({
        passengerId: passenger._id,
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
        status: 'COMPLETED',
        fareCalculation: {
          method: data.method,
          finalFare: data.finalFare,
          baseFare: 30,
          calculatedAt: new Date()
        },
        payment: {
          status: 'COLLECTED',
          amountDue: data.finalFare,
          amountCollected: data.finalFare,
          collectedAt: new Date(),
          receiptNumber: `WR-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        },
        timestamps: {
          requested: new Date(),
          completed: new Date()
        }
      });
      await ride.save();
      testRides.push(ride);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Commission Calculation', () => {
    test('should calculate 20% commission with K5 rounding', () => {
      const testCases = [
        { fare: 30, expectedCommission: 5 },   // 6 → 5
        { fare: 50, expectedCommission: 10 },  // 10 → 10
        { fare: 75, expectedCommission: 15 },  // 15 → 15
        { fare: 105, expectedCommission: 20 }, // 21 → 20
        { fare: 130, expectedCommission: 25 }, // 26 → 25
        { fare: 200, expectedCommission: 40 }  // 40 → 40
      ];

      testCases.forEach(({ fare, expectedCommission }) => {
        const ride = {
          fareCalculation: { finalFare: fare },
          payment: { status: 'COLLECTED' }
        };

        const commission = calculateRideCommission(ride);
        
        expect(commission.fare).toBe(fare);
        expect(commission.commissionRate).toBe(0.20);
        expect(commission.commission).toBe(expectedCommission);
        expect(commission.commission % 5).toBe(0); // Must be K5-rounded
        expect(commission.netToCompany).toBe(fare - expectedCommission);
      });
    });

    test('should throw error for ride without fare calculation', () => {
      const ride = {
        payment: { status: 'COLLECTED' }
      };

      expect(() => calculateRideCommission(ride)).toThrow('Ride must have fare calculation');
    });

    test('should throw error for ride without collected payment', () => {
      const ride = {
        fareCalculation: { finalFare: 100 },
        payment: { status: 'PENDING' }
      };

      expect(() => calculateRideCommission(ride)).toThrow('Commission only calculated for collected payments');
    });
  });

  describe('Driver Commission Calculation', () => {
    test('should calculate total commissions for driver period', async () => {
      const { from, to } = getCurrentWeekRange();
      
      const commissionData = await calculateDriverCommissions(driverId, from, to);
      
      expect(commissionData.driverId).toEqual(driverId);
      expect(commissionData.ridesCompleted).toBe(4);
      expect(commissionData.totalFares).toBe(250); // 30 + 105 + 40 + 75
      
      // Expected commissions: 5 + 20 + 10 + 15 = 50
      expect(commissionData.totalCommissions).toBe(50);
      expect(commissionData.totalCommissions % 5).toBe(0); // K5-rounded
      
      expect(commissionData.netToCompany).toBe(200); // 250 - 50
      expect(commissionData.averageCommissionPerRide).toBe(roundToK5(50 / 4)); // K12.5 → K10
      
      expect(commissionData.details).toHaveLength(4);
      expect(commissionData.details[0]).toHaveProperty('rideId');
      expect(commissionData.details[0]).toHaveProperty('fare');
      expect(commissionData.details[0]).toHaveProperty('commission');
    });

    test('should return zero data for driver with no rides', async () => {
      // Create another driver with no rides
      const otherDriver = new User({
        name: 'Other Driver',
        email: 'other@test.com',
        phone: '+67511111111',
        roles: ['DRIVER'],
        password: 'password123'
      });
      await otherDriver.save();

      const { from, to } = getCurrentWeekRange();
      const commissionData = await calculateDriverCommissions(otherDriver._id, from, to);
      
      expect(commissionData.ridesCompleted).toBe(0);
      expect(commissionData.totalFares).toBe(0);
      expect(commissionData.totalCommissions).toBe(0);
      expect(commissionData.details).toHaveLength(0);
    });
  });

  describe('Commission API Endpoints', () => {
    test('GET /api/driver/commissions should return commission data', async () => {
      const response = await request(app)
        .get('/api/driver/commissions?period=THIS_WEEK')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('ridesCompleted', 4);
      expect(response.body.data).toHaveProperty('totalFares', 250);
      expect(response.body.data).toHaveProperty('totalCommissions', 50);
      expect(response.body.data.details).toHaveLength(4);
    });

    test('GET /api/driver/commissions should support different periods', async () => {
      const periods = ['TODAY', 'THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH'];
      
      for (const period of periods) {
        const response = await request(app)
          .get(`/api/driver/commissions?period=${period}`)
          .set('Authorization', `Bearer ${driverToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('period');
        expect(response.body.data).toHaveProperty('ridesCompleted');
        expect(response.body.data).toHaveProperty('totalCommissions');
      }
    });

    test('GET /api/driver/commissions should reject invalid period', async () => {
      const response = await request(app)
        .get('/api/driver/commissions?period=INVALID')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid period specified');
    });

    test('GET /api/driver/payouts should return empty payout history', async () => {
      const response = await request(app)
        .get('/api/driver/payouts')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.payouts).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });

    test('GET /api/driver/commission-stats should return statistics', async () => {
      const response = await request(app)
        .get('/api/driver/commission-stats')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('thisWeek');
      expect(response.body.data).toHaveProperty('lastWeek');
      expect(response.body.data).toHaveProperty('thisMonth');
      expect(response.body.data).toHaveProperty('recentPayouts');
    });

    test('should require driver authentication', async () => {
      const response = await request(app)
        .get('/api/driver/commissions');

      expect(response.status).toBe(401);
    });
  });

  describe('Commission Payout Model', () => {
    test('should create payout with valid data', async () => {
      const { from, to } = getLastWeekRange();
      const weekNumber = 1;
      const year = 2024;

      const payout = new CommissionPayout({
        driverId: driverId,
        period: {
          from: from,
          to: to,
          weekNumber: weekNumber,
          year: year
        },
        rides: testRides.map(r => r._id),
        ridesCount: 4,
        totalFares: 250,
        totalCommissionsBeforeRounding: 50,
        totalCommissions: 50,
        deductions: [],
        totalDeductions: 0,
        netPayout: 50,
        status: 'PENDING',
        generatedBy: 'AUTO'
      });

      await payout.save();

      expect(payout._id).toBeDefined();
      expect(payout.netPayout).toBe(50);
      expect(payout.status).toBe('PENDING');
    });

    test('should validate K5 rounding on amounts', async () => {
      const payout = new CommissionPayout({
        driverId: driverId,
        period: {
          from: new Date(),
          to: new Date(),
          weekNumber: 1,
          year: 2024
        },
        rides: [],
        ridesCount: 1,
        totalFares: 103, // Not K5-rounded
        totalCommissionsBeforeRounding: 20.6,
        totalCommissions: 20,
        netPayout: 20
      });

      await expect(payout.save()).rejects.toThrow('Total fares must be K5-rounded');
    });

    test('should calculate net payout automatically', async () => {
      const payout = new CommissionPayout({
        driverId: driverId,
        period: {
          from: new Date(),
          to: new Date(),
          weekNumber: 1,
          year: 2024
        },
        rides: [],
        ridesCount: 1,
        totalFares: 100,
        totalCommissionsBeforeRounding: 20,
        totalCommissions: 20,
        deductions: [
          {
            type: 'FUEL',
            amount: 5,
            reason: 'Fuel cost',
            addedBy: driverId
          }
        ]
      });

      await payout.save();

      expect(payout.totalDeductions).toBe(5);
      expect(payout.netPayout).toBe(15); // 20 - 5
    });

    test('should prevent negative net payout', async () => {
      const payout = new CommissionPayout({
        driverId: driverId,
        period: {
          from: new Date(),
          to: new Date(),
          weekNumber: 1,
          year: 2024
        },
        rides: [],
        ridesCount: 1,
        totalFares: 100,
        totalCommissionsBeforeRounding: 20,
        totalCommissions: 20,
        deductions: [
          {
            type: 'DAMAGE',
            amount: 25, // More than commission
            reason: 'Vehicle damage',
            addedBy: driverId
          }
        ]
      });

      await expect(payout.save()).rejects.toThrow('Net payout cannot be negative');
    });
  });

  describe('K5 Rounding Integration', () => {
    test('should maintain K5 rounding throughout commission calculation', async () => {
      // Test various fare amounts and ensure all commission calculations are K5-rounded
      const testFares = [27, 33, 47, 53, 67, 73, 87, 93, 107, 113];
      
      for (const fare of testFares) {
        const ride = {
          fareCalculation: { finalFare: fare },
          payment: { status: 'COLLECTED' }
        };

        const commission = calculateRideCommission(ride);
        
        // Commission must be K5-rounded
        expect(commission.commission % 5).toBe(0);
        
        // Net to company must also be valid
        expect(commission.netToCompany).toBe(fare - commission.commission);
      }
    });

    test('should handle edge cases in commission calculation', () => {
      const edgeCases = [
        { fare: 5, expectedCommission: 0 },    // 1 → 0
        { fare: 10, expectedCommission: 0 },   // 2 → 0
        { fare: 15, expectedCommission: 5 },   // 3 → 5
        { fare: 20, expectedCommission: 5 },   // 4 → 5
        { fare: 25, expectedCommission: 5 }    // 5 → 5
      ];

      edgeCases.forEach(({ fare, expectedCommission }) => {
        const ride = {
          fareCalculation: { finalFare: fare },
          payment: { status: 'COLLECTED' }
        };

        const commission = calculateRideCommission(ride);
        expect(commission.commission).toBe(expectedCommission);
      });
    });
  });
});
