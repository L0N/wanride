const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server');
const User = require('../models/User');
const jwtService = require('../utils/jwt');

// Test database
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/wanride_fleet_test';

describe('Authentication System', () => {
  let server;

  beforeAll(async () => {
    // Connect to test database
    try {
      await mongoose.connect(MONGODB_TEST_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000,
      });
    } catch (error) {
      console.error('Failed to connect to test database:', error.message);
      throw error;
    }
    server = app.listen(0); // Use random port for testing
  });

  afterAll(async () => {
    // Clean up
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
      }
    } catch (error) {
      console.error('Error during test cleanup:', error.message);
    }
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Clear users collection before each test
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({});
    }
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '75123456',
      password: 'Test123!',
      roles: ['PASSENGER']
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Registration successful');
      expect(response.body.user.email).toBe(validUserData.email);
      expect(response.body.user.isVerified).toBe(false);
    });

    it('should reject registration with invalid email', async () => {
      const invalidData = { ...validUserData, email: 'invalid-email' };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject registration with weak password', async () => {
      const invalidData = { ...validUserData, password: '123' };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should format PNG phone number correctly', async () => {
      const pngUserData = { ...validUserData, phone: '75123456' };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(pngUserData)
        .expect(201);

      expect(response.body.user.phone).toBe('+67575123456');
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    let testUser;
    let otpToken;

    beforeEach(async () => {
      // Create a test user
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+67575123456',
        password: 'Test123!',
        roles: ['PASSENGER']
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      testUser = response.body.user;
      otpToken = response.body.otpToken;
    });

    it('should verify OTP successfully', async () => {
      // Mock OTP verification (in real scenario, OTP would be sent via SMS)
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          phone: testUser.phone,
          otp: '123456', // Mock OTP
          otpToken: otpToken
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified successfully');
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
    });

    it('should reject invalid OTP', async () => {
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          phone: testUser.phone,
          otp: '000000',
          otpToken: otpToken
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid OTP');
    });
  });

  describe('POST /api/auth/login', () => {
    let verifiedUser;

    beforeEach(async () => {
      // Create and verify a test user
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        phone: '+67575123456',
        password: 'Test123!',
        roles: ['PASSENGER'],
        isVerified: true
      });
      await user.save();
      verifiedUser = user;
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Login successful');
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login for unverified user', async () => {
      // Create unverified user
      const unverifiedUser = new User({
        name: 'Unverified User',
        email: 'unverified@example.com',
        phone: '+67575123457',
        password: 'Test123!',
        roles: ['PASSENGER'],
        isVerified: false
      });
      await unverifiedUser.save();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unverified@example.com',
          password: 'Test123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not verified');
    });
  });

  describe('JWT Token Management', () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      phone: '+67575123456',
      name: 'Test User',
      roles: ['PASSENGER'],
      isVerified: true,
      rating: 4.5
    };

    it('should generate valid access token', () => {
      const token = jwtService.generateAccessToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwtService.verifyAccessToken(token);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.tokenType).toBe('access');
    });

    it('should generate valid refresh token', () => {
      const token = jwtService.generateRefreshToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwtService.verifyRefreshToken(token);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.tokenType).toBe('refresh');
    });

    it('should generate valid OTP verification token', () => {
      const token = jwtService.generateOTPVerificationToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwtService.verifyOTPVerificationToken(token);
      expect(decoded.phone).toBe(mockUser.phone);
      expect(decoded.tokenType).toBe('otp_verification');
    });

    it('should reject expired tokens', (done) => {
      // Create token with very short expiry
      const shortLivedToken = jwtService.generateAccessToken(mockUser, '1ms');
      
      setTimeout(() => {
        expect(() => {
          jwtService.verifyAccessToken(shortLivedToken);
        }).toThrow();
        done();
      }, 10);
    });
  });

  describe('GET /health', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.message).toContain('WanRides API is running');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/auth/health', () => {
    it('should return authentication service health', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('Authentication');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
