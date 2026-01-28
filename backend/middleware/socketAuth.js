const JWTService = require('../utils/jwt');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Socket.io authentication middleware
 * Verifies JWT token and attaches user to socket
 */
const socketAuth = async (socket, next) => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth?.token || 
                  socket.handshake.query?.token ||
                  socket.request.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn(`Socket ${socket.id} attempted connection without token`);
      return next(new Error('Authentication token required'));
    }

    // Verify the token
    const jwtService = new JWTService();
    let decoded;
    
    try {
      decoded = jwtService.verifyAccessToken(token);
    } catch (jwtError) {
      logger.warn(`Socket ${socket.id} provided invalid token: ${jwtError.message}`);
      return next(new Error('Invalid authentication token'));
    }

    // Get user from database
    const user = await User.findById(decoded.userId)
      .select('name email phone roles isVerified rating');

    if (!user) {
      logger.warn(`Socket ${socket.id} token valid but user not found: ${decoded.userId}`);
      return next(new Error('User not found'));
    }

    if (!user.isVerified) {
      logger.warn(`Socket ${socket.id} user not verified: ${user.id}`);
      return next(new Error('User account not verified'));
    }

    // Attach user to socket for use in handlers
    socket.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      roles: user.roles,
      rating: user.rating
    };

    logger.info(`Socket ${socket.id} authenticated for user ${user._id} (${user.roles.join(',')})`);
    next();

  } catch (error) {
    logger.error(`Socket authentication error: ${error.message}`);
    next(new Error('Authentication failed'));
  }
};

module.exports = socketAuth;
