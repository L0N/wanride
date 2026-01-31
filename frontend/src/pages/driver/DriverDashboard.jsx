import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import ShiftManager from '../../components/driver/ShiftManager';
import IncomingRideModal from '../../components/driver/IncomingRideModal';
import DriverStats from '../../components/driver/DriverStats';
import VehicleStatusCard from '../../components/driver/VehicleStatusCard';
import SOSButton from '../../components/driver/SOSButton';
import OfflineBanner from '../../components/driver/OfflineBanner';

const DriverDashboard = () => {
  const { user, logout } = useAuth();
  const { isConnected, notifications, emit } = useSocket();
  const navigate = useNavigate();
  
  // State
  const [shiftStatus, setShiftStatus] = useState('OFFLINE');
  const [activeRide, setActiveRide] = useState(null);
  const [incomingRide, setIncomingRide] = useState(null);
  const [showIncomingRideModal, setShowIncomingRideModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [todayStats, setTodayStats] = useState({
    hoursWorked: 0,
    ridesCompleted: 0,
    cashCollected: 0,
    estimatedCommission: 0,
    averageRating: 0
  });
  const [messages, setMessages] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Check if user is a driver
  useEffect(() => {
    if (!user || !user.roles.includes('DRIVER')) {
      toast.error('Access denied: Driver account required');
      navigate('/login');
      return;
    }
  }, [user, navigate]);

  // Listen for incoming ride assignments
  useEffect(() => {
    if (!isConnected) return;

    // Listen for ride assignments
    const handleRideAssigned = (ride) => {
      console.log('Ride assigned:', ride);
      setIncomingRide(ride);
      setShowIncomingRideModal(true);
      
      // Play notification sound
      playNotificationSound();
      
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification('New Ride Assignment', {
          body: `Pickup: ${ride.pickupAddress}`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: 'ride-assignment',
          requireInteraction: true
        });
      }
    };

    // Listen for ride cancellations
    const handleRideCancelled = ({ rideId, reason }) => {
      if (activeRide && activeRide.id === rideId) {
        setActiveRide(null);
        toast.info(`Ride cancelled: ${reason}`);
      }
      if (incomingRide && incomingRide.id === rideId) {
        setIncomingRide(null);
        setShowIncomingRideModal(false);
        toast.info(`Assigned ride cancelled: ${reason}`);
      }
    };

    // Listen for dispatcher messages
    const handleDispatcherMessage = ({ message, timestamp }) => {
      setMessages(prev => [...prev, { message, timestamp, type: 'dispatcher' }]);
      toast.info(`Dispatcher: ${message}`);
    };

    // Listen for fleet announcements
    const handleFleetAnnouncement = ({ title, message, priority }) => {
      setAnnouncements(prev => [...prev, { title, message, priority, timestamp: new Date() }]);
      
      if (priority === 'high') {
        toast.warning(`${title}: ${message}`);
      } else {
        toast.info(`${title}: ${message}`);
      }
    };

    // Listen for shift reminders
    const handleShiftReminder = ({ type, message }) => {
      toast.info(message);
    };

    // Listen for force logout
    const handleForceLogout = ({ reason }) => {
      toast.error(`You have been logged out: ${reason}`);
      logout();
      navigate('/driver/login');
    };

    // Set up Socket.io listeners
    const socket = window.socket; // Assuming socket is available globally
    if (socket) {
      socket.on('ride:assigned', handleRideAssigned);
      socket.on('ride:cancelled', handleRideCancelled);
      socket.on('dispatcher:message', handleDispatcherMessage);
      socket.on('fleet:announcement', handleFleetAnnouncement);
      socket.on('driver:shift:reminder', handleShiftReminder);
      socket.on('driver:force:logout', handleForceLogout);
    }

    // Cleanup listeners
    return () => {
      if (socket) {
        socket.off('ride:assigned', handleRideAssigned);
        socket.off('ride:cancelled', handleRideCancelled);
        socket.off('dispatcher:message', handleDispatcherMessage);
        socket.off('fleet:announcement', handleFleetAnnouncement);
        socket.off('driver:shift:reminder', handleShiftReminder);
        socket.off('driver:force:logout', handleForceLogout);
      }
    };
  }, [isConnected, activeRide, incomingRide, logout, navigate]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          toast.success('Notifications enabled for ride assignments');
        } else {
          toast.warning('Enable notifications to receive ride assignments');
        }
      });
    }
  }, []);

  // Track location when on duty
  useEffect(() => {
    let locationWatcher = null;
    
    if (shiftStatus === 'CLOCKED_IN' && navigator.geolocation) {
      locationWatcher = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };
          
          setCurrentLocation(location);
          setLocationAccuracy(position.coords.accuracy);
          
          // Send location update via Socket.io every 10 seconds
          if (isConnected) {
            emit('driver:location', {
              driverId: user.id,
              location,
              status: activeRide ? 'ON_RIDE' : 'AVAILABLE'
            });
          }
        },
        (error) => {
          console.error('Location error:', error);
          toast.error('GPS signal lost. Please check your location settings.');
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000 // 10 seconds
        }
      );
    }
    
    return () => {
      if (locationWatcher) {
        navigator.geolocation.clearWatch(locationWatcher);
      }
    };
  }, [shiftStatus, isConnected, user, activeRide, emit]);

  // Monitor battery level
  useEffect(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        setBatteryLevel(Math.round(battery.level * 100));
        
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
        
        // Warn if battery is low
        if (battery.level < 0.2) {
          toast.warning('⚠️ Battery low (20%). Consider charging your device.');
        }
      });
    }
  }, []);

  // Load today's statistics
  useEffect(() => {
    loadTodayStats();
    
    // Refresh stats every 5 minutes
    const interval = setInterval(loadTodayStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load today's statistics
  const loadTodayStats = async () => {
    try {
      const response = await fetch('/api/driver/stats/today', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTodayStats(data);
      }
    } catch (error) {
      console.error('Error loading today stats:', error);
    }
  };

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/sounds/ride-assigned.mp3');
      audio.volume = 0.8;
      audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
      console.log('Audio not available:', error);
    }
  };

  // Handle shift status change
  const handleShiftChange = (newStatus) => {
    setShiftStatus(newStatus);
    
    // Update driver status via Socket.io
    if (isConnected) {
      let driverStatus = 'OFFLINE';
      if (newStatus === 'CLOCKED_IN') driverStatus = 'AVAILABLE';
      if (newStatus === 'ON_BREAK') driverStatus = 'ON_BREAK';
      
      emit('driver:status', {
        driverId: user.id,
        status: driverStatus
      });
    }
  };

  // Handle ride acceptance
  const handleAcceptRide = async (ride) => {
    try {
      const response = await fetch(`/api/driver/rides/${ride.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        setActiveRide(ride);
        setIncomingRide(null);
        setShowIncomingRideModal(false);
        
        // Emit Socket.io event
        if (isConnected) {
          emit('ride:accept', {
            rideId: ride.id,
            driverId: user.id,
            timestamp: new Date().toISOString()
          });
        }
        
        toast.success('✅ Ride accepted! Navigate to pickup location.');
        
        // Navigate to ride view
        navigate(`/driver/ride/${ride.id}`);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to accept ride');
      }
    } catch (error) {
      console.error('Accept ride error:', error);
      toast.error('Failed to accept ride. Check your connection.');
    }
  };

  // Handle quick contact
  const handleCallDispatcher = () => {
    const dispatcherNumber = '+675712345'; // Replace with actual number
    window.location.href = `tel:${dispatcherNumber}`;
  };

  const handleCallFleetManager = () => {
    const fleetManagerNumber = '+675712346'; // Replace with actual number
    window.location.href = `tel:${fleetManagerNumber}`;
  };

  // Handle logout
  const handleLogout = () => {
    const confirmed = window.confirm('Are you sure you want to log out?');
    if (confirmed) {
      logout();
      navigate('/driver/login');
    }
  };

  // Render available state (no active ride)
  const renderAvailableState = () => (
    <div className="driver-dashboard available">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>🚗 WanRide Driver</h1>
          <p>Welcome, {user?.name}</p>
        </div>
        <div className="header-right">
          <div className="battery-indicator">
            {batteryLevel && (
              <span className={`battery ${batteryLevel < 20 ? 'low' : ''}`}>
                🔋 {batteryLevel}%
              </span>
            )}
          </div>
          <button onClick={handleLogout} className="logout-btn">
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Offline banner */}
      {!isConnected && <OfflineBanner />}

      {/* Shift Manager */}
      <ShiftManager onShiftChange={handleShiftChange} />

      {/* Main content when clocked in */}
      {shiftStatus === 'CLOCKED_IN' && (
        <>
          {/* Today's Stats */}
          <DriverStats stats={todayStats} />

          {/* Vehicle Status */}
          <VehicleStatusCard />

          {/* Current Location */}
          <div className="location-card">
            <h3>📍 Current Location</h3>
            {currentLocation ? (
              <div className="location-info">
                <p className="location-address">
                  {/* This would be reverse geocoded in real implementation */}
                  Port Moresby, PNG
                </p>
                <div className="location-details">
                  <span className="accuracy">
                    GPS Accuracy: {locationAccuracy ? Math.round(locationAccuracy) : '?'}m
                  </span>
                  <span className="last-update">
                    Updated: {format(new Date(), 'HH:mm:ss')}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    // Refresh location
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          setCurrentLocation({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: new Date().toISOString()
                          });
                          toast.success('📍 Location refreshed');
                        },
                        (error) => toast.error('Failed to get location')
                      );
                    }
                  }}
                  className="refresh-location-btn"
                >
                  🔄 Refresh
                </button>
              </div>
            ) : (
              <div className="location-loading">
                <div className="loading-spinner" />
                <p>Getting your location...</p>
              </div>
            )}
          </div>

          {/* Notifications Center */}
          {(messages.length > 0 || announcements.length > 0) && (
            <div className="notifications-center">
              <h3>🔔 Notifications</h3>
              
              {messages.slice(-3).map((msg, index) => (
                <div key={index} className="notification-item dispatcher">
                  <div className="notification-header">
                    <span className="notification-type">📢 Dispatcher</span>
                    <span className="notification-time">
                      {format(new Date(msg.timestamp), 'HH:mm')}
                    </span>
                  </div>
                  <p className="notification-message">{msg.message}</p>
                </div>
              ))}
              
              {announcements.slice(-2).map((announcement, index) => (
                <div key={index} className={`notification-item announcement ${announcement.priority}`}>
                  <div className="notification-header">
                    <span className="notification-type">📣 {announcement.title}</span>
                    <span className="notification-time">
                      {format(announcement.timestamp, 'HH:mm')}
                    </span>
                  </div>
                  <p className="notification-message">{announcement.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Quick Contact */}
          <div className="quick-contact">
            <h3>📞 Quick Contact</h3>
            <div className="contact-buttons">
              <button 
                onClick={handleCallDispatcher}
                className="contact-btn dispatcher"
              >
                📞 Call Dispatcher
              </button>
              <button 
                onClick={handleCallFleetManager}
                className="contact-btn fleet-manager"
              >
                📞 Fleet Manager
              </button>
            </div>
          </div>
        </>
      )}

      {/* Waiting for rides message */}
      {shiftStatus === 'CLOCKED_IN' && (
        <div className="waiting-message">
          <div className="waiting-icon">⏳</div>
          <h3>Waiting for ride assignments...</h3>
          <p>You'll be notified when a dispatcher assigns you a ride.</p>
        </div>
      )}

      {/* SOS Button (always visible when clocked in) */}
      {shiftStatus === 'CLOCKED_IN' && (
        <SOSButton 
          rideId={activeRide?.id}
          location={currentLocation}
        />
      )}

      {/* Incoming Ride Modal */}
      {showIncomingRideModal && incomingRide && (
        <IncomingRideModal
          ride={incomingRide}
          onAccept={handleAcceptRide}
          onTimeout={() => {
            // Auto-accept after 15 seconds
            handleAcceptRide(incomingRide);
          }}
        />
      )}
    </div>
  );

  // Loading state
  if (!user) {
    return (
      <div className="driver-dashboard loading">
        <div className="loading-spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return renderAvailableState();
};

export default DriverDashboard;
