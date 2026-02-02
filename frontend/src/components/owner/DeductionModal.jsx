import React, { useState } from 'react';
import { formatKina, roundToK5, parseKina } from '../../utils/k5Rounding';
import './DeductionModal.css';

const DEDUCTION_TYPES = [
  { value: 'FUEL', label: 'Fuel Costs' },
  { value: 'DAMAGE', label: 'Vehicle Damage' },
  { value: 'VIOLATION', label: 'Traffic Violation' },
  { value: 'ADVANCE', label: 'Salary Advance Repayment' },
  { value: 'OTHER', label: 'Other' }
];

export default function DeductionModal({ payout, onClose }) {
  const [deductions, setDeductions] = useState(payout.deductions || []);
  const [newDeduction, setNewDeduction] = useState({
    type: 'FUEL',
    amount: '',
    reason: '',
    receiptNumber: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const handleAddDeduction = () => {
    const amount = parseKina(newDeduction.amount);
    const roundedAmount = roundToK5(amount);
    
    if (roundedAmount <= 0) {
      setError('Deduction amount must be greater than 0');
      return;
    }
    
    if (!newDeduction.reason.trim()) {
      setError('Please provide a reason for the deduction');
      return;
    }
    
    const deduction = {
      type: newDeduction.type,
      amount: roundedAmount,
      reason: newDeduction.reason.trim(),
      receiptNumber: newDeduction.receiptNumber.trim(),
      notes: newDeduction.notes.trim(),
      date: new Date()
    };
    
    setDeductions([...deductions, deduction]);
    setNewDeduction({
      type: 'FUEL',
      amount: '',
      reason: '',
      receiptNumber: '',
      notes: ''
    });
    setError(null);
  };
  
  const handleRemoveDeduction = (index) => {
    setDeductions(deductions.filter((_, i) => i !== index));
  };
  
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/owner/payouts/${payout._id}/deductions`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deductions })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update deductions');
      }
      
      alert('Deductions updated successfully!');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const netPayout = payout.totalCommissions - totalDeductions;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal deduction-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Deductions</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="payout-summary">
            <div className="summary-row">
              <span>Driver:</span>
              <strong>{payout.driver.name}</strong>
            </div>
            <div className="summary-row">
              <span>Total Commission:</span>
              <strong>{formatKina(payout.totalCommissions)}</strong>
            </div>
            <div className="summary-row">
              <span>Current Deductions:</span>
              <strong className="deduction">-{formatKina(totalDeductions)}</strong>
            </div>
            <div className="summary-row total">
              <span>Net Payout:</span>
              <strong>{formatKina(netPayout)}</strong>
            </div>
          </div>
          
          <div className="add-deduction-section">
            <h3>Add New Deduction</h3>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Type</label>
                <select
                  value={newDeduction.type}
                  onChange={(e) => setNewDeduction({...newDeduction, type: e.target.value})}
                >
                  {DEDUCTION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Amount (K5 increments)</label>
                <input
                  type="number"
                  step="5"
                  min="5"
                  value={newDeduction.amount}
                  onChange={(e) => setNewDeduction({...newDeduction, amount: e.target.value})}
                  placeholder="e.g., 50"
                />
              </div>
              
              <div className="form-group full-width">
                <label>Reason (Required)</label>
                <input
                  type="text"
                  value={newDeduction.reason}
                  onChange={(e) => setNewDeduction({...newDeduction, reason: e.target.value})}
                  placeholder="e.g., Fuel for week, Damaged side mirror"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Receipt Number (Optional)</label>
                <input
                  type="text"
                  value={newDeduction.receiptNumber}
                  onChange={(e) => setNewDeduction({...newDeduction, receiptNumber: e.target.value})}
                  placeholder="e.g., REC-2026-001"
                />
              </div>
              
              <div className="form-group">
                <label>Notes (Optional)</label>
                <input
                  type="text"
                  value={newDeduction.notes}
                  onChange={(e) => setNewDeduction({...newDeduction, notes: e.target.value})}
                  placeholder="Additional notes"
                />
              </div>
            </div>
            
            <button className="btn-secondary" onClick={handleAddDeduction}>
              Add Deduction
            </button>
          </div>
          
          {deductions.length > 0 && (
            <div className="deductions-list">
              <h3>Current Deductions ({deductions.length})</h3>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Amount</th>
                    <th>Receipt #</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deductions.map((deduction, index) => (
                    <tr key={index}>
                      <td>
                        <span className={`deduction-type ${deduction.type.toLowerCase()}`}>
                          {DEDUCTION_TYPES.find(t => t.value === deduction.type)?.label}
                        </span>
                      </td>
                      <td>{deduction.reason}</td>
                      <td className="amount">-{formatKina(deduction.amount)}</td>
                      <td>{deduction.receiptNumber || '-'}</td>
                      <td>
                        <button
                          className="btn-small btn-danger"
                          onClick={() => handleRemoveDeduction(index)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="2"><strong>Total Deductions</strong></td>
                    <td className="amount"><strong>-{formatKina(totalDeductions)}</strong></td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          
          {error && (
            <div className="error-message">
              <span className="icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Deductions'}
          </button>
        </div>
      </div>
    </div>
  );
}
