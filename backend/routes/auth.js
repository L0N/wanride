const express = require('express');
const authController = require('../controllers/authController');
const { 
  authenticate, 
  authRateLimit, 
  logAuthEvent 
} = require('../middleware/auth');
const {
  validateRegistration,
  validateLogin,
  validateOTPVerification,
  validateOTPResend,
  validateTokenRefresh,
  validateSMSTest
} = require('../utils/validation');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { name, email, phone, password, roles }
 */
router.post('/register', 
  authRateLimit,
  logAuthEvent('REGISTER_ATTEMPT'),
  validateRegistration,
  authController.register
);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP and complete registration/login
 * @access  Public
 * @body    { otpToken, otp }
 */
router.post('/verify-otp',
  authRateLimit,
  logAuthEvent('OTP_VERIFICATION_ATTEMPT'),
  validateOTPVerification,
  authController.verifyOTP
);

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP for verification
 * @access  Public
 * @body    { otpToken }
 */
router.post('/resend-otp',
  authRateLimit,
  logAuthEvent('OTP_RESEND_ATTEMPT'),
  validateOTPResend,
  authController.resendOTP
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 * @body    { email, password }
 */
router.post('/login',
  authRateLimit,
  logAuthEvent('LOGIN_ATTEMPT'),
  validateLogin,
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 * @body    { refreshToken }
 */
router.post('/refresh',
  authRateLimit,
  logAuthEvent('TOKEN_REFRESH_ATTEMPT'),
  validateTokenRefresh,
  authController.refreshToken
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticate,
  authController.getProfile
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout',
  authenticate,
  logAuthEvent('LOGOUT'),
  authController.logout
);

/**
 * @route   POST /api/auth/test-sms
 * @desc    Test SMS service (development only)
 * @access  Public (should be restricted in production)
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test-sms',
    validateSMSTest,
    authController.testSMS
  );
}

/**
 * @route   GET /api/auth/health
 * @desc    Health check for authentication service
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Authentication service is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;
