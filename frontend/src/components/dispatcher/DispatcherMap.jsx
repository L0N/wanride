import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { useSocket } from '../../contexts/SocketContext';
import DriverMarker from './DriverMarker';

// Port Moresby center coordinates
const PORT_MORESBY_CENTER = {
  lat: -9.4438,
  lng: 147.1803
};

// Map configuration optimized for PNG
const MAP_CONFIG = {
  zoom: 12,
  center: PORT_MORESBY_CENTER,
  options: {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: true,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: true,
    mapTypeId: 'roadmap',
    styles: [
      // Custom map styling for better visibility
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      },
      {
        featureType: 'transit',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  }
};

// Google Maps libraries to load
const LIBRARIES = ['geometry', 'drawing'];

const DispatcherMap = ({ onMarkerClick, onRideRouteClick }) => {
  const { driverLocations, activeRides, isConnected } = useSocket();
  
  // Map state
  const [map, setMap] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedRide, setSelectedRide] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [rides, setRides] = useState([]);
  
  // Refs for performance optimization
  const markersRef = useRef(new Map());
  const lastUpdateRef = useRef(Date.now());

  // Convert driver locations Map to array for rendering
  useEffect(() => {
    const driversArray = Array.from(driverLocations.entries()).map(([driverId, location]) => ({
      id: driverId,
      ...location,
      // Mock driver data - in real app this would come from API
      name: `Driver ${driverId.slice(-4)}`,
      vehicle: `Vehicle ${driverId.slice(-4)}`,
      status: location.status || 'AVAILABLE'
    }));
    setDrivers(driversArray);
  }, [driverLocations]);

  // Update active rides
  useEffect(() => {
    setRides(activeRides);
  }, [activeRides]);

  // Handle map load
  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    setMapLoaded(true);
    console.log('[DispatcherMap] Map loaded successfully');
  }, []);

  // Handle map unmount
  const onMapUnmount = useCallback(() => {
    setMap(null);
    setMapLoaded(false);
    markersRef.current.clear();
  }, []);

  // Handle driver marker click
  const handleDriverClick = useCallback((driver) => {
    setSelectedDriver(driver);
    setSelectedRide(null);
    if (onMarkerClick) {
      onMarkerClick(driver);
    }
  }, [onMarkerClick]);

  // Handle ride route click
  const handleRideRouteClick = useCallback((ride) => {
    setSelectedRide(ride);
    setSelectedDriver(null);
    if (onRideRouteClick) {
      onRideRouteClick(ride);
    }
  }, [onRideRouteClick]);

  // Get driver status color
  const getDriverStatusColor = (status) => {
    switch (status) {
      case 'AVAILABLE': return '#4caf50'; // Green
      case 'EN_ROUTE_TO_PICKUP': return '#ff9800'; // Orange
      case 'ON_RIDE': return '#2196f3'; // Blue
      case 'ON_BREAK': return '#ff5722'; // Deep orange
      case 'OFFLINE': return '#9e9e9e'; // Gray
      default: return '#9e9e9e';
    }
  };

  // Get driver status icon
  const getDriverStatusIcon = (status) => {
    switch (status) {
      case 'AVAILABLE': return '🟢';
      case 'EN_ROUTE_TO_PICKUP': return '🟡';
      case 'ON_RIDE': return '🔵';
      case 'ON_BREAK': return '🟠';
      case 'OFFLINE': return '🔴';
      default: return '⚪';
    }
  };

  // Auto-fit map bounds to show all drivers
  const fitMapBounds = useCallback(() => {
    if (!map || drivers.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    
    // Add driver locations to bounds
    drivers.forEach(driver => {
      if (driver.lat && driver.lng) {
        bounds.extend(new window.google.maps.LatLng(driver.lat, driver.lng));
      }
    });

    // Add ride locations to bounds
    rides.forEach(ride => {
      if (ride.pickupLocation) {
        bounds.extend(new window.google.maps.LatLng(
          ride.pickupLocation.lat, 
          ride.pickupLocation.lng
        ));
      }
      if (ride.dropoffLocation) {
        bounds.extend(new window.google.maps.LatLng(
          ride.dropoffLocation.lat, 
          ride.dropoffLocation.lng
        ));
      }
    });

    // Fit bounds with padding
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }, [map, drivers, rides]);

  // Throttled location updates for performance
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current > 5000) { // Update every 5 seconds max
      lastUpdateRef.current = now;
      if (drivers.length > 0 && map) {
        // Only fit bounds if we have new data
        fitMapBounds();
      }
    }
  }, [drivers, fitMapBounds, map]);

  // Render ride routes
  const renderRideRoutes = () => {
    return rides.map(ride => {
      if (!ride.pickupLocation || !ride.dropoffLocation) return null;

      const routePath = [
        { lat: ride.pickupLocation.lat, lng: ride.pickupLocation.lng },
        { lat: ride.dropoffLocation.lat, lng: ride.dropoffLocation.lng }
      ];

      return (
        <Polyline
          key={`ride-${ride.id}`}
          path={routePath}
          options={{
            strokeColor: '#2196f3',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            clickable: true
          }}
          onClick={() => handleRideRouteClick(ride)}
        />
      );
    });
  };

  // Render pickup/dropoff markers
  const renderRideMarkers = () => {
    const markers = [];
    
    rides.forEach(ride => {
      // Pickup marker
      if (ride.pickupLocation) {
        markers.push(
          <Marker
            key={`pickup-${ride.id}`}
            position={{ lat: ride.pickupLocation.lat, lng: ride.pickupLocation.lng }}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#4caf50" stroke="white" stroke-width="2"/>
                  <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">P</text>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(24, 24)
            }}
            title={`Pickup: ${ride.passengerName || 'Passenger'}`}
          />
        );
      }

      // Dropoff marker
      if (ride.dropoffLocation) {
        markers.push(
          <Marker
            key={`dropoff-${ride.id}`}
            position={{ lat: ride.dropoffLocation.lat, lng: ride.dropoffLocation.lng }}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#f44336" stroke="white" stroke-width="2"/>
                  <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">D</text>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(24, 24)
            }}
            title={`Dropoff: ${ride.destination || 'Destination'}`}
          />
        );
      }
    });

    return markers;
  };

  // Map controls
  const MapControls = () => (
    <div className="map-controls">
      <button
        className={`control-btn ${showHeatmap ? 'active' : ''}`}
        onClick={() => setShowHeatmap(!showHeatmap)}
        title="Toggle fleet density heatmap"
      >
        🔥 Heatmap
      </button>
      <button
        className="control-btn"
        onClick={fitMapBounds}
        title="Fit all vehicles in view"
      >
        🎯 Fit All
      </button>
      <button
        className="control-btn"
        onClick={() => map?.setCenter(PORT_MORESBY_CENTER)}
        title="Center on Port Moresby"
      >
        📍 Center
      </button>
      <div className="connection-indicator">
        <div 
          className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}
          title={isConnected ? 'Real-time updates active' : 'Offline - showing cached data'}
        />
        <span className="status-text">
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>
    </div>
  );

  // Loading state
  if (!mapLoaded) {
    return (
      <div className="map-loading">
        <div className="loading-spinner" />
        <p>Loading Port Moresby fleet map...</p>
      </div>
    );
  }

  return (
    <div className="dispatcher-map">
      <LoadScript
        googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY || ''}
        libraries={LIBRARIES}
        loadingElement={<div className="map-loading">Loading map...</div>}
      >
        <GoogleMap
          mapContainerClassName="map-container"
          center={MAP_CONFIG.center}
          zoom={MAP_CONFIG.zoom}
          options={MAP_CONFIG.options}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
        >
          {/* Driver markers */}
          {drivers.map(driver => (
            <Marker
              key={`driver-${driver.id}`}
              position={{ lat: driver.lat, lng: driver.lng }}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="14" fill="${getDriverStatusColor(driver.status)}" stroke="white" stroke-width="3"/>
                    <text x="16" y="20" text-anchor="middle" fill="white" font-size="16">${getDriverStatusIcon(driver.status)}</text>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(32, 32)
              }}
              title={`${driver.name} - ${driver.status}`}
              onClick={() => handleDriverClick(driver)}
            />
          ))}

          {/* Ride routes */}
          {renderRideRoutes()}

          {/* Ride markers */}
          {renderRideMarkers()}

          {/* Driver info window */}
          {selectedDriver && (
            <InfoWindow
              position={{ lat: selectedDriver.lat, lng: selectedDriver.lng }}
              onCloseClick={() => setSelectedDriver(null)}
            >
              <div className="driver-info-window">
                <h3>{selectedDriver.name}</h3>
                <p><strong>Vehicle:</strong> {selectedDriver.vehicle}</p>
                <p><strong>Status:</strong> {selectedDriver.status}</p>
                <p><strong>Last Update:</strong> {new Date(selectedDriver.timestamp).toLocaleTimeString()}</p>
                <div className="info-actions">
                  <button 
                    className="btn-call"
                    onClick={() => console.log('Call driver:', selectedDriver.id)}
                  >
                    📞 Call
                  </button>
                  <button 
                    className="btn-message"
                    onClick={() => console.log('Message driver:', selectedDriver.id)}
                  >
                    💬 Message
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}

          {/* Ride info window */}
          {selectedRide && (
            <InfoWindow
              position={{ 
                lat: selectedRide.pickupLocation?.lat || selectedRide.dropoffLocation?.lat, 
                lng: selectedRide.pickupLocation?.lng || selectedRide.dropoffLocation?.lng 
              }}
              onCloseClick={() => setSelectedRide(null)}
            >
              <div className="ride-info-window">
                <h3>Ride #{selectedRide.id?.slice(-6)}</h3>
                <p><strong>Passenger:</strong> {selectedRide.passengerName}</p>
                <p><strong>Driver:</strong> {selectedRide.driverName}</p>
                <p><strong>Status:</strong> {selectedRide.status}</p>
                <p><strong>Fare:</strong> PGK {selectedRide.fare}</p>
                <div className="info-actions">
                  <button 
                    className="btn-track"
                    onClick={() => console.log('Track ride:', selectedRide.id)}
                  >
                    📍 Track
                  </button>
                  <button 
                    className="btn-contact"
                    onClick={() => console.log('Contact ride:', selectedRide.id)}
                  >
                    📞 Contact
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>

      {/* Map controls overlay */}
      <MapControls />

      {/* Fleet summary */}
      <div className="fleet-summary">
        <div className="summary-item">
          <span className="summary-label">Total Vehicles:</span>
          <span className="summary-value">{drivers.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Available:</span>
          <span className="summary-value available">
            {drivers.filter(d => d.status === 'AVAILABLE').length}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Active Rides:</span>
          <span className="summary-value active">
            {rides.length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DispatcherMap;
