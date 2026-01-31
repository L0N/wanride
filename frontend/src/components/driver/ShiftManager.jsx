import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { toast } from 'react-toastify';
import { format, differenceInMinutes, differenceInHours } from 'date-fns';

const ShiftManager = ({ onShiftChange }) => {
  const { user } = useAuth();
  const { emit, isConnected } = useSocket();
  
  // State
  const [shiftStatus, setShiftStatus] = useState('OFFLINE'); // OFFLINE, CLOCKED_IN, ON_BREAK
  const [shiftStartTime, setShiftStartTime] = useState(null);
  const [breakStartTime, setBreakStartTime] = useState(null);
  const [breakReason, setBreakReason] = useState('');
  const [breakDuration, setBreakDuration] = useState(30); // minutes
  const [vehicleInfo, setVehicleInfo] = useState(null);
  const [fuelLevel, setFuelLevel] = useState(75); // percentage
  const [isLoading, setIsLoading] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [todayStats, setTodayStats] = useState({
    ridesCompleted: 0,
    cashCollected: 0,
    hoursWorked: 0
  });

  // Load shift state from localStorage on mount
  useEffect(() => {
    const savedShift = localStorage.getItem('driverShift');
    if (savedShift) {
      const shiftData = JSON.parse(savedShift);
      setShiftStatus(shiftData.status);
      setShiftStartTime(shiftData.startTime ? new Date(shiftData.startTime) : null);
      setBreakStartTime(shiftData.breakStartTime ? new Date(shiftData.breakStartTime) : null);
      setBreakReason(shiftData.breakReason || '');
    }
    
    // Load vehicle info
    loadVehicleInfo();
    loadTodayStats();
  }, []);

  // Save shift state to localStorage
  const saveShiftState = (status, startTime = shiftStartTime, breakStart = breakStartTime, reason = breakReason) => {
    const shiftData = {
      status,
      startTime: startTime?.toISOString(),
      breakStartTime: breakStart?.toISOString(),
      breakReason: reason,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('driverShift', JSON.stringify(shiftData));
  };

  // Load vehicle assignment
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
      }
    } catch (error) {
      console.error('Error loading vehicle info:', error);
    }
  };

  // Load today's statistics
  const loadTodayStats = async () => {
    try {
      const response = await fetch('/api/driver/stats/today', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTodayStats(data);
      }
    } catch (error) {
      console.error('Error loading today stats:', error);
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  };

  // Clock in for shift
  const handleClockIn = async () => {
    if (!vehicleInfo) {
      toast.error('No vehicle assigned. Contact your supervisor.');
      return;
    }

    setIsLoading(true);
    
    try {
      // Get current location
      const location = await getCurrentLocation();
      
      const response = await fetch('/api/driver/shift/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          vehicleId: vehicleInfo.id,
          location,
          fuelLevel,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        const startTime = new Date();
        
        setShiftStatus('CLOCKED_IN');
        setShiftStartTime(startTime);
        saveShiftState('CLOCKED_IN', startTime);
        
        // Emit Socket.io event
        if (isConnected) {
          emit('driver:shift:start', {
            driverId: user.id,
            vehicleId: vehicleInfo.id,
            location,
            timestamp: startTime.toISOString()
          });
        }
        
        toast.success('✅ Shift started! You are now available for rides.');
        
        if (onShiftChange) {
          onShiftChange('CLOCKED_IN');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to start shift');
      }
    } catch (error) {
      console.error('Clock in error:', error);
      if (error.message.includes('location')) {
        toast.error('Location access required to start shift');
      } else {
        toast.error('Failed to start shift. Check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Take a break
  const handleTakeBreak = async () => {
    if (!breakReason) {
      toast.error('Please select a break reason');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/driver/shift/break', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          reason: breakReason,
          duration: breakDuration,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const breakStart = new Date();
        
        setShiftStatus('ON_BREAK');
        setBreakStartTime(breakStart);
        saveShiftState('ON_BREAK', shiftStartTime, breakStart, breakReason);
        
        // Emit Socket.io event
        if (isConnected) {
          emit('driver:break:start', {
            driverId: user.id,
            reason: breakReason,
            duration: breakDuration,
            timestamp: breakStart.toISOString()
          });
        }
        
        toast.success(`🛑 Break started (${breakReason})`);
        setShowBreakModal(false);
        
        // Set timer to remind about break end
        setTimeout(() => {
          if (shiftStatus === 'ON_BREAK') {
            toast.info('⏰ Break time ending soon!');
          }
        }, (breakDuration - 5) * 60 * 1000); // 5 minutes before end
        
        if (onShiftChange) {
          onShiftChange('ON_BREAK');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to start break');
      }
    } catch (error) {
      console.error('Take break error:', error);
      toast.error('Failed to start break. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // End break
  const handleEndBreak = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/driver/shift/break', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        setShiftStatus('CLOCKED_IN');
        setBreakStartTime(null);
        setBreakReason('');
        saveShiftState('CLOCKED_IN', shiftStartTime);
        
        // Emit Socket.io event
        if (isConnected) {
          emit('driver:break:end', {
            driverId: user.id,
            timestamp: new Date().toISOString()
          });
        }
        
        toast.success('✅ Break ended. You are now available for rides.');
        
        if (onShiftChange) {
          onShiftChange('CLOCKED_IN');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to end break');
      }
    } catch (error) {
      console.error('End break error:', error);
      toast.error('Failed to end break. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Clock out
  const handleClockOut = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/driver/shift/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          stats: todayStats
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        setShiftStatus('OFFLINE');
        setShiftStartTime(null);
        setBreakStartTime(null);
        setBreakReason('');
        localStorage.removeItem('driverShift');
        
        // Emit Socket.io event
        if (isConnected) {
          emit('driver:shift:end', {
            driverId: user.id,
            stats: data.shiftSummary,
            timestamp: new Date().toISOString()
          });
        }
        
        toast.success('✅ Shift ended. Have a great day!');
        setShowClockOutModal(false);
        
        if (onShiftChange) {
          onShiftChange('OFFLINE');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to end shift');
      }
    } catch (error) {
      console.error('Clock out error:', error);
      toast.error('Failed to end shift. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update fuel level
  const handleFuelUpdate = async (newLevel) => {
    try {
      await fetch('/api/driver/vehicle/fuel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ fuelLevel: newLevel })
      });
      
      setFuelLevel(newLevel);
      toast.success('⛽ Fuel level updated');
    } catch (error) {
      console.error('Fuel update error:', error);
    }
  };

  // Calculate shift duration
  const getShiftDuration = () => {
    if (!shiftStartTime) return '0h 0m';
    
    const now = new Date();
    const hours = differenceInHours(now, shiftStartTime);
    const minutes = differenceInMinutes(now, shiftStartTime) % 60;
    
    return `${hours}h ${minutes}m`;
  };

  // Calculate break duration
  const getBreakDuration = () => {
    if (!breakStartTime) return '0m';
    
    const now = new Date();
    const minutes = differenceInMinutes(now, breakStartTime);
    
    return `${minutes}m`;
  };

  // Render break modal
  const renderBreakModal = () => (
    <div className="modal-overlay">
      <div className="break-modal">
        <div className="modal-header">
          <h3>🛑 Take a Break</h3>
          <button 
            className="close-btn"
            onClick={() => setShowBreakModal(false)}
          >
            ✕
          </button>
        </div>
        
        <div className="modal-content">
          <div className="form-group">
            <label>Break Reason:</label>
            <select 
              value={breakReason}
              onChange={(e) => setBreakReason(e.target.value)}
              className="break-reason-select"
            >
              <option value="">Select reason...</option>
              <option value="lunch">🍽️ Lunch Break</option>
              <option value="fuel">⛽ Fuel Stop</option>
              <option value="maintenance">🔧 Vehicle Maintenance</option>
              <option value="personal">👤 Personal Break</option>
              <option value="rest">😴 Rest Break</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Duration:</label>
            <select 
              value={breakDuration}
              onChange={(e) => setBreakDuration(parseInt(e.target.value))}
              className="break-duration-select"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </div>
        </div>
        
        <div className="modal-actions">
          <button 
            onClick={() => setShowBreakModal(false)}
            className="btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            onClick={handleTakeBreak}
            className="btn-primary"
            disabled={isLoading || !breakReason}
          >
            {isLoading ? '⏳ Starting...' : '🛑 Start Break'}
          </button>
        </div>
      </div>
    </div>
  );

  // Render clock out modal
  const renderClockOutModal = () => (
    <div className="modal-overlay">
      <div className="clockout-modal">
        <div className="modal-header">
          <h3>🏁 End Shift</h3>
          <button 
            className="close-btn"
            onClick={() => setShowClockOutModal(false)}
          >
            ✕
          </button>
        </div>
        
        <div className="modal-content">
          <div className="shift-summary">
            <h4>Today's Summary</h4>
            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-label">Hours Worked:</span>
                <span className="stat-value">{getShiftDuration()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Rides Completed:</span>
                <span className="stat-value">{todayStats.ridesCompleted}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Cash Collected:</span>
                <span className="stat-value">PGK {todayStats.cashCollected}</span>
              </div>
            </div>
          </div>
          
          <p className="clockout-warning">
            ⚠️ Make sure you have completed all active rides before ending your shift.
          </p>
        </div>
        
        <div className="modal-actions">
          <button 
            onClick={() => setShowClockOutModal(false)}
            className="btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            onClick={handleClockOut}
            className="btn-danger"
            disabled={isLoading}
          >
            {isLoading ? '⏳ Ending...' : '🏁 End Shift'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="shift-manager">
      {/* Shift Status Header */}
      <div className={`shift-status ${shiftStatus.toLowerCase()}`}>
        <div className="status-info">
          <div className="status-text">
            {shiftStatus === 'OFFLINE' && '⚫ Offline'}
            {shiftStatus === 'CLOCKED_IN' && '🟢 On Duty'}
            {shiftStatus === 'ON_BREAK' && '🟡 On Break'}
          </div>
          {shiftStartTime && (
            <div className="shift-duration">
              {shiftStatus === 'ON_BREAK' 
                ? `Break: ${getBreakDuration()} (${breakReason})`
                : `Shift: ${getShiftDuration()}`
              }
            </div>
          )}
        </div>
        
        <div className="connection-indicator">
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span>{isConnected ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Vehicle Info */}
      {vehicleInfo && (
        <div className="vehicle-info-card">
          <h4>🚗 Your Vehicle</h4>
          <div className="vehicle-details">
            <p><strong>{vehicleInfo.make} {vehicleInfo.model}</strong></p>
            <p>Plate: {vehicleInfo.plate} • Color: {vehicleInfo.color}</p>
          </div>
          
          <div className="fuel-level">
            <label>⛽ Fuel Level: {fuelLevel}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={fuelLevel}
              onChange={(e) => handleFuelUpdate(parseInt(e.target.value))}
              className="fuel-slider"
              disabled={shiftStatus === 'OFFLINE'}
            />
          </div>
        </div>
      )}

      {/* Shift Controls */}
      <div className="shift-controls">
        {shiftStatus === 'OFFLINE' && (
          <button
            onClick={handleClockIn}
            disabled={isLoading || !vehicleInfo}
            className="btn-primary btn-large"
          >
            {isLoading ? '⏳ Starting...' : '🟢 Clock In'}
          </button>
        )}
        
        {shiftStatus === 'CLOCKED_IN' && (
          <>
            <button
              onClick={() => setShowBreakModal(true)}
              disabled={isLoading}
              className="btn-secondary btn-large"
            >
              🛑 Take Break
            </button>
            <button
              onClick={() => setShowClockOutModal(true)}
              disabled={isLoading}
              className="btn-danger btn-large"
            >
              🏁 Clock Out
            </button>
          </>
        )}
        
        {shiftStatus === 'ON_BREAK' && (
          <button
            onClick={handleEndBreak}
            disabled={isLoading}
            className="btn-primary btn-large"
          >
            {isLoading ? '⏳ Ending...' : '✅ End Break'}
          </button>
        )}
      </div>

      {/* Modals */}
      {showBreakModal && renderBreakModal()}
      {showClockOutModal && renderClockOutModal()}
    </div>
  );
};

export default ShiftManager;
