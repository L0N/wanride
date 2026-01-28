# 🔧 WanRide Private Fleet System - Technical Documentation

## 📋 Table of Contents
- [System Overview](#system-overview)
- [Architecture](#architecture)
- [Authentication System](#authentication-system)
- [Communication Services](#communication-services)
- [Database Models](#database-models)
- [Environment Configuration](#environment-configuration)
- [Deployment Guide](#deployment-guide)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Support](#support)

## 🏗️ System Overview

WanRide Private Fleet System is a production-ready ride-hailing platform designed specifically for company-owned vehicle fleets in Papua New Guinea. The system manages private fleet operations with centralized dispatch control, real-time tracking, and cash-based payment processing.

### Key Characteristics
- **Private Fleet Model**: Company-owned vehicles only (no driver-owned vehicles)
- **Employee Drivers**: Drivers are company employees, not freelancers
- **Centralized Dispatch**: All ride assignments controlled by dispatchers
- **Cash-Based Payments**: PNG Kina (PGK) with K5 rounding
- **Multi-Role Authentication**: PASSENGER, DRIVER, DISPATCHER, OWNER
- **Real-Time Operations**: Live GPS tracking and Socket.io communication

## 🏛️ Architecture

### Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with SMS OTP verification
- **Real-Time**: Socket.io for live updates
- **SMS Service**: Twilio for Papua New Guinea (+675)
- **Email Service**: Nodemailer with professional templates
- **Frontend**: React PWA (Progressive Web App)

### System Components

```
WanRide Private Fleet System
├── Authentication Layer (JWT + SMS OTP)
├── Communication Services (SMS + Email)
├── Database Layer (MongoDB)
├── Real-Time Engine (Socket.io)
├── Business Logic (Fleet Management)
└── Progressive Web App (Multi-Role UI)
```

## 🔐 Authentication System

### JWT Token Management
The system uses three types of JWT tokens:

#### 1. Access Tokens (15 minutes)
```javascript
{
  id: "user_id",
  email: "user@example.com",
  phone: "+675XXXXXXXX",
  name: "User Name",
  roles: ["PASSENGER", "DRIVER"],
  isVerified: true,
  rating: 4.5,
  tokenType: "access",
  iss: "wanride-fleet-wantekpng",
  aud: "wanride-users"
}
```

#### 2. Refresh Tokens (7 days)
```javascript
{
  id: "user_id",
  tokenType: "refresh",
  iss: "wanride-fleet-wantekpng",
  aud: "wanride-users"
}
```

#### 3. OTP Verification Tokens (10 minutes)
```javascript
{
  id: "user_id",
  otp: "123456",
  tokenType: "otp_verification",
  iss: "wanride-fleet-wantekpng",
  aud: "wanride-otp"
}
```

### Authentication Flow

#### Registration Flow
1. User submits registration data
2. System validates PNG phone number format (+675)
3. Password hashed with bcryptjs (12 salt rounds)
4. OTP generated and sent via SMS
5. OTP verification token returned
6. Driver profile auto-created for DRIVER role

#### Login Flow
1. User submits email/password
2. System validates credentials
3. Account lock check (5 failed attempts = 2-hour lock)
4. If unverified: OTP sent, 403 returned
5. If verified: tokens generated and returned

#### OTP Verification
1. User submits OTP token + OTP digits
2. System verifies token and OTP match
3. User marked as verified
4. Access + refresh tokens generated
5. Welcome messages sent (SMS + Email for drivers)

### Security Features
- **Rate Limiting**: 5 authentication attempts per IP per 15 minutes
- **Account Locking**: Automatic lockout after 5 failed login attempts
- **Token Type Validation**: Prevents token mixing attacks
- **Password Requirements**: 8+ characters, mixed case, numbers
- **Audit Logging**: All authentication events logged with IP and timestamp

## 📱 Communication Services

### SMS Service (Twilio)
Handles Papua New Guinea phone number formatting and SMS delivery.

#### Phone Number Formatting
```javascript
// Input formats supported:
"+675XXXXXXXX"  // International format
"0XXXXXXXX"     // National format with leading zero
"XXXXXXXX"      // Local format (7-8 digits)

// Output format:
"+675XXXXXXXX"  // Always international format
```

#### SMS Message Types
- **OTP Verification**: Registration, login, password reset
- **Driver Welcome**: New driver onboarding
- **Ride Notifications**: Passenger updates
- **SOS Alerts**: Emergency notifications

#### Example SMS Templates
```
OTP: "Your WanRide verification code is: 123456. Valid for 10 minutes. Do not share this code. Support: frank@wantekpng.com"

Welcome: "Welcome to WanRide Fleet, John! You are now part of Port Moresby's premier transport service. Drive safely! Support: frank@wantekpng.com"

SOS: "EMERGENCY ALERT: WanRide passenger needs help. Location: Downtown Port Moresby. Ride ID: R123456. Contact dispatcher immediately. Support: frank@wantekpng.com"
```

### Email Service (Nodemailer)
Professional email templates for business communication.

#### Email Types
1. **Ride Receipts**: Professional receipts with ride details
2. **Driver Welcome**: Comprehensive onboarding emails
3. **System Notifications**: Alerts and updates

#### Email Configuration
```javascript
// Environment Variables
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=frank@wantekpng.com
EMAIL_PASS=your_app_password
SUPPORT_EMAIL=frank@wantekpng.com
BUSINESS_NAME=WanTek PNG
BUSINESS_CONTACT=frank@wantekpng.com
```

#### Email Templates
All emails include:
- Professional WanRide Fleet branding
- Responsive HTML design with text fallbacks
- Support contact information (frank@wantekpng.com)
- WanTek PNG business information
- Professional styling and layout

## 🗄️ Database Models

### User Model
```javascript
{
  name: String,           // Full name
  email: String,          // Unique email address
  phone: String,          // PNG phone number (+675)
  password: String,       // Hashed with bcryptjs
  roles: [String],        // PASSENGER, DRIVER, DISPATCHER, OWNER
  isVerified: Boolean,    // Phone verification status
  rating: Number,         // User rating (1-5)
  loginAttempts: Number,  // Failed login tracking
  lockUntil: Date,        // Account lock expiry
  lastLogin: Date,        // Last successful login
  otp: String,            // Current OTP (hashed)
  otpExpiry: Date,        // OTP expiration time
  createdAt: Date,
  updatedAt: Date
}
```

### DriverProfile Model
```javascript
{
  userId: ObjectId,           // Reference to User
  license: String,            // Driver's license number
  status: String,             // APPLIED, VERIFIED, ASSIGNED_VEHICLE, ACTIVE, SUSPENDED, TERMINATED
  currentLocation: {
    type: "Point",
    coordinates: [lng, lat]   // GeoJSON format
  },
  assignedVehicleId: ObjectId, // Reference to Vehicle
  isOnline: Boolean,          // Current online status
  rating: Number,             // Driver rating (1-5)
  totalRides: Number,         // Completed rides count
  totalEarnings: Number,      // Total earnings (PGK)
  commissionRate: Number,     // Current commission rate (0.15-0.30)
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  workingHours: {
    start: String,            // HH:MM format
    end: String               // HH:MM format
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Vehicle Model
```javascript
{
  plate: String,              // License plate (unique)
  model: String,              // Vehicle model
  vin: String,                // Vehicle identification number
  status: String,             // ACTIVE, MAINTENANCE, RETIRED
  assignedDriverId: ObjectId, // Reference to DriverProfile
  currentLocation: {
    type: "Point",
    coordinates: [lng, lat]
  },
  maintenanceRecords: [{
    date: Date,
    type: String,
    description: String,
    cost: Number,
    performedBy: String
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Ride Model
```javascript
{
  passengerId: ObjectId,      // Reference to User
  driverId: ObjectId,         // Reference to DriverProfile
  vehicleId: ObjectId,        // Reference to Vehicle
  pickupLocation: {
    type: "Point",
    coordinates: [lng, lat]
  },
  dropoffLocation: {
    type: "Point",
    coordinates: [lng, lat]
  },
  pickupAddress: String,      // Human-readable address
  dropoffAddress: String,     // Human-readable address
  distance: Number,           // Distance in kilometers
  fare: Number,               // Calculated fare (K5 rounded)
  status: String,             // REQUESTED, ASSIGNED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED
  paidAmount: Number,         // Amount paid by passenger
  paymentConfirmedBy: String, // PASSENGER or DRIVER
  sosTriggered: Boolean,      // Emergency alert status
  sosLocation: {
    type: "Point",
    coordinates: [lng, lat]
  },
  timestamps: {
    requested: Date,
    assigned: Date,
    arrived: Date,
    started: Date,
    completed: Date,
    cancelled: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### WalletLedger Model
```javascript
{
  userId: ObjectId,           // Reference to User
  rideId: ObjectId,           // Reference to Ride (optional)
  amount: Number,             // Transaction amount (PGK)
  type: String,               // COLLECTED, COMMISSION, ADJUSTMENT, SALARY
  description: String,        // Transaction description
  balanceBefore: Number,      // Balance before transaction
  balanceAfter: Number,       // Balance after transaction
  processedBy: ObjectId,      // Reference to User (who processed)
  createdAt: Date
}
```

## ⚙️ Environment Configuration

### Required Environment Variables

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/wanride_fleet
NODE_ENV=development

# JWT Configuration
JWT_ACCESS_SECRET=your_super_secure_access_secret_key_here
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_key_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Email Configuration (Official WanTek PNG Contact)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=frank@wantekpng.com
EMAIL_PASS=your_email_password
SUPPORT_EMAIL=frank@wantekpng.com
BUSINESS_NAME=WanTek PNG
BUSINESS_CONTACT=frank@wantekpng.com

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5

# File Upload Configuration
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf

# Private Fleet Configuration
BASE_FARE_PER_KM=2.5
MINIMUM_FARE=5

# Commission rates based on driver rating
COMMISSION_RATE_LOW=0.15
COMMISSION_RATE_MID=0.20
COMMISSION_RATE_HIGH=0.25
COMMISSION_RATE_PREMIUM=0.30

# PNG Specific Configuration
DEFAULT_COUNTRY_CODE=675
DEFAULT_TIMEZONE=Pacific/Port_Moresby
DEFAULT_CURRENCY=PGK

# Socket.io Configuration
SOCKET_CORS_ORIGIN=http://localhost:3000
```

### Development vs Production

#### Development Mode
- SMS service uses mock mode (logs to console)
- Email service uses mock mode (logs to console)
- Detailed error messages
- CORS enabled for localhost

#### Production Mode
- Real SMS delivery via Twilio
- Real email delivery via SMTP
- Minimal error messages
- Restricted CORS origins
- Enhanced security headers

## 🚀 Deployment Guide

### Prerequisites
- Node.js 18+ and npm
- MongoDB 5.0+
- Twilio account for SMS
- SMTP email service (Gmail, SendGrid, etc.)

### Backend Deployment

#### 1. Environment Setup
```bash
# Clone repository
git clone https://github.com/L0N/wanride.git
cd wanride/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration
```

#### 2. Database Setup
```bash
# Start MongoDB
mongod

# The application will automatically create indexes on startup
```

#### 3. Start Application
```bash
# Development
npm run dev

# Production
npm start
```

### Production Deployment (Render/Railway)

#### 1. Build Configuration
```json
{
  "build": {
    "env": {
      "NODE_ENV": "production"
    }
  },
  "start": "node server.js"
}
```

#### 2. Environment Variables
Set all required environment variables in your hosting platform:
- Database connection string
- JWT secrets
- Twilio credentials
- Email configuration
- WanTek PNG contact information

#### 3. Health Checks
The system provides health check endpoints:
- `GET /api/auth/health` - Authentication service status
- `GET /api/health` - Overall system health

### Database Indexes
The system automatically creates these indexes:
```javascript
// User model
{ email: 1 }        // Unique
{ phone: 1 }        // Unique

// DriverProfile model
{ userId: 1 }       // Unique
{ currentLocation: "2dsphere" }  // Geospatial

// Vehicle model
{ plate: 1 }        // Unique
{ currentLocation: "2dsphere" }  // Geospatial

// Ride model
{ passengerId: 1, createdAt: -1 }
{ driverId: 1, createdAt: -1 }
{ status: 1, createdAt: -1 }
{ pickupLocation: "2dsphere" }   // Geospatial
{ dropoffLocation: "2dsphere" }  // Geospatial

// WalletLedger model
{ userId: 1, createdAt: -1 }
{ type: 1, createdAt: -1 }
```

## 📚 API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "75123456",
  "password": "SecurePass123",
  "roles": ["PASSENGER"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please verify your phone number.",
  "data": {
    "userId": "user_id",
    "otpToken": "jwt_token_here",
    "smsStatus": {
      "success": true,
      "messageId": "twilio_message_id"
    }
  }
}
```

#### POST /api/auth/verify-otp
Verify phone number with OTP.

**Request Body:**
```json
{
  "otpToken": "jwt_token_from_registration",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Phone number verified successfully",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+67575123456",
      "roles": ["PASSENGER"],
      "isVerified": true,
      "rating": 5.0
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token"
    },
    "driverProfile": null
  }
}
```

#### POST /api/auth/login
Authenticate user with email and password.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+67575123456",
      "roles": ["DRIVER"],
      "isVerified": true,
      "rating": 4.8,
      "lastLogin": "2026-01-28T10:30:00.000Z"
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token"
    },
    "driverProfile": {
      "id": "driver_profile_id",
      "status": "ACTIVE",
      "isOnline": false,
      "rating": 4.8,
      "totalRides": 150,
      "commissionRate": 0.25,
      "assignedVehicle": {
        "id": "vehicle_id",
        "plate": "ABC-123",
        "model": "Toyota Camry"
      }
    }
  }
}
```

#### POST /api/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "new_jwt_access_token",
    "refreshToken": "new_jwt_refresh_token"
  }
}
```

### Error Responses

#### Authentication Errors
```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

**Common Error Codes:**
- `TOKEN_MISSING`: No authorization header provided
- `TOKEN_EXPIRED`: Access token has expired
- `TOKEN_INVALID`: Token is malformed or invalid
- `USER_NOT_FOUND`: User account doesn't exist
- `ACCOUNT_LOCKED`: Account locked due to failed attempts
- `INVALID_CREDENTIALS`: Wrong email/password combination
- `VERIFICATION_REQUIRED`: Phone number not verified
- `RATE_LIMIT_EXCEEDED`: Too many requests from IP
- `INVALID_OTP`: OTP doesn't match or expired
- `USER_EXISTS`: Email or phone already registered

## 🔧 Troubleshooting

### Common Issues

#### 1. SMS Not Sending
**Problem**: OTP SMS messages not being delivered

**Solutions**:
- Check Twilio credentials in environment variables
- Verify Twilio account has sufficient balance
- Confirm phone number format is correct (+675XXXXXXXX)
- Check Twilio console for delivery status
- In development, check console logs for mock SMS

**Debug Steps**:
```bash
# Test SMS service directly
curl -X POST http://localhost:5000/api/auth/test-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "75123456"}'
```

#### 2. Email Not Sending
**Problem**: Welcome emails or receipts not being delivered

**Solutions**:
- Verify email credentials (frank@wantekpng.com)
- Check SMTP settings (host, port, security)
- Ensure "Less secure app access" enabled for Gmail
- Use App Passwords for Gmail 2FA accounts
- Check spam/junk folders

**Debug Steps**:
```javascript
// Check email service status
const emailService = require('./services/emailService');
console.log(emailService.getServiceStatus());
```

#### 3. JWT Token Issues
**Problem**: Authentication failing with token errors

**Solutions**:
- Verify JWT secrets are set in environment
- Check token expiry times (15m access, 7d refresh)
- Ensure client sends tokens in Authorization header
- Verify token type matches endpoint requirements

**Debug Steps**:
```javascript
// Decode token without verification
const jwt = require('jsonwebtoken');
const decoded = jwt.decode(token);
console.log('Token payload:', decoded);
```

#### 4. Database Connection Issues
**Problem**: MongoDB connection failures

**Solutions**:
- Verify MongoDB is running
- Check connection string format
- Ensure database user has proper permissions
- Verify network connectivity to MongoDB server

**Debug Steps**:
```bash
# Test MongoDB connection
mongosh "mongodb://localhost:27017/wanride_fleet"
```

#### 5. Rate Limiting Issues
**Problem**: Authentication requests being blocked

**Solutions**:
- Wait for rate limit window to reset (15 minutes)
- Check if IP is making too many requests
- Verify rate limit configuration
- Consider IP whitelisting for development

**Debug Steps**:
```bash
# Check current rate limit status
curl -I http://localhost:5000/api/auth/login
# Look for X-RateLimit-* headers
```

### Performance Optimization

#### Database Optimization
- Ensure proper indexes are created
- Monitor query performance with MongoDB Compass
- Use aggregation pipelines for complex queries
- Implement database connection pooling

#### Memory Management
- Monitor Node.js memory usage
- Implement proper error handling to prevent memory leaks
- Use streaming for large file operations
- Configure garbage collection for production

#### Security Hardening
- Use HTTPS in production
- Implement proper CORS configuration
- Add security headers with Helmet.js
- Regular security audits with npm audit

### Monitoring and Logging

#### Application Logs
```javascript
// Log levels
console.error('Error message');   // Errors
console.warn('Warning message');  // Warnings
console.log('Info message');      // General info
console.debug('Debug message');   // Debug info
```

#### Health Monitoring
- Monitor authentication endpoint response times
- Track SMS delivery success rates
- Monitor email delivery success rates
- Track database query performance
- Monitor JWT token generation/validation times

## 📞 Support

### Technical Support
For technical issues, implementation questions, or system support:

**Email**: frank@wantekpng.com  
**Business**: WanTek PNG  
**Location**: Port Moresby, Papua New Guinea

### Support Information Included in System
All user-facing communications include support contact:
- SMS messages include "Support: frank@wantekpng.com"
- Email templates include support contact information
- Error messages reference support contact when appropriate
- System notifications include assistance contact details

### Documentation Updates
This technical documentation is maintained alongside the codebase. For updates or corrections, please contact frank@wantekpng.com.

---

**WanTek PNG** - Reliable Transport Solutions for Papua New Guinea 🚗🇵🇬

*Last Updated: January 28, 2026 - Version 2.1.0*
