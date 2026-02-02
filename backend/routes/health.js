/**
 * Health Check Routes for WanRide Production
 * Provides comprehensive system health monitoring
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const redis = require('redis');
const logger = require('../config/logger');

// Create Redis client for health checks
let redisClient;
try {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  redisClient.on('error', (err) => {
    logger.error('Redis health check client error:', err);
  });
} catch (error) {
  logger.error('Failed to create Redis client for health checks:', error);
}

/**
 * Basic health check endpoint
 * Returns 200 if application is running
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    message: 'WanRide API is running'
  });
});

/**
 * Comprehensive health check with dependencies
 * Checks database, cache, and external services
 */
router.get('/detailed', async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    checks: {
      application: { status: 'healthy' },
      database: { status: 'unknown' },
      cache: { status: 'unknown' },
      memory: { status: 'unknown' },
      disk: { status: 'unknown' }
    }
  };

  let overallStatus = 'healthy';

  try {
    // Check MongoDB connection
    const dbState = mongoose.connection.readyState;
    if (dbState === 1) {
      // Test database with a simple query
      const dbStats = await mongoose.connection.db.admin().ping();
      healthCheck.checks.database = {
        status: 'healthy',
        connection: 'connected',
        response_time: Date.now()
      };
    } else {
      healthCheck.checks.database = {
        status: 'unhealthy',
        connection: 'disconnected',
        state: dbState
      };
      overallStatus = 'unhealthy';
    }
  } catch (error) {
    healthCheck.checks.database = {
      status: 'unhealthy',
      error: error.message
    };
    overallStatus = 'unhealthy';
  }

  try {
    // Check Redis connection
    if (redisClient) {
      await redisClient.connect();
      const pong = await redisClient.ping();
      await redisClient.disconnect();
      
      healthCheck.checks.cache = {
        status: 'healthy',
        response: pong,
        response_time: Date.now()
      };
    } else {
      healthCheck.checks.cache = {
        status: 'unhealthy',
        error: 'Redis client not initialized'
      };
      overallStatus = 'degraded';
    }
  } catch (error) {
    healthCheck.checks.cache = {
      status: 'unhealthy',
      error: error.message
    };
    overallStatus = 'degraded';
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };

  // Memory health check (alert if heap used > 500MB)
  if (memUsageMB.heapUsed > 500) {
    healthCheck.checks.memory = {
      status: 'warning',
      usage: memUsageMB,
      message: 'High memory usage detected'
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  } else {
    healthCheck.checks.memory = {
      status: 'healthy',
      usage: memUsageMB
    };
  }

  // Check disk space (if available)
  try {
    const fs = require('fs');
    const stats = fs.statSync('.');
    healthCheck.checks.disk = {
      status: 'healthy',
      message: 'Disk check not implemented'
    };
  } catch (error) {
    healthCheck.checks.disk = {
      status: 'unknown',
      error: 'Unable to check disk space'
    };
  }

  // Set overall status
  healthCheck.status = overallStatus;

  // Return appropriate HTTP status
  const statusCode = overallStatus === 'healthy' ? 200 : 
                    overallStatus === 'degraded' ? 200 : 503;

  res.status(statusCode).json(healthCheck);
});

/**
 * Readiness probe for Kubernetes/Docker
 * Returns 200 only when application is ready to serve traffic
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if database is connected and responsive
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'not_ready',
        reason: 'Database not connected',
        timestamp: new Date().toISOString()
      });
    }

    // Test database with a simple query
    await mongoose.connection.db.admin().ping();

    // Check if Redis is available (optional for readiness)
    let redisStatus = 'unknown';
    try {
      if (redisClient) {
        await redisClient.connect();
        await redisClient.ping();
        await redisClient.disconnect();
        redisStatus = 'connected';
      }
    } catch (error) {
      redisStatus = 'disconnected';
      // Redis failure doesn't make app not ready, just log it
      logger.warn('Redis not available during readiness check:', error.message);
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected',
      cache: redisStatus
    });

  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      reason: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness probe for Kubernetes/Docker
 * Returns 200 if application process is alive
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
});

/**
 * Version information endpoint
 */
router.get('/version', (req, res) => {
  const packageJson = require('../../package.json');
  
  res.json({
    name: packageJson.name || 'wanride-api',
    version: packageJson.version || '3.0.0',
    description: packageJson.description || 'WanRide API Server',
    environment: process.env.NODE_ENV || 'development',
    node_version: process.version,
    platform: process.platform,
    architecture: process.arch,
    build_date: process.env.BUILD_DATE || 'unknown',
    commit_hash: process.env.COMMIT_HASH || 'unknown'
  });
});

/**
 * System metrics endpoint (for monitoring)
 */
router.get('/metrics', (req, res) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    process: {
      pid: process.pid,
      ppid: process.ppid,
      platform: process.platform,
      arch: process.arch,
      version: process.version
    },
    environment: {
      node_env: process.env.NODE_ENV,
      timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  });
});

module.exports = router;
