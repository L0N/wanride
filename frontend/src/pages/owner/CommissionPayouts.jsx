import React, { useState, useEffect } from 'react';
import { formatKina } from '../../utils/k5Rounding';
import moment from 'moment-timezone';
import DeductionModal from '../../components/owner/DeductionModal';
import PayoutDetailsModal from '../../components/owner/PayoutDetailsModal';
import './CommissionPayouts.css';

const PNG_TIMEZONE = 'Pacific/Port_Moresby';

export default function CommissionPayouts() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  useEffect(() => {
    fetchPayouts();
  }, [statusFilter]);
  
  const fetchPayouts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/owner/payouts?status=${statusFilter}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch payouts');
      }
      
      const data = await response.json();
      setPayouts(data.payouts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprovePayout = async (payoutId) => {
    if (!confirm('Approve this payout? Driver will receive payment.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/owner/payouts/${payoutId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to approve payout');
      }
      
      alert('Payout approved successfully!');
      fetchPayouts();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };
  
  const handleMarkPaid = async (payoutId, paymentMethod, paymentReference) => {
    try {
      const response = await fetch(`/api/owner/payouts/${payoutId}/mark-paid`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentMethod,
          paymentReference,
          paidAt: new Date()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark payout as paid');
      }
      
      alert('Payout marked as paid!');
      fetchPayouts();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };
  
  const handleBulkApprove = async () => {
    const pendingPayouts = payouts.filter(p => p.status === 'PENDING');
    
    if (!confirm(`Approve ${pendingPayouts.length} pending payouts?`)) {
      return;
    }
    
    try {
      const response = await fetch('/api/owner/payouts/bulk-approve', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payoutIds: pendingPayouts.map(p => p._id)
        })
      });
      
      if (!response.ok) {
        throw new Error('Bulk approval failed');
      }
      
      const data = await response.json();
      alert(`${data.approved} payouts approved!`);
      fetchPayouts();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };
  
  const totalPendingAmount = payouts
    .filter(p => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.netPayout, 0);
  
  return (
    <div className="commission-payouts">
      <div className="page-header">
        <h1>Commission Payouts</h1>
        <div className="header-actions">
          {statusFilter === 'PENDING' && payouts.length > 0 && (
            <button className="btn-primary" onClick={handleBulkApprove}>
              Approve All ({payouts.length})
            </button>
          )}
        </div>
      </div>
      
      <div className="status-tabs">
        <button
          className={statusFilter === 'PENDING' ? 'active' : ''}
          onClick={() => setStatusFilter('PENDING')}
        >
          Pending ({payouts.filter(p => p.status === 'PENDING').length})
        </button>
        <button
          className={statusFilter === 'APPROVED' ? 'active' : ''}
          onClick={() => setStatusFilter('APPROVED')}
        >
          Approved
        </button>
        <button
          className={statusFilter === 'PAID' ? 'active' : ''}
          onClick={() => setStatusFilter('PAID')}
        >
          Paid
        </button>
        <button
          className={statusFilter === 'ALL' ? 'active' : ''}
          onClick={() => setStatusFilter('ALL')}
        >
          All
        </button>
      </div>
      
      {statusFilter === 'PENDING' && payouts.length > 0 && (
        <div className="pending-summary">
          <div className="summary-card">
            <span className="label">Total Pending Payouts:</span>
            <span className="amount">{formatKina(totalPendingAmount)}</span>
          </div>
          <div className="summary-card">
            <span className="label">Drivers Awaiting Payment:</span>
            <span className="count">{payouts.length}</span>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading payouts...</p>
        </div>
      ) : error ? (
        <div className="error">
          <p>Error: {error}</p>
          <button onClick={fetchPayouts}>Retry</button>
        </div>
      ) : payouts.length === 0 ? (
        <div className="no-payouts">
          <p>No {statusFilter.toLowerCase()} payouts found</p>
        </div>
      ) : (
        <div className="payouts-table">
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Period</th>
                <th>Rides</th>
                <th>Total Fares</th>
                <th>Commission (20%)</th>
                <th>Deductions</th>
                <th>Net Payout</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(payout => (
                <tr key={payout._id} className={`status-${payout.status.toLowerCase()}`}>
                  <td>
                    <div className="driver-cell">
                      <strong>{payout.driver.name}</strong>
                      <span className="driver-id">ID: {payout.driver.employeeId || payout.driver._id.slice(-6)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="period-cell">
                      {moment(payout.period.from).tz(PNG_TIMEZONE).format('MMM DD')} - 
                      {moment(payout.period.to).tz(PNG_TIMEZONE).format('MMM DD, YYYY')}
                      <span className="week-label">Week {payout.period.weekNumber}</span>
                    </div>
                  </td>
                  <td className="text-center">{payout.ridesCount}</td>
                  <td className="amount">{formatKina(payout.totalFares)}</td>
                  <td className="amount commission">{formatKina(payout.totalCommissions)}</td>
                  <td className="amount">
                    {payout.totalDeductions > 0 ? (
                      <span className="deduction">-{formatKina(payout.totalDeductions)}</span>
                    ) : (
                      <span className="no-deduction">None</span>
                    )}
                  </td>
                  <td className="amount net-payout">
                    <strong>{formatKina(payout.netPayout)}</strong>
                  </td>
                  <td>
                    <span className={`status-badge status-${payout.status.toLowerCase()}`}>
                      {payout.status}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <div className="action-buttons">
                      <button
                        className="btn-small btn-secondary"
                        onClick={() => {
                          setSelectedPayout(payout);
                          setShowDetailsModal(true);
                        }}
                      >
                        View
                      </button>
                      
                      {payout.status === 'PENDING' && (
                        <>
                          <button
                            className="btn-small btn-tertiary"
                            onClick={() => {
                              setSelectedPayout(payout);
                              setShowDeductionModal(true);
                            }}
                          >
                            Deductions
                          </button>
                          <button
                            className="btn-small btn-success"
                            onClick={() => handleApprovePayout(payout._id)}
                          >
                            Approve
                          </button>
                        </>
                      )}
                      
                      {payout.status === 'APPROVED' && (
                        <button
                          className="btn-small btn-primary"
                          onClick={() => {
                            const method = prompt('Payment method (CASH/BANK_TRANSFER):');
                            const ref = prompt('Payment reference (optional):');
                            if (method) {
                              handleMarkPaid(payout._id, method.toUpperCase(), ref);
                            }
                          }}
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="totals-row">
                <td colSpan="3"><strong>Total ({payouts.length} payouts)</strong></td>
                <td className="amount">
                  <strong>{formatKina(payouts.reduce((sum, p) => sum + p.totalFares, 0))}</strong>
                </td>
                <td className="amount">
                  <strong>{formatKina(payouts.reduce((sum, p) => sum + p.totalCommissions, 0))}</strong>
                </td>
                <td className="amount">
                  <strong>-{formatKina(payouts.reduce((sum, p) => sum + p.totalDeductions, 0))}</strong>
                </td>
                <td className="amount">
                  <strong>{formatKina(payouts.reduce((sum, p) => sum + p.netPayout, 0))}</strong>
                </td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      
      {showDeductionModal && selectedPayout && (
        <DeductionModal
          payout={selectedPayout}
          onClose={() => {
            setShowDeductionModal(false);
            setSelectedPayout(null);
            fetchPayouts();
          }}
        />
      )}
      
      {showDetailsModal && selectedPayout && (
        <PayoutDetailsModal
          payout={selectedPayout}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedPayout(null);
          }}
        />
      )}
    </div>
  );
}
