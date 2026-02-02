# 🚗 WanRide - Ride-Hailing Platform for Port Moresby
## Production-Ready Fleet Management & Dispatch System

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/L0N/wanride)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/L0N/wanride/deploy.yml?branch=main)](https://github.com/L0N/wanride/actions)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://hub.docker.com/r/wanride/api)

**WanRide** is a comprehensive ride-hailing platform specifically designed for Papua New Guinea's unique transportation needs. Built with a private fleet model (company-owned vehicles with employed drivers), cash-based payment system, and PNG Kina (K5) currency compliance.

**🌐 Live Demo:** https://demo.wanride.com.pg  
**📱 Mobile App:** Progressive Web App (installable on any device)  
**🇵🇬 Market:** Port Moresby, Papua New Guinea

---

## 🌟 Key Highlights

✅ **100% Cash-Based** - No card payments required (PNG economy optimized)  
✅ **K5 Currency Compliance** - All amounts rounded to nearest K5 Kina  
✅ **Private Fleet Model** - Company-owned vehicles with employed drivers  
✅ **Real-Time Dispatch** - Live fleet tracking and ride assignment  
✅ **Driver Commissions** - Transparent 20% commission with automated weekly payouts  
✅ **3G Optimized** - Works seamlessly on low-bandwidth PNG networks  
✅ **Offline Capable** - Progressive Web App with offline queue management  
✅ **Production Ready** - Docker containerized, CI/CD enabled, fully tested

---

## 📑 Table of Contents

- [Features](#features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Development Setup](#development-setup)
  - [Production Deployment](#production-deployment)
- [Configuration](#configuration)
- [User Guides](#user-guides)
  - [For Passengers](#for-passengers)
  - [For Drivers](#for-drivers)
  - [For Dispatchers](#for-dispatchers)
  - [For Fleet Owners](#for-fleet-owners)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

---

## 🎯 Features

### Core Functionality

#### 🚖 Ride Management
- **Smart Fare Calculation**
  - Inside NCD (Port Moresby): Flat K30 rate
  - Outside NCD: K30 base + K2/km + K0.50/min
  - Airport trips: Additional K10 fee (Jackson's International)
  - 25% return fee for remote area trips
  - Real-time fare estimation before ride confirmation
  
- **Real-Time Dispatch**
  - Live fleet tracking on Google Maps
  - Manual ride assignment by dispatcher
  - Automatic driver notifications via Socket.io
  - No driver rejection (employment model)
  - SOS emergency alerts with instant notification

- **Ride Lifecycle**
  - Passenger requests ride with pickup/destination
  - Dispatcher assigns to available driver
  - Driver navigates to pickup location
  - Passenger boards and travels to destination
  - Cash payment collected by driver
  - Receipt generated (SMS/Email/Print)
  - Ride completed and logged

#### 💰 Payment & Commission System
- **Cash Payment Collection**
  - Driver collects cash at ride completion
  - K5-rounded amounts (PNG currency compliance)
  - Professional receipt generation (unique receipt numbers)
  - Multi-channel receipt delivery (SMS, Email, Print)
  - Payment dispute reporting and resolution
  
- **Driver Commission System**
  - 20% commission on all collected fares
  - K5-rounded commission amounts
  - Automated weekly payout generation (every Friday 6pm PNG)
  - Transparent ride-by-ride commission breakdown
  - Owner approval workflow before payment release
  - Deduction management (fuel, damage, violations)
  
- **Cash Reconciliation**
  - End-of-shift cash handover tracking
  - Expected vs actual cash comparison
  - Automatic discrepancy detection
  - Daily reconciliation dashboard for owners
  - Complete audit trail

#### 📊 Analytics & Reporting
- **Executive Dashboard**
  - Real-time KPIs (revenue, rides, fleet utilization)
  - Revenue trend analysis with period comparisons
  - Ride volume charts with multiple view modes
  - Financial health indicators
  - Goals tracking with progress bars
  
- **Fleet Performance**
  - Vehicle utilization rates
  - Driver productivity metrics
  - Revenue per vehicle/driver
  - Maintenance tracking
  - Fuel consumption monitoring
  
- **Financial Reports**
  - Revenue breakdown by period
  - Commission expense tracking
  - Cash flow analysis
  - Profitability reports
  - Tax compliance exports (PNG GST, PAYE)

#### 👥 User Management
- **Role-Based Access Control**
  - Passengers: Ride requests, history, receipts
  - Drivers: Shift management, ride completion, commission dashboard
  - Dispatchers: Fleet monitoring, ride assignment, dispute resolution
  - Owners: Full system access, analytics, settings management
  
- **Driver Management**
  - Employee roster with shift scheduling
  - Performance tracking and leaderboards
  - Attendance monitoring
  - Commission payout history
  - Vehicle assignment

#### 📱 Progressive Web App (PWA)
- **Installable on Any Device**
  - Works on Android, iOS, desktop
  - No app store required
  - Automatic updates
  
- **Offline Capability**
  - Service worker caching
  - IndexedDB queue for offline actions
  - Background sync when connection restored
  - Offline ride history access
  
- **3G Network Optimized**
  - 3-second network timeouts
  - Optimized asset loading
  - Compressed data transfers
  - Minimal bandwidth usage

---

### PNG-Specific Features

#### 💵 K5 Currency Compliance
**All monetary amounts rounded to nearest K5 Kina**
- Fare calculations: K30, K35, K40, K45... (never K32, K38, etc.)
- Commission amounts: K5, K10, K15, K20... (never K7, K13, etc.)
- Deductions: K50, K55, K60... (always K5 increments)
- Receipt totals: All K5-rounded
- Financial reports: All K5-rounded

**Why K5 Rounding?**
Papua New Guinea's smallest commonly-used banknote is K5. Rounding to K5 simplifies cash handling and reduces disputes.

#### 🇵🇬 Papua New Guinea Optimizations
- **Timezone:** Pacific/Port_Moresby (UTC+10, no daylight saving)
- **Date Format:** DD/MM/YYYY (PNG standard)
- **Phone Numbers:** +675 prefix with local formatting
- **Cash Economy:** 100% cash payments (no card processing required)
- **3G Networks:** Optimized for PNG's mobile infrastructure
- **Low-End Android:** Tested on budget Android devices (<2GB RAM)

#### 🏙️ Port Moresby Geographic Features
- **NCD Boundary Detection:** Automatic detection of National Capital District limits
- **Flat Rate Inside NCD:** K30 for all Port Moresby trips
- **Distance-Based Outside NCD:** Fair pricing for Sogeri, Varirata, etc.
- **Airport Integration:** Jackson's International Airport support
- **Return Fee:** 25% for remote area trips (covers driver's empty return)

---

### Technical Features

#### 🔒 Security
- **HTTPS Enforced:** SSL/TLS encryption for all communications
- **JWT Authentication:** Secure token-based auth with expiry
- **SMS OTP Verification:** Two-factor authentication for drivers
- **Rate Limiting:** API (100 req/15min), Auth (5 req/15min)
- **Input Sanitization:** NoSQL injection, XSS, HPP protection
- **Security Headers:** Helmet.js configured (HSTS, CSP, X-Frame-Options)
- **Password Hashing:** bcrypt with salt rounds
- **CORS:** Properly configured for production domain

#### 📡 Real-Time Communication
- **Socket.io Integration:** Bidirectional event-based communication
- **Live Fleet Tracking:** Driver locations updated every 10 seconds
- **Instant Notifications:** Ride assignments, status updates, SOS alerts
- **Connection Resilience:** Automatic reconnection on network issues
- **Room-Based Broadcasting:** Efficient message delivery to specific user groups

#### 🐳 DevOps & Infrastructure
- **Docker Containerization:** Multi-stage builds, optimized images
- **Docker Compose:** Orchestration for MongoDB, Redis, API, Nginx
- **CI/CD Pipeline:** GitHub Actions for automated testing and deployment
- **Health Checks:** Container-level and application-level monitoring
- **Log Aggregation:** Winston logging with file rotation
- **Automated Backups:** Daily MongoDB backups to cloud storage
- **Zero-Downtime Deployments:** Rolling updates without service interruption

#### ⚡ Performance
- **Redis Caching:** API response caching (60s dashboard, 5min reports)
- **Database Indexing:** Optimized queries on all collections
- **CDN Integration:** CloudFlare for static asset delivery
- **Gzip Compression:** Nginx-level compression for all text content
- **Code Splitting:** React lazy loading for faster initial load
- **Image Optimization:** WebP format, lazy loading, responsive images
- **Query Optimization:** MongoDB aggregation pipelines, compound indexes

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  Passenger PWA  │  Driver PWA  │  Dispatcher Web  │  Owner Web  │
│  (React 18)     │  (React 18)  │  (React 18)      │  (React 18) │
└────────┬────────┴──────┬───────┴────────┬─────────┴──────┬──────┘
         │               │                │                │
         └───────────────┴────────────────┴────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Nginx (SSL)     │
                    │  Reverse Proxy    │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐        ┌──────▼──────┐     ┌──────▼──────┐
    │ HTTP API│        │  Socket.io  │     │   Static    │
    │  (REST) │        │  WebSocket  │     │   Assets    │
    └────┬────┘        └──────┬──────┘     └─────────────┘
         │                    │
         └────────┬───────────┘
                  │
         ┌────────▼────────┐
         │   Node.js API   │
         │   Express.js    │
         │   (Port 5000)   │
         └────────┬────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
┌────▼────┐  ┌────▼────┐  ┌───▼────┐
│ MongoDB │  │  Redis  │  │ Google │
│  6.0    │  │  Cache  │  │  Maps  │
└─────────┘  └─────────┘  └────────┘
```

### Component Breakdown

#### Frontend (React PWA)
- **Passenger App:** Ride requests, history, receipts
- **Driver App:** Shift management, navigation, payments, commissions
- **Dispatcher Dashboard:** Fleet map, ride assignment, monitoring
- **Owner Dashboard:** Analytics, reports, payout approvals, settings

#### Backend (Node.js/Express)
- **Authentication Service:** JWT, SMS OTP, RBAC
- **Ride Service:** CRUD operations, status management
- **Dispatch Service:** Assignment logic, real-time updates
- **Payment Service:** Fare calculation, cash collection, receipts
- **Commission Service:** 20% calculation, payout generation
- **Analytics Service:** KPI aggregation, report generation

#### Data Layer
- **MongoDB:** Primary database (users, rides, vehicles, payouts)
- **Redis:** Caching layer (API responses, session data)
- **Cloud Storage:** Receipt PDFs, backup archives

#### External Services
- **Google Maps API:** Geocoding, routing, distance calculation
- **SMS Gateway:** OTP delivery, receipt SMS (Twilio)
- **Email Service:** Receipt delivery, notifications (SendGrid)

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** React 18.2 with Hooks
- **State Management:** Context API (Auth, Socket)
- **Routing:** React Router v6
- **UI Components:** Material-UI (MUI) v5
- **Charts:** Recharts (analytics dashboards)
- **Maps:** @react-google-maps/api
- **Forms:** React Hook Form with validation
- **HTTP Client:** Fetch API with custom hooks
- **PWA:** Workbox (service worker, offline caching)
- **Build Tool:** Create React App (Webpack)

### Backend
- **Runtime:** Node.js 18 LTS
- **Framework:** Express.js 4.18
- **Real-Time:** Socket.io 4.5
- **Authentication:** JWT (jsonwebtoken), bcrypt
- **Database ODM:** Mongoose 7.0 (MongoDB)
- **Caching:** Redis 7 with node-redis
- **Validation:** Joi (environment, input)
- **Logging:** Winston 3.8
- **Security:** Helmet, express-rate-limit, xss-clean
- **Task Scheduling:** node-cron (weekly payouts)
- **PDF Generation:** PDFKit (receipts)
- **Excel Export:** ExcelJS
- **SMS:** Twilio SDK
- **Email:** SendGrid SDK

### Database
- **Primary:** MongoDB 6.0 (document store)
- **Cache:** Redis 7 (in-memory cache)
- **Backup:** AWS S3 / Google Cloud Storage

### DevOps & Infrastructure
- **Containerization:** Docker 20.10+
- **Orchestration:** Docker Compose
- **Web Server:** Nginx (reverse proxy, SSL)
- **CI/CD:** GitHub Actions
- **Hosting:** AWS EC2 / DigitalOcean / Azure
- **SSL:** Let's Encrypt (Certbot)
- **Monitoring:** Winston logs, custom health checks
- **Version Control:** Git, GitHub

### External APIs
- **Google Maps API:** Geocoding, Distance Matrix, Directions
- **Twilio:** SMS OTP, receipt delivery
- **SendGrid:** Email notifications, receipts
- **CloudFlare:** CDN, DDoS protection

### Development Tools
- **Code Editor:** VS Code
- **API Testing:** Postman, Thunder Client
- **Database Tool:** MongoDB Compass, Studio 3T
- **Testing:** Jest, React Testing Library
- **Linting:** ESLint (Airbnb style)
- **Formatting:** Prettier

### Production Dependencies
```json
{
  "backend": {
    "express": "^4.18.2",
    "socket.io": "^4.5.4",
    "mongoose": "^7.0.0",
    "redis": "^4.6.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.7.0",
    "winston": "^3.8.0",
    "node-cron": "^3.0.2",
    "twilio": "^4.10.0",
    "@sendgrid/mail": "^7.7.0",
    "geolib": "^3.3.3",
    "moment-timezone": "^0.5.43"
  },
  "frontend": {
    "react": "^18.2.0",
    "react-router-dom": "^6.10.0",
    "@mui/material": "^5.12.0",
    "recharts": "^2.5.0",
    "@react-google-maps/api": "^2.18.0",
    "socket.io-client": "^4.5.4",
    "date-fns": "^2.30.0",
    "workbox-*": "^6.5.4"
  }
}
```

---

## 📦 Prerequisites

### Development Environment
- **Node.js:** 18.x LTS or higher ([Download](https://nodejs.org/))
- **MongoDB:** 6.0+ ([Download](https://www.mongodb.com/try/download/community))
- **Redis:** 7.0+ ([Download](https://redis.io/download))
- **Git:** Latest version
- **Code Editor:** VS Code recommended

### Production Environment
- **Server:** Ubuntu 20.04+ (4GB RAM, 2 CPU cores minimum)
- **Docker:** 20.10+ ([Installation Guide](https://docs.docker.com/engine/install/))
- **Docker Compose:** 2.0+
- **Domain Name:** Registered and DNS configured
- **SSL Certificate:** Let's Encrypt or commercial

### External Services (API Keys Required)
- **Google Maps API:** Enable Geocoding, Distance Matrix, Directions APIs
- **Twilio Account:** For SMS OTP and receipts (PNG phone numbers)
- **SendGrid Account:** For email notifications (optional)
- **Cloud Storage:** AWS S3 or Google Cloud Storage (for backups)

---

## 🚀 Installation

### Development Setup

#### 1. Clone Repository
```bash
git clone https://github.com/L0N/wanride.git
cd wanride
```

#### 2. Install Backend Dependencies
```bash
npm install
```

#### 3. Install Frontend Dependencies
```bash
cd client
npm install
cd ..
```

#### 4. Configure Environment Variables
```bash
cp .env.production.example .env
```

Edit `.env` with your configuration:
```bash
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/wanride
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRE=7d

# External APIs
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
SMS_API_KEY=your-twilio-api-key
SMS_FROM_NUMBER=+675XXXXXXXX
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@wanride.com.pg

# Fare Configuration (K5-rounded)
FARE_NCD_FLAT_RATE=30
FARE_BASE=30
FARE_DISTANCE_RATE=2.00
FARE_TIME_RATE=0.50
FARE_FREE_DISTANCE_KM=10
FARE_RETURN_FEE_PERCENTAGE=25
FARE_AIRPORT_ADDON=10
COMMISSION_RATE=0.20

# NCD Boundary (Port Moresby)
NCD_BOUNDARY_NORTH=-9.3
NCD_BOUNDARY_SOUTH=-9.6
NCD_BOUNDARY_EAST=147.3
NCD_BOUNDARY_WEST=147.0
```

#### 5. Start MongoDB and Redis
```bash
# MongoDB (in separate terminal)
mongod

# Redis (in separate terminal)
redis-server
```

#### 6. Create Database Indexes
```bash
npm run create-indexes
```

#### 7. Seed Database (Optional)
```bash
npm run seed
```

This creates:
- 1 owner account
- 2 dispatcher accounts
- 5 driver accounts
- 10 vehicle records
- Sample ride data

#### 8. Start Development Servers
```bash
# Backend (runs on port 5000)
npm run dev

# Frontend (runs on port 3000) - in new terminal
cd client
npm start
```

#### 9. Access Application
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **Health Check:** http://localhost:5000/health

#### 10. Default Login Credentials
After seeding:
- **Owner:** owner@wanride.com.pg / password123
- **Dispatcher:** dispatcher@wanride.com.pg / password123
- **Driver:** +6757XXXXXXX / OTP via SMS (or check console logs)

---

### Production Deployment

#### Option 1: Docker Deployment (Recommended)

##### 1. Prepare Production Server
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

##### 2. Clone Repository
```bash
cd /opt
sudo git clone https://github.com/L0N/wanride.git
sudo chown -R $USER:$USER wanride
cd wanride
```

##### 3. Configure Production Environment
```bash
cp .env.production.example .env.production
nano .env.production
```

**Critical Production Variables:**
```bash
NODE_ENV=production
MONGODB_URI=mongodb://username:password@mongodb:27017/wanride
REDIS_URL=redis://:password@redis:6379
JWT_SECRET=<generate-with-openssl-rand-base64-32>
```

##### 4. Setup SSL Certificate
```bash
# Install Certbot
sudo apt install certbot -y

# Obtain certificate
sudo certbot certonly --standalone -d wanride.com.pg -d www.wanride.com.pg

# Copy certificates to nginx directory
sudo cp /etc/letsencrypt/live/wanride.com.pg/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/wanride.com.pg/privkey.pem nginx/ssl/
sudo chown -R $USER:$USER nginx/ssl/
```

##### 5. Build and Deploy
```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

##### 6. Create Database Indexes
```bash
docker-compose -f docker-compose.prod.yml exec api npm run create-indexes
```

##### 7. Verify Deployment
```bash
# Check container health
docker-compose -f docker-compose.prod.yml ps

# Test health endpoint
curl https://wanride.com.pg/health

# Should return: {"status":"healthy", ...}
```

##### 8. Setup Automated Backups
```bash
# Make backup script executable
chmod +x scripts/backup.sh

# Add to crontab (daily at 2am PNG time)
crontab -e

# Add this line:
0 2 * * * /opt/wanride/scripts/backup.sh >> /var/log/wanride-backup.log 2>&1
```

For complete deployment instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## 👥 User Guides

### For Passengers

#### How to Request a Ride
1. **Open WanRide App** - Visit https://wanride.com.pg or use installed PWA
2. **Login** - Enter phone number (+675 XXX XXXX) and verify with SMS OTP
3. **Request Ride** - Enter pickup and destination, view K5-rounded fare estimate
4. **Wait for Assignment** - Dispatcher assigns available driver, track on map
5. **Complete Ride** - Pay cash to driver, receive SMS/email receipt

#### Fare Information
- **Inside NCD (Port Moresby):** Flat K30 rate
- **Outside NCD:** K30 base + K2/km + K0.50/min + 25% return fee
- **Airport:** Base fare + K10 airport addon
- **All fares K5-rounded** (K30, K35, K40, never K32, K38)

---

### For Drivers

#### Getting Started
1. **Login** - Use credentials from fleet manager, verify with SMS OTP
2. **Start Shift** - Clock in, confirm vehicle, update fuel level
3. **Accept Rides** - Auto-assigned by dispatcher (employment model)
4. **Complete Rides** - Navigate to pickup, transport passenger, collect cash
5. **End Shift** - Clock out, hand over cash to manager

#### Your Commissions
- **20% of every fare** you collect (K5-rounded)
- **Weekly payouts** every Friday 6pm PNG time
- **View earnings** in "My Commissions" dashboard
- **Deductions possible** for fuel, damage, violations

#### Examples:
- K30 fare → K5 commission
- K50 fare → K10 commission  
- K105 fare → K20 commission

---

### For Dispatchers

#### Main Responsibilities
- **Assign rides** to available drivers using fleet map
- **Monitor fleet** in real-time (driver locations, status)
- **Handle emergencies** - respond to SOS alerts immediately
- **Resolve disputes** - manage payment issues between drivers/passengers

#### Ride Assignment Process
1. **View pending rides** in queue
2. **Select available driver** (green markers on map)
3. **Assign ride** - system notifies driver automatically
4. **Monitor progress** - track ride status updates

#### Emergency Response
- **SOS alerts** trigger immediate notifications
- **Call driver** to assess situation
- **Contact emergency services** if needed
- **Document incident** for records

---

### For Fleet Owners

#### Dashboard Overview
- **Real-time KPIs** - revenue, rides, fleet utilization
- **Financial reports** - revenue trends, commission expenses
- **Fleet performance** - vehicle utilization, driver productivity
- **Cash reconciliation** - daily cash tracking

#### Commission Payout Management
**Weekly Process (Every Friday 6pm):**
1. **Review pending payouts** - system auto-generates for previous week
2. **Add deductions** if needed (fuel, damage, violations)
3. **Approve payouts** - individual or bulk approval
4. **Mark as paid** after transferring money to drivers

#### Cash Reconciliation
- **Daily tracking** of expected vs actual cash
- **Driver-by-driver breakdown** with discrepancy detection
- **Export reports** for accounting
- **Resolve variances** with driver explanations

#### Fare Settings
Configure all pricing without code changes:
- **NCD flat rate** (default: K30)
- **Distance/time rates** for outside NCD
- **Airport addon** (default: K10)
- **Commission rate** (default: 20%)

---

## 📡 API Documentation

Full API documentation available at `/docs/API.md`

### Base URL
- **Development:** http://localhost:5000/api
- **Production:** https://wanride.com.pg/api

### Authentication
All protected endpoints require JWT token:
```http
Authorization: Bearer <your-jwt-token>
```

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with phone + OTP
- `POST /api/auth/otp/send` - Request OTP
- `POST /api/auth/otp/verify` - Verify OTP

#### Rides
- `GET /api/rides` - List rides (with filters)
- `POST /api/rides` - Create new ride
- `PUT /api/rides/:id/status` - Update ride status
- `POST /api/rides/calculate-fare` - Calculate fare estimate

#### Payments
- `POST /api/driver/rides/:id/payment` - Confirm cash collection
- `POST /api/driver/rides/:id/dispute` - Report payment dispute
- `GET /api/driver/rides/:id/receipt` - Get receipt data

#### Commissions
- `GET /api/driver/commissions` - Driver commission summary
- `GET /api/owner/payouts` - Owner payout management
- `PUT /api/owner/payouts/:id/approve` - Approve payout

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

---

## 🧪 Testing

### Run Tests
```bash
# Backend tests
npm test

# Frontend tests
cd client
npm test

# With coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

### Test Coverage
- **Unit Tests:** 180+ tests
- **Integration Tests:** Payment flows, commission calculations
- **E2E Tests:** Complete ride workflows
- **Manual Testing:** See [docs/TESTING_CHECKLIST.md](docs/TESTING_CHECKLIST.md)

---

## 📊 Monitoring

### Health Checks
```bash
# Basic health
curl https://wanride.com.pg/health

# Detailed health with dependencies
curl https://wanride.com.pg/health/detailed

# Kubernetes probes
curl https://wanride.com.pg/health/ready
curl https://wanride.com.pg/health/live
```

### Logs
```bash
# View all logs
docker-compose logs -f

# Backend logs only
docker-compose logs -f api

# Error logs only
tail -f logs/error.log
```

### Metrics
- CPU and memory usage
- Database connections
- Redis cache hit rate
- API response times
- Active WebSocket connections

---

## 🔧 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check container status
docker-compose ps

# View logs for errors
docker-compose logs api

# Restart services
docker-compose restart
```

#### Database Connection Failed
```bash
# Check MongoDB running
docker-compose ps mongodb

# Test connection
docker-compose exec mongodb mongosh

# Verify credentials
cat .env.production | grep MONGODB
```

#### SSL Certificate Issues
```bash
# Test certificate
openssl s_client -connect wanride.com.pg:443

# Renew certificate
sudo certbot renew

# Restart nginx
docker-compose restart nginx
```

For detailed troubleshooting, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 🤝 Contributing

We welcome contributions to WanRide!

### Development Workflow
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Standards
- **Backend:** ESLint (Airbnb style guide)
- **Frontend:** ESLint + Prettier
- **Commits:** Conventional Commits format
- **Tests:** Required for new features
- **Documentation:** Update relevant docs

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 WanRide

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 📞 Support

### Documentation
- **Deployment Guide:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **API Documentation:** [docs/API.md](docs/API.md)
- **Go-Live Checklist:** [docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md)
- **Troubleshooting:** [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

### Contact
- **Email:** support@wanride.com.pg
- **Phone:** +675 XXX XXXX (24/7 support)
- **GitHub Issues:** [Report Bug](https://github.com/L0N/wanride/issues)

### Business Inquiries
For partnership, licensing, or enterprise deployment:
- **Email:** business@wanride.com.pg
- **Phone:** +675 XXX XXXX

---

## 🙏 Acknowledgments

Built with:
- [Node.js](https://nodejs.org/) - JavaScript runtime
- [React](https://reactjs.org/) - Frontend framework
- [MongoDB](https://www.mongodb.com/) - Database
- [Socket.io](https://socket.io/) - Real-time communication
- [Google Maps](https://developers.google.com/maps) - Mapping services
- [Material-UI](https://mui.com/) - UI components

Special thanks to:
- PNG transport operators for valuable feedback
- Beta testers in Port Moresby
- Open source community

---

## 📈 Roadmap

### Version 3.1 (Q2 2026)
- [ ] Mobile money integration (PNG operators)
- [ ] Corporate accounts and billing
- [ ] Advanced analytics (machine learning insights)
- [ ] Multi-language support (Tok Pisin, Hiri Motu)

### Version 3.2 (Q3 2026)
- [ ] Scheduled rides (advance booking)
- [ ] Loyalty program for passengers
- [ ] Driver training modules
- [ ] Fleet maintenance scheduling automation

### Version 4.0 (Q4 2026)
- [ ] Expansion to Lae, Madang, Mt. Hagen
- [ ] Package delivery service
- [ ] API for third-party integrations
- [ ] White-label solution for other operators

---

## 🎯 Project Status

**Current Version:** 3.0.0  
**Status:** Production Ready ✅  
**Last Updated:** February 2026  
**Deployment:** Port Moresby, Papua New Guinea  

**Statistics:**
- **13,392+ lines** of production code
- **180+ automated tests**
- **25+ API endpoints**
- **100% K5 currency compliance**
- **Complete infrastructure** for commercial deployment

**🚗💨 WanRide is now live and transforming transportation in Port Moresby!** 🇵🇬

---

**⭐ If you find WanRide useful, please star this repository!**
