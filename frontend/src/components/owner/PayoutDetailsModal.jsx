import React from 'react';
import { formatKina } from '../../utils/k5Rounding';
import moment from 'moment-timezone';
import './PayoutDetailsModal.css';

const PNG_TIMEZONE = 'Pacific/Port_Moresby';

export default function PayoutDetailsModal({ payout, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal payout-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Payout Details</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="payout-header">
            <div className="driver-info">
              <h3>{payout.driver.name}</h3>
              <p>Employee ID: {payout.driver.employeeId || payout.driver._id.slice(-6)}</p>
              <p>Email: {payout.driver.email}</p>
            </div>
            <div className="payout-status">
              <span className={`status-badge status-${payout.status.toLowerCase()}`}>
                {payout.status}
              </span>
            </div>
          </div>
          
          <div className="period-info">
            <h4>Payout Period</h4>
            <div className="period-details">
              <p><strong>Week {payout.period.weekNumber}, {payout.period.year}</strong></p>
              <p>
                {moment(payout.period.from).tz(PNG_TIMEZONE).format('dddd, MMMM DD, YYYY')} - 
                {moment(payout.period.to).tz(PNG_TIMEZONE).format('dddd, MMMM DD, YYYY')}
              </p>
            </div>
          </div>
          
          <div className="financial-summary">
            <h4>Financial Summary</h4>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="label">Total Rides:</span>
                <span className="value">{payout.ridesCount}</span>
              </div>
              <div className="summary-item">
                <span className="label">Total Fares Collected:</span>
                <span className="value">{formatKina(payout.totalFares)}</span>
              </div>
              <div className="summary-item">
                <span className="label">Commission Rate:</span>
                <span className="value">20%</span>
              </div>
              <div className="summary-item">
                <span className="label">Total Commission:</span>
                <span className="value commission">{formatKina(payout.totalCommissions)}</span>
              </div>
              <div className="summary-item">
                <span className="label">Total Deductions:</span>
                <span className="value deduction">-{formatKina(payout.totalDeductions)}</span>
              </div>
              <div className="summary-item total">
                <span className="label">Net Payout:</span>
                <span className="value">{formatKina(payout.netPayout)}</span>
              </div>
            </div>
          </div>
          
          {payout.deductions && payout.deductions.length > 0 && (
            <div className="deductions-section">
              <h4>Deductions ({payout.deductions.length})</h4>
              <table className="deductions-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Amount</th>
                    <th>Receipt #</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payout.deductions.map((deduction, index) => (
                    <tr key={index}>
                      <td>
                        <span className={`deduction-type ${deduction.type.toLowerCase()}`}>
                          {deduction.type}
                        </span>
                      </td>
                      <td>{deduction.reason}</td>
                      <td className="amount">-{formatKina(deduction.amount)}</td>
                      <td>{deduction.receiptNumber || '-'}</td>
                      <td>{moment(deduction.date).tz(PNG_TIMEZONE).format('MMM DD, YYYY')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="status-history">
            <h4>Status History</h4>
            <div className="status-timeline">
              <div className="timeline-item">
                <div className="timeline-dot created"></div>
                <div className="timeline-content">
                  <strong>Payout Created</strong>
                  <p>{moment(payout.createdAt).tz(PNG_TIMEZONE).format('MMM DD, YYYY [at] h:mm A')}</p>
                </div>
              </div>
              
              {payout.approvedAt && (
                <div className="timeline-item">
                  <div className="timeline-dot approved"></div>
                  <div className="timeline-content">
                    <strong>Approved</strong>
                    <p>{moment(payout.approvedAt).tz(PNG_TIMEZONE).format('MMM DD, YYYY [at] h:mm A')}</p>
                    {payout.approvalNotes && <p className="notes">Notes: {payout.approvalNotes}</p>}
                  </div>
                </div>
              )}
              
              {payout.paidAt && (
                <div className="timeline-item">
                  <div className="timeline-dot paid"></div>
                  <div className="timeline-content">
                    <strong>Paid</strong>
                    <p>{moment(payout.paidAt).tz(PNG_TIMEZONE).format('MMM DD, YYYY [at] h:mm A')}</p>
                    {payout.paymentMethod && <p>Method: {payout.paymentMethod}</p>}
                    {payout.paymentReference && <p>Reference: {payout.paymentReference}</p>}
                    {payout.paymentNotes && <p className="notes">Notes: {payout.paymentNotes}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {payout.rides && payout.rides.length > 0 && (
            <div className="rides-section">
              <h4>Included Rides ({payout.rides.length})</h4>
              <div className="rides-list">
                {payout.rides.slice(0, 10).map((ride, index) => (
                  <div key={ride._id || index} className="ride-item">
                    <div className="ride-info">
                      <span className="ride-id">#{ride._id?.slice(-6) || `Ride ${index + 1}`}</span>
                      <span className="ride-date">
                        {moment(ride.completedAt || ride.createdAt).tz(PNG_TIMEZONE).format('MMM DD')}
                      </span>
                    </div>
                    <div className="ride-fare">
                      {formatKina(ride.fare)}
                    </div>
                  </div>
                ))}
                {payout.rides.length > 10 && (
                  <div className="more-rides">
                    ... and {payout.rides.length - 10} more rides
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-secondary" onClick={() => window.print()}>
            Print Details
          </button>
        </div>
      </div>
    </div>
  );
}
