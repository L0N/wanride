import React, { useState, useEffect } from 'react';
import { formatKina, parseKina, roundToK5 } from '../../utils/k5Rounding';
import './PaymentDisputeForm.css';

/**
 * PaymentDisputeForm Component - Week 2: Cash Payment Collection
 * 
 * Driver interface to report payment discrepancies
 * Features:
 * - Display expected vs actual amount
 * - K5-rounded amount input validation
 * - Real-time difference calculation
 * - Detailed reason input
 * - Clear error handling
 * - Dispatcher notification
 */

export default function PaymentDisputeForm({ ride, onCancel, onSubmit }) {
  const [reportedAmount, setReportedAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const expectedAmount = ride.fareCalculation?.finalFare || ride.fare;
  
  // Calculate difference in real-time
  const parsedAmount = parseKina(reportedAmount);
  const roundedAmount = roundToK5(parsedAmount);
  const difference = expectedAmount - roundedAmount;
  
  // Validate K5 rounding
  const isValidAmount = reportedAmount === '' || (parsedAmount >= 0 && parsedAmount % 5 === 0);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (roundedAmount < 0) {
      setError('Please enter the amount passenger paid');
      return;
    }
    
    if (!reason.trim()) {
      setError('Please explain what happened');
      return;
    }
    
    if (reason.trim().length < 10) {
      setError('Please provide more details (at least 10 characters)');
      return;
    }
    
    if (!isValidAmount) {
      setError('Amount must be in K5 increments (0, 5, 10, 15, etc.)');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/driver/rides/${ride._id}/dispute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reportedAmount: roundedAmount,
          reason: reason.trim()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to report dispute');
      }
      
      onSubmit(data.data);
      
    } catch (err) {
      console.error('Payment dispute error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Auto-format amount input to K5 increments
  const handleAmountChange = (e) => {
    const value = e.target.value;
    
    // Allow empty input
    if (value === '') {
      setReportedAmount('');
      return;
    }
    
    // Parse and validate numeric input
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      return; // Don't update if invalid
    }
    
    setReportedAmount(value);
  };
  
  // Suggest common dispute reasons
  const commonReasons = [
    "Passenger didn't have exact change",
    "Passenger only had large bills",
    "Passenger disputed the fare amount",
    "Passenger paid less than expected",
    "Passenger gave wrong amount",
    "Payment method issue"
  ];
  
  const handleReasonSuggestion = (suggestion) => {
    setReason(suggestion);
  };
  
  return (
    <div className="payment-dispute-form">
      <div className="dispute-header">
        <h2>🚨 Report Payment Issue</h2>
        <p className="subtitle">
          Help us resolve payment discrepancies quickly and fairly
        </p>
      </div>
      
      <div className="expected-amount-display">
        <div className="amount-card">
          <label>Expected Amount:</label>
          <span className="amount expected">{formatKina(expectedAmount)}</span>
        </div>
        
        <div className="ride-details">
          <div className="route">
            📍 {ride.pickup?.address || 'Pickup'} → {ride.destination?.address || 'Destination'}
          </div>
          {ride.passenger?.name && (
            <div className="passenger">
              👤 {ride.passenger.name}
            </div>
          )}
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="dispute-form">
        <div className="form-group">
          <label htmlFor="reported-amount">
            Amount Passenger Actually Paid <span className="required">*</span>
          </label>
          <div className="amount-input-wrapper">
            <span className="currency-prefix">K</span>
            <input
              id="reported-amount"
              type="number"
              step="5"
              min="0"
              value={reportedAmount}
              onChange={handleAmountChange}
              placeholder="0"
              className={!isValidAmount ? 'invalid' : ''}
              disabled={loading}
              required
            />
          </div>
          
          {!isValidAmount && reportedAmount !== '' && (
            <div className="input-error">
              Amount must be in K5 increments (0, 5, 10, 15, 20, etc.)
            </div>
          )}
          
          {difference !== 0 && isValidAmount && reportedAmount !== '' && (
            <div className={`difference-display ${difference > 0 ? 'short-paid' : 'overpaid'}`}>
              <div className="difference-amount">
                Difference: {difference > 0 ? '-' : '+'}{formatKina(Math.abs(difference))}
              </div>
              <div className="difference-explanation">
                {difference > 0 ? (
                  <span className="short-paid">
                    ⚠️ Passenger short-paid by {formatKina(difference)}
                  </span>
                ) : (
                  <span className="overpaid">
                    ✅ Passenger overpaid by {formatKina(Math.abs(difference))}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="dispute-reason">
            Explain What Happened <span className="required">*</span>
          </label>
          
          <div className="reason-suggestions">
            <div className="suggestions-label">Common reasons:</div>
            <div className="suggestion-buttons">
              {commonReasons.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  className="suggestion-btn"
                  onClick={() => handleReasonSuggestion(suggestion)}
                  disabled={loading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          
          <textarea
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe what happened with the payment. Be as specific as possible to help the dispatcher resolve this quickly."
            rows={4}
            maxLength={1000}
            className={reason.trim().length > 0 && reason.trim().length < 10 ? 'invalid' : ''}
            disabled={loading}
            required
          />
          
          <div className="char-count">
            {reason.length}/1000 characters
            {reason.trim().length > 0 && reason.trim().length < 10 && (
              <span className="min-length"> (minimum 10 characters)</span>
            )}
          </div>
        </div>
        
        {error && (
          <div className="error-message">
            <span className="icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}
        
        <div className="dispute-info">
          <div className="info-box">
            <h4>📋 What happens next?</h4>
            <ul>
              <li>Dispatcher will be notified immediately</li>
              <li>Ride will be marked as completed</li>
              <li>Dispatcher will review and resolve the issue</li>
              <li>You may be contacted for additional details</li>
            </ul>
          </div>
        </div>
        
        <div className="action-buttons">
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !isValidAmount || reason.trim().length < 10}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Submitting...
              </>
            ) : (
              <>
                📤 Report to Dispatcher
              </>
            )}
          </button>
          
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
