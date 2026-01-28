# Changelog

All notable changes to WanRide Private Fleet System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-01-28

### Added
- **Email Service Integration**: Professional email templates for receipts, driver welcome, and system notifications
- **Official Contact Information**: frank@wantekpng.com integrated throughout the system
- **Enhanced SMS Templates**: All SMS messages now include support contact information
- **Professional Email Templates**: HTML and text versions for ride receipts and driver onboarding
- **Business Branding**: WanTek PNG branding with official contact information

### Changed
- **JWT Issuer**: Updated to "wanride-fleet-wantekpng" for proper business identification
- **SMS Messages**: All OTP, welcome, and emergency messages include frank@wantekpng.com
- **Environment Configuration**: Added official contact variables (SUPPORT_EMAIL, BUSINESS_NAME, BUSINESS_CONTACT)
- **Package Metadata**: Updated author and contact information to WanTek PNG
- **Error Messages**: Account lockout messages include support contact information

### Technical
- Added nodemailer dependency for email functionality
- Email service supports both production SMTP and development mock mode
- Professional email templates with responsive design
- Contact information centralized via environment variables
- Enhanced driver onboarding with both SMS and email welcome messages

## [2.0.0] - 2026-01-28

### Changed - BREAKING CHANGES
- **COMPLETE ARCHITECTURE REDESIGN**: Transformed from open marketplace model to private fleet management system
- **Business Model**: Changed from driver-owned vehicles to company-owned fleet only
- **User Roles**: Replaced Client/Driver/Company/Admin with Passenger/Driver/Dispatcher/Owner roles
- **Payment System**: Implemented cash-based payments with K5 rounding (Papua New Guinea Kina)
- **Dispatch System**: Added centralized dispatcher control with manual assignment capabilities
- **Driver Management**: Implemented employee lifecycle (APPLIED → VERIFIED → ASSIGNED_VEHICLE → ACTIVE)
- **Fleet Management**: Added company vehicle assignment and tracking system
- **Commission System**: Replaced referral system with rating-based commission structure (15%-30%)

### Added
- **Private Fleet Architecture**: Complete fleet management system for company-owned vehicles
- **Dispatcher Dashboard**: Real-time fleet monitoring and manual ride assignment
- **Owner Dashboard**: Financial reporting, driver performance, and fleet analytics
- **Cash Payment System**: K5-rounded fares with cash collection tracking and reconciliation
- **Commission Calculator**: Rating-based driver commission system with weekly payroll
- **SOS Alert System**: Emergency alerts with real-time dispatcher notifications
- **Privacy Features**: Phone number masking with system-routed calling
- **Fleet Tracking**: Live GPS tracking for all company vehicles
- **Driver Employee System**: Complete employee lifecycle management
- **Vehicle Assignment**: Mandatory vehicle assignment before drivers can go online
- **Receipt System**: Automated receipt generation and email delivery
- **Variance Tracking**: Expected vs actual cash collection monitoring

### Removed - BREAKING CHANGES
- **Referral System**: Removed 0.25% profit sharing and referral codes
- **Driver Vehicle Ownership**: Removed ability for drivers to use personal vehicles
- **Open Marketplace Features**: Removed public driver registration and marketplace functionality
- **Company Role**: Removed separate company role (integrated into Owner role)

### Technical Changes
- **Database Schema**: Complete redesign with User, DriverProfile, Vehicle, Ride, WalletLedger models
- **Authentication**: Rebuilt with role-based access for four specific roles
- **Real-time Engine**: Enhanced Socket.io implementation for dispatcher-centric operations
- **API Architecture**: Redesigned RESTful APIs for private fleet operations
- **Frontend**: Progressive Web App optimized for Port Moresby operations

## [1.0.0] - 2026-01-27 (Baseline)

### Initial State (Open Marketplace Model)
- Multi-role authentication system (Client, Driver, Company, Admin)
- Driver-owned vehicle marketplace model
- Referral system with 0.25% profit sharing for 12 months
- Phone/OTP verification with Twilio integration
- Document upload and verification workflow
- Real-time ride tracking and communication
- MERN stack foundation with Socket.io
- MongoDB database with basic schemas
- React frontend with role-based access
- Express.js backend with security middleware

### Infrastructure (Preserved)
- MERN stack architecture (MongoDB, Express.js, React, Node.js)
- Socket.io real-time communication
- JWT authentication foundation
- Twilio SMS integration
- Cloudinary file upload
- Winston logging system
- Security middleware (Helmet, CORS, Rate limiting)

## [Unreleased]

### Added
- Initial project setup with MERN stack architecture
- Backend Express.js server with Socket.io integration
- MongoDB database configuration with connection handling
- Winston logging system with file rotation
- Environment variable configuration templates
- React frontend foundation with modern dependencies
- Security middleware (Helmet, CORS, Rate limiting)
- Health check endpoint for monitoring
- Graceful shutdown handling for both frontend and backend
- ESLint and Prettier configuration for code quality
- Comprehensive package.json files with all required dependencies

### Infrastructure
- Backend dependencies: Express, Mongoose, Socket.io, JWT, Twilio, Cloudinary, Multer
- Frontend dependencies: React 18, React Router, Axios, Socket.io-client, React Hook Form
- Development tools: Nodemon, ESLint, Prettier, Jest for testing
- Logging: Winston with file rotation and console output
- Security: Helmet, CORS, Rate limiting, Input validation ready

### Configuration
- Environment variables for all services (Database, JWT, Twilio, Cloudinary)
- Separate development and production configurations
- Socket.io CORS configuration for real-time communication
- File upload limits and allowed types configuration
- Referral system configuration (0.25% for 12 months)
- Operational cost percentage configuration for profit calculations

### Documentation
- Comprehensive README structure ready
- Environment variable documentation
- Project structure documentation
- Development setup instructions prepared

## [1.0.0] - TBD

### Planned Features
- Multi-role authentication system (Client, Driver, Company, Admin)
- Phone/OTP verification with Twilio integration
- Document upload and verification workflow
- Referral system with profit sharing (0.25% for one year)
- Real-time ride tracking and communication
- Admin dashboard for user and document management
- Complete ride lifecycle management
- Fare calculation and profit distribution
- Role-based access control and permissions
- Responsive React frontend with real-time updates
- Deployment configurations for Vercel and Render

---

## Development Phases

### Phase 1: ✅ Project Setup and Core Infrastructure (Completed)
- [x] MERN stack project structure
- [x] Backend Express server with Socket.io
- [x] MongoDB connection configuration
- [x] Environment variable setup
- [x] Logging system implementation
- [x] React frontend foundation
- [x] Security middleware configuration

### Phase 2: 🔄 Database Models and Schemas (Retrying implementation)
- [x] User schema with multi-role support (Client, Driver, Company, Admin)
- [x] Ride schema with complete status flow and profit calculation
- [x] Referral schema with earnings tracking and 0.25% profit sharing
- [x] Document schema with verification workflow and Cloudinary integration
- [x] Session schema for JWT management and security tracking
- [x] Comprehensive indexing for performance optimization
- [x] Virtual fields and middleware for business logic
- [x] Static methods for complex queries and analytics

### Phase 3: ✅ Authentication System (Completed)
- [x] JWT token generation and validation with role-based permissions
- [x] Twilio phone verification with SMS integration
- [x] Multi-role registration and login (Client, Driver, Company, Admin)
- [x] Password hashing with bcrypt and security features
- [x] Session management with device tracking and security monitoring
- [x] Role-based middleware and route protection
- [x] Rate limiting and authentication event logging
- [x] Password reset functionality with SMS codes
- [x] Comprehensive input validation and error handling

### Phase 4: 🔄 Document Upload & Verification (Next)
- [ ] Multer file upload middleware
- [ ] Cloudinary integration
- [ ] Admin verification workflow
- [ ] File validation and security

### Phase 5: 📋 Referral System (Planned)
- [ ] Unique code generation
- [ ] Profit calculation logic
- [ ] Time-based tracking (12 months)
- [ ] Earnings reporting

### Phase 6: 📋 Ride Management (Planned)
- [ ] Ride request and acceptance
- [ ] Status transition management
- [ ] Fare calculation engine
- [ ] Driver-client matching

### Phase 7: 📋 Real-time Communication (Planned)
- [ ] Socket.io event handlers
- [ ] Real-time location tracking
- [ ] Ride status updates
- [ ] Push notifications

### Phase 8: 📋 Admin Dashboard Backend (Planned)
- [ ] Document verification APIs
- [ ] User management endpoints
- [ ] Analytics and reporting
- [ ] Audit logging

### Phase 9: 📋 React Frontend Foundation (Planned)
- [ ] Context API state management
- [ ] Protected routes implementation
- [ ] Socket.io client integration
- [ ] Custom hooks development

### Phase 10: 📋 UI Components & Deployment (Planned)
- [ ] Role-specific dashboards
- [ ] Authentication components
- [ ] Ride tracking interface
- [ ] Vercel and Render deployment configs

---

*This changelog will be updated as development progresses through each phase.*
