# WanRide Production Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build frontend and install dependencies
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install backend dependencies (production only)
RUN cd backend && npm ci --only=production

# Install frontend dependencies and build
RUN cd frontend && npm ci

# Copy source code
COPY . .

# Build frontend for production
RUN cd frontend && npm run build

# Stage 2: Production runtime
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling and curl for health checks
RUN apk add --no-cache dumb-init curl

# Create non-root user for security
RUN addgroup -g 1001 nodejs && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/backend ./backend
COPY --from=builder --chown=nodejs:nodejs /app/frontend/build ./frontend/build
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "backend/server.js"]
