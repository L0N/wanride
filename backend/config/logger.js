const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(colors);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (stack) {
      logMessage += `\nStack: ${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      logMessage += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    
    let logMessage = `${timestamp} ${level}: ${message}`;
    
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      logMessage += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  format: logFormat,
  defaultMeta: { service: 'wanride-api', version: '3.0.0' },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    // HTTP requests log
    new winston.transports.File({
      filename: path.join(logDir, 'http.log'),
      level: 'http',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Security events log
    new winston.transports.File({
      filename: path.join(logDir, 'security.log'),
      level: 'warn',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],
});

// Add console transport
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
} else {
  // In production, only log errors to console
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'error'
  }));
}

// Create a stream object for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Helper functions for structured logging
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    contentLength: res.get('Content-Length') || 0
  };
  
  if (req.user) {
    logData.userId = req.user._id;
    logData.userRole = req.user.role;
  }
  
  logger.http('HTTP Request', logData);
};

logger.logError = (error, req = null, additionalInfo = {}) => {
  const logData = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...additionalInfo
  };
  
  if (req) {
    logData.request = {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
    
    if (req.user) {
      logData.request.userId = req.user._id;
      logData.request.userRole = req.user.role;
    }
  }
  
  logger.error('Application Error', logData);
};

logger.logSecurity = (event, req, additionalInfo = {}) => {
  const logData = {
    event,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl || req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  };
  
  if (req.user) {
    logData.userId = req.user._id;
    logData.userRole = req.user.role;
  }
  
  logger.warn('Security Event', logData);
};

logger.logBusiness = (event, data = {}) => {
  logger.info('Business Event', {
    event,
    timestamp: new Date().toISOString(),
    ...data
  });
};

logger.logPerformance = (operation, duration, additionalInfo = {}) => {
  logger.info('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  });
};

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  );
  
  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  );
}

// Log startup information
logger.info('Logger initialized', {
  environment: process.env.NODE_ENV,
  logLevel: logger.level,
  version: '3.0.0'
});

module.exports = logger;
