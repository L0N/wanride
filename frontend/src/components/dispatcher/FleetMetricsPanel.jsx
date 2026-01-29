import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useSocket } from '../../contexts/SocketContext';

const FleetMetricsPanel = () => {
  const { fleetStatus, isConnected } = useSocket();
  
  // State
  const [metrics, setMetrics] = useState({
    totalVehicles: 0,
    availableVehicles: 0,
    vehiclesOnRide: 0,
    vehiclesOnBreak: 0,
    offlineVehicles: 0,
    fleetHealthScore: 0
  });
  
  const [hourlyDemand, setHourlyDemand] = useState([]);
  const [driverUtilization, setDriverUtilization] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Mock data - replace with real Socket.io data
  useEffect(() => {
    // Mock fleet metrics
    const mockMetrics = {
      totalVehicles: 25,
      availableVehicles: 12,
      vehiclesOnRide: 8,
      vehiclesOnBreak: 3,
      offlineVehicles: 2,
      fleetHealthScore: 85 // Percentage
    };

    // Mock hourly demand data (last 24 hours)
    const mockHourlyDemand = [];
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(Date.now() - i * 60 * 60 * 1000);
      mockHourlyDemand.push({
        hour: hour.getHours(),
        rides: Math.floor(Math.random() * 15) + 5, // 5-20 rides per hour
        time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      });
    }

    // Mock driver utilization data
    const mockDriverUtilization = [
      { name: 'James K.', utilization: 85, rides: 12 },
      { name: 'Mary T.', utilization: 72, rides: 8 },
      { name: 'Peter N.', utilization: 91, rides: 15 },
      { name: 'Sarah W.', utilization: 68, rides: 6 },
      { name: 'Michael T.', utilization: 45, rides: 3 }
    ];

    setMetrics(mockMetrics);
    setHourlyDemand(mockHourlyDemand);
    setDriverUtilization(mockDriverUtilization);

    // Generate alerts based on metrics
    const newAlerts = [];
    
    const availabilityPercentage = (mockMetrics.availableVehicles / mockMetrics.totalVehicles) * 100;
    if (availabilityPercentage < 20) {
      newAlerts.push({
        type: 'warning',
        message: `Low availability: Only ${mockMetrics.availableVehicles} vehicles available (${Math.round(availabilityPercentage)}%)`
      });
    }

    if (mockMetrics.offlineVehicles > 3) {
      newAlerts.push({
        type: 'error',
        message: `High offline count: ${mockMetrics.offlineVehicles} vehicles offline`
      });
    }

    const pendingRides = 3; // Mock pending rides count
    if (pendingRides > 5) {
      newAlerts.push({
        type: 'warning',
        message: `High pending ride backlog: ${pendingRides} rides waiting`
      });
    }

    setAlerts(newAlerts);
  }, []);

  // Update metrics from Socket.io
  useEffect(() => {
    if (fleetStatus) {
      setMetrics(prev => ({ ...prev, ...fleetStatus }));
    }
  }, [fleetStatus]);

  // Calculate peak hours
  const getPeakHours = () => {
    if (hourlyDemand.length === 0) return 'No data';
    
    const sorted = [...hourlyDemand].sort((a, b) => b.rides - a.rides);
    const peak = sorted[0];
    return `${peak.hour}:00 (${peak.rides} rides)`;
  };

  // Colors for charts
  const COLORS = {
    available: '#4caf50',
    onRide: '#2196f3',
    onBreak: '#ff9800',
    offline: '#9e9e9e'
  };

  // Pie chart data
  const pieData = [
    { name: 'Available', value: metrics.availableVehicles, color: COLORS.available },
    { name: 'On Ride', value: metrics.vehiclesOnRide, color: COLORS.onRide },
    { name: 'On Break', value: metrics.vehiclesOnBreak, color: COLORS.onBreak },
    { name: 'Offline', value: metrics.offlineVehicles, color: COLORS.offline }
  ];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="tooltip-value" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fleet-metrics-panel">
      {/* Header */}
      <div className="panel-header">
        <h2>📊 Fleet Metrics</h2>
        <div className="connection-status">
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span>{isConnected ? 'Live' : 'Cached'}</span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="key-metrics">
        <div className="metric-card total">
          <div className="metric-value">{metrics.totalVehicles}</div>
          <div className="metric-label">Total Vehicles</div>
        </div>
        <div className="metric-card available">
          <div className="metric-value">{metrics.availableVehicles}</div>
          <div className="metric-label">Available</div>
        </div>
        <div className="metric-card active">
          <div className="metric-value">{metrics.vehiclesOnRide}</div>
          <div className="metric-label">On Rides</div>
        </div>
        <div className="metric-card health">
          <div className="metric-value">{metrics.fleetHealthScore}%</div>
          <div className="metric-label">Fleet Health</div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          <h3>⚠️ Alerts</h3>
          <div className="alerts-list">
            {alerts.map((alert, index) => (
              <div key={index} className={`alert ${alert.type}`}>
                <span className="alert-icon">
                  {alert.type === 'error' ? '🔴' : '🟡'}
                </span>
                <span className="alert-message">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts section */}
      <div className="charts-section">
        {/* Vehicle status distribution */}
        <div className="chart-container">
          <h3>🚗 Vehicle Status Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-legend">
            {pieData.map((entry, index) => (
              <div key={index} className="legend-item">
                <div 
                  className="legend-color" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="legend-text">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly demand */}
        <div className="chart-container">
          <h3>📈 Hourly Ride Demand (Last 24h)</h3>
          <div className="chart-info">
            <span>Peak: {getPeakHours()}</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={hourlyDemand}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis />
              <Tooltip 
                content={<CustomTooltip />}
                labelFormatter={(hour) => `${hour}:00`}
              />
              <Line 
                type="monotone" 
                dataKey="rides" 
                stroke="#2196f3" 
                strokeWidth={2}
                dot={{ fill: '#2196f3', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Driver utilization */}
        <div className="chart-container">
          <h3>👥 Driver Utilization Rate</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={driverUtilization} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip 
                content={<CustomTooltip />}
                formatter={(value, name) => [`${value}%`, 'Utilization']}
              />
              <Bar 
                dataKey="utilization" 
                fill="#4caf50"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fleet health score */}
      <div className="health-score-section">
        <h3>🏥 Fleet Health Score</h3>
        <div className="health-score-container">
          <div className="health-score-circle">
            <div 
              className="health-score-fill"
              style={{
                background: `conic-gradient(
                  ${metrics.fleetHealthScore >= 80 ? '#4caf50' : 
                    metrics.fleetHealthScore >= 60 ? '#ff9800' : '#f44336'} 
                  ${metrics.fleetHealthScore * 3.6}deg, 
                  #e0e0e0 0deg
                )`
              }}
            >
              <div className="health-score-inner">
                <span className="health-score-value">{metrics.fleetHealthScore}%</span>
                <span className="health-score-label">Health</span>
              </div>
            </div>
          </div>
          <div className="health-score-details">
            <div className="health-factor">
              <span className="factor-label">Availability:</span>
              <span className="factor-value">
                {Math.round((metrics.availableVehicles / metrics.totalVehicles) * 100)}%
              </span>
            </div>
            <div className="health-factor">
              <span className="factor-label">Utilization:</span>
              <span className="factor-value">
                {Math.round((metrics.vehiclesOnRide / (metrics.totalVehicles - metrics.offlineVehicles)) * 100)}%
              </span>
            </div>
            <div className="health-factor">
              <span className="factor-label">Offline Rate:</span>
              <span className="factor-value">
                {Math.round((metrics.offlineVehicles / metrics.totalVehicles) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="quick-stats">
        <div className="stat-row">
          <span className="stat-label">🎯 Peak Hours:</span>
          <span className="stat-value">{getPeakHours()}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">⚡ Avg Response:</span>
          <span className="stat-value">3.2 min</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">💰 Today's Revenue:</span>
          <span className="stat-value">PGK 2,340</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">🚕 Completed Rides:</span>
          <span className="stat-value">156</span>
        </div>
      </div>

      {/* Last updated */}
      <div className="panel-footer">
        <small>
          🔄 Last updated: {new Date().toLocaleTimeString()} 
          {!isConnected && ' (Offline data)'}
        </small>
      </div>
    </div>
  );
};

export default FleetMetricsPanel;
