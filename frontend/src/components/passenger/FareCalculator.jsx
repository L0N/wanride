import React, { useState, useEffect } from 'react';
import { formatKina } from '../../utils/k5Rounding';

const FareCalculator = ({ pickup, destination, onFareCalculated }) => {
  const [fareEstimate, setFareEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (pickup && destination && pickup.lat && pickup.lng && destination.lat && destination.lng) {
      calculateFare();
    } else {
      setFareEstimate(null);
      setError(null);
    }
  }, [pickup, destination]);

  const calculateFare = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get estimated duration (placeholder - would integrate with Google Maps API)
      const estimatedDuration = await getEstimatedDuration(pickup, destination);

      const response = await fetch('/api/fare/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pickup: {
            lat: pickup.lat,
            lng: pickup.lng,
            address: pickup.address
          },
          destination: {
            lat: destination.lat,
            lng: destination.lng,
            address: destination.address
          },
          estimatedDuration: estimatedDuration
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fare calculation failed');
      }

      const data = await response.json();
      setFareEstimate(data.data);
      
      // Notify parent component
      if (onFareCalculated) {
        onFareCalculated(data.data);
      }

    } catch (err) {
      setError(err.message || 'Unable to calculate fare. Please try again.');
      console.error('Fare calculation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Placeholder function - would integrate with Google Maps Distance Matrix API
  const getEstimatedDuration = async (pickup, destination) => {
    // Simple distance-based estimation as fallback
    const distance = calculateSimpleDistance(pickup, destination);
    const estimatedSpeed = 30; // km/h average in Port Moresby
    const durationHours = distance / estimatedSpeed;
    const durationMinutes = Math.max(15, Math.round(durationHours * 60)); // Minimum 15 minutes
    
    return durationMinutes;
  };

  // Simple distance calculation (Haversine formula)
  const calculateSimpleDistance = (point1, point2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  if (loading) {
    return (
      <div className="fare-calculator loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Calculating fare...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fare-calculator error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <p className="error-message">{error}</p>
          <button onClick={calculateFare} className="retry-btn">
            🔄 Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!fareEstimate) {
    return (
      <div className="fare-calculator empty">
        <div className="empty-content">
          <div className="empty-icon">📍</div>
          <p>Select pickup and destination to see fare estimate</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fare-calculator">
      <div className="fare-main">
        <div className="fare-amount">
          <span className="fare-label">Estimated Fare</span>
          <span className="fare-value">{formatKina(fareEstimate.finalFare)}</span>
        </div>

        {/* Method-specific display */}
        {fareEstimate.method === 'FLAT_NCD' && (
          <div className="fare-info flat-rate">
            <p className="fare-description">
              Flat rate for all trips within Port Moresby
            </p>
          </div>
        )}

        {fareEstimate.method === 'FLAT_NCD_AIRPORT' && (
          <div className="fare-info airport">
            <div className="airport-badge">
              <span className="airport-icon">✈️</span>
              <span className="airport-text">Airport Trip</span>
            </div>
            <p className="fare-description">
              Includes {formatKina(fareEstimate.airportAddon)} airport access fee
            </p>
            <p className="fare-note">
              (Covers waiting time and airport procedures)
            </p>
          </div>
        )}

        {fareEstimate.method === 'DISTANCE_BASED' && (
          <div className="fare-info distance-based">
            <div className="fare-includes">
              <p className="includes-title">Includes:</p>
              <ul className="includes-list">
                <li>✓ Trip to {destination.address || 'destination'} ({fareEstimate.distanceKm}km)</li>
                <li>✓ Return costs (driver returns to Port Moresby)</li>
              </ul>
            </div>
            <p className="fare-explanation">
              Remote areas have limited passengers, so return costs are included to ensure driver availability.
            </p>
          </div>
        )}

        {/* Toggle details button */}
        <button 
          className="details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '▲ Hide Details' : '▼ View Breakdown'}
        </button>
      </div>

      {/* Detailed breakdown */}
      {showDetails && (
        <div className="fare-details">
          <h4>Fare Breakdown</h4>
          
          {fareEstimate.method === 'FLAT_NCD' && (
            <div className="breakdown-items">
              <div className="breakdown-item">
                <span className="item-label">Flat rate (NCD):</span>
                <span className="item-value">{formatKina(fareEstimate.baseFare)}</span>
              </div>
            </div>
          )}

          {fareEstimate.method === 'FLAT_NCD_AIRPORT' && (
            <div className="breakdown-items">
              <div className="breakdown-item">
                <span className="item-label">Base fare (NCD):</span>
                <span className="item-value">{formatKina(fareEstimate.baseFare)}</span>
              </div>
              <div className="breakdown-item">
                <span className="item-label">Airport fee:</span>
                <span className="item-value">{formatKina(fareEstimate.airportAddon)}</span>
              </div>
              <div className="breakdown-item total">
                <span className="item-label">Total:</span>
                <span className="item-value">{formatKina(fareEstimate.finalFare)}</span>
              </div>
            </div>
          )}

          {fareEstimate.method === 'DISTANCE_BASED' && (
            <div className="breakdown-items">
              <div className="breakdown-item">
                <span className="item-label">Base fare:</span>
                <span className="item-value">{formatKina(fareEstimate.baseFare, false)}</span>
              </div>
              <div className="breakdown-item">
                <span className="item-label">Distance ({fareEstimate.distanceKm}km):</span>
                <span className="item-value">{formatKina(fareEstimate.distanceCharge, false)}</span>
              </div>
              <div className="breakdown-item">
                <span className="item-label">Time ({fareEstimate.timeMinutes}min):</span>
                <span className="item-value">{formatKina(fareEstimate.timeCharge, false)}</span>
              </div>
              <div className="breakdown-item subtotal">
                <span className="item-label">Subtotal:</span>
                <span className="item-value">{formatKina(fareEstimate.baseFareRounded)}</span>
              </div>
              <div className="breakdown-item">
                <span className="item-label">Return costs (25%):</span>
                <span className="item-value">{formatKina(fareEstimate.returnFee)}</span>
              </div>
              <div className="breakdown-item total">
                <span className="item-label">Total:</span>
                <span className="item-value">{formatKina(fareEstimate.finalFare)}</span>
              </div>
            </div>
          )}

          <div className="breakdown-info">
            <div className="info-item">
              <span className="info-label">Distance:</span>
              <span className="info-value">{fareEstimate.distanceKm} km</span>
            </div>
            <div className="info-item">
              <span className="info-label">Estimated time:</span>
              <span className="info-value">{fareEstimate.timeMinutes} minutes</span>
            </div>
            <div className="info-item">
              <span className="info-label">Zone:</span>
              <span className="info-value">
                {fareEstimate.withinNCD ? 'NCD (Port Moresby)' : 'Outside NCD'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="fare-disclaimer">
        <p>
          ⚠️ Final fare may vary based on actual route and traffic conditions
        </p>
      </div>
    </div>
  );
};

export default FareCalculator;
