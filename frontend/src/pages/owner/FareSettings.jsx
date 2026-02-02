import React, { useState, useEffect } from 'react';
import { roundToK5 } from '../../utils/k5Rounding';
import './FareSettings.css';

export default function FareSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  useEffect(() => {
    fetchSettings();
  }, []);
  
  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/owner/settings/fare', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      
      const data = await response.json();
      setSettings(data.settings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      const response = await fetch('/api/owner/settings/fare', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  
  const handleReset = () => {
    if (!confirm('Reset all settings to default values?')) {
      return;
    }
    
    fetchSettings();
  };
  
  if (loading) {
    return <div className="loading">Loading fare settings...</div>;
  }
  
  if (!settings) {
    return null;
  }
  
  return (
    <div className="fare-settings">
      <div className="page-header">
        <h1>Fare Configuration</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleReset}>
            Reset to Defaults
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
      
      {success && (
        <div className="success-message">
          ✅ Settings saved successfully! Changes will apply to new rides immediately.
        </div>
      )}
      
      {error && (
        <div className="error-message">
          ⚠️ Error: {error}
        </div>
      )}
      
      <div className="warning-banner">
        ⚠️ <strong>Important:</strong> Changing these settings will affect all future rides. 
        Existing rides are not affected.
      </div>
      
      <div className="settings-sections">
        {/* Inside NCD Settings */}
        <div className="settings-section">
          <h2>Inside NCD (Port Moresby)</h2>
          <div className="form-group">
            <label>
              Flat Rate (K5 increments)
              <span className="help-text">Default: K30</span>
            </label>
            <input
              type="number"
              step="5"
              min="5"
              value={settings.ncdFlatRate}
              onChange={(e) => setSettings({
                ...settings,
                ncdFlatRate: roundToK5(parseFloat(e.target.value))
              })}
            />
          </div>
        </div>
        
        {/* Outside NCD Settings */}
        <div className="settings-section">
          <h2>Outside NCD (Distance-Based)</h2>
          
          <div className="form-grid">
            <div className="form-group">
              <label>
                Base Fare (K5 increments)
                <span className="help-text">Default: K30</span>
              </label>
              <input
                type="number"
                step="5"
                min="5"
                value={settings.baseFare}
                onChange={(e) => setSettings({
                  ...settings,
                  baseFare: roundToK5(parseFloat(e.target.value))
                })}
              />
            </div>
            
            <div className="form-group">
              <label>
                Distance Rate (K per km)
                <span className="help-text">Default: K2.00/km</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={settings.distanceRate}
                onChange={(e) => setSettings({
                  ...settings,
                  distanceRate: parseFloat(e.target.value)
                })}
              />
            </div>
            
            <div className="form-group">
              <label>
                Time Rate (K per minute)
                <span className="help-text">Default: K0.50/min</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={settings.timeRate}
                onChange={(e) => setSettings({
                  ...settings,
                  timeRate: parseFloat(e.target.value)
                })}
              />
            </div>
            
            <div className="form-group">
              <label>
                Free Distance (km)
                <span className="help-text">Included in base fare. Default: 10km</span>
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={settings.freeDistanceKm}
                onChange={(e) => setSettings({
                  ...settings,
                  freeDistanceKm: parseInt(e.target.value)
                })}
              />
            </div>
            
            <div className="form-group">
              <label>
                Return Fee (%)
                <span className="help-text">Default: 25%</span>
              </label>
              <input
                type="number"
                step="5"
                min="0"
                max="100"
                value={settings.returnFeePercentage}
                onChange={(e) => setSettings({
                  ...settings,
                  returnFeePercentage: parseInt(e.target.value)
                })}
              />
            </div>
          </div>
        </div>
        
        {/* Airport Settings */}
        <div className="settings-section">
          <h2>Airport Trips (Jackson's International)</h2>
          
          <div className="form-group">
            <label>
              Airport Addon (K5 increments)
              <span className="help-text">Added to base fare. Default: K10</span>
            </label>
            <input
              type="number"
              step="5"
              min="0"
              value={settings.airportAddon}
              onChange={(e) => setSettings({
                ...settings,
                airportAddon: roundToK5(parseFloat(e.target.value))
              })}
            />
          </div>
        </div>
        
        {/* Commission Settings */}
        <div className="settings-section">
          <h2>Commission Settings</h2>
          
          <div className="form-group">
            <label>
              Driver Commission Rate (%)
              <span className="help-text">Default: 20%</span>
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max="50"
              value={settings.commissionRate * 100}
              onChange={(e) => setSettings({
                ...settings,
                commissionRate: parseFloat(e.target.value) / 100
              })}
            />
            <p className="calculation-preview">
              Example: K100 fare = K{roundToK5(100 * settings.commissionRate)} commission
            </p>
          </div>
        </div>
      </div>
      
      <div className="settings-footer">
        <button
          className="btn-primary btn-large"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving Changes...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
