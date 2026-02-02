import React, { useState, useEffect } from 'react';
import { formatKina } from '../../utils/k5Rounding';
import moment from 'moment-timezone';
import './CashReconciliation.css';

const PNG_TIMEZONE = 'Pacific/Port_Moresby';

export default function CashReconciliation() {
  const [date, setDate] = useState(moment().tz(PNG_TIMEZONE).format('YYYY-MM-DD'));
  const [reconciliationData, setReconciliationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchReconciliationData();
  }, [date]);
  
  const fetchReconciliationData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/owner/cash-reconciliation?date=${date}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch reconciliation data');
      }
      
      const data = await response.json();
      setReconciliationData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div className="loading">Loading reconciliation data...</div>;
  }
  
  if (error) {
    return (
      <div className="error">
        <p>Error: {error}</p>
        <button onClick={fetchReconciliationData}>Retry</button>
      </div>
    );
  }
  
  if (!reconciliationData) {
    return null;
  }
  
  const {
    summary,
    drivers
  } = reconciliationData;
  
  return (
    <div className="cash-reconciliation">
      <div className="page-header">
        <h1>Daily Cash Reconciliation</h1>
        <div className="date-selector">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={moment().tz(PNG_TIMEZONE).format('YYYY-MM-DD')}
          />
        </div>
      </div>
      
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">💵</div>
          <div className="card-content">
            <div className="card-label">Expected Cash</div>
            <div className="card-value">{formatKina(summary.totalExpected)}</div>
            <div className="card-subtext">From {summary.totalRides} rides</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <div className="card-label">Actual Cash</div>
            <div className="card-value">{formatKina(summary.totalActual)}</div>
            <div className="card-subtext">{summary.driversReconciled} drivers</div>
          </div>
        </div>
        
        <div className={`summary-card ${summary.totalDiscrepancy !== 0 ? 'warning' : 'success'}`}>
          <div className="card-icon">{summary.totalDiscrepancy === 0 ? '✅' : '⚠️'}</div>
          <div className="card-content">
            <div className="card-label">Discrepancy</div>
            <div className="card-value">
              {summary.totalDiscrepancy > 0 ? '+' : ''}{formatKina(summary.totalDiscrepancy)}
            </div>
            <div className="card-subtext">
              {summary.totalDiscrepancy === 0 ? 'All reconciled' : `${summary.driversWithDiscrepancies} drivers`}
            </div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <div className="card-label">Reconciliation Rate</div>
            <div className="card-value">
              {summary.driversActive > 0
                ? Math.round((summary.driversReconciled / summary.driversActive) * 100)
                : 0}%
            </div>
            <div className="card-subtext">
              {summary.driversReconciled} / {summary.driversActive} drivers
            </div>
          </div>
        </div>
      </div>
      
      <div className="reconciliation-table">
        <table>
          <thead>
            <tr>
              <th>Driver</th>
              <th>Rides</th>
              <th>Expected</th>
              <th>Actual</th>
              <th>Difference</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map(driver => (
              <tr
                key={driver._id}
                className={driver.hasDiscrepancy ? 'has-discrepancy' : 'reconciled'}
              >
                <td>
                  <div className="driver-cell">
                    <strong>{driver.name}</strong>
                    <span className="driver-id">ID: {driver.employeeId || driver._id.slice(-6)}</span>
                  </div>
                </td>
                <td className="text-center">{driver.ridesCompleted}</td>
                <td className="amount">{formatKina(driver.expectedCash)}</td>
                <td className="amount">{formatKina(driver.actualCash)}</td>
                <td className={`amount ${driver.discrepancy > 0 ? 'positive' : driver.discrepancy < 0 ? 'negative' : ''}`}>
                  {driver.discrepancy > 0 ? '+' : ''}{formatKina(driver.discrepancy)}
                </td>
                <td>
                  <span className={`status-badge ${driver.reconciliationStatus.toLowerCase()}`}>
                    {driver.reconciliationStatus}
                  </span>
                </td>
                <td className="notes-cell">
                  {driver.notes || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="report-actions">
        <button className="btn-secondary" onClick={() => window.print()}>
          Print Report
        </button>
        <button className="btn-secondary">
          Export to Excel
        </button>
        <button className="btn-primary">
          Email to Accountant
        </button>
      </div>
    </div>
  );
}
