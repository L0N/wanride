import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

const ActionLogPanel = () => {
  // State
  const [actions, setActions] = useState([]);
  const [filteredActions, setFilteredActions] = useState([]);
  const [filter, setFilter] = useState('all'); // all, assignments, cancellations, sos, system
  const [loading, setLoading] = useState(true);

  // Mock action log data
  useEffect(() => {
    const mockActions = [
      {
        id: 'action-001',
        timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
        type: 'ASSIGNMENT',
        dispatcher: 'Current User',
        action: 'Assigned ride #001234 to James Kila',
        details: 'Manual assignment - nearest driver (2.3km away)',
        rideId: 'ride-001234',
        driverId: 'driver-001',
        severity: 'info'
      },
      {
        id: 'action-002',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
        type: 'SOS_RESOLVED',
        dispatcher: 'Current User',
        action: 'Resolved SOS alert for ride #001233',
        details: 'False alarm - passenger accidentally triggered SOS',
        rideId: 'ride-001233',
        severity: 'warning'
      },
      {
        id: 'action-003',
        timestamp: new Date(Date.now() - 8 * 60 * 1000), // 8 min ago
        type: 'SOS_TRIGGERED',
        dispatcher: 'System',
        action: 'SOS alert triggered on ride #001233',
        details: 'Passenger: Peter Wilson, Driver: Sarah Wilson, Location: General Hospital area',
        rideId: 'ride-001233',
        severity: 'critical'
      },
      {
        id: 'action-004',
        timestamp: new Date(Date.now() - 12 * 60 * 1000), // 12 min ago
        type: 'CANCELLATION',
        dispatcher: 'Current User',
        action: 'Cancelled ride #001232',
        details: 'Reason: Passenger no-show after 10 minutes',
        rideId: 'ride-001232',
        severity: 'warning'
      },
      {
        id: 'action-005',
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
        type: 'FORCE_LOGOUT',
        dispatcher: 'Current User',
        action: 'Force logged out driver Michael Temu',
        details: 'Emergency logout - driver not responding to calls',
        driverId: 'driver-005',
        severity: 'warning'
      },
      {
        id: 'action-006',
        timestamp: new Date(Date.now() - 18 * 60 * 1000), // 18 min ago
        type: 'ASSIGNMENT',
        dispatcher: 'Current User',
        action: 'Force assigned ride #001231 to Peter Namaliu',
        details: 'Driver was on break - emergency assignment for medical ride',
        rideId: 'ride-001231',
        driverId: 'driver-003',
        severity: 'warning'
      },
      {
        id: 'action-007',
        timestamp: new Date(Date.now() - 22 * 60 * 1000), // 22 min ago
        type: 'SYSTEM',
        dispatcher: 'System',
        action: 'Fleet health score dropped to 78%',
        details: 'Low availability: Only 8 vehicles available out of 25',
        severity: 'warning'
      },
      {
        id: 'action-008',
        timestamp: new Date(Date.now() - 25 * 60 * 1000), // 25 min ago
        type: 'MESSAGE',
        dispatcher: 'Current User',
        action: 'Sent message to driver James Kila',
        details: 'Message: "Please confirm your location - GPS shows you stationary"',
        driverId: 'driver-001',
        severity: 'info'
      },
      {
        id: 'action-009',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
        type: 'ASSIGNMENT',
        dispatcher: 'Current User',
        action: 'Assigned ride #001230 to Mary Temu',
        details: 'Auto-assignment - closest available driver (1.8km away)',
        rideId: 'ride-001230',
        driverId: 'driver-002',
        severity: 'info'
      },
      {
        id: 'action-010',
        timestamp: new Date(Date.now() - 35 * 60 * 1000), // 35 min ago
        type: 'SYSTEM',
        dispatcher: 'System',
        action: 'Dispatcher session started',
        details: 'User logged in from IP: 192.168.1.100',
        severity: 'info'
      }
    ];

    setActions(mockActions);
    setLoading(false);
  }, []);

  // Filter actions
  useEffect(() => {
    let filtered = [...actions];

    if (filter !== 'all') {
      switch (filter) {
        case 'assignments':
          filtered = filtered.filter(action => action.type === 'ASSIGNMENT');
          break;
        case 'cancellations':
          filtered = filtered.filter(action => action.type === 'CANCELLATION');
          break;
        case 'sos':
          filtered = filtered.filter(action => 
            action.type === 'SOS_TRIGGERED' || action.type === 'SOS_RESOLVED'
          );
          break;
        case 'system':
          filtered = filtered.filter(action => action.dispatcher === 'System');
          break;
        default:
          break;
      }
    }

    setFilteredActions(filtered);
  }, [actions, filter]);

  // Get action icon
  const getActionIcon = (type) => {
    switch (type) {
      case 'ASSIGNMENT': return '🚗';
      case 'CANCELLATION': return '❌';
      case 'SOS_TRIGGERED': return '🚨';
      case 'SOS_RESOLVED': return '✅';
      case 'FORCE_LOGOUT': return '🚪';
      case 'MESSAGE': return '💬';
      case 'SYSTEM': return '⚙️';
      default: return '📝';
    }
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#f44336';
      case 'warning': return '#ff9800';
      case 'info': return '#2196f3';
      default: return '#9e9e9e';
    }
  };

  // Get action type display name
  const getActionTypeDisplay = (type) => {
    switch (type) {
      case 'ASSIGNMENT': return 'Assignment';
      case 'CANCELLATION': return 'Cancellation';
      case 'SOS_TRIGGERED': return 'SOS Alert';
      case 'SOS_RESOLVED': return 'SOS Resolved';
      case 'FORCE_LOGOUT': return 'Force Logout';
      case 'MESSAGE': return 'Message';
      case 'SYSTEM': return 'System';
      default: return 'Unknown';
    }
  };

  // Clear log (in real app, this would be restricted)
  const clearLog = () => {
    const confirmed = window.confirm(
      'Clear all action logs? This action cannot be undone.'
    );
    if (confirmed) {
      setActions([]);
      setFilteredActions([]);
    }
  };

  if (loading) {
    return (
      <div className="action-log-loading">
        <div className="loading-spinner" />
        <p>Loading action log...</p>
      </div>
    );
  }

  return (
    <div className="action-log-panel">
      {/* Header */}
      <div className="panel-header">
        <h2>📋 Action Log</h2>
        <div className="header-controls">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Actions</option>
            <option value="assignments">Assignments</option>
            <option value="cancellations">Cancellations</option>
            <option value="sos">SOS Alerts</option>
            <option value="system">System Events</option>
          </select>
          <button 
            className="clear-log-btn danger"
            onClick={clearLog}
            title="Clear all logs (Admin only)"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="log-stats">
        <div className="stat-item">
          <span className="stat-value">{filteredActions.length}</span>
          <span className="stat-label">Actions</span>
        </div>
        <div className="stat-item critical">
          <span className="stat-value">
            {filteredActions.filter(a => a.severity === 'critical').length}
          </span>
          <span className="stat-label">Critical</span>
        </div>
        <div className="stat-item warning">
          <span className="stat-value">
            {filteredActions.filter(a => a.severity === 'warning').length}
          </span>
          <span className="stat-label">Warnings</span>
        </div>
        <div className="stat-item info">
          <span className="stat-value">
            {filteredActions.filter(a => a.severity === 'info').length}
          </span>
          <span className="stat-label">Info</span>
        </div>
      </div>

      {/* Action list */}
      <div className="action-list">
        {filteredActions.length === 0 ? (
          <div className="empty-log">
            <div className="empty-icon">📝</div>
            <h3>No actions found</h3>
            <p>No actions match the current filter criteria.</p>
          </div>
        ) : (
          <div className="actions-scroll">
            {filteredActions.map(action => (
              <div 
                key={action.id} 
                className={`action-item ${action.severity}`}
              >
                {/* Action header */}
                <div className="action-header">
                  <div className="action-icon">
                    {getActionIcon(action.type)}
                  </div>
                  <div className="action-info">
                    <div className="action-title">{action.action}</div>
                    <div className="action-meta">
                      <span className="action-type">
                        {getActionTypeDisplay(action.type)}
                      </span>
                      <span className="action-dispatcher">
                        by {action.dispatcher}
                      </span>
                      <span className="action-time">
                        {format(action.timestamp, 'HH:mm:ss')}
                      </span>
                    </div>
                  </div>
                  <div 
                    className="severity-indicator"
                    style={{ backgroundColor: getSeverityColor(action.severity) }}
                  />
                </div>

                {/* Action details */}
                {action.details && (
                  <div className="action-details">
                    <span className="details-label">Details:</span>
                    <span className="details-text">{action.details}</span>
                  </div>
                )}

                {/* Related entities */}
                <div className="action-entities">
                  {action.rideId && (
                    <span className="entity-tag ride">
                      🚕 {action.rideId.slice(-6)}
                    </span>
                  )}
                  {action.driverId && (
                    <span className="entity-tag driver">
                      👤 {action.driverId.slice(-3)}
                    </span>
                  )}
                </div>

                {/* Timestamp */}
                <div className="action-timestamp">
                  {format(action.timestamp, 'dd/MM/yyyy HH:mm:ss')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-refresh notice */}
      <div className="panel-footer">
        <small>
          🔄 Auto-refreshing every 10 seconds • 
          Showing last {filteredActions.length} actions
        </small>
      </div>
    </div>
  );
};

export default ActionLogPanel;
