/**
 * Security Middleware for WanRide Production
 * Implements comprehensive security hardening measures
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const logger = require('../config/logger');

/**
 * Apply comprehensive security middleware to Express app
 */
function applySecurityMiddleware(app) {
  // Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "https:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        manifestSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Allow for PWA functionality
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS configuration
  const corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = [
        'https://wanride.com.pg',
        'https://www.wanride.com.pg'
      ];
      
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (process.env.NODE_ENV === 'development') {
        allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
      }
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400 // 24 hours
  };
  
  app.use(cors(corsOptions));

  // Rate limiting
  const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = false) => {
    return rateLimit({
      windowMs,
      max,
      message: { error: message },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests,
      handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
        res.status(429).json({ error: message });
      }
    });
  };

  // General API rate limiting
  app.use('/api/', createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // limit each IP to 100 requests per windowMs
    'Too many requests from this IP, please try again later.'
  ));

  // Strict rate limiting for authentication endpoints
  app.use('/api/auth/', createRateLimit(
    15 * 60 * 1000, // 15 minutes
    10, // limit each IP to 10 auth requests per windowMs
    'Too many authentication attempts, please try again later.',
    true // skip successful requests
  ));

  // Very strict rate limiting for SMS endpoints
  app.use('/api/sms/', createRateLimit(
    60 * 60 * 1000, // 1 hour
    5, // limit each IP to 5 SMS requests per hour
    'SMS rate limit exceeded. Please try again later.'
  ));

  // Password reset rate limiting
  app.use('/api/auth/forgot-password', createRateLimit(
    60 * 60 * 1000, // 1 hour
    3, // limit each IP to 3 password reset requests per hour
    'Too many password reset attempts, please try again later.'
  ));

  // Data sanitization against NoSQL query injection
  app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      logger.warn(`Sanitized NoSQL injection attempt from IP: ${req.ip}, Key: ${key}`);
    }
  }));

  // Data sanitization against XSS attacks
  app.use(xss());

  // Prevent HTTP Parameter Pollution attacks
  app.use(hpp({
    whitelist: ['sort', 'fields', 'page', 'limit', 'status'] // Allow these params to be arrays
  }));

  // Custom security headers
  app.use((req, res, next) => {
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    // Add custom security headers
    res.setHeader('X-API-Version', '3.0.0');
    res.setHeader('X-Request-ID', req.id || 'unknown');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Feature policy
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=()');
    
    next();
  });

  // Request logging for security monitoring
  app.use((req, res, next) => {
    // Log suspicious patterns
    const suspiciousPatterns = [
      /\.\./,  // Directory traversal
      /<script/i,  // XSS attempts
      /union.*select/i,  // SQL injection
      /javascript:/i,  // JavaScript injection
      /vbscript:/i,  // VBScript injection
      /onload=/i,  // Event handler injection
      /onerror=/i  // Error handler injection
    ];

    const userAgent = req.get('User-Agent') || '';
    const url = req.originalUrl || req.url;
    const body = JSON.stringify(req.body || {});

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(body) || pattern.test(userAgent)) {
        logger.warn(`Suspicious request detected from IP: ${req.ip}`, {
          ip: req.ip,
          userAgent,
          url,
          method: req.method,
          pattern: pattern.toString()
        });
        break;
      }
    }

    next();
  });

  // IP whitelist for admin endpoints (if needed)
  const adminIPWhitelist = process.env.ADMIN_IP_WHITELIST?.split(',') || [];
  
  if (adminIPWhitelist.length > 0) {
    app.use('/api/admin/', (req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      
      if (!adminIPWhitelist.includes(clientIP)) {
        logger.warn(`Unauthorized admin access attempt from IP: ${clientIP}`);
        return res.status(403).json({ error: 'Access denied' });
      }
      
      next();
    });
  }

  logger.info('Security middleware applied successfully');
}

/**
 * Create a custom rate limiter for specific endpoints
 */
function createCustomRateLimit(options) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Rate limit exceeded',
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    keyGenerator,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Custom rate limit exceeded`, {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      res.status(429).json({ error: message });
    }
  });
}

/**
 * Middleware to validate API keys for external integrations
 */
function validateAPIKey(req, res, next) {
  const apiKey = req.header('X-API-Key');
  const validAPIKeys = process.env.VALID_API_KEYS?.split(',') || [];

  if (!apiKey || !validAPIKeys.includes(apiKey)) {
    logger.warn(`Invalid API key attempt from IP: ${req.ip}`);
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
}

/**
 * Middleware to block requests from known malicious IPs
 */
function blockMaliciousIPs(req, res, next) {
  const blockedIPs = process.env.BLOCKED_IPS?.split(',') || [];
  const clientIP = req.ip || req.connection.remoteAddress;

  if (blockedIPs.includes(clientIP)) {
    logger.warn(`Blocked request from malicious IP: ${clientIP}`);
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
}

module.exports = {
  applySecurityMiddleware,
  createCustomRateLimit,
  validateAPIKey,
  blockMaliciousIPs
};
