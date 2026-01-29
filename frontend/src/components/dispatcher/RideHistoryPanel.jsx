import React, { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import { format, subDays } from 'date-fns';

const RideHistoryPanel = () => {
  // State
  const [rides, setRides] = useState([]);
  const [filteredRides, setFilteredRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [ridesPerPage] = useState(20);
  
  // Filters
  const [filters, setFilters] = useState({
    dateFrom: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    dateTo: format(new Date(), 'yyyy-MM-dd'),
    driverName: '',
    passengerName: '',
    status: 'all',
    vehiclePlate: ''
  });

  // Mock ride history data
  useEffect(() => {
    const mockRides = [];
    
    // Generate mock data for the last 7 days
    for (let i = 0; i < 150; i++) {
      const date = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      mockRides.push({
        id: `ride-${String(i + 1).padStart(6, '0')}`,
        date: date,
        passengerName: ['John Doe', 'Mary Smith', 'Peter Wilson', 'Sarah Johnson', 'Michael Brown'][Math.floor(Math.random() * 5)],
        passengerPhone: '+675 7' + Math.floor(Math.random() * 900 + 100) + ' ' + Math.floor(Math.random() * 9000 + 1000),
        driverName: ['James Kila', 'Mary Temu', 'Peter Namaliu', 'Sarah Wilson', 'Michael Temu'][Math.floor(Math.random() * 5)],
        vehiclePlate: ['NAD 123', 'NAD 456', 'NAD 789', 'NAD 101', 'NAD 202'][Math.floor(Math.random() * 5)],
        pickupAddress: ['Jacksons Airport', 'University of PNG', 'Holiday Inn', 'Vision City', 'Boroko Centre'][Math.floor(Math.random() * 5)],
        dropoffAddress: ['Vision City', 'Boroko Centre', 'General Hospital', 'Waigani', 'Town Centre'][Math.floor(Math.random() * 5)],
        fare: Math.round((Math.random() * 50 + 10) / 5) * 5, // K5 rounded
        status: ['COMPLETED', 'CANCELLED', 'NO_SHOW'][Math.floor(Math.random() * 10) < 8 ? 0 : Math.floor(Math.random() * 2) + 1],
        duration: Math.floor(Math.random() * 45 + 10), // 10-55 minutes
        distance: Math.round((Math.random() * 20 + 2) * 10) / 10, // 2-22 km
        dispatcherNotes: Math.random() > 0.7 ? ['Assigned manually', 'VIP passenger', 'Medical appointment', 'Airport pickup'][Math.floor(Math.random() * 4)] : null
      });
    }

    setRides(mockRides.sort((a, b) => new Date(b.date) - new Date(a.date)));
    setLoading(false);
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...rides];

    // Date range filter
    if (filters.dateFrom) {
      filtered = filtered.filter(ride => 
        new Date(ride.date) >= new Date(filters.dateFrom)
      );
    }
    if (filters.dateTo) {
      filtered = filtered.filter(ride => 
        new Date(ride.date) <= new Date(filters.dateTo + 'T23:59:59')
      );
    }

    // Text filters
    if (filters.driverName) {
      filtered = filtered.filter(ride => 
        ride.driverName.toLowerCase().includes(filters.driverName.toLowerCase())
      );
    }
    if (filters.passengerName) {
      filtered = filtered.filter(ride => 
        ride.passengerName.toLowerCase().includes(filters.passengerName.toLowerCase()) ||
        ride.passengerPhone.includes(filters.passengerName)
      );
    }
    if (filters.vehiclePlate) {
      filtered = filtered.filter(ride => 
        ride.vehiclePlate.toLowerCase().includes(filters.vehiclePlate.toLowerCase())
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(ride => ride.status === filters.status);
    }

    setFilteredRides(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [rides, filters]);

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      dateFrom: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      dateTo: format(new Date(), 'yyyy-MM-dd'),
      driverName: '',
      passengerName: '',
      status: 'all',
      vehiclePlate: ''
    });
  };

  // Export to CSV
  const exportToCSV = () => {
    const csvData = filteredRides.map(ride => ({
      'Ride ID': ride.id,
      'Date': format(ride.date, 'dd/MM/yyyy'),
      'Time': format(ride.date, 'HH:mm'),
      'Passenger': ride.passengerName,
      'Phone': ride.passengerPhone,
      'Driver': ride.driverName,
      'Vehicle': ride.vehiclePlate,
      'Pickup': ride.pickupAddress,
      'Dropoff': ride.dropoffAddress,
      'Fare (PGK)': ride.fare,
      'Distance (km)': ride.distance,
      'Duration (min)': ride.duration,
      'Status': ride.status,
      'Notes': ride.dispatcherNotes || ''
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `wanride-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  // Pagination
  const indexOfLastRide = currentPage * ridesPerPage;
  const indexOfFirstRide = indexOfLastRide - ridesPerPage;
  const currentRides = filteredRides.slice(indexOfFirstRide, indexOfLastRide);
  const totalPages = Math.ceil(filteredRides.length / ridesPerPage);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return '#4caf50';
      case 'CANCELLED': return '#f44336';
      case 'NO_SHOW': return '#ff9800';
      default: return '#9e9e9e';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'COMPLETED': return '✅';
      case 'CANCELLED': return '❌';
      case 'NO_SHOW': return '👻';
      default: return '❓';
    }
  };

  // Calculate stats
  const stats = {
    totalRides: filteredRides.length,
    totalRevenue: filteredRides.reduce((sum, ride) => sum + (ride.status === 'COMPLETED' ? ride.fare : 0), 0),
    averageFare: filteredRides.length > 0 ? Math.round(filteredRides.reduce((sum, ride) => sum + ride.fare, 0) / filteredRides.length) : 0,
    completionRate: filteredRides.length > 0 ? Math.round((filteredRides.filter(r => r.status === 'COMPLETED').length / filteredRides.length) * 100) : 0
  };

  if (loading) {
    return (
      <div className="ride-history-loading">
        <div className="loading-spinner" />
        <p>Loading ride history...</p>
      </div>
    );
  }

  return (
    <div className="ride-history-panel">
      {/* Header */}
      <div className="panel-header">
        <h2>📊 Ride History</h2>
        <button 
          className="export-btn"
          onClick={exportToCSV}
          disabled={filteredRides.length === 0}
        >
          📥 Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="history-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.totalRides}</div>
          <div className="stat-label">Total Rides</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">PGK {stats.totalRevenue}</div>
          <div className="stat-label">Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">PGK {stats.averageFare}</div>
          <div className="stat-label">Avg Fare</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completionRate}%</div>
          <div className="stat-label">Completion</div>
        </div>
      </div>

      {/* Filters */}
      <div className="history-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>From:</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>To:</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Status:</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No Show</option>
            </select>
          </div>
        </div>
        <div className="filter-row">
          <div className="filter-group">
            <label>Driver:</label>
            <input
              type="text"
              placeholder="Driver name..."
              value={filters.driverName}
              onChange={(e) => handleFilterChange('driverName', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Passenger:</label>
            <input
              type="text"
              placeholder="Name or phone..."
              value={filters.passengerName}
              onChange={(e) => handleFilterChange('passengerName', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Vehicle:</label>
            <input
              type="text"
              placeholder="Plate number..."
              value={filters.vehiclePlate}
              onChange={(e) => handleFilterChange('vehiclePlate', e.target.value)}
            />
          </div>
          <button className="clear-filters-btn" onClick={clearFilters}>
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Results table */}
      <div className="history-table-container">
        {currentRides.length === 0 ? (
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <h3>No rides found</h3>
            <p>Try adjusting your search criteria.</p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Passenger</th>
                <th>Driver</th>
                <th>Route</th>
                <th>Fare</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentRides.map(ride => (
                <tr key={ride.id}>
                  <td>
                    <div className="date-time">
                      <div className="date">{format(ride.date, 'dd/MM/yyyy')}</div>
                      <div className="time">{format(ride.date, 'HH:mm')}</div>
                    </div>
                  </td>
                  <td>
                    <div className="passenger-info">
                      <div className="name">{ride.passengerName}</div>
                      <div className="phone">{ride.passengerPhone}</div>
                    </div>
                  </td>
                  <td>
                    <div className="driver-info">
                      <div className="name">{ride.driverName}</div>
                      <div className="vehicle">{ride.vehiclePlate}</div>
                    </div>
                  </td>
                  <td>
                    <div className="route-info">
                      <div className="pickup">📍 {ride.pickupAddress}</div>
                      <div className="dropoff">🏁 {ride.dropoffAddress}</div>
                    </div>
                  </td>
                  <td>
                    <div className="fare-info">
                      <div className="amount">PGK {ride.fare}</div>
                      <div className="distance">{ride.distance} km</div>
                    </div>
                  </td>
                  <td>
                    <div 
                      className="status-badge"
                      style={{ color: getStatusColor(ride.status) }}
                    >
                      {getStatusIcon(ride.status)} {ride.status}
                    </div>
                  </td>
                  <td>
                    <div className="duration">{ride.duration} min</div>
                  </td>
                  <td>
                    <div className="actions">
                      <button 
                        className="action-btn view"
                        onClick={() => console.log('View details:', ride.id)}
                        title="View details"
                      >
                        👁️
                      </button>
                      <button 
                        className="action-btn receipt"
                        onClick={() => console.log('Download receipt:', ride.id)}
                        title="Download receipt"
                      >
                        📄
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            className="page-btn"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            ← Previous
          </button>
          
          <div className="page-info">
            Page {currentPage} of {totalPages} 
            ({filteredRides.length} rides)
          </div>
          
          <button 
            className="page-btn"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default RideHistoryPanel;
