import React, { useState, useEffect, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useSocket } from '../../contexts/SocketContext';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const DriverStatusPanel = ({ onCallDriver }) => {
  const { driverLocations, isConnected, emit } = useSocket();
  
  // State
  const [drivers, setDrivers] = useState([]);
  const [filteredDrivers, setFilteredDrivers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, available, busy, offline
  const [loading, setLoading] = useState(true);
  const [statusBreakdown, setStatusBreakdown] = useState({
    available: 0,
    onRide: 0,
    enRoute: 0,
    onBreak: 0,
    offline: 0
  });

  // Mock driver data - replace with real API
  useEffect(() => {
    const mockDrivers = [
      {
        id: 'driver-001',
        name: 'James Kila',
        phone: '+675 7111 2222',
        email: 'james.kila@wanride.com',
        photo: '/images/drivers/driver-001.jpg',
        vehicle: {
          make: 'Toyota',
          model: 'Camry',
          plate: 'NAD 123',
          color: 'White'
        },
        status: 'AVAILABLE',
        location: { lat: -9.4400, lng: 147.1750 },
        lastUpdate: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
        shiftStart: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        completedRides: 12,
        dailyEarnings: 340, // PGK
        rating: 4.8,
        address: 'Waigani Drive, Port Moresby'
      },
      {
        id: 'driver-002',
        name: 'Mary Temu',
        phone: '+675 7222 3333',
        email: 'mary.temu@wanride.com',
        photo: '/images/drivers/driver-002.jpg',
        vehicle: {
          make: 'Honda',
          model: 'Civic',
          plate: 'NAD 456',
          color: 'Blue'
        },
        status: 'ON_RIDE',
        location: { lat: -9.4350, lng: 147.1800 },
        lastUpdate: new Date(Date.now() - 1 * 60 * 1000), // 1 min ago
        shiftStart: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        completedRides: 8,
        dailyEarnings: 220,
        rating: 4.6,
        address: 'University Road, Port Moresby'
      },
      {
        id: 'driver-003',
        name: 'Peter Namaliu',
        phone: '+675 7333 4444',
        email: 'peter.namaliu@wanride.com',
        photo: '/images/drivers/driver-003.jpg',
        vehicle: {
          make: 'Nissan',
          model: 'Altima',
          plate: 'NAD 789',
          color: 'Silver'
        },
        status: 'ON_BREAK',
        location: { lat: -9.4500, lng: 147.1650 },
        lastUpdate: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
        shiftStart: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        completedRides: 15,
        dailyEarnings: 425,
        rating: 4.9,
        address: 'Boroko Shopping Centre'
      },
      {
        id: 'driver-004',
        name: 'Sarah Wilson',
        phone: '+675 7444 5555',
        email: 'sarah.wilson@wanride.com',
        photo: '/images/drivers/driver-004.jpg',
        vehicle: {
          make: 'Mazda',
          model: 'CX-5',
          plate: 'NAD 101',
          color: 'Red'
        },
        status: 'EN_ROUTE_TO_PICKUP',
        location: { lat: -9.4200, lng: 147.1900 },
        lastUpdate: new Date(Date.now() - 30 * 1000), // 30 sec ago
        shiftStart: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        completedRides: 6,
        dailyEarnings: 180,
        rating: 4.7,
        address: 'Vision City, Waigani'
      },
      {
        id: 'driver-005',
        name: 'Michael Temu',
        phone: '+675 7555 6666',
        email: 'michael.temu@wanride.com',
        photo: '/images/drivers/driver-005.jpg',
        vehicle: {
          make: 'Ford',
          model: 'Focus',
          plate: 'NAD 202',
          color: 'Black'
        },
        status: 'OFFLINE',
        location: { lat: -9.4600, lng: 147.1400 },
        lastUpdate: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
        shiftStart: null,
        completedRides: 0,
        dailyEarnings: 0,
        rating: 4.5,
        address: 'Last known: Jackson Airport'
      }
    ];

    setDrivers(mockDrivers);
    setLoading(false);

    // Calculate status breakdown
    const breakdown = mockDrivers.reduce((acc, driver) => {
      switch (driver.status) {
        case 'AVAILABLE':
          acc.available++;
          break;
        case 'ON_RIDE':
          acc.onRide++;
          break;
        case 'EN_ROUTE_TO_PICKUP':
          acc.enRoute++;
          break;
        case 'ON_BREAK':
          acc.onBreak++;
          break;
        case 'OFFLINE':
          acc.offline++;
          break;
        default:
          break;
      }
      return acc;
    }, { available: 0, onRide: 0, enRoute: 0, onBreak: 0, offline: 0 });

    setStatusBreakdown(breakdown);
  }, []);

  // Filter and search drivers
  useEffect(() => {
    let filtered = [...drivers];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(driver => 
        driver.name.toLowerCase().includes(term) ||
        driver.vehicle.plate.toLowerCase().includes(term) ||
        driver.phone.includes(term)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      switch (statusFilter) {
        case 'available':
          filtered = filtered.filter(d => d.status === 'AVAILABLE');
          break;
        case 'busy':
          filtered = filtered.filter(d => ['ON_RIDE', 'EN_ROUTE_TO_PICKUP'].includes(d.status));
          break;
        case 'offline':
          filtered = filtered.filter(d => ['OFFLINE', 'ON_BREAK'].includes(d.status));
          break;
        default:
          break;
      }
    }

    setFilteredDrivers(filtered);
  }, [drivers, searchTerm, statusFilter]);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'AVAILABLE': return '#4caf50';
      case 'ON_RIDE': return '#2196f3';
      case 'EN_ROUTE_TO_PICKUP': return '#ff9800';
      case 'ON_BREAK': return '#ff5722';
      case 'OFFLINE': return '#9e9e9e';
      default: return '#9e9e9e';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'AVAILABLE': return '🟢';
      case 'ON_RIDE': return '🔵';
      case 'EN_ROUTE_TO_PICKUP': return '🟡';
      case 'ON_BREAK': return '🟠';
      case 'OFFLINE': return '🔴';
      default: return '⚪';
    }
  };

  // Get status text
  const getStatusText = (status) => {
    switch (status) {
      case 'AVAILABLE': return 'Available';
      case 'ON_RIDE': return 'On Ride';
      case 'EN_ROUTE_TO_PICKUP': return 'En Route';
      case 'ON_BREAK': return 'On Break';
      case 'OFFLINE': return 'Offline';
      default: return 'Unknown';
    }
  };

  // Check if GPS data is stale
  const isGPSStale = (lastUpdate) => {
    return Date.now() - new Date(lastUpdate).getTime() > 60 * 1000; // 1 minute
  };

  // Calculate shift duration
  const getShiftDuration = (shiftStart) => {
    if (!shiftStart) return 'Not on shift';
    const hours = Math.floor((Date.now() - new Date(shiftStart).getTime()) / (1000 * 60 * 60));
    const minutes = Math.floor(((Date.now() - new Date(shiftStart).getTime()) % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Handle driver actions
  const handleCallDriver = (driver) => {
    if (onCallDriver) {
      onCallDriver(driver.id);
    }
    toast.info(`Calling ${driver.name}...`);
  };

  const handleMessageDriver = (driver) => {
    const message = prompt(`Send message to ${driver.name}:`);
    if (message) {
      emit('dispatcher:message', { driverId: driver.id, message });
      toast.success(`Message sent to ${driver.name}`);
    }
  };

  const handleForceLogout = (driver) => {
    const confirmed = window.confirm(
      `Force logout ${driver.name}? This will end their shift immediately.`
    );
    if (confirmed) {
      emit('dispatcher:force_logout', { driverId: driver.id });
      toast.warning(`${driver.name} has been logged out`);
    }
  };

  // Driver card component for virtualized list
  const DriverCard = ({ index, style }) => {
    const driver = filteredDrivers[index];
    const isStale = isGPSStale(driver.lastUpdate);

    return (
      <div style={style} className="driver-card-container">
        <div className={`driver-card ${isStale ? 'stale' : ''}`}>
          {/* Header */}
          <div className="driver-header">
            <div className="driver-photo">
              <img 
                src={driver.photo} 
                alt={driver.name}
                onError={(e) => {
                  e.target.src = '/images/default-driver.png';
                }}
              />
              <div 
                className="status-badge"
                style={{ backgroundColor: getStatusColor(driver.status) }}
              >
                {getStatusIcon(driver.status)}
              </div>
            </div>
            <div className="driver-info">
              <h3 className="driver-name">{driver.name}</h3>
              <div className="driver-contact">
                <span className="phone">{driver.phone}</span>
                <span className="rating">⭐ {driver.rating}</span>
              </div>
            </div>
            <div className="driver-status">
              <span 
                className="status-text"
                style={{ color: getStatusColor(driver.status) }}
              >
                {getStatusText(driver.status)}
              </span>
              {isStale && <span className="stale-indicator">📡 Stale</span>}
            </div>
          </div>

          {/* Vehicle info */}
          <div className="vehicle-section">
            <div className="vehicle-info">
              <span className="vehicle-details">
                🚗 {driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model}
              </span>
              <span className="vehicle-plate">{driver.vehicle.plate}</span>
            </div>
          </div>

          {/* Location and shift info */}
          <div className="driver-details">
            <div className="detail-row">
              <span className="detail-label">📍 Location:</span>
              <span className="detail-value">{driver.address}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">⏰ Shift:</span>
              <span className="detail-value">{getShiftDuration(driver.shiftStart)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">🚕 Rides:</span>
              <span className="detail-value">{driver.completedRides} completed</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">💰 Earnings:</span>
              <span className="detail-value">PGK {driver.dailyEarnings}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">🕐 Last Update:</span>
              <span className="detail-value">
                {format(driver.lastUpdate, 'HH:mm:ss')}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="driver-actions">
            <button 
              className="action-btn call"
              onClick={() => handleCallDriver(driver)}
              title="Call driver"
            >
              📞 Call
            </button>
            <button 
              className="action-btn message"
              onClick={() => handleMessageDriver(driver)}
              title="Send message"
            >
              💬 Message
            </button>
            <button 
              className="action-btn history"
              onClick={() => console.log('View history:', driver.id)}
              title="View ride history"
            >
              📊 History
            </button>
            <button 
              className="action-btn logout danger"
              onClick={() => handleForceLogout(driver)}
              title="Force logout (emergency)"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="driver-status-loading">
        <div className="loading-spinner" />
        <p>Loading driver status...</p>
      </div>
    );
  }

  return (
    <div className="driver-status-panel">
      {/* Header */}
      <div className="panel-header">
        <h2>👥 Driver Status</h2>
        <div className="connection-status">
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span>{isConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* Status breakdown chart */}
      <div className="status-breakdown">
        <div className="breakdown-chart">
          <div className="chart-item available">
            <div className="chart-value">{statusBreakdown.available}</div>
            <div className="chart-label">Available</div>
          </div>
          <div className="chart-item on-ride">
            <div className="chart-value">{statusBreakdown.onRide}</div>
            <div className="chart-label">On Ride</div>
          </div>
          <div className="chart-item en-route">
            <div className="chart-value">{statusBreakdown.enRoute}</div>
            <div className="chart-label">En Route</div>
          </div>
          <div className="chart-item on-break">
            <div className="chart-value">{statusBreakdown.onBreak}</div>
            <div className="chart-label">On Break</div>
          </div>
          <div className="chart-item offline">
            <div className="chart-value">{statusBreakdown.offline}</div>
            <div className="chart-label">Offline</div>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="panel-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search drivers, plates, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        <div className="filter-controls">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="all">All Drivers</option>
            <option value="available">Available Only</option>
            <option value="busy">Busy (On Ride/En Route)</option>
            <option value="offline">Offline/Break</option>
          </select>
        </div>
      </div>

      {/* Driver list */}
      <div className="drivers-list">
        {filteredDrivers.length === 0 ? (
          <div className="empty-drivers">
            <div className="empty-icon">👥</div>
            <h3>No drivers found</h3>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <List
            height={400} // Adjust based on available space
            itemCount={filteredDrivers.length}
            itemSize={280} // Height of each driver card
            className="virtualized-driver-list"
          >
            {DriverCard}
          </List>
        )}
      </div>

      {/* Summary stats */}
      <div className="panel-footer">
        <div className="summary-stats">
          <span className="stat">
            Total: <strong>{drivers.length}</strong>
          </span>
          <span className="stat">
            Showing: <strong>{filteredDrivers.length}</strong>
          </span>
          <span className="stat">
            Active: <strong>{statusBreakdown.available + statusBreakdown.onRide + statusBreakdown.enRoute}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

export default DriverStatusPanel;
