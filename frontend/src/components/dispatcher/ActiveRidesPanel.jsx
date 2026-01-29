import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { toast } from 'react-toastify';
import { format, formatDistanceToNow } from 'date-fns';

const ActiveRidesPanel = () => {
  const { activeRides, isConnected, emit } = useSocket();
  
  // State
  const [rides, setRides] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('startTime'); // startTime, duration, status

  // Mock active rides data - replace with real Socket.io data
  useEffect(() => {
    const mockActiveRides = [
      {
        id: 'ride-active-001',
        passengerName: 'John Doe',
        passengerPhone: '+675 7123 4567',
        driverName: 'James Kila',
        driverPhone: '+675 7111 2222',
        vehicle: {
          make: 'Toyota',
          model: 'Camry',
          plate: 'NAD 123'
        },
        status: 'EN_ROUTE_TO_PICKUP',
        pickupAddress: 'Jacksons Airport, Port Moresby',
        dropoffAddress: 'Vision City, Waigani',
        pickupLocation: { lat: -9.4434, lng: 147.2200 },
        dropoffLocation: { lat: -9.4000, lng: 147.1500 },
        currentLocation: { lat: -9.4400, lng: 147.2000 },
        estimatedFare: 45,
        startTime: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
        estimatedArrival: new Date(Date.now() + 12 * 60 * 1000), // 12 minutes from now
        distance: 15.2, // km
        sosTriggered: false,
        notes: []
      },
      {
        id: 'ride-active-002',
        passengerName: 'Mary Smith',
        passengerPhone: '+675 7234 5678',
        driverName: 'Peter Namaliu',
        driverPhone: '+675 7333 4444',
        vehicle: {
          make: 'Nissan',
          model: 'Altima',
          plate: 'NAD 789'
        },
        status: 'PASSENGER_ON_BOARD',
        pickupAddress: 'University of Papua New Guinea',
        dropoffAddress: 'Boroko Shopping Centre',
        pickupLocation: { lat: -9.4050, lng: 147.1600 },
        dropoffLocation: { lat: -9.4300, lng: 147.1800 },
        currentLocation: { lat: -9.4200, lng: 147.1700 },
        estimatedFare: 25,
        startTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        estimatedArrival: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        distance: 8.5,
        sosTriggered: false,
        notes: ['Passenger requested AC on']
      },
      {
        id: 'ride-active-003',
        passengerName: 'Peter Wilson',
        passengerPhone: '+675 7345 6789',
        driverName: 'Sarah Wilson',
        driverPhone: '+675 7444 5555',
        vehicle: {
          make: 'Mazda',
          model: 'CX-5',
          plate: 'NAD 101'
        },
        status: 'APPROACHING_DESTINATION',
        pickupAddress: 'Holiday Inn, Port Moresby',
        dropoffAddress: 'Port Moresby General Hospital',
        pickupLocation: { lat: -9.4700, lng: 147.1500 },
        dropoffLocation: { lat: -9.4200, lng: 147.1700 },
        currentLocation: { lat: -9.4250, lng: 147.1680 },
        estimatedFare: 30,
        startTime: new Date(Date.now() - 22 * 60 * 1000), // 22 minutes ago
        estimatedArrival: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes from now
        distance: 12.1,
        sosTriggered: true, // SOS alert triggered
        notes: ['Medical appointment - urgent', 'SOS triggered at 14:32']
      }
    ];

    setRides(mockActiveRides);
    setLoading(false);
  }, []);

  // Update rides from Socket.io
  useEffect(() => {
    if (activeRides && activeRides.length > 0) {
      setRides(activeRides);
    }
  }, [activeRides]);

  // Get status color
  const getStatusColor = (status, sosTriggered = false) => {
    if (sosTriggered) return '#f44336'; // Red for SOS
    
    switch (status) {
      case 'EN_ROUTE_TO_PICKUP': return '#ff9800'; // Orange
      case 'PASSENGER_ON_BOARD': return '#2196f3'; // Blue
      case 'APPROACHING_DESTINATION': return '#4caf50'; // Green
      default: return '#9e9e9e';
    }
  };

  // Get status icon
  const getStatusIcon = (status, sosTriggered = false) => {
    if (sosTriggered) return '🚨';
    
    switch (status) {
      case 'EN_ROUTE_TO_PICKUP': return '🟡';
      case 'PASSENGER_ON_BOARD': return '🔵';
      case 'APPROACHING_DESTINATION': return '🟢';
      default: return '⚪';
    }
  };

  // Get status text
  const getStatusText = (status) => {
    switch (status) {
      case 'EN_ROUTE_TO_PICKUP': return 'En Route to Pickup';
      case 'PASSENGER_ON_BOARD': return 'Passenger On Board';
      case 'APPROACHING_DESTINATION': return 'Approaching Destination';
      default: return 'Unknown Status';
    }
  };

  // Calculate ride duration
  const getRideDuration = (startTime) => {
    return formatDistanceToNow(new Date(startTime), { addSuffix: false });
  };

  // Sort rides
  const getSortedRides = useCallback(() => {
    return [...rides].sort((a, b) => {
      switch (sortBy) {
        case 'startTime':
          return new Date(b.startTime) - new Date(a.startTime); // Newest first
        case 'duration':
          return new Date(a.startTime) - new Date(b.startTime); // Longest first
        case 'status':
          // SOS first, then by status priority
          if (a.sosTriggered && !b.sosTriggered) return -1;
          if (!a.sosTriggered && b.sosTriggered) return 1;
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  }, [rides, sortBy]);

  // Handle ride actions
  const handleCallDriver = (ride) => {
    toast.info(`Calling driver ${ride.driverName}...`);
    console.log('Call driver:', ride.driverPhone);
  };

  const handleCallPassenger = (ride) => {
    toast.info(`Calling passenger ${ride.passengerName}...`);
    console.log('Call passenger:', ride.passengerPhone);
  };

  const handleViewOnMap = (ride) => {
    // This would zoom the main map to the ride location
    console.log('View ride on map:', ride.id);
    toast.info('Zooming to ride location on map...');
  };

  const handleAddNote = (ride) => {
    const note = prompt(`Add note for ride ${ride.id.slice(-6)}:`);
    if (note) {
      // In real app, this would update via API
      const updatedRides = rides.map(r => 
        r.id === ride.id 
          ? { ...r, notes: [...r.notes, `${format(new Date(), 'HH:mm')} - ${note}`] }
          : r
      );
      setRides(updatedRides);
      toast.success('Note added to ride');
    }
  };

  const handleForceCancelRide = (ride) => {
    const reason = prompt(`Force cancel ride ${ride.id.slice(-6)}? Enter reason:`);
    if (reason) {
      const confirmed = window.confirm(
        `This will immediately cancel the active ride. Are you sure?`
      );
      if (confirmed) {
        emit('dispatcher:force_cancel', { rideId: ride.id, reason });
        toast.warning(`Ride ${ride.id.slice(-6)} has been force cancelled`);
      }
    }
  };

  const handleResolveSOS = (ride) => {
    const confirmed = window.confirm(
      `Mark SOS alert as resolved for ride ${ride.id.slice(-6)}?`
    );
    if (confirmed) {
      // Update ride to remove SOS flag
      const updatedRides = rides.map(r => 
        r.id === ride.id 
          ? { ...r, sosTriggered: false, notes: [...r.notes, `${format(new Date(), 'HH:mm')} - SOS resolved by dispatcher`] }
          : r
      );
      setRides(updatedRides);
      toast.success('SOS alert resolved');
    }
  };

  // Format currency for PNG
  const formatCurrency = (amount) => {
    const rounded = Math.round(amount / 5) * 5;
    return `PGK ${rounded}`;
  };

  // Render ride card
  const RideCard = ({ ride }) => {
    const duration = getRideDuration(ride.startTime);
    const isSOS = ride.sosTriggered;
    
    return (
      <div className={`active-ride-card ${isSOS ? 'sos-alert' : ''}`}>
        {/* Header */}
        <div className="ride-header">
          <div className="ride-id">
            <span className="id-text">#{ride.id.slice(-6)}</span>
            <div className="status-indicator">
              <span 
                className="status-icon"
                style={{ color: getStatusColor(ride.status, isSOS) }}
              >
                {getStatusIcon(ride.status, isSOS)}
              </span>
              <span className="status-text">{getStatusText(ride.status)}</span>
            </div>
          </div>
          <div className="ride-duration">
            <span className="duration-text">{duration}</span>
            {isSOS && <span className="sos-badge">🚨 SOS</span>}
          </div>
        </div>

        {/* Participants */}
        <div className="ride-participants">
          <div className="participant passenger">
            <span className="participant-label">👤 Passenger:</span>
            <span className="participant-name">{ride.passengerName}</span>
            <span className="participant-phone">{ride.passengerPhone}</span>
          </div>
          <div className="participant driver">
            <span className="participant-label">🚗 Driver:</span>
            <span className="participant-name">{ride.driverName}</span>
            <span className="participant-vehicle">
              {ride.vehicle.make} {ride.vehicle.model} ({ride.vehicle.plate})
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
            <span className="detail-label">💰 Fare:</span>
            <span className="detail-value">{formatCurrency(ride.estimatedFare)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">📏 Distance:</span>
            <span className="detail-value">{ride.distance} km</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">🕐 Started:</span>
            <span className="detail-value">{format(ride.startTime, 'HH:mm')}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">⏰ ETA:</span>
            <span className="detail-value">{format(ride.estimatedArrival, 'HH:mm')}</span>
          </div>
        </div>

        {/* Notes */}
        {ride.notes && ride.notes.length > 0 && (
          <div className="ride-notes">
            <div className="notes-header">📝 Notes:</div>
            <div className="notes-list">
              {ride.notes.map((note, index) => (
                <div key={index} className="note-item">{note}</div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="ride-actions">
          <div className="action-group primary">
            <button 
              className="action-btn call-driver"
              onClick={() => handleCallDriver(ride)}
              title="Call driver"
            >
              📞 Driver
            </button>
            <button 
              className="action-btn call-passenger"
              onClick={() => handleCallPassenger(ride)}
              title="Call passenger"
            >
              📞 Passenger
            </button>
            <button 
              className="action-btn view-map"
              onClick={() => handleViewOnMap(ride)}
              title="View on map"
            >
              🗺️ Map
            </button>
          </div>
          
          <div className="action-group secondary">
            <button 
              className="action-btn add-note"
              onClick={() => handleAddNote(ride)}
              title="Add internal note"
            >
              📝 Note
            </button>
            {isSOS && (
              <button 
                className="action-btn resolve-sos"
                onClick={() => handleResolveSOS(ride)}
                title="Resolve SOS alert"
              >
                ✅ Resolve SOS
              </button>
            )}
            <button 
              className="action-btn cancel-ride danger"
              onClick={() => handleForceCancelRide(ride)}
              title="Force cancel ride (emergency)"
            >
              ❌ Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="active-rides-loading">
        <div className="loading-spinner" />
        <p>Loading active rides...</p>
      </div>
    );
  }

  const sortedRides = getSortedRides();
  const sosCount = rides.filter(r => r.sosTriggered).length;

  return (
    <div className="active-rides-panel">
      {/* Header */}
      <div className="panel-header">
        <h2>🚕 Active Rides</h2>
        <div className="header-stats">
          {sosCount > 0 && (
            <div className="sos-indicator">
              <span className="sos-count">🚨 {sosCount}</span>
            </div>
          )}
          <div className="connection-status">
            <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            <span>{isConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="panel-controls">
        <div className="sort-controls">
          <label>Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="startTime">Start Time (Newest)</option>
            <option value="duration">Duration (Longest)</option>
            <option value="status">Status (SOS First)</option>
          </select>
        </div>
        <div className="ride-stats">
          <span className="stat-item">
            Total: <strong>{rides.length}</strong>
          </span>
          <span className="stat-item">
            En Route: <strong>{rides.filter(r => r.status === 'EN_ROUTE_TO_PICKUP').length}</strong>
          </span>
          <span className="stat-item">
            On Board: <strong>{rides.filter(r => r.status === 'PASSENGER_ON_BOARD').length}</strong>
          </span>
        </div>
      </div>

      {/* Rides list */}
      <div className="rides-list">
        {sortedRides.length === 0 ? (
          <div className="empty-rides">
            <div className="empty-icon">🎉</div>
            <h3>No active rides</h3>
            <p>All rides have been completed or are waiting for assignment.</p>
          </div>
        ) : (
          <div className="rides-scroll">
            {sortedRides.map(ride => (
              <RideCard key={ride.id} ride={ride} />
            ))}
          </div>
        )}
      </div>

      {/* Auto-scroll to new rides */}
      <div className="auto-scroll-notice">
        {rides.length > 0 && (
          <small>🔄 Auto-refreshing every 5 seconds</small>
        )}
      </div>
    </div>
  );
};

export default ActiveRidesPanel;
