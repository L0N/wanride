import React, { useState, useEffect } from 'react';
import { formatKina } from '../../utils/k5Rounding';
import moment from 'moment-timezone';
import './DriverCommissions.css';

const PNG_TIMEZONE = 'Pacific/Port_Moresby';

/**
 * DriverCommissions Component - Week 3: Commission System
 * 
 * Driver interface to view commission earnings with:
 * - Period selection (today, this week, last week, this month)
 * - Summary cards showing rides, fares, commissions, averages
 * - Ride-by-ride breakdown table
 * - Commission payment information
 * - Transparent K5 rounding display
 */

export default function DriverCommissions() {
  const [period, setPeriod] = useState('THIS_WEEK');
  const [commissionData, setCommissionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchCommissionData();
  }, [period]);
  
  const fetchCommissionData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/driver/commissions?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch commission data');
      }
      
      const data = await response.json();
      setCommissionData(data);
    } catch (err) {
      console.error('Commission data error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const formatPeriod = (from, to) => {
    const fromDate = moment(from).tz(PNG_TIMEZONE).format('MMM DD');
    const toDate = moment(to).tz(PNG_TIMEZONE).format('MMM DD, YYYY');
    return `${fromDate} - ${toDate}`;
  };
  
  const getPeriodLabel = () => {
    switch (period) {
      case 'TODAY': return 'Today';
      case 'THIS_WEEK': return 'This Week';
      case 'LAST_WEEK': return 'Last Week';
      case 'THIS_MONTH': return 'This Month';
      default: return 'Selected Period';
    }
  };
  
  if (loading) {
    return (
      <div className="driver-commissions loading">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading commission data...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="driver-commissions error">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>Unable to Load Commission Data</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={fetchCommissionData}>
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  if (!commissionData) {
    return null;
  }
  
  return (
    <div className="driver-commissions">
      <div className="page-header">
        <h1>💰 My Commissions</h1>
        <p className="subtitle">Track your earnings and commission breakdown</p>
        
        <div className="period-selector">
          <button
            className={period === 'TODAY' ? 'active' : ''}
            onClick={() => setPeriod('TODAY')}
          >
            Today
          </button>
          <button
            className={period === 'THIS_WEEK' ? 'active' : ''}
            onClick={() => setPeriod('THIS_WEEK')}
          >
            This Week
          </button>
          <button
            className={period === 'LAST_WEEK' ? 'active' : ''}
            onClick={() => setPeriod('LAST_WEEK')}
          >
            Last Week
          </button>
          <button
            className={period === 'THIS_MONTH' ? 'active' : ''}
            onClick={() => setPeriod('THIS_MONTH')}
          >
            This Month
          </button>
        </div>
      </div>
      
      <div className="period-info">
        <div className="period-card">
          <span className="period-label">{getPeriodLabel()}:</span>
          <span className="period-dates">
            {formatPeriod(commissionData.period.from, commissionData.period.to)}
          </span>
        </div>
      </div>
      
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">🚗</div>
          <div className="card-content">
            <div className="card-label">Rides Completed</div>
            <div className="card-value">{commissionData.ridesCompleted}</div>
            <div className="card-subtext">
              {commissionData.ridesCompleted === 1 ? 'ride' : 'rides'} with payment collected
            </div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon">💵</div>
          <div className="card-content">
            <div className="card-label">Total Fares Collected</div>
            <div className="card-value">{formatKina(commissionData.totalFares)}</div>
            <div className="card-subtext">
              All fares K5-rounded
            </div>
          </div>
        </div>
        
        <div className="summary-card highlight">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <div className="card-label">Your Commission (20%)</div>
            <div className="card-value commission">{formatKina(commissionData.totalCommissions)}</div>
            <div className="card-subtext">
              Before rounding: {formatKina(commissionData.totalCommissionsBeforeRounding, false)}
            </div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <div className="card-label">Average per Ride</div>
            <div className="card-value">{formatKina(commissionData.averageCommissionPerRide)}</div>
            <div className="card-subtext">
              Commission per completed ride
            </div>
          </div>
        </div>
      </div>
      
      {commissionData.ridesCompleted > 0 ? (
        <div className="commission-details">
          <div className="details-header">
            <h2>📋 Ride-by-Ride Breakdown</h2>
            <p>Detailed commission calculation for each completed ride</p>
          </div>
          
          <div className="rides-table-container">
            <table className="rides-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Passenger</th>
                  <th>Route</th>
                  <th>Method</th>
                  <th>Fare</th>
                  <th>Commission</th>
                </tr>
              </thead>
              <tbody>
                {commissionData.details.map((detail) => (
                  <tr key={detail.rideId}>
                    <td className="date-cell">
                      <div className="date">
                        {moment(detail.date).tz(PNG_TIMEZONE).format('MMM DD')}
                      </div>
                      <div className="time">
                        {moment(detail.date).tz(PNG_TIMEZONE).format('HH:mm')}
                      </div>
                    </td>
                    <td className="passenger-cell">
                      <div className="passenger-name">{detail.passenger.name}</div>
                      <div className="passenger-phone">
                        {detail.passenger.phone ? `***${detail.passenger.phone.slice(-4)}` : ''}
                      </div>
                    </td>
                    <td className="route-cell">
                      <div className="route-from">📍 {detail.pickup}</div>
                      <div className="route-arrow">↓</div>
                      <div className="route-to">📍 {detail.destination}</div>
                    </td>
                    <td className="method-cell">
                      <span className={`method-badge ${detail.fareMethod.toLowerCase()}`}>
                        {detail.fareMethod === 'FLAT_NCD' ? 'Flat Rate' :
                         detail.fareMethod === 'FLAT_NCD_AIRPORT' ? 'Airport' :
                         detail.fareMethod === 'DISTANCE_BASED' ? 'Distance' : detail.fareMethod}
                      </span>
                    </td>
                    <td className="fare-cell">
                      <span className="amount">{formatKina(detail.fare)}</span>
                    </td>
                    <td className="commission-cell">
                      <span className="amount commission">{formatKina(detail.commission)}</span>
                      <div className="commission-rate">20%</div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <td colSpan="4"><strong>Total</strong></td>
                  <td className="fare-cell">
                    <strong>{formatKina(commissionData.totalFares)}</strong>
                  </td>
                  <td className="commission-cell">
                    <strong>{formatKina(commissionData.totalCommissions)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="no-rides">
          <div className="no-rides-icon">🚗</div>
          <h3>No Completed Rides</h3>
          <p>You haven't completed any rides with collected payments in this period.</p>
          <p>Complete rides and collect payments to start earning commissions!</p>
        </div>
      )}
      
      <div className="payout-info">
        <div className="info-section">
          <h3>💡 Commission Payment Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <div className="info-icon">📊</div>
              <div className="info-content">
                <strong>Commission Rate:</strong> 20% of all fares collected
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">🔄</div>
              <div className="info-content">
                <strong>K5 Rounding:</strong> All commission amounts rounded to nearest K5
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">📅</div>
              <div className="info-content">
                <strong>Payout Schedule:</strong> Every Friday at 6pm PNG time
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">📋</div>
              <div className="info-content">
                <strong>Payout Period:</strong> Monday - Sunday each week
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">💳</div>
              <div className="info-content">
                <strong>Payment Method:</strong> Cash, bank transfer, or salary addition
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">📝</div>
              <div className="info-content">
                <strong>Deductions:</strong> May include fuel, damage, or advance deductions
              </div>
            </div>
          </div>
        </div>
        
        <div className="action-buttons">
          <button 
            className="btn-secondary"
            onClick={() => window.location.href = '/driver/payouts'}
          >
            📄 View Payout History
          </button>
          <button 
            className="btn-tertiary"
            onClick={fetchCommissionData}
          >
            🔄 Refresh Data
          </button>
        </div>
      </div>
      
      {commissionData.ridesCompleted > 0 && (
        <div className="commission-summary">
          <div className="summary-box">
            <h4>📈 Commission Summary</h4>
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-label">Total Earned:</span>
                <span className="stat-value">{formatKina(commissionData.totalCommissions)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Company Net:</span>
                <span className="stat-value">{formatKina(commissionData.netToCompany)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Effective Rate:</span>
                <span className="stat-value">
                  {((commissionData.totalCommissions / commissionData.totalFares) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
