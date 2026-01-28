const { User, DriverProfile } = require('../models');
const jwtService = require('../utils/jwt');
const smsService = require('../services/smsService');
const { validationResult } = require('express-validator');

class AuthController {
  /**
   * Register a new user
   */
  async register(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { name, email, phone, password, roles } = req.body;

      // Format PNG phone number
      const formattedPhone = smsService.formatPNGPhoneNumber(phone);

      // Validate PNG phone number
      if (!smsService.isValidPNGPhoneNumber(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Papua New Guinea phone number format',
          code: 'INVALID_PHONE_FORMAT'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: email.toLowerCase() },
          { phone: formattedPhone }
        ]
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User already exists with this email or phone number',
          code: 'USER_EXISTS'
        });
      }

      // Validate roles
      const validRoles = ['PASSENGER', 'DRIVER', 'DISPATCHER', 'OWNER'];
      const userRoles = Array.isArray(roles) ? roles : [roles || 'PASSENGER'];
      
      for (const role of userRoles) {
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            success: false,
            message: `Invalid role: ${role}`,
            code: 'INVALID_ROLE'
          });
        }
      }

      // Create user
      const user = new User({
        name,
        email: email.toLowerCase(),
        phone: formattedPhone,
        password,
        roles: userRoles
      });

      // Generate and send OTP
      const otp = user.generateOTP();
      await user.save();

      const smsResult = await smsService.sendOTP(formattedPhone, otp, 'verification');

      if (!smsResult.success) {
        // If SMS fails, still create user but log the error
        console.error('Failed to send OTP SMS:', smsResult.error);
      }

      // Create driver profile if user has DRIVER role
      if (userRoles.includes('DRIVER')) {
        const driverProfile = new DriverProfile({
          userId: user._id,
          license: '', // Will be filled during verification process
          status: 'APPLIED'
        });
        await driverProfile.save();
      }

      // Generate OTP token for verification
      const otpToken = jwtService.generateOTPToken(user, otp);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please verify your phone number.',
        data: {
          userId: user._id,
          email: user.email,
          phone: user.phone,
          name: user.name,
          roles: user.roles,
          isVerified: user.isVerified,
          otpToken: otpToken,
          smsStatus: smsResult.success ? 'sent' : 'failed'
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Verify OTP and complete registration
   */
  async verifyOTP(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { otpToken, otp } = req.body;

      // Verify OTP token
      const decoded = await jwtService.verifyOTPToken(otpToken);
      
      // Find user
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Verify OTP
      if (!user.verifyOTP(otp)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP',
          code: 'INVALID_OTP'
        });
      }

      await user.save();

      // Generate access tokens
      const tokens = jwtService.generateTokenPair(user);

      // Send welcome SMS for drivers
      if (user.hasRole('DRIVER')) {
        await smsService.sendDriverWelcome(user.phone, user.name);
      }

      res.json({
        success: true,
        message: 'Phone number verified successfully',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            roles: user.roles,
            rating: user.rating,
            isVerified: user.isVerified
          },
          tokens
        }
      });

    } catch (error) {
      console.error('OTP verification error:', error);
      
      if (error.message === 'OTP verification expired') {
        return res.status(400).json({
          success: false,
          message: 'OTP verification token expired',
          code: 'OTP_TOKEN_EXPIRED'
        });
      }

      res.status(500).json({
        success: false,
        message: 'OTP verification failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Login user
   */
  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ 
        email: email.toLowerCase() 
      }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked due to too many failed login attempts',
          code: 'ACCOUNT_LOCKED'
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        // Increment failed login attempts
        await user.incLoginAttempts();
        
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Check if user is verified
      if (!user.isVerified) {
        // Generate new OTP and send
        const otp = user.generateOTP();
        await user.save();

        const smsResult = await smsService.sendOTP(user.phone, otp, 'login');
        const otpToken = jwtService.generateOTPToken(user, otp);

        return res.status(403).json({
          success: false,
          message: 'Phone number not verified. OTP sent to your phone.',
          code: 'VERIFICATION_REQUIRED',
          data: {
            otpToken: otpToken,
            phone: user.phone,
            smsStatus: smsResult.success ? 'sent' : 'failed'
          }
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const tokens = jwtService.generateTokenPair(user);

      // Get driver profile if user is a driver
      let driverProfile = null;
      if (user.hasRole('DRIVER')) {
        driverProfile = await DriverProfile.findOne({ userId: user._id });
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            roles: user.roles,
            rating: user.rating,
            isVerified: user.isVerified,
            lastLogin: user.lastLogin
          },
          driverProfile,
          tokens
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token required',
          code: 'REFRESH_TOKEN_MISSING'
        });
      }

      // Verify refresh token
      const decoded = await jwtService.verifyRefreshToken(refreshToken);

      // Get user
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }

      // Generate new tokens
      const tokens = jwtService.generateTokenPair(user);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: { tokens }
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      
      if (error.message === 'Refresh token expired') {
        return res.status(401).json({
          success: false,
          message: 'Refresh token expired',
          code: 'REFRESH_TOKEN_EXPIRED'
        });
      }

      res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
  }

  /**
   * Resend OTP
   */
  async resendOTP(req, res) {
    try {
      const { otpToken } = req.body;

      if (!otpToken) {
        return res.status(400).json({
          success: false,
          message: 'OTP token required',
          code: 'OTP_TOKEN_MISSING'
        });
      }

      // Verify OTP token (even if expired, we can still get user info)
      let decoded;
      try {
        decoded = await jwtService.verifyOTPToken(otpToken);
      } catch (error) {
        // If token is expired, try to decode without verification
        const jwt = require('jsonwebtoken');
        decoded = jwt.decode(otpToken);
        if (!decoded || decoded.tokenType !== 'otp_verification') {
          return res.status(400).json({
            success: false,
            message: 'Invalid OTP token',
            code: 'INVALID_OTP_TOKEN'
          });
        }
      }

      // Find user
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Generate new OTP
      const otp = user.generateOTP();
      await user.save();

      // Send SMS
      const smsResult = await smsService.sendOTP(user.phone, otp, 'verification');

      // Generate new OTP token
      const newOtpToken = jwtService.generateOTPToken(user, otp);

      res.json({
        success: true,
        message: 'OTP sent successfully',
        data: {
          otpToken: newOtpToken,
          phone: user.phone,
          smsStatus: smsResult.success ? 'sent' : 'failed'
        }
      });

    } catch (error) {
      console.error('Resend OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend OTP',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req, res) {
    try {
      const user = req.user;
      
      // Get driver profile if user is a driver
      let driverProfile = null;
      if (user.hasRole('DRIVER')) {
        driverProfile = await DriverProfile.findOne({ userId: user._id })
          .populate('assignedVehicleId');
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            roles: user.roles,
            rating: user.rating,
            isVerified: user.isVerified,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt
          },
          driverProfile
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Logout user (invalidate token on client side)
   */
  async logout(req, res) {
    try {
      // In a production app, you might want to blacklist the token
      // For now, we'll just return success and let client handle token removal
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Test SMS service
   */
  async testSMS(req, res) {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number required'
        });
      }

      const result = await smsService.testService(phone);

      res.json({
        success: result.success,
        message: result.success ? 'SMS test successful' : 'SMS test failed',
        data: result
      });

    } catch (error) {
      console.error('SMS test error:', error);
      res.status(500).json({
        success: false,
        message: 'SMS test failed',
        error: error.message
      });
    }
  }
}

module.exports = new AuthController();
