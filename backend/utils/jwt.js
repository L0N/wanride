const jwt = require('jsonwebtoken');
const { promisify } = require('util');

class JWTService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || 'wanride-access-secret-2026';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'wanride-refresh-secret-2026';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  /**
   * Generate access token with user data and roles
   */
  generateAccessToken(user) {
    const payload = {
      id: user._id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      roles: user.roles,
      isVerified: user.isVerified,
      rating: user.rating,
      tokenType: 'access'
    };

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'wanride-fleet',
      audience: 'wanride-users'
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(user) {
    const payload = {
      id: user._id,
      email: user.email,
      tokenType: 'refresh'
    };

    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'wanride-fleet',
      audience: 'wanride-users'
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(user) {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
      expiresIn: this.accessTokenExpiry
    };
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token) {
    try {
      const decoded = await promisify(jwt.verify)(token, this.accessTokenSecret);
      
      if (decoded.tokenType !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token) {
    try {
      const decoded = await promisify(jwt.verify)(token, this.refreshTokenSecret);
      
      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Generate OTP verification token (short-lived)
   */
  generateOTPToken(user, otp) {
    const payload = {
      id: user._id,
      email: user.email,
      phone: user.phone,
      otp: otp,
      tokenType: 'otp_verification'
    };

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: '10m', // OTP tokens expire in 10 minutes
      issuer: 'wanride-fleet',
      audience: 'wanride-otp'
    });
  }

  /**
   * Verify OTP token
   */
  async verifyOTPToken(token) {
    try {
      const decoded = await promisify(jwt.verify)(token, this.accessTokenSecret);
      
      if (decoded.tokenType !== 'otp_verification') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('OTP verification expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid OTP token');
      }
      throw error;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Check if user has required role
   */
  hasRole(userRoles, requiredRole) {
    if (!Array.isArray(userRoles)) {
      return false;
    }
    return userRoles.includes(requiredRole);
  }

  /**
   * Check if user has any of the required roles
   */
  hasAnyRole(userRoles, requiredRoles) {
    if (!Array.isArray(userRoles) || !Array.isArray(requiredRoles)) {
      return false;
    }
    return requiredRoles.some(role => userRoles.includes(role));
  }

  /**
   * Get token expiry time in seconds
   */
  getTokenExpirySeconds(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        return null;
      }
      return decoded.exp - Math.floor(Date.now() / 1000);
    } catch (error) {
      return null;
    }
  }
}

module.exports = new JWTService();
