import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const IncomingRideModal = ({ ride, onAccept, onTimeout }) => {
  const [timeLeft, setTimeLeft] = useState(15); // 15 seconds to respond
  const [isAccepting, setIsAccepting] = useState(false);

  // Countdown timer for auto-accept
  useEffect(() => {
    if (timeLeft <= 0) {
      // Auto-accept after timeout
      toast.warning('⏰ Auto-accepting ride (no response)');
      if (onTimeout) {
        onTimeout();
      }
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, onTimeout]);

  // Play notification sound on mount
  useEffect(() => {
    try {
      const audio = new Audio('/sounds/ride-assigned.mp3');
      audio.volume = 0.9;
      audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
      console.log('Audio not available:', error);
    }

    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 300]);
    }
  }, []);

  // Handle ride acceptance
  const handleAcceptRide = async () => {
    setIsAccepting(true);
    
    try {
      await onAccept(ride);
    } catch (error) {
      console.error('Accept ride error:', error);
      toast.error('Failed to accept ride');
    } finally {
      setIsAccepting(false);
    }
  };

  // Calculate distance (mock - would use real calculation)
  const getDistanceToPickup = () => {
    // Mock distance calculation - in real app would use Haversine formula
    return (Math.random() * 5 + 0.5).toFixed(1); // 0.5-5.5 km
  };

  // Calculate ETA to pickup
  const getETAToPickup = () => {
    const distance = parseFloat(getDistanceToPickup());
    const avgSpeed = 25; // km/h average in Port Moresby traffic
    const minutes = Math.round((distance / avgSpeed) * 60);
    return Math.max(minutes, 2); // Minimum 2 minutes
  };

  // Format fare with K5 rounding
  const formatFare = (amount) => {
    const rounded = Math.round(amount / 5) * 5; // Round to nearest K5
    return `PGK K${rounded}`;
  };

  // Get passenger phone (last 4 digits only)
  const getPartialPhone = (phone) => {
    if (!phone) return 'N/A';
    return `****${phone.slice(-4)}`;
  };

  // Handle call passenger
  const handleCallPassenger = () => {
    if (ride.passengerPhone) {
      window.location.href = `tel:${ride.passengerPhone}`;
    } else {
      toast.error('Passenger phone not available');
    }
  };

  // Handle call dispatcher
  const handleCallDispatcher = () => {
    const dispatcherNumber = '+675712345'; // Replace with actual number
    window.location.href = `tel:${dispatcherNumber}`;
  };

  return (
    <div className="incoming-ride-modal-overlay">
      <div className="incoming-ride-modal">
        {/* Header with countdown */}
        <div className="modal-header">
          <div className="header-left">
            <h2>🚗 New Ride Assignment</h2>
            <p className="assignment-time">
              Assigned: {format(new Date(), 'HH:mm:ss')}
            </p>
          </div>
          <div className="countdown-timer">
            <div className={`countdown-circle ${timeLeft <= 5 ? 'urgent' : ''}`}>
              <span className="countdown-number">{timeLeft}</span>
            </div>
            <p className="countdown-text">
              {timeLeft > 5 ? 'Auto-accept in' : 'ACCEPTING IN'}
            </p>
          </div>
        </div>

        {/* Passenger Information */}
        <div className="passenger-section">
          <h3>👤 Passenger</h3>
          <div className="passenger-info">
            <div className="passenger-details">
              <p className="passenger-name">
                <strong>{ride.passengerName || 'Anonymous'}</strong>
              </p>
              <div className="passenger-meta">
                <span className="passenger-phone">
                  📞 {getPartialPhone(ride.passengerPhone)}
                  <button 
                    onClick={handleCallPassenger}
                    className="reveal-phone-btn"
                    title="Click to call"
                  >
                    📞
                  </button>
                </span>
                {ride.passengerRating && (
                  <span className="passenger-rating">
                    ⭐ {ride.passengerRating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Trip Information */}
        <div className="trip-section">
          <h3>📍 Trip Details</h3>
          
          {/* Pickup Location */}
          <div className="location-item pickup">
            <div className="location-icon">🟠</div>
            <div className="location-details">
              <p className="location-label">Pickup</p>
              <p className="location-address">{ride.pickupAddress}</p>
              <div className="location-meta">
                <span className="distance">
                  📏 {getDistanceToPickup()}km away
                </span>
                <span className="eta">
                  ⏱️ {getETAToPickup()} min ETA
                </span>
              </div>
            </div>
          </div>

          {/* Destination */}
          <div className="location-item destination">
            <div className="location-icon">🟢</div>
            <div className="location-details">
              <p className="location-label">Destination</p>
              <p className="location-address">{ride.destinationAddress}</p>
              <div className="location-meta">
                <span className="fare">
                  💰 {formatFare(ride.estimatedFare)}
                </span>
                <span className="duration">
                  ⏱️ ~{ride.estimatedDuration || 15} min trip
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Map Preview (placeholder) */}
        <div className="map-preview">
          <div className="map-placeholder">
            <div className="map-icon">🗺️</div>
            <p>Route Preview</p>
            <div className="route-summary">
              <span>📍 Pickup → 🏁 Destination</span>
              <span>Distance: {getDistanceToPickup()}km</span>
            </div>
          </div>
        </div>

        {/* Special Instructions */}
        {ride.specialInstructions && (
          <div className="special-instructions">
            <h4>📝 Special Instructions</h4>
            <p>{ride.specialInstructions}</p>
          </div>
        )}

        {/* Priority/VIP Badge */}
        {ride.priority === 'VIP' && (
          <div className="priority-badge vip">
            ⭐ VIP Passenger
          </div>
        )}
        {ride.priority === 'URGENT' && (
          <div className="priority-badge urgent">
            🚨 Urgent Ride
          </div>
        )}

        {/* Action Buttons */}
        <div className="modal-actions">
          {/* Quick Actions */}
          <div className="quick-actions">
            <button 
              onClick={handleCallPassenger}
              className="quick-action-btn call-passenger"
              disabled={!ride.passengerPhone}
            >
              📞 Call Passenger
            </button>
            <button 
              onClick={handleCallDispatcher}
              className="quick-action-btn call-dispatcher"
            >
              📞 Call Dispatch
            </button>
          </div>

          {/* Main Accept Button - NO REJECT OPTION */}
          <button
            onClick={handleAcceptRide}
            disabled={isAccepting}
            className="accept-ride-btn"
          >
            {isAccepting ? (
              <>
                <div className="loading-spinner small" />
                Accepting...
              </>
            ) : (
              <>
                ✅ ACCEPT RIDE
                {timeLeft <= 5 && <span className="auto-accept-warning"> (Auto-accepting)</span>}
              </>
            )}
          </button>
        </div>

        {/* Employment Model Notice */}
        <div className="employment-notice">
          <p>
            <strong>📋 Company Policy:</strong> As a WanRide employee driver, 
            you are required to accept all assigned rides. This ride will be 
            automatically accepted in {timeLeft} seconds.
          </p>
        </div>

        {/* Auto-accept warning */}
        {timeLeft <= 5 && (
          <div className="auto-accept-warning-banner">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <strong>AUTO-ACCEPTING IN {timeLeft} SECONDS</strong>
              <p>Tap "ACCEPT RIDE" to confirm immediately</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncomingRideModal;
