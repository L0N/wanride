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

### Backend (Node.js/Express)
```
backend/
├── config/          # Database and logger configuration
├── controllers/     # Route controllers (Phase 3+)
├── middleware/      # Authentication and validation (Phase 3+)
├── models/          # MongoDB schemas (Phase 2)
├── routes/          # API endpoints (Phase 3+)
├── services/        # Business logic (Phase 5+)
├── socket/          # Socket.io handlers (Phase 7)
├── utils/           # Helper functions (Phase 3+)
└── server.js        # Main server file
```

### Frontend (React)
```
frontend/
├── public/          # Static assets
├── src/
│   ├── components/  # React components (Phase 9+)
│   ├── contexts/    # Context API providers (Phase 9)
│   ├── hooks/       # Custom React hooks (Phase 9)
│   ├── pages/       # Page components (Phase 10)
│   ├── services/    # API services (Phase 9)
│   ├── utils/       # Helper functions (Phase 9)
│   └── App.js       # Main App component
└── package.json
```

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

#### Backend (.env)
```env
# Database
MONGODB_URI=mongodb://localhost:27017/wanrides

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Twilio (Phone Verification)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number

# Cloudinary (File Upload)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Business Logic
OPERATIONAL_COST_PERCENTAGE=20
REFERRAL_PERCENTAGE=0.25
REFERRAL_DURATION_MONTHS=12
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

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-otp` - Phone verification
- `POST /api/auth/refresh` - Refresh JWT token

### Rides
- `POST /api/rides/request` - Request a ride
- `PUT /api/rides/:id/accept` - Accept ride (driver)
- `PUT /api/rides/:id/complete` - Complete ride
- `GET /api/rides/history` - Ride history

### Referrals
- `POST /api/referrals/generate` - Generate referral code
- `POST /api/referrals/apply` - Apply referral code
- `GET /api/referrals/earnings` - View earnings

### Documents
- `POST /api/documents/upload` - Upload documents
- `PUT /api/admin/documents/:id/verify` - Verify documents (admin)

## 🔄 Real-Time Events (Socket.io)

### Ride Events
```javascript
// Client requests ride
socket.emit('ride:request', rideData);

// Driver accepts ride
socket.emit('ride:accept', { rideId, driverId });

// Location updates
socket.emit('location:update', { lat, lng, rideId });

// Status updates
socket.on('ride:status-update', (status) => {
  // Handle status change
});
```

## 💰 Profit Calculation

```javascript
const calculateReferralEarnings = (rideFare, operationalCostPercentage) => {
  const profit = rideFare * (1 - operationalCostPercentage / 100);
  const referralEarning = profit * 0.0025; // 0.25%
  return referralEarning;
};
```

## 🚀 Deployment

### Frontend (Vercel)
```json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "build" }
    }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### Backend (Render)
```yaml
services:
  - type: web
    name: wanrides-api
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

## 📋 Development Phases

- [x] **Phase 1**: Project Setup & Infrastructure
- [ ] **Phase 2**: Database Models & Schemas
- [ ] **Phase 3**: Authentication System
- [ ] **Phase 4**: Document Upload & Verification
- [ ] **Phase 5**: Referral System
- [ ] **Phase 6**: Ride Management
- [ ] **Phase 7**: Real-time Communication
- [ ] **Phase 8**: Admin Dashboard
- [ ] **Phase 9**: React Frontend Foundation
- [ ] **Phase 10**: UI Components & Deployment

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 📝 Scripts

### Backend
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint

### Frontend
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Run ESLint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@wanrides.com or join our Slack channel.

---

**WanRides Team** - Building the future of ride-hailing 🚗💨
