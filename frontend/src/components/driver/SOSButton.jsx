import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { toast } from 'react-toastify';

const SOSButton = ({ rideId, location }) => {
  const { user } = useAuth();
  const { emit, isConnected } = useSocket();
  
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [showSOSModal, setShowSOSModal] = useState(false);

  // Monitor battery level
  useEffect(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        setBatteryLevel(Math.round(battery.level * 100));
        
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }
  }, []);

  // Handle long press start
  const handlePressStart = () => {
    setIsLongPressing(true);
    
    // Haptic feedback if supported
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
    
    // Start 2-second timer for SOS activation
    const timer = setTimeout(() => {
      triggerSOS();
    }, 2000);
    
    setLongPressTimer(timer);
  };

  // Handle press end (before 2 seconds)
  const handlePressEnd = () => {
    setIsLongPressing(false);
    
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Trigger SOS alert
  const triggerSOS = async () => {
    setIsLongPressing(false);
    
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    // Prevent spam (rate limiting)
    if (isSOSActive) {
      toast.warning('SOS already active');
      return;
    }

    try {
      // Get current location if not provided
      let currentLocation = location;
      if (!currentLocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 30000
            });
          });
          
          currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
        } catch (error) {
          console.error('Failed to get location for SOS:', error);
          // Continue with SOS even without location
        }
      }

      // Prepare SOS data
      const sosData = {
        driverId: user.id,
        driverName: user.name,
        rideId: rideId || null,
        location: currentLocation,
        batteryLevel,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      };

      // Send SOS via API
      const response = await fetch('/api/driver/sos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(sosData)
      });

      if (response.ok) {
        setIsSOSActive(true);
        setShowSOSModal(true);
        
        // Emit Socket.io event for real-time dispatcher notification
        if (isConnected) {
          emit('ride:sos', sosData);
        }
        
        // Strong haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate([500, 200, 500, 200, 500]);
        }
        
        // Play alert sound
        try {
          const audio = new Audio('/sounds/sos-alert.mp3');
          audio.volume = 1.0;
          audio.play().catch(e => console.log('SOS audio failed:', e));
        } catch (error) {
          console.log('SOS audio not available:', error);
        }
        
        toast.error('🚨 SOS ALERT SENT - Help is on the way!', {
          autoClose: false,
          closeOnClick: false
        });
        
        // Auto-dial dispatcher after 3 seconds
        setTimeout(() => {
          const dispatcherNumber = '+675712345'; // Replace with actual emergency number
          window.location.href = `tel:${dispatcherNumber}`;
        }, 3000);
        
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to send SOS alert');
      }
    } catch (error) {
      console.error('SOS trigger error:', error);
      toast.error('Failed to send SOS alert. Check your connection.');
      
      // Still try to emit via Socket.io if connected
      if (isConnected) {
        emit('ride:sos', {
          driverId: user.id,
          driverName: user.name,
          rideId: rideId || null,
          location: location || null,
          batteryLevel,
          timestamp: new Date().toISOString(),
          offline: true // Indicate this was sent while offline
        });
        
        toast.warning('SOS sent via real-time connection (offline mode)');
      }
    }
  };

  // Cancel SOS (false alarm)
  const cancelSOS = async () => {
    try {
      const response = await fetch('/api/driver/sos/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          driverId: user.id,
          timestamp: new Date().toISOString(),
          reason: 'False alarm - cancelled by driver'
        })
      });

      if (response.ok) {
        setIsSOSActive(false);
        setShowSOSModal(false);
        
        // Emit cancellation via Socket.io
        if (isConnected) {
          emit('ride:sos:cancel', {
            driverId: user.id,
            timestamp: new Date().toISOString()
          });
        }
        
        toast.success('✅ SOS alert cancelled');
      } else {
        toast.error('Failed to cancel SOS alert');
      }
    } catch (error) {
      console.error('SOS cancel error:', error);
      toast.error('Failed to cancel SOS alert');
    }
  };

  // Render SOS active modal
  const renderSOSModal = () => (
    <div className="sos-modal-overlay">
      <div className="sos-modal">
        <div className="sos-header">
          <div className="sos-icon flashing">🚨</div>
          <h2>SOS ALERT ACTIVE</h2>
          <p>Help has been dispatched</p>
        </div>
        
        <div className="sos-content">
          <div className="sos-status">
            <div className="status-item">
              <span className="status-label">Alert Sent:</span>
              <span className="status-value">✅ Confirmed</span>
            </div>
            <div className="status-item">
              <span className="status-label">Dispatcher:</span>
              <span className="status-value">📞 Notified</span>
            </div>
            <div className="status-item">
              <span className="status-label">Location:</span>
              <span className="status-value">
                {location ? '📍 Shared' : '❌ Unavailable'}
              </span>
            </div>
            {batteryLevel && (
              <div className="status-item">
                <span className="status-label">Battery:</span>
                <span className="status-value">🔋 {batteryLevel}%</span>
              </div>
            )}
          </div>
          
          <div className="sos-instructions">
            <h4>📋 What happens next:</h4>
            <ul>
              <li>✅ Dispatcher has been alerted</li>
              <li>📞 You will receive a call shortly</li>
              <li>🚗 Help is being sent to your location</li>
              <li>📍 Your location is being tracked</li>
            </ul>
          </div>
          
          <div className="sos-actions">
            <button 
              onClick={() => {
                const dispatcherNumber = '+675712345';
                window.location.href = `tel:${dispatcherNumber}`;
              }}
              className="sos-action-btn call"
            >
              📞 Call Dispatcher Now
            </button>
            
            <button 
              onClick={cancelSOS}
              className="sos-action-btn cancel"
            >
              ❌ Cancel SOS (False Alarm)
            </button>
          </div>
        </div>
        
        <div className="sos-footer">
          <p><strong>Stay calm. Help is on the way.</strong></p>
          <p>This alert cannot be dismissed until resolved.</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* SOS Button */}
      <div className="sos-button-container">
        <button
          className={`sos-button ${isSOSActive ? 'active' : ''} ${isLongPressing ? 'pressing' : ''}`}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          disabled={isSOSActive}
        >
          <div className="sos-icon">
            {isSOSActive ? '🚨' : '🆘'}
          </div>
          <div className="sos-text">
            {isSOSActive ? 'SOS ACTIVE' : 'SOS'}
          </div>
          
          {isLongPressing && (
            <div className="sos-progress">
              <div className="sos-progress-fill" />
            </div>
          )}
        </button>
        
        {!isSOSActive && (
          <div className="sos-instruction">
            Hold for 2 seconds
          </div>
        )}
      </div>

      {/* SOS Active Modal */}
      {showSOSModal && renderSOSModal()}
    </>
  );
};

export default SOSButton;
