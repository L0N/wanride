# WanRide Production Deployment Guide

## 🚀 Overview

This guide covers the complete deployment of WanRide v3.0.0 to production infrastructure in Papua New Guinea. The system is designed for high availability, security, and optimal performance on PNG's 3G networks.

## 📋 Prerequisites

### Server Requirements
- **OS**: Ubuntu 20.04 LTS or newer
- **CPU**: 2+ cores (4 cores recommended)
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 50GB SSD minimum (100GB recommended)
- **Network**: Static IP address with domain name

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git 2.30+
- Nginx (handled by Docker)
- SSL Certificate (Let's Encrypt recommended)

### Domain & DNS
- Domain name: `wanride.com.pg` (or your chosen domain)
- DNS A record pointing to server IP
- SSL certificate for HTTPS

## 🔧 Installation Steps

### Step 1: Server Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git ufw fail2ban

# Configure firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login to apply Docker group changes
```

### Step 2: Application Deployment

```bash
# Create application directory
sudo mkdir -p /opt/wanride
sudo chown $USER:$USER /opt/wanride
cd /opt/wanride

# Clone repository
git clone https://github.com/yourusername/wanride.git .

# Create production environment file
cp .env.production.example .env.production

# Edit environment variables (IMPORTANT!)
nano .env.production
```

### Step 3: SSL Certificate Setup

```bash
# Install Certbot
sudo apt install -y certbot

# Obtain SSL certificate
sudo certbot certonly --standalone -d wanride.com.pg -d www.wanride.com.pg

# Create SSL directory for Docker
sudo mkdir -p /opt/wanride/nginx/ssl

# Copy certificates
sudo cp /etc/letsencrypt/live/wanride.com.pg/fullchain.pem /opt/wanride/nginx/ssl/
sudo cp /etc/letsencrypt/live/wanride.com.pg/privkey.pem /opt/wanride/nginx/ssl/

# Set proper permissions
sudo chown -R $USER:$USER /opt/wanride/nginx/ssl
chmod 600 /opt/wanride/nginx/ssl/privkey.pem
```

### Step 4: Environment Configuration

Edit `/opt/wanride/.env.production` with your actual values:

```bash
# Critical settings to update:
NODE_ENV=production
MONGODB_URI=mongodb://wanride_user:YOUR_SECURE_PASSWORD@mongodb:27017/wanride
JWT_SECRET=YOUR_32_CHARACTER_SECRET_KEY
SMS_API_KEY=your_twilio_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

**Generate secure secrets:**
```bash
# Generate JWT secret
openssl rand -base64 32

# Generate MongoDB password
openssl rand -base64 24

# Generate Redis password
openssl rand -base64 16
```

### Step 5: Deploy Application

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 6: Verify Deployment

```bash
# Check application health
curl -f https://wanride.com.pg/health

# Check API endpoints
curl -f https://wanride.com.pg/api/health

# Check WebSocket connection
curl -f https://wanride.com.pg/socket.io/
```

## 🔒 Security Configuration

### Firewall Rules
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw deny 27017     # Block direct MongoDB access
sudo ufw deny 6379      # Block direct Redis access
```

### Fail2Ban Configuration
```bash
# Configure fail2ban for SSH protection
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
```

### SSL Certificate Auto-Renewal
```bash
# Add to crontab
sudo crontab -e

# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet && docker-compose -f /opt/wanride/docker-compose.prod.yml restart nginx
```

## 📊 Monitoring Setup

### Log Monitoring
```bash
# Create log monitoring script
sudo nano /opt/wanride/scripts/monitor-logs.sh
```

```bash
#!/bin/bash
# Monitor application logs for errors
tail -f /opt/wanride/logs/error.log | while read line; do
    echo "$(date): $line" | mail -s "WanRide Error Alert" admin@wanride.com.pg
done
```

### Health Check Monitoring
```bash
# Add to crontab for health monitoring
*/5 * * * * curl -f https://wanride.com.pg/health || echo "WanRide health check failed" | mail -s "WanRide Down Alert" admin@wanride.com.pg
```

## 🗄️ Backup Configuration

### Automated Backups
```bash
# Make backup script executable
chmod +x /opt/wanride/scripts/backup.sh

# Add to crontab (2am PNG time daily)
sudo crontab -e

# Add this line:
0 2 * * * TZ=Pacific/Port_Moresby /opt/wanride/scripts/backup.sh
```

### Manual Backup
```bash
# Run manual backup
cd /opt/wanride
./scripts/backup.sh
```

### Restore from Backup
```bash
# Stop application
docker-compose -f docker-compose.prod.yml down

# Restore from backup file
mongorestore --uri="$MONGODB_URI" --gzip --archive=/backups/mongodb/wanride_YYYYMMDD_HHMMSS.gz

# Start application
docker-compose -f docker-compose.prod.yml up -d
```

## 🔄 Updates and Maintenance

### Application Updates
```bash
cd /opt/wanride

# Pull latest code
git pull origin main

# Rebuild and restart services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Verify deployment
curl -f https://wanride.com.pg/health
```

### Database Maintenance
```bash
# Connect to MongoDB
docker exec -it wanride-mongodb mongosh "mongodb://wanride_user:password@localhost:27017/wanride"

# Check database stats
db.stats()

# Compact collections (if needed)
db.runCommand({compact: 'rides'})
```

## 📈 Performance Optimization

### Database Indexing
```bash
# Verify indexes are created
docker exec -it wanride-mongodb mongosh "mongodb://wanride_user:password@localhost:27017/wanride" --eval "db.rides.getIndexes()"
```

### Redis Cache Monitoring
```bash
# Check Redis memory usage
docker exec -it wanride-redis redis-cli info memory
```

### Nginx Performance
```bash
# Check Nginx status
curl http://localhost:8080/nginx_status
```

## 🚨 Troubleshooting

### Common Issues

**1. Application won't start**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs api

# Check environment variables
docker-compose -f docker-compose.prod.yml config
```

**2. Database connection issues**
```bash
# Test MongoDB connection
docker exec -it wanride-mongodb mongosh "mongodb://wanride_user:password@localhost:27017/wanride" --eval "db.runCommand({ping: 1})"
```

**3. SSL certificate issues**
```bash
# Check certificate validity
openssl x509 -in /opt/wanride/nginx/ssl/fullchain.pem -text -noout

# Renew certificate
sudo certbot renew --force-renewal
```

**4. High memory usage**
```bash
# Check container resource usage
docker stats

# Restart services if needed
docker-compose -f docker-compose.prod.yml restart
```

### Log Locations
- Application logs: `/opt/wanride/logs/`
- Nginx logs: `/opt/wanride/logs/nginx/`
- Docker logs: `docker-compose logs [service]`
- System logs: `/var/log/syslog`

## 📞 Support

### Emergency Contacts
- **Technical Support**: tech@wanride.com.pg
- **System Admin**: admin@wanride.com.pg
- **Emergency Phone**: +675XXXXXXXX

### Monitoring Dashboards
- **Application Health**: https://wanride.com.pg/health
- **Nginx Status**: http://localhost:8080/nginx_status (internal only)
- **Server Monitoring**: Configure with your preferred monitoring solution

## ✅ Go-Live Checklist

Before going live, ensure:

- [ ] All environment variables configured
- [ ] SSL certificates installed and valid
- [ ] Database initialized with admin user
- [ ] Backup system tested
- [ ] Health checks passing
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] DNS records configured
- [ ] Monitoring alerts configured
- [ ] Support team notified
- [ ] Rollback plan prepared

## 🎉 Success!

Once all steps are completed, WanRide will be live at:
- **Main Site**: https://wanride.com.pg
- **API**: https://wanride.com.pg/api
- **Health Check**: https://wanride.com.pg/health

Your WanRide production deployment is now complete! 🚀🇵🇬
