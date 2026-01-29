import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const RideQueuePanel = ({ onAssignRide }) => {
  const { isConnected, emit } = useSocket();
  
  // State
  const [pendingRides, setPendingRides] = useState([]);
  const [filter, setFilter] = useState('all'); // all, urgent, vip
  const [sortBy, setSortBy] = useState('waitTime'); // waitTime, fare, distance
  const [loading, setLoading] = useState(true);
  const [queueStats, setQueueStats] = useState({
    total: 0,
    urgent: 0,
    averageWait: 0
  });

  // Mock data for development - replace with real API calls
  useEffect(() => {
    // Simulate loading pending rides
    const mockRides = [
      {
        id: 'ride-001',
        passengerName: 'John Doe',
        passengerPhone: '+675 7123 4567',
        passengerRating: 4.8,
        pickupAddress: 'Jacksons Airport, Port Moresby',
        dropoffAddress: 'Vision City, Waigani',
        pickupLocation: { lat: -9.4434, lng: 147.2200 },
        dropoffLocation: { lat: -9.4000, lng: 147.1500 },
        estimatedFare: 45, // PGK
        requestTime: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
        priority: 'normal',
        specialRequests: null
      },
      {
        id: 'ride-002',
        passengerName: 'Mary Smith',
        passengerPhone: '+675 7234 5678',
        passengerRating: 4.2,
        pickupAddress: 'University of Papua New Guinea',
        dropoffAddress: 'Boroko Shopping Centre',
        pickupLocation: { lat: -9.4050, lng: 147.1600 },
        dropoffLocation: { lat: -9.4300, lng: 147.1800 },
        estimatedFare: 25,
        requestTime: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
        priority: 'normal',
        specialRequests: 'Wheelchair accessible'
      },
      {
        id: 'ride-003',
        passengerName: 'Peter Wilson',
        passengerPhone: '+675 7345 6789',
        passengerRating: 4.9,
        pickupAddress: 'Holiday Inn, Port Moresby',
        dropoffAddress: 'Port Moresby General Hospital',
        pickupLocation: { lat: -9.4700, lng: 147.1500 },
        dropoffLocation: { lat: -9.4200, lng: 147.1700 },
        estimatedFare: 30,
        requestTime: new Date(Date.now() - 12 * 60 * 1000), // 12 minutes ago
        priority: 'urgent',
        specialRequests: 'Medical appointment'
      }
    ];

    setPendingRides(mockRides);
    setLoading(false);

    // Calculate stats
    const urgent = mockRides.filter(ride => getWaitTime(ride.requestTime) > 5).length;
    const totalWait = mockRides.reduce((sum, ride) => sum + getWaitTime(ride.requestTime), 0);
    
    setQueueStats({
      total: mockRides.length,
      urgent: urgent,
      averageWait: mockRides.length > 0 ? Math.round(totalWait / mockRides.length) : 0
    });
  }, []);

  // Calculate wait time in minutes
  const getWaitTime = useCallback((requestTime) => {
    return Math.floor((Date.now() - new Date(requestTime).getTime()) / (1000 * 60));
  }, []);

  // Get wait time color based on duration
  const getWaitTimeColor = (waitTime) => {
    if (waitTime < 2) return '#4caf50'; // Green
    if (waitTime < 5) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  // Get wait time icon
  const getWaitTimeIcon = (waitTime) => {
    if (waitTime < 2) return '🟢';
    if (waitTime < 5) return '🟡';
    return '🔴';
  };

  // Filter rides based on selected filter
  const getFilteredRides = useCallback(() => {
    let filtered = [...pendingRides];

    switch (filter) {
      case 'urgent':
        filtered = filtered.filter(ride => getWaitTime(ride.requestTime) > 5);
        break;
      case 'vip':
        filtered = filtered.filter(ride => ride.passengerRating >= 4.8);
        break;
      default:
        // Show all rides
        break;
    }

    // Sort rides
    switch (sortBy) {
      case 'waitTime':
        filtered.sort((a, b) => new Date(a.requestTime) - new Date(b.requestTime));
        break;
      case 'fare':
        filtered.sort((a, b) => b.estimatedFare - a.estimatedFare);
        break;
      case 'distance':
        // Mock distance sorting - in real app calculate actual distance
        filtered.sort((a, b) => a.estimatedFare - b.estimatedFare);
        break;
      default:
        break;
    }

    return filtered;
  }, [pendingRides, filter, sortBy, getWaitTime]);

  // Handle ride assignment
  const handleAssignRide = (ride) => {
    if (onAssignRide) {
      onAssignRide(ride);
    }
  };

  // Handle ride cancellation
  const handleCancelRide = async (rideId, reason) => {
    try {
      // Emit cancellation via Socket.io
      const success = emit('dispatcher:cancel', { rideId, reason });
      
      if (success) {
        // Remove from local state
        setPendingRides(prev => prev.filter(ride => ride.id !== rideId));
        toast.success('Ride cancelled successfully');
      } else {
        toast.error('Failed to cancel ride - connection issue');
      }
    } catch (error) {
      console.error('Error cancelling ride:', error);
      toast.error('Failed to cancel ride');
    }
  };

  // Handle call passenger
  const handleCallPassenger = (ride) => {
    // In real app, this would initiate a call through the system
    toast.info(`Calling ${ride.passengerName}...`);
    console.log('Call passenger:', ride.passengerPhone);
  };

  // Format currency for PNG
  const formatCurrency = (amount) => {
    // Round to nearest K5
    const rounded = Math.round(amount / 5) * 5;
    return `PGK ${rounded}`;
  };

  // Render ride card
  const RideCard = ({ ride }) => {
    const waitTime = getWaitTime(ride.requestTime);
    
    return (
      <div className={`ride-card ${ride.priority === 'urgent' ? 'urgent' : ''}`}>
        {/* Header */}
        <div className="ride-header">
          <div className="passenger-info">
            <h3 className="passenger-name">{ride.passengerName}</h3>
            <div className="passenger-rating">
              ⭐ {ride.passengerRating}
            </div>
          </div>
          <div className="wait-time">
            <span 
              className="wait-indicator"
              style={{ color: getWaitTimeColor(waitTime) }}
            >
              {getWaitTimeIcon(waitTime)} {waitTime}m
            </span>
          </div>
        </div>

        {/* Route */}
        <div className="ride-route">
          <div className="route-item pickup">
            <span className="route-icon">📍</span>
            <span className="route-address">{ride.pickupAddress}</span>
          </div>
          <div className="route-arrow">↓</div>
          <div className="route-item dropoff">
            <span className="route-icon">🏁</span>
            <span className="route-address">{ride.dropoffAddress}</span>
          </div>
        </div>

        {/* Details */}
        <div className="ride-details">
          <div className="detail-item">
            <span className="detail-label">Fare:</span>
            <span className="detail-value fare">{formatCurrency(ride.estimatedFare)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Requested:</span>
            <span className="detail-value">{format(ride.requestTime, 'HH:mm')}</span>
          </div>
          {ride.specialRequests && (
            <div className="detail-item special">
              <span className="detail-label">Special:</span>
              <span className="detail-value">{ride.specialRequests}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="ride-actions">
          <button
            className="btn-assign primary"
            onClick={() => handleAssignRide(ride)}
            disabled={!isConnected}
          >
            🚗 Assign Driver
          </button>
          <button
            className="btn-call secondary"
            onClick={() => handleCallPassenger(ride)}
          >
            📞 Call
          </button>
          <button
            className="btn-cancel danger"
            onClick={() => {
              const reason = prompt('Cancellation reason:');
              if (reason) {
                handleCancelRide(ride.id, reason);
              }
            }}
          >
            ❌ Cancel
          </button>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="ride-queue-loading">
        <div className="loading-spinner" />
        <p>Loading ride queue...</p>
      </div>
    );
  }

  const filteredRides = getFilteredRides();

  return (
    <div className="ride-queue-panel">
      {/* Header */}
      <div className="panel-header">
        <h2>📋 Ride Queue</h2>
        <div className="connection-status">
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span>{isConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="queue-stats">
        <div className="stat-item">
          <span className="stat-value">{queueStats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item urgent">
          <span className="stat-value">{queueStats.urgent}</span>
          <span className="stat-label">Urgent</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{queueStats.averageWait}m</span>
          <span className="stat-label">Avg Wait</span>
        </div>
      </div>

      {/* Filters */}
      <div className="queue-filters">
        <div className="filter-group">
          <label>Filter:</label>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Rides</option>
            <option value="urgent">Urgent (>5min)</option>
            <option value="vip">VIP (4.8+ rating)</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="waitTime">Wait Time</option>
            <option value="fare">Fare (High to Low)</option>
            <option value="distance">Distance</option>
          </select>
        </div>
      </div>

      {/* Ride list */}
      <div className="ride-list">
        {filteredRides.length === 0 ? (
          <div className="empty-queue">
            <div className="empty-icon">🎉</div>
            <h3>No pending rides</h3>
            <p>All rides have been assigned or completed.</p>
          </div>
        ) : (
          filteredRides.map(ride => (
            <RideCard key={ride.id} ride={ride} />
          ))
        )}
      </div>

      {/* Audio alert for new rides */}
      <audio id="new-ride-alert" preload="auto">
        <source src="/sounds/new-ride-alert.mp3" type="audio/mpeg" />
        <source src="/sounds/new-ride-alert.wav" type="audio/wav" />
      </audio>
    </div>
  );
};

export default RideQueuePanel;
