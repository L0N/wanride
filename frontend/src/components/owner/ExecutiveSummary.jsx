import React from 'react';
import { format } from 'date-fns';

const ExecutiveSummary = ({ data, period, formatCurrency }) => {
  // Calculate trend indicators
  const getTrendIndicator = (current, previous) => {
    if (!previous || previous === 0) return { percentage: 0, direction: 'neutral' };
    
    const change = ((current - previous) / previous) * 100;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    
    return {
      percentage: Math.abs(change),
      direction
    };
  };

  // Get trend icon
  const getTrendIcon = (direction) => {
    switch (direction) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  // Get trend color
  const getTrendColor = (direction) => {
    switch (direction) {
      case 'up': return '#4CAF50'; // Green
      case 'down': return '#F44336'; // Red
      default: return '#757575'; // Gray
    }
  };

  // Format period label
  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'vs Yesterday';
      case 'week': return 'vs Last Week';
      case 'month': return 'vs Last Month';
      case 'year': return 'vs Last Year';
      default: return 'vs Previous Period';
    }
  };

  // Generate sparkline data (simplified)
  const generateSparkline = (data) => {
    if (!data || !data.sparkline) return [];
    return data.sparkline.slice(-7); // Last 7 data points
  };

  // Render sparkline (simple SVG)
  const renderSparkline = (data, color = '#1976D2') => {
    const points = generateSparkline(data);
    if (points.length === 0) return null;

    const width = 80;
    const height = 30;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;

    const pathData = points
      .map((value, index) => {
        const x = (index / (points.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="sparkline">
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="executive-summary">
      <div className="summary-header">
        <h2>📊 Executive Summary</h2>
        <p className="summary-period">
          {period === 'today' ? 'Today' : 
           period === 'week' ? 'This Week' :
           period === 'month' ? 'This Month' :
           period === 'year' ? 'This Year' : 'Custom Period'}
        </p>
      </div>

      <div className="kpi-cards">
        {/* Total Revenue */}
        <div className="kpi-card revenue">
          <div className="kpi-header">
            <div className="kpi-icon">💰</div>
            <div className="kpi-title">Total Revenue</div>
          </div>
          
          <div className="kpi-value">
            {formatCurrency(data.revenue?.total || 0)}
          </div>
          
          <div className="kpi-trend">
            {data.revenue?.trend && (
              <>
                <span 
                  className="trend-indicator"
                  style={{ color: getTrendColor(getTrendIndicator(data.revenue.total, data.revenue.previous).direction) }}
                >
                  {getTrendIcon(getTrendIndicator(data.revenue.total, data.revenue.previous).direction)}
                  {getTrendIndicator(data.revenue.total, data.revenue.previous).percentage.toFixed(1)}%
                </span>
                <span className="trend-label">{getPeriodLabel()}</span>
              </>
            )}
          </div>
          
          <div className="kpi-sparkline">
            {renderSparkline(data.revenue, '#4CAF50')}
          </div>
        </div>

        {/* Active Rides */}
        <div className="kpi-card rides">
          <div className="kpi-header">
            <div className="kpi-icon">🚗</div>
            <div className="kpi-title">Active Rides</div>
          </div>
          
          <div className="kpi-value">
            {data.rides?.active || 0}
          </div>
          
          <div className="kpi-trend">
            <span className="trend-label">Right Now</span>
            {data.rides?.completed && (
              <span className="secondary-metric">
                {data.rides.completed} completed today
              </span>
            )}
          </div>
          
          <div className="kpi-sparkline">
            {renderSparkline(data.rides, '#2196F3')}
          </div>
        </div>

        {/* Fleet Utilization */}
        <div className="kpi-card utilization">
          <div className="kpi-header">
            <div className="kpi-icon">📊</div>
            <div className="kpi-title">Fleet Utilization</div>
          </div>
          
          <div className="kpi-value">
            {data.fleet?.utilization ? `${data.fleet.utilization.toFixed(1)}%` : '0%'}
          </div>
          
          <div className="kpi-trend">
            <span className="trend-label">
              {data.fleet?.onRide || 0} of {data.fleet?.total || 0} vehicles
            </span>
            {data.fleet?.target && (
              <span 
                className={`target-indicator ${data.fleet.utilization >= data.fleet.target ? 'met' : 'below'}`}
              >
                Target: {data.fleet.target}%
              </span>
            )}
          </div>
          
          <div className="utilization-bar">
            <div 
              className="utilization-fill"
              style={{ 
                width: `${Math.min(data.fleet?.utilization || 0, 100)}%`,
                backgroundColor: (data.fleet?.utilization || 0) >= (data.fleet?.target || 70) ? '#4CAF50' : '#FF9800'
              }}
            />
          </div>
        </div>

        {/* Driver Efficiency */}
        <div className="kpi-card efficiency">
          <div className="kpi-header">
            <div className="kpi-icon">⚡</div>
            <div className="kpi-title">Driver Efficiency</div>
          </div>
          
          <div className="kpi-value">
            {data.drivers?.avgRidesPerDriver ? data.drivers.avgRidesPerDriver.toFixed(1) : '0'}
          </div>
          
          <div className="kpi-trend">
            <span className="trend-label">Avg rides per driver</span>
            {data.drivers?.topPerformer && (
              <span className="secondary-metric">
                Top: {data.drivers.topPerformer.name} ({data.drivers.topPerformer.rides})
              </span>
            )}
          </div>
          
          <div className="kpi-sparkline">
            {renderSparkline(data.drivers, '#FF9800')}
          </div>
        </div>
      </div>

      {/* Additional Metrics Row */}
      <div className="additional-metrics">
        {/* Average Fare */}
        <div className="metric-item">
          <span className="metric-label">Average Fare:</span>
          <span className="metric-value">
            {data.revenue?.avgFare ? formatCurrency(data.revenue.avgFare) : 'N/A'}
          </span>
        </div>

        {/* Completion Rate */}
        <div className="metric-item">
          <span className="metric-label">Completion Rate:</span>
          <span className="metric-value">
            {data.rides?.completionRate ? `${data.rides.completionRate.toFixed(1)}%` : 'N/A'}
          </span>
        </div>

        {/* Peak Hour */}
        <div className="metric-item">
          <span className="metric-label">Peak Hour:</span>
          <span className="metric-value">
            {data.operational?.peakHour ? `${data.operational.peakHour}:00` : 'N/A'}
          </span>
        </div>

        {/* Active Drivers */}
        <div className="metric-item">
          <span className="metric-label">Active Drivers:</span>
          <span className="metric-value">
            {data.drivers?.active || 0} of {data.drivers?.total || 0}
          </span>
        </div>

        {/* Cash Collected */}
        <div className="metric-item">
          <span className="metric-label">Cash Collected:</span>
          <span className="metric-value">
            {data.financials?.cashCollected ? formatCurrency(data.financials.cashCollected) : 'N/A'}
          </span>
        </div>

        {/* Outstanding Commissions */}
        <div className="metric-item">
          <span className="metric-label">Outstanding Commissions:</span>
          <span className="metric-value">
            {data.financials?.outstandingCommissions ? formatCurrency(data.financials.outstandingCommissions) : 'N/A'}
          </span>
        </div>
      </div>

      {/* Health Score */}
      {data.fleet?.healthScore && (
        <div className="fleet-health">
          <div className="health-header">
            <h4>🏥 Fleet Health Score</h4>
            <span className={`health-score ${data.fleet.healthScore >= 80 ? 'excellent' : data.fleet.healthScore >= 60 ? 'good' : 'poor'}`}>
              {data.fleet.healthScore.toFixed(0)}%
            </span>
          </div>
          
          <div className="health-bar">
            <div 
              className="health-fill"
              style={{ 
                width: `${data.fleet.healthScore}%`,
                backgroundColor: data.fleet.healthScore >= 80 ? '#4CAF50' : 
                                data.fleet.healthScore >= 60 ? '#FF9800' : '#F44336'
              }}
            />
          </div>
          
          <div className="health-factors">
            <span className="factor">Vehicle Availability</span>
            <span className="factor">Driver Performance</span>
            <span className="factor">Maintenance Status</span>
            <span className="factor">Customer Satisfaction</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummary;
