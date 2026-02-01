import React, { useState } from 'react';
import { formatKina } from '../../utils/k5Rounding';
import PaymentDisputeForm from './PaymentDisputeForm';
import './PaymentCollection.css';

/**
 * PaymentCollection Component - Week 2: Cash Payment Collection
 * 
 * Driver interface to confirm cash collection from passengers
 * Features:
 * - Display expected fare amount (K5-rounded)
 * - Collapsible fare breakdown by pricing method
 * - Cash collection confirmation checkbox
 * - Optional notes field
 * - Payment dispute reporting
 * - Error handling and loading states
 */

export default function PaymentCollection({ ride, onPaymentComplete, onCancel }) {
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDispute, setShowDispute] = useState(false);
  const [notes, setNotes] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);
  
  const fare = ride.fareCalculation?.finalFare || ride.fare;
  const fareMethod = ride.fareCalculation?.method || 'UNKNOWN';
  
  const handleConfirmPayment = async () => {
    if (!cashConfirmed) {
      setError('Please confirm you have collected the cash');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/driver/rides/${ride._id}/payment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amountCollected: fare,
          paymentMethod: 'CASH',
          notes: notes.trim()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Payment confirmation failed');
      }
      
      // Show success and proceed
      onPaymentComplete({
        success: true,
        ride: data.data.ride,
        receiptNumber: data.data.receiptNumber,
        receiptData: data.data.receiptData
      });
      
    } catch (err) {
      console.error('Payment confirmation error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDisputeSubmit = (disputeResult) => {
    // Handle dispute submission result
    onPaymentComplete({
      success: true,
      disputed: true,
      ride: disputeResult.ride
    });
  };
  
  if (showDispute) {
    return (
      <PaymentDisputeForm 
        ride={ride}
        onCancel={() => setShowDispute(false)}
        onSubmit={handleDisputeSubmit}
      />
    );
  }
  
  return (
    <div className="payment-collection">
      <div className="payment-header">
        <h2>💰 Collect Payment</h2>
        <div className="ride-info">
          <div className="route">
            <span className="from">📍 {ride.pickup?.address || 'Pickup location'}</span>
            <span className="arrow">→</span>
            <span className="to">📍 {ride.destination?.address || 'Destination'}</span>
          </div>
          {ride.passenger?.name && (
            <div className="passenger">
              👤 {ride.passenger.name}
            </div>
          )}
        </div>
      </div>
      
      <div className="fare-display">
        <div className="fare-amount">
          <span className="label">Amount to Collect</span>
          <span className="amount">{formatKina(fare)}</span>
        </div>
        
        {ride.fareCalculation && fareMethod !== 'FLAT_NCD' && (
          <div className="fare-breakdown">
            <button 
              className="breakdown-toggle"
              onClick={() => setShowBreakdown(!showBreakdown)}
              type="button"
            >
              {showBreakdown ? '▼' : '▶'} View breakdown
            </button>
            
            {showBreakdown && (
              <div className="breakdown-items">
                {fareMethod === 'FLAT_NCD_AIRPORT' ? (
                  <>
                    <div className="item">
                      <span>Base fare:</span>
                      <span>{formatKina(ride.fareCalculation.baseFare)}</span>
                    </div>
                    <div className="item">
                      <span>✈️ Airport fee:</span>
                      <span>{formatKina(ride.fareCalculation.airportAddon)}</span>
                    </div>
                  </>
                ) : fareMethod === 'DISTANCE_BASED' ? (
                  <>
                    <div className="item">
                      <span>Base fare:</span>
                      <span>{formatKina(ride.fareCalculation.baseFare)}</span>
                    </div>
                    {ride.fareCalculation.distanceKm > 0 && (
                      <div className="item">
                        <span>Distance ({ride.fareCalculation.distanceKm.toFixed(1)}km):</span>
                        <span>{formatKina(ride.fareCalculation.distanceCharge, false)}</span>
                      </div>
                    )}
                    {ride.fareCalculation.timeMinutes > 0 && (
                      <div className="item">
                        <span>Time ({ride.fareCalculation.timeMinutes}min):</span>
                        <span>{formatKina(ride.fareCalculation.timeCharge, false)}</span>
                      </div>
                    )}
                    {ride.fareCalculation.returnFee > 0 && (
                      <div className="item">
                        <span>🔄 Return costs:</span>
                        <span>{formatKina(ride.fareCalculation.returnFee)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="item">
                    <span>Flat rate (Port Moresby):</span>
                    <span>{formatKina(fare)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {fareMethod === 'DISTANCE_BASED' && ride.fareCalculation?.returnFee > 0 && (
          <div className="return-fee-explanation">
            <div className="info-icon">ℹ️</div>
            <div className="explanation">
              <strong>Return costs included:</strong> This trip is outside Port Moresby. 
              The return fee covers your travel back to the city.
            </div>
          </div>
        )}
      </div>
      
      <div className="payment-confirmation">
        <div className="confirmation-checkbox">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={cashConfirmed}
              onChange={(e) => setCashConfirmed(e.target.checked)}
              disabled={loading}
            />
            <span className="checkmark"></span>
            <span className="checkbox-text">
              I have collected <strong>{formatKina(fare)}</strong> in cash from the passenger
            </span>
          </label>
        </div>
        
        <div className="notes-section">
          <label htmlFor="payment-notes">Notes (optional)</label>
          <textarea
            id="payment-notes"
            placeholder="Add any notes about the payment (e.g., passenger gave exact change, paid with large bills, etc.)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
            disabled={loading}
          />
          <div className="char-count">
            {notes.length}/500 characters
          </div>
        </div>
        
        {error && (
          <div className="error-message">
            <span className="icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}
        
        <div className="action-buttons">
          <button
            className="btn-primary"
            onClick={handleConfirmPayment}
            disabled={!cashConfirmed || loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Processing...
              </>
            ) : (
              <>
                ✅ Confirm Payment & Complete Ride
              </>
            )}
          </button>
          
          <button
            className="btn-secondary"
            onClick={() => setShowDispute(true)}
            disabled={loading}
          >
            🚨 Report Payment Issue
          </button>
          
          {onCancel && (
            <button
              className="btn-tertiary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      
      <div className="payment-info">
        <div className="info-box">
          <h4>💡 Payment Collection Tips</h4>
          <ul>
            <li>Always count the cash before confirming</li>
            <li>If passenger doesn't have exact change, report a payment issue</li>
            <li>Receipt will be sent automatically to passenger</li>
            <li>You can view the receipt after confirming payment</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
