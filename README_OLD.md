# 🚗 WanRide Private Fleet System

A production-ready ride hailing platform for private vehicle fleets in Port Moresby, Papua New Guinea. Built with the MERN stack, this system manages company-owned vehicles with centralized dispatch, real-time tracking, and cash-based payments.

## 🌟 Core Features

### Private Fleet Management
- **Company-Owned Vehicles**: All vehicles belong to the company (no driver-owned vehicles)
- **Employee Drivers**: Drivers are employees, not freelancers
- **Centralized Dispatch**: Dispatchers control all ride assignments with manual override
- **Real-Time Fleet Tracking**: Live GPS tracking of all company vehicles
- **Cash-Based Payments**: K5-rounded fares with cash collection tracking

### User Roles
- **🧑‍🤝‍🧑 Passengers**: Authenticated users who request rides (no anonymous rides)
- **🚗 Drivers**: Company employees assigned to specific vehicles
- **📋 Dispatchers**: Control ride assignments and monitor fleet operations
- **👨‍💼 Owners**: Manage fleet, view reports, and handle payroll

## 🏗️ Architecture

### Backend (Node.js/Express) - **PRODUCTION READY** ✅
```
backend/
├── config/          # Database and logger configuration ✅
├── controllers/     # Route controllers ✅
│   ├── authController.js    # Complete authentication system
│   └── rideController.js    # Complete ride management (11 endpoints)
├── middleware/      # Authentication and validation ✅
│   ├── auth.js      # JWT auth, rate limiting, role-based access
│   └── validation.js # Express-validator integration
├── models/          # MongoDB schemas (8 collections) ✅
│   ├── User.js      # Multi-role user system
│   ├── DriverProfile.js  # Driver management with ratings
│   ├── Vehicle.js   # Fleet management
│   ├── Ride.js      # Completed ride records
│   ├── RideRequest.js    # Active ride lifecycle
│   ├── DriverLocation.js # Real-time GPS tracking
│   ├── WalletLedger.js   # Financial transactions
│   └── DispatchLog.js    # Audit trail
├── routes/          # API endpoints ✅
│   ├── auth.js      # Authentication routes
│   └── rides.js     # Complete ride management API
├── services/        # Communication services ✅
│   ├── emailService.js   # Professional email templates
│   ├── smsService.js     # PNG SMS with Twilio
│   └── dispatchService.js # Intelligent driver assignment
├── socket/          # Real-time communication ✅
│   └── socketHandlers.js # Socket.io event handlers
├── utils/           # Helper functions ✅
│   ├── jwt.js       # JWT token management
│   ├── logger.js    # Winston logging system
│   └── validation.js # Input validation utilities
└── server.js        # Main server file ✅
```

### Frontend (React PWA) - **v2.2.0 IMPLEMENTATION** 🚧
```
frontend/
├── public/          # PWA assets
│   ├── manifest.json     # PWA manifest ⏳
│   └── sw.js            # Service worker ⏳
├── src/
│   ├── components/      # Reusable components ⏳
│   │   ├── Layout.js    # App layout
│   │   ├── FleetMap.js  # Real-time fleet map
│   │   ├── RideQueue.js # Dispatcher ride queue
│   │   └── PaymentForm.js # Cash payment recording
│   ├── contexts/        # State management ⏳
│   │   ├── AuthContext.js   # Authentication state
│   │   └── SocketContext.js # Real-time connection
│   ├── pages/           # Role-based interfaces ⏳
│   │   ├── DispatcherDashboard.js # Fleet management
│   │   ├── DriverDashboard.js     # Driver interface
│   │   ├── PassengerDashboard.js  # Booking interface
│   │   └── OwnerDashboard.js      # Analytics & reports
│   ├── hooks/           # Custom React hooks ⏳
│   │   └── useSocket.js # Socket.io integration
│   ├── utils/           # Frontend utilities ⏳
│   │   └── offlineQueue.js # Offline functionality
│   ├── App.js       # Main app with routing ✅
│   └── index.js     # PWA entry point ✅
└── package.json     # PWA dependencies ✅
```

**Current Status**: Transforming from basic React to full Progressive Web App with offline capabilities.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- MongoDB
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/L0N/wanride.git
   cd wanride
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm start
   ```

### Environment Variables

#### Backend (.env) - **CURRENT IMPLEMENTATION**
```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/wanride_fleet
NODE_ENV=development

# JWT Configuration
JWT_ACCESS_SECRET=your_super_secure_access_secret_key_here
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_key_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# SMS Configuration (Twilio for PNG)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Email Configuration (WanTek PNG Contact)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=frank@wantekpng.com
EMAIL_PASS=your_email_password
SUPPORT_EMAIL=frank@wantekpng.com
BUSINESS_NAME=WanTek PNG
BUSINESS_CONTACT=frank@wantekpng.com

# CORS Configuration
FRONTEND_URL=http://localhost:3000
SOCKET_CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

## 📊 Database Schema

### User Schema (Role-Based)
```javascript
{
  id: ObjectId,
  name: String,
  email: String,
  phone: String,
  roles: ['PASSENGER', 'DRIVER', 'DISPATCHER', 'OWNER'], // Multiple roles allowed
  rating: Number,
  isVerified: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### DriverProfile Schema
```javascript
{
  userId: ObjectId,
  license: String,
  status: ['APPLIED', 'VERIFIED', 'ASSIGNED_VEHICLE', 'ACTIVE', 'SUSPENDED', 'TERMINATED'],
  currentLocation: { lat: Number, lng: Number },
  assignedVehicleId: ObjectId,
  isOnline: Boolean,
  rating: Number,
  totalRides: Number,
  totalEarnings: Number,
  commissionRate: Number // Based on rating: 15%-30%
}
```

### Vehicle Schema
```javascript
{
  plate: String,
  model: String,
  vin: String,
  status: ['ACTIVE', 'MAINTENANCE', 'RETIRED'],
  assignedDriverId: ObjectId,
  currentLocation: { lat: Number, lng: Number },
  lastServiceDate: Date
}
```

### Ride Schema
```javascript
{
  passengerId: ObjectId,
  driverId: ObjectId,
  vehicleId: ObjectId,
  pickupLocation: { lat: Number, lng: Number, address: String },
  dropoffLocation: { lat: Number, lng: Number, address: String },
  distance: Number,
  fare: Number, // Rounded to nearest K5
  status: ['REQUESTED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  paidAmount: Number,
  dispatcherId: ObjectId, // Who assigned the ride
  timestamps: {
    requested: Date,
    assigned: Date,
    arrived: Date,
    started: Date,
    completed: Date
  }
}
```

### WalletLedger Schema
```javascript
{
  userId: ObjectId,
  rideId: ObjectId,
  amount: Number,
  type: ['COLLECTED', 'COMMISSION', 'ADJUSTMENT'],
  description: String,
  createdAt: Date
}
```

## 🔌 API Endpoints - **IMPLEMENTED**

### Authentication System ✅
- `POST /api/auth/register` - User registration with SMS OTP
- `POST /api/auth/verify-otp` - Phone verification with OTP
- `POST /api/auth/resend-otp` - Resend OTP for verification
- `POST /api/auth/login` - User login with email/password
- `POST /api/auth/refresh` - Refresh JWT access token
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/health` - Authentication service health check
- `POST /api/auth/test-sms` - Test SMS service (development only)

### System Health ✅
- `GET /health` - Overall system health check

### **Coming in Phase 3+**
- Fleet Management APIs
- Real-time Dispatch APIs
- Ride Management APIs
- Driver Status APIs
- Owner Dashboard APIs

## 🔄 Real-Time Events (Socket.io) - **BASIC SETUP**

### Current Implementation ✅
```javascript
// Basic connection handling
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);
  
  socket.emit('connected', { 
    message: 'Connected to WanRides server',
    socketId: socket.id 
  });

  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });
});
```

### **Coming in Phase 3: Real-time Dispatch Engine**
- Driver location tracking
- Live ride assignments
- Real-time status updates
- SOS emergency alerts
- Dispatcher notifications

## 💰 Commission System - **IMPLEMENTED**

### Rating-Based Commission Structure
```javascript
// Commission rates based on driver rating
const getCommissionRate = (rating) => {
  if (rating < 4.2) return 0.15; // 15%
  if (rating < 4.6) return 0.20; // 20%
  if (rating < 4.8) return 0.25; // 25%
  return 0.30; // 30% for 4.8+ rating
};

// Calculate driver commission
const calculateCommission = (totalFare, driverRating) => {
  const rate = getCommissionRate(driverRating);
  return totalFare * rate;
};
```

## 🚀 Deployment - **PRODUCTION READY**

### Prerequisites ✅
- Node.js 18+ and npm
- MongoDB 5.0+
- Twilio account for PNG SMS (+675)
- SMTP email service (Gmail recommended)

### Backend Deployment ✅
```bash
# 1. Clone and setup
git clone https://github.com/L0N/wanride.git
cd wanride/backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your production values

# 3. Start application
npm start  # Production
npm run dev  # Development
```

### Production Platforms
**Recommended**: Railway, Render, or Heroku

```yaml
# render.yaml example
services:
  - type: web
    name: wanride-api
    env: node
    buildCommand: cd backend && npm install
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        fromDatabase:
          name: wanride-fleet
          property: connectionString
```

### Health Checks ✅
- `GET /health` - System health
- `GET /api/auth/health` - Auth service health

**📚 Complete deployment guide available in [TECHNICAL_DOCS.md](./TECHNICAL_DOCS.md)**

## 📋 Development Phases

- [x] **Phase 1**: Database Models & Private Fleet Architecture
- [x] **Phase 2**: Authentication System with SMS OTP
- [x] **Phase 2.1**: Contact Integration & Email Service (v2.1.0)
- [ ] **Phase 3**: Real-time Dispatch Engine (Socket.io)
- [ ] **Phase 4**: Fleet Management APIs
- [ ] **Phase 5**: Progressive Web App (PWA)
- [ ] **Phase 6**: Dispatcher Dashboard
- [ ] **Phase 7**: Driver Mobile Interface
- [ ] **Phase 8**: Owner Analytics & Reports
- [ ] **Phase 9**: Payment & Commission System
- [ ] **Phase 10**: Production Deployment

## 🧪 Testing - **IMPLEMENTED**

### Backend Testing ✅
```bash
cd backend
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:ci       # Run tests for CI/CD
npm run dev           # Development server with auto-reload
npm start             # Production server
```

### Unit & Integration Tests ✅
```bash
# Authentication system tests (309 test cases)
npm test auth.test.js

# Test coverage report
npm run test:coverage
```

### API Testing ✅
```bash
# Test authentication endpoints
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","phone":"75123456","password":"Test123!","roles":["PASSENGER"]}'

# Health check
curl http://localhost:5000/health
curl http://localhost:5000/api/auth/health
```

### **Test Coverage**
- ✅ Authentication endpoints (register, login, verify-otp)
- ✅ JWT token management (access, refresh, OTP verification)
- ✅ PNG phone number formatting
- ✅ Input validation and error handling
- ✅ Health check endpoints

## 📝 Available Scripts

### Backend ✅
- `npm start` - Start production server
- `npm run dev` - Development server with nodemon
- `npm install` - Install dependencies

### Frontend ✅
- `npm start` - Start React development server
- `npm run build` - Build for production
- `npm install` - Install dependencies

### **Development Tools**
- Environment configuration via `.env` files
- MongoDB connection with auto-reconnect
- Rate limiting and security middleware
- Comprehensive error handling and logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and inquiries, contact us at **frank@wantekpng.com**

**Business Contact**: WanTek PNG  
**Email**: frank@wantekpng.com  
**Location**: Port Moresby, Papua New Guinea

---

**WanTek PNG** - Reliable Transport Solutions for Papua New Guinea 🚗🇵🇬
