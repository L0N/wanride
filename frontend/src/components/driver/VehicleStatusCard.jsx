import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const VehicleStatusCard = () => {
  const [vehicleInfo, setVehicleInfo] = useState(null);
  const [fuelLevel, setFuelLevel] = useState(75);
  const [odometerReading, setOdometerReading] = useState(null);
  const [isUpdatingFuel, setIsUpdatingFuel] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [tempFuelLevel, setTempFuelLevel] = useState(75);

  // Load vehicle information on mount
  useEffect(() => {
    loadVehicleInfo();
  }, []);

  // Load vehicle assignment and status
  const loadVehicleInfo = async () => {
    try {
      const response = await fetch('/api/driver/vehicle/assigned', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVehicleInfo(data.vehicle);
        setFuelLevel(data.fuelLevel || 75);
        setTempFuelLevel(data.fuelLevel || 75);
        setOdometerReading(data.odometerReading);
      }
    } catch (error) {
      console.error('Error loading vehicle info:', error);
    }
  };

  // Update fuel level
  const handleUpdateFuel = async (newLevel) => {
    setIsUpdatingFuel(true);
    
    try {
      const response = await fetch('/api/driver/vehicle/fuel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          fuelLevel: newLevel,
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        setFuelLevel(newLevel);
        toast.success('⛽ Fuel level updated');
        setShowFuelModal(false);
      } else {
        toast.error('Failed to update fuel level');
      }
    } catch (error) {
      console.error('Fuel update error:', error);
      toast.error('Failed to update fuel level. Check your connection.');
    } finally {
      setIsUpdatingFuel(false);
    }
  };

  // Get fuel level color
  const getFuelColor = (level) => {
    if (level <= 15) return '#f44336'; // Red - Critical
    if (level <= 30) return '#ff9800'; // Orange - Low
    if (level <= 50) return '#ffc107'; // Yellow - Medium
    return '#4caf50'; // Green - Good
  };

  // Get fuel level status
  const getFuelStatus = (level) => {
    if (level <= 15) return { text: 'Critical - Refuel Now', icon: '🚨' };
    if (level <= 30) return { text: 'Low - Refuel Soon', icon: '⚠️' };
    if (level <= 50) return { text: 'Medium', icon: '⛽' };
    return { text: 'Good', icon: '✅' };
  };

  // Format vehicle display name
  const getVehicleDisplayName = () => {
    if (!vehicleInfo) return 'No Vehicle Assigned';
    return `${vehicleInfo.make} ${vehicleInfo.model}`;
  };

  // Get next maintenance info
  const getMaintenanceInfo = () => {
    if (!vehicleInfo || !vehicleInfo.nextMaintenance) return null;
    
    const maintenanceDate = new Date(vehicleInfo.nextMaintenance);
    const today = new Date();
    const daysUntil = Math.ceil((maintenanceDate - today) / (1000 * 60 * 60 * 24));
    
    return {
      date: format(maintenanceDate, 'MMM dd, yyyy'),
      daysUntil,
      isOverdue: daysUntil < 0,
      isDue: daysUntil <= 7
    };
  };

  // Render fuel update modal
  const renderFuelModal = () => (
    <div className="modal-overlay">
      <div className="fuel-modal">
        <div className="modal-header">
          <h3>⛽ Update Fuel Level</h3>
          <button 
            className="close-btn"
            onClick={() => setShowFuelModal(false)}
          >
            ✕
          </button>
        </div>
        
        <div className="modal-content">
          <div className="fuel-display">
            <div className="fuel-gauge">
              <div 
                className="fuel-fill"
                style={{ 
                  width: `${tempFuelLevel}%`,
                  backgroundColor: getFuelColor(tempFuelLevel)
                }}
              />
            </div>
            <div className="fuel-percentage">{tempFuelLevel}%</div>
          </div>
          
          <div className="fuel-slider-container">
            <label>Fuel Level:</label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={tempFuelLevel}
              onChange={(e) => setTempFuelLevel(parseInt(e.target.value))}
              className="fuel-slider"
            />
            <div className="fuel-markers">
              <span>Empty</span>
              <span>Half</span>
              <span>Full</span>
            </div>
          </div>
          
          <div className="fuel-status">
            <span className="fuel-status-icon">
              {getFuelStatus(tempFuelLevel).icon}
            </span>
            <span className="fuel-status-text">
              {getFuelStatus(tempFuelLevel).text}
            </span>
          </div>
        </div>
        
        <div className="modal-actions">
          <button 
            onClick={() => setShowFuelModal(false)}
            className="btn-secondary"
            disabled={isUpdatingFuel}
          >
            Cancel
          </button>
          <button 
            onClick={() => handleUpdateFuel(tempFuelLevel)}
            className="btn-primary"
            disabled={isUpdatingFuel || tempFuelLevel === fuelLevel}
          >
            {isUpdatingFuel ? '⏳ Updating...' : '✅ Update Fuel'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!vehicleInfo) {
    return (
      <div className="vehicle-status-card loading">
        <div className="loading-spinner" />
        <p>Loading vehicle information...</p>
      </div>
    );
  }

  const maintenanceInfo = getMaintenanceInfo();
  const fuelStatus = getFuelStatus(fuelLevel);

  return (
    <div className="vehicle-status-card">
      <div className="card-header">
        <h3>🚗 Your Vehicle</h3>
        <div className="vehicle-status-indicator">
          <div className="status-dot active" />
          <span>Active</span>
        </div>
      </div>

      {/* Vehicle Basic Info */}
      <div className="vehicle-info">
        <div className="vehicle-main">
          <h4 className="vehicle-name">{getVehicleDisplayName()}</h4>
          <div className="vehicle-details">
            <div className="detail-item">
              <span className="detail-label">Plate:</span>
              <span className="detail-value">{vehicleInfo.plate}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Color:</span>
              <span className="detail-value">{vehicleInfo.color}</span>
            </div>
            {vehicleInfo.year && (
              <div className="detail-item">
                <span className="detail-label">Year:</span>
                <span className="detail-value">{vehicleInfo.year}</span>
              </div>
            )}
          </div>
        </div>
        
        {vehicleInfo.image && (
          <div className="vehicle-image">
            <img src={vehicleInfo.image} alt={getVehicleDisplayName()} />
          </div>
        )}
      </div>

      {/* Fuel Level Section */}
      <div className="fuel-section">
        <div className="fuel-header">
          <h4>⛽ Fuel Level</h4>
          <button 
            onClick={() => setShowFuelModal(true)}
            className="update-fuel-btn"
          >
            📝 Update
          </button>
        </div>
        
        <div className="fuel-display">
          <div className="fuel-gauge">
            <div 
              className="fuel-fill"
              style={{ 
                width: `${fuelLevel}%`,
                backgroundColor: getFuelColor(fuelLevel)
              }}
            />
          </div>
          <div className="fuel-info">
            <span className="fuel-percentage">{fuelLevel}%</span>
            <span className="fuel-status">
              {fuelStatus.icon} {fuelStatus.text}
            </span>
          </div>
        </div>

        {/* Fuel Warnings */}
        {fuelLevel <= 15 && (
          <div className="fuel-warning critical">
            <div className="warning-icon">🚨</div>
            <div className="warning-text">
              <strong>Critical Fuel Level!</strong>
              <p>Refuel immediately before continuing rides.</p>
            </div>
          </div>
        )}
        
        {fuelLevel > 15 && fuelLevel <= 30 && (
          <div className="fuel-warning low">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <strong>Low Fuel</strong>
              <p>Plan to refuel during your next break.</p>
            </div>
          </div>
        )}
      </div>

      {/* Odometer Section */}
      {odometerReading && (
        <div className="odometer-section">
          <h4>📊 Odometer</h4>
          <div className="odometer-reading">
            <span className="odometer-value">{odometerReading.toLocaleString()}</span>
            <span className="odometer-unit">km</span>
          </div>
        </div>
      )}

      {/* Maintenance Section */}
      {maintenanceInfo && (
        <div className="maintenance-section">
          <h4>🔧 Maintenance</h4>
          <div className={`maintenance-info ${maintenanceInfo.isOverdue ? 'overdue' : maintenanceInfo.isDue ? 'due' : ''}`}>
            {maintenanceInfo.isOverdue ? (
              <div className="maintenance-overdue">
                <span className="maintenance-icon">🚨</span>
                <div className="maintenance-text">
                  <strong>Maintenance Overdue</strong>
                  <p>Contact fleet manager immediately</p>
                </div>
              </div>
            ) : maintenanceInfo.isDue ? (
              <div className="maintenance-due">
                <span className="maintenance-icon">⚠️</span>
                <div className="maintenance-text">
                  <strong>Maintenance Due Soon</strong>
                  <p>Due: {maintenanceInfo.date} ({maintenanceInfo.daysUntil} days)</p>
                </div>
              </div>
            ) : (
              <div className="maintenance-ok">
                <span className="maintenance-icon">✅</span>
                <div className="maintenance-text">
                  <strong>Next Service</strong>
                  <p>{maintenanceInfo.date} ({maintenanceInfo.daysUntil} days)</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vehicle Actions */}
      <div className="vehicle-actions">
        <button 
          onClick={() => setShowFuelModal(true)}
          className="action-btn fuel"
        >
          ⛽ Update Fuel
        </button>
        
        {maintenanceInfo && maintenanceInfo.isOverdue && (
          <button 
            onClick={() => {
              const fleetManagerNumber = '+675712346'; // Replace with actual number
              window.location.href = `tel:${fleetManagerNumber}`;
            }}
            className="action-btn maintenance urgent"
          >
            📞 Call Fleet Manager
          </button>
        )}
      </div>

      {/* Fuel Update Modal */}
      {showFuelModal && renderFuelModal()}
    </div>
  );
};

export default VehicleStatusCard;
