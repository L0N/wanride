const jwtService = require('../utils/jwt');
const { User } = require('../models');

/**
 * Middleware to authenticate JWT tokens
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    // Verify the token
    const decoded = await jwtService.verifyAccessToken(token);

    // Get fresh user data from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        message: 'Account is temporarily locked',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Attach user to request
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.message === 'Access token expired') {
      return res.status(401).json({
        success: false,
        message: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.message === 'Invalid access token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid access token',
        code: 'TOKEN_INVALID'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

/**
 * Middleware to check if user has specific role
 */
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!jwtService.hasRole(req.user.roles, role)) {
      return res.status(403).json({
        success: false,
        message: `${role} role required`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRole: role,
        userRoles: req.user.roles
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has any of the specified roles
 */
const requireAnyRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!jwtService.hasAnyRole(req.user.roles, roles)) {
      return res.status(403).json({
        success: false,
        message: `One of these roles required: ${roles.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRoles: req.user.roles
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is verified
 */
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Account verification required',
      code: 'VERIFICATION_REQUIRED'
    });
  }

  next();
};

/**
 * Middleware for passenger-only routes
 */
const requirePassenger = [authenticate, requireRole('PASSENGER')];

/**
 * Middleware for driver-only routes
 */
const requireDriver = [authenticate, requireRole('DRIVER')];

/**
 * Middleware for dispatcher-only routes
 */
const requireDispatcher = [authenticate, requireRole('DISPATCHER')];

/**
 * Middleware for owner-only routes
 */
const requireOwner = [authenticate, requireRole('OWNER')];

/**
 * Middleware for driver or dispatcher routes
 */
const requireDriverOrDispatcher = [authenticate, requireAnyRole(['DRIVER', 'DISPATCHER'])];

/**
 * Middleware for dispatcher or owner routes
 */
const requireDispatcherOrOwner = [authenticate, requireAnyRole(['DISPATCHER', 'OWNER'])];

/**
 * Middleware for any authenticated user
 */
const requireAuth = [authenticate];

/**
 * Middleware for verified users only
 */
const requireVerifiedUser = [authenticate, requireVerified];

/**
 * Optional authentication - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = await jwtService.verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-password');
    
    if (user && user.isActive && !user.isLocked) {
      req.user = user;
      req.token = token;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    req.user = null;
    next();
  }
};

/**
 * Rate limiting middleware for authentication endpoints
 */
const authRateLimit = (req, res, next) => {
  // This would typically use a rate limiting library like express-rate-limit
  // For now, we'll implement a simple in-memory rate limiter
  
  const ip = req.ip || req.connection.remoteAddress;
  const key = `auth_${ip}`;
  
  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }
  
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5; // 5 attempts per window
  
  const record = global.rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };
  
  if (now > record.resetTime) {
    // Reset the window
    record.count = 0;
    record.resetTime = now + windowMs;
  }
  
  if (record.count >= maxAttempts) {
    return res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((record.resetTime - now) / 1000)
    });
  }
  
  record.count++;
  global.rateLimitStore.set(key, record);
  
  next();
};

/**
 * Middleware to log authentication events
 */
const logAuthEvent = (event) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the authentication event
      const logData = {
        event,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        success: res.statusCode < 400,
        userId: req.user ? req.user._id : null,
        email: req.body ? req.body.email : null
      };
      
      console.log('Auth Event:', JSON.stringify(logData));
      
      // Call original send
      originalSend.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  authenticate,
  requireRole,
  requireAnyRole,
  requireVerified,
  requirePassenger,
  requireDriver,
  requireDispatcher,
  requireOwner,
  requireDriverOrDispatcher,
  requireDispatcherOrOwner,
  requireAuth,
  requireVerifiedUser,
  optionalAuth,
  authRateLimit,
  logAuthEvent
};
