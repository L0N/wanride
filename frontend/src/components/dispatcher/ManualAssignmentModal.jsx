import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { useSocket } from '../../contexts/SocketContext';
import { toast } from 'react-toastify';

// Port Moresby center for fallback
const PORT_MORESBY_CENTER = { lat: -9.4438, lng: 147.1803 };

const ManualAssignmentModal = ({ ride, onAssign, onCancel }) => {
  const { driverLocations, emit, isConnected } = useSocket();
  
  // State
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [assignmentNote, setAssignmentNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [mapCenter, setMapCenter] = useState(PORT_MORESBY_CENTER);
  const [driverDistances, setDriverDistances] = useState(new Map());

  // Mock available drivers data - replace with real API
  useEffect(() => {
    const mockDrivers = [
      {
        id: 'driver-001',
        name: 'James Kila',
        phone: '+675 7111 2222',
        vehicle: {
          make: 'Toyota',
          model: 'Camry',
          plate: 'NAD 123',
          color: 'White'
        },
        location: { lat: -9.4400, lng: 147.1750 },
        status: 'AVAILABLE',
        rating: 4.8,
        completedRides: 12,
        lastRideTime: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
        photo: '/images/drivers/driver-001.jpg'
      },
      {
        id: 'driver-002',
        name: 'Mary Temu',
        phone: '+675 7222 3333',
        vehicle: {
          make: 'Honda',
          model: 'Civic',
          plate: 'NAD 456',
          color: 'Blue'
        },
        location: { lat: -9.4350, lng: 147.1800 },
        status: 'AVAILABLE',
        rating: 4.6,
        completedRides: 8,
        lastRideTime: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
        photo: '/images/drivers/driver-002.jpg'
      },
      {
        id: 'driver-003',
        name: 'Peter Namaliu',
        phone: '+675 7333 4444',
        vehicle: {
          make: 'Nissan',
          model: 'Altima',
          plate: 'NAD 789',
          color: 'Silver'
        },
        location: { lat: -9.4500, lng: 147.1650 },
        status: 'ON_BREAK',
        rating: 4.9,
        completedRides: 15,
        lastRideTime: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
        photo: '/images/drivers/driver-003.jpg'
      }
    ];

    setAvailableDrivers(mockDrivers);
    setLoading(false);

    // Set map center to pickup location
    if (ride.pickupLocation) {
      setMapCenter(ride.pickupLocation);
    }

    // Calculate distances (mock calculation)
    const distances = new Map();
    mockDrivers.forEach(driver => {
      // Mock distance calculation - in real app use Google Maps Distance Matrix API
      const distance = calculateDistance(
        driver.location,
        ride.pickupLocation || PORT_MORESBY_CENTER
      );
      distances.set(driver.id, {
        distance: distance,
        eta: Math.round(distance * 2.5) // Rough ETA calculation
      });
    });
    setDriverDistances(distances);
  }, [ride]);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((point1, point2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lng - point1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal place
  }, []);

  // Sort drivers by assignment priority
  const getSortedDrivers = useCallback(() => {
    return [...availableDrivers].sort((a, b) => {
      const distanceA = driverDistances.get(a.id)?.distance || 999;
      const distanceB = driverDistances.get(b.id)?.distance || 999;
      
      // Primary: Distance (ascending)
      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }
      
      // Secondary: Rating (descending)
      if (a.rating !== b.rating) {
        return b.rating - a.rating;
      }
      
      // Tertiary: Completed rides today (ascending for workload balance)
      return a.completedRides - b.completedRides;
    });
  }, [availableDrivers, driverDistances]);

  // Handle driver selection
  const handleDriverSelect = (driver) => {
    setSelectedDriver(driver);
  };

  // Handle assignment
  const handleAssign = async () => {
    if (!selectedDriver) {
      toast.error('Please select a driver');
      return;
    }

    if (!isConnected) {
      toast.error('Cannot assign ride - connection lost');
      return;
    }

    setCalculating(true);

    try {
      // Emit assignment via Socket.io
      const success = emit('dispatcher:assign', {
        rideId: ride.id,
        driverId: selectedDriver.id,
        note: assignmentNote || `Assigned to ${selectedDriver.name} - ${driverDistances.get(selectedDriver.id)?.distance}km away`
      });

      if (success) {
        toast.success(`Ride assigned to ${selectedDriver.name}`);
        onAssign();
      } else {
        toast.error('Assignment failed - please try again');
      }
    } catch (error) {
      console.error('Assignment error:', error);
      toast.error('Assignment failed');
    } finally {
      setCalculating(false);
    }
  };

  // Handle force assignment (for ON_BREAK drivers)
  const handleForceAssign = async (driver) => {
    const confirmed = window.confirm(
      `${driver.name} is currently on break. Force assign this ride?`
    );
    
    if (confirmed) {
      setSelectedDriver(driver);
      setAssignmentNote(`Force assigned - driver was on break`);
    }
  };

  // Render driver card
  const DriverCard = ({ driver, isSelected, onSelect }) => {
    const driverData = driverDistances.get(driver.id);
    const isOnBreak = driver.status === 'ON_BREAK';
    
    return (
      <div 
        className={`driver-card ${isSelected ? 'selected' : ''} ${isOnBreak ? 'on-break' : ''}`}
        onClick={() => onSelect(driver)}
      >
        {/* Driver photo and basic info */}
        <div className="driver-header">
          <div className="driver-photo">
            <img 
              src={driver.photo} 
              alt={driver.name}
              onError={(e) => {
                e.target.src = '/images/default-driver.png';
              }}
            />
            <div className={`status-badge ${driver.status.toLowerCase()}`}>
              {driver.status === 'AVAILABLE' ? '🟢' : '🟠'}
            </div>
          </div>
          <div className="driver-info">
            <h3 className="driver-name">{driver.name}</h3>
            <div className="driver-rating">⭐ {driver.rating}</div>
            <div className="driver-phone">{driver.phone}</div>
          </div>
        </div>

        {/* Vehicle info */}
        <div className="vehicle-info">
          <div className="vehicle-details">
            <span className="vehicle-text">
              {driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model}
            </span>
            <span className="vehicle-plate">{driver.vehicle.plate}</span>
          </div>
        </div>

        {/* Distance and ETA */}
        <div className="assignment-metrics">
          <div className="metric-item">
            <span className="metric-label">Distance:</span>
            <span className="metric-value">{driverData?.distance || '?'} km</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">ETA:</span>
            <span className="metric-value">{driverData?.eta || '?'} min</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Rides today:</span>
            <span className="metric-value">{driver.completedRides}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="driver-actions">
          {driver.status === 'AVAILABLE' ? (
            <button 
              className="btn-select primary"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(driver);
              }}
            >
              {isSelected ? '✓ Selected' : 'Select Driver'}
            </button>
          ) : (
            <button 
              className="btn-force secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleForceAssign(driver);
              }}
            >
              Force Assign
            </button>
          )}
          <button 
            className="btn-call tertiary"
            onClick={(e) => {
              e.stopPropagation();
              console.log('Call driver:', driver.phone);
              toast.info(`Calling ${driver.name}...`);
            }}
          >
            📞 Call
          </button>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="assignment-modal loading">
          <div className="loading-spinner" />
          <p>Loading available drivers...</p>
        </div>
      </div>
    );
  }

  const sortedDrivers = getSortedDrivers();

  return (
    <div className="modal-overlay">
      <div className="assignment-modal">
        {/* Header */}
        <div className="modal-header">
          <h2>🚗 Assign Driver</h2>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        {/* Ride info */}
        <div className="ride-summary">
          <div className="ride-route">
            <div className="route-point pickup">
              <span className="route-icon">📍</span>
              <span className="route-text">{ride.pickupAddress}</span>
            </div>
            <div className="route-arrow">→</div>
            <div className="route-point dropoff">
              <span className="route-icon">🏁</span>
              <span className="route-text">{ride.dropoffAddress}</span>
            </div>
          </div>
          <div className="ride-details">
            <span className="passenger-name">👤 {ride.passengerName}</span>
            <span className="estimated-fare">💰 PGK {Math.round(ride.estimatedFare / 5) * 5}</span>
          </div>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Map section */}
          <div className="assignment-map">
            <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY || ''}>
              <GoogleMap
                mapContainerClassName="map-container"
                center={mapCenter}
                zoom={13}
                options={{
                  disableDefaultUI: true,
                  zoomControl: true,
                  mapTypeControl: false
                }}
              >
                {/* Pickup marker */}
                {ride.pickupLocation && (
                  <Marker
                    position={ride.pickupLocation}
                    icon={{
                      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="16" cy="16" r="14" fill="#4caf50" stroke="white" stroke-width="3"/>
                          <text x="16" y="20" text-anchor="middle" fill="white" font-size="14" font-weight="bold">P</text>
                        </svg>
                      `),
                      scaledSize: new window.google.maps.Size(32, 32)
                    }}
                    title="Pickup Location"
                  />
                )}

                {/* Driver markers */}
                {sortedDrivers.map(driver => (
                  <Marker
                    key={driver.id}
                    position={driver.location}
                    icon={{
                      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="14" cy="14" r="12" fill="${driver.status === 'AVAILABLE' ? '#2196f3' : '#ff9800'}" stroke="white" stroke-width="2"/>
                          <text x="14" y="18" text-anchor="middle" fill="white" font-size="12">🚗</text>
                        </svg>
                      `),
                      scaledSize: new window.google.maps.Size(28, 28)
                    }}
                    title={`${driver.name} - ${driverDistances.get(driver.id)?.distance}km`}
                    onClick={() => handleDriverSelect(driver)}
                  />
                ))}

                {/* Distance lines */}
                {selectedDriver && ride.pickupLocation && (
                  <Polyline
                    path={[selectedDriver.location, ride.pickupLocation]}
                    options={{
                      strokeColor: '#2196f3',
                      strokeOpacity: 0.8,
                      strokeWeight: 2,
                      strokeDashArray: '5,5'
                    }}
                  />
                )}
              </GoogleMap>
            </LoadScript>
          </div>

          {/* Driver list */}
          <div className="drivers-list">
            <div className="list-header">
              <h3>Available Drivers ({sortedDrivers.length})</h3>
              <div className="sort-info">Sorted by distance</div>
            </div>
            
            <div className="drivers-scroll">
              {sortedDrivers.length === 0 ? (
                <div className="no-drivers">
                  <div className="no-drivers-icon">🚫</div>
                  <h4>No drivers available</h4>
                  <p>All drivers are currently busy or offline.</p>
                </div>
              ) : (
                sortedDrivers.map(driver => (
                  <DriverCard
                    key={driver.id}
                    driver={driver}
                    isSelected={selectedDriver?.id === driver.id}
                    onSelect={handleDriverSelect}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Assignment note */}
        <div className="assignment-note">
          <label htmlFor="assignment-note">Assignment Note (Optional):</label>
          <textarea
            id="assignment-note"
            value={assignmentNote}
            onChange={(e) => setAssignmentNote(e.target.value)}
            placeholder="Add a note about this assignment..."
            rows={2}
          />
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div className="selected-driver-info">
            {selectedDriver && (
              <div className="selection-summary">
                <span className="selected-text">
                  Selected: <strong>{selectedDriver.name}</strong>
                </span>
                <span className="selection-details">
                  {driverDistances.get(selectedDriver.id)?.distance}km away • 
                  ETA {driverDistances.get(selectedDriver.id)?.eta} min
                </span>
              </div>
            )}
          </div>
          
          <div className="modal-actions">
            <button 
              className="btn-cancel secondary"
              onClick={onCancel}
              disabled={calculating}
            >
              Cancel
            </button>
            <button 
              className="btn-assign primary"
              onClick={handleAssign}
              disabled={!selectedDriver || calculating || !isConnected}
            >
              {calculating ? '⏳ Assigning...' : '🚗 Assign Driver'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualAssignmentModal;
