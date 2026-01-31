import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

const RevenueTrendChart = ({ data, period, formatCurrency }) => {
  const [showComparison, setShowComparison] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('revenue'); // revenue, rides, avgFare

  // Format data for chart
  const formatChartData = () => {
    if (!data || !data.timeline) return [];
    
    return data.timeline.map(item => ({
      ...item,
      date: item.date,
      displayDate: formatDateForPeriod(item.date),
      revenue: Math.round(item.revenue / 5) * 5, // K5 rounding
      previousRevenue: item.previousRevenue ? Math.round(item.previousRevenue / 5) * 5 : null,
      avgFare: item.avgFare ? Math.round(item.avgFare / 5) * 5 : null
    }));
  };

  // Format date based on period
  const formatDateForPeriod = (dateString) => {
    const date = parseISO(dateString);
    
    switch (period) {
      case 'today':
        return format(date, 'HH:mm'); // Hourly for today
      case 'week':
        return format(date, 'EEE'); // Day of week
      case 'month':
        return format(date, 'MMM dd'); // Month day
      case 'year':
        return format(date, 'MMM'); // Month
      default:
        return format(date, 'MMM dd');
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    
    return (
      <div className="chart-tooltip">
        <div className="tooltip-header">
          <strong>{label}</strong>
        </div>
        <div className="tooltip-content">
          {selectedMetric === 'revenue' && (
            <>
              <div className="tooltip-item current">
                <span className="tooltip-label">Revenue:</span>
                <span className="tooltip-value">{formatCurrency(data.revenue)}</span>
              </div>
              {showComparison && data.previousRevenue && (
                <div className="tooltip-item previous">
                  <span className="tooltip-label">Previous:</span>
                  <span className="tooltip-value">{formatCurrency(data.previousRevenue)}</span>
                </div>
              )}
            </>
          )}
          
          {selectedMetric === 'rides' && (
            <div className="tooltip-item">
              <span className="tooltip-label">Rides:</span>
              <span className="tooltip-value">{data.rides || 0}</span>
            </div>
          )}
          
          {selectedMetric === 'avgFare' && (
            <div className="tooltip-item">
              <span className="tooltip-label">Avg Fare:</span>
              <span className="tooltip-value">{formatCurrency(data.avgFare || 0)}</span>
            </div>
          )}
          
          <div className="tooltip-item">
            <span className="tooltip-label">Completion Rate:</span>
            <span className="tooltip-value">{data.completionRate ? `${data.completionRate.toFixed(1)}%` : 'N/A'}</span>
          </div>
        </div>
      </div>
    );
  };

  // Format Y-axis values
  const formatYAxis = (value) => {
    if (selectedMetric === 'revenue' || selectedMetric === 'avgFare') {
      return `K${(value / 1000).toFixed(0)}k`; // K5k format for thousands
    }
    return value;
  };

  // Get chart color based on metric
  const getChartColor = () => {
    switch (selectedMetric) {
      case 'revenue': return '#4CAF50';
      case 'rides': return '#2196F3';
      case 'avgFare': return '#FF9800';
      default: return '#1976D2';
    }
  };

  // Get metric label
  const getMetricLabel = () => {
    switch (selectedMetric) {
      case 'revenue': return 'Revenue (PGK)';
      case 'rides': return 'Number of Rides';
      case 'avgFare': return 'Average Fare (PGK)';
      default: return 'Revenue (PGK)';
    }
  };

  // Calculate summary stats
  const getSummaryStats = () => {
    const chartData = formatChartData();
    if (chartData.length === 0) return null;

    const values = chartData.map(item => item[selectedMetric] || 0);
    const total = values.reduce((sum, val) => sum + val, 0);
    const avg = total / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    return {
      total: selectedMetric === 'revenue' ? formatCurrency(total) : total.toFixed(0),
      average: selectedMetric === 'revenue' || selectedMetric === 'avgFare' ? formatCurrency(avg) : avg.toFixed(1),
      peak: selectedMetric === 'revenue' || selectedMetric === 'avgFare' ? formatCurrency(max) : max.toFixed(0),
      lowest: selectedMetric === 'revenue' || selectedMetric === 'avgFare' ? formatCurrency(min) : min.toFixed(0)
    };
  };

  const chartData = formatChartData();
  const summaryStats = getSummaryStats();

  return (
    <div className="revenue-trend-chart">
      <div className="chart-header">
        <div className="chart-title">
          <h3>📈 Revenue Trend Analysis</h3>
          <p className="chart-subtitle">
            {period === 'today' ? 'Hourly breakdown for today' :
             period === 'week' ? 'Daily breakdown for this week' :
             period === 'month' ? 'Daily breakdown for this month' :
             period === 'year' ? 'Monthly breakdown for this year' : 'Custom period breakdown'}
          </p>
        </div>
        
        <div className="chart-controls">
          {/* Metric Selector */}
          <div className="metric-selector">
            <button 
              className={`metric-btn ${selectedMetric === 'revenue' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('revenue')}
            >
              💰 Revenue
            </button>
            <button 
              className={`metric-btn ${selectedMetric === 'rides' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('rides')}
            >
              🚗 Rides
            </button>
            <button 
              className={`metric-btn ${selectedMetric === 'avgFare' ? 'active' : ''}`}
              onClick={() => setSelectedMetric('avgFare')}
            >
              💵 Avg Fare
            </button>
          </div>
          
          {/* Comparison Toggle */}
          <button 
            className={`comparison-btn ${showComparison ? 'active' : ''}`}
            onClick={() => setShowComparison(!showComparison)}
            title="Compare with previous period"
          >
            📊 Compare
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summaryStats && (
        <div className="chart-summary">
          <div className="summary-item">
            <span className="summary-label">Total:</span>
            <span className="summary-value">{summaryStats.total}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Average:</span>
            <span className="summary-value">{summaryStats.average}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Peak:</span>
            <span className="summary-value">{summaryStats.peak}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Lowest:</span>
            <span className="summary-value">{summaryStats.lowest}</span>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="chart-container">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="displayDate" 
                stroke="#666"
                fontSize={12}
              />
              <YAxis 
                tickFormatter={formatYAxis}
                stroke="#666"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* Main line */}
              <Line
                type="monotone"
                dataKey={selectedMetric}
                stroke={getChartColor()}
                strokeWidth={3}
                dot={{ fill: getChartColor(), strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: getChartColor(), strokeWidth: 2 }}
                name={getMetricLabel()}
              />
              
              {/* Comparison line */}
              {showComparison && selectedMetric === 'revenue' && (
                <Line
                  type="monotone"
                  dataKey="previousRevenue"
                  stroke="#999"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#999', strokeWidth: 1, r: 3 }}
                  name="Previous Period"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="no-chart-data">
            <div className="no-data-icon">📈</div>
            <h4>No Data Available</h4>
            <p>No revenue data found for the selected period.</p>
          </div>
        )}
      </div>

      {/* Chart Insights */}
      {chartData.length > 0 && (
        <div className="chart-insights">
          <h4>💡 Key Insights</h4>
          <div className="insights-list">
            {/* Peak time insight */}
            {period === 'today' && (
              <div className="insight-item">
                <span className="insight-icon">⏰</span>
                <span className="insight-text">
                  Peak revenue hour: {chartData.reduce((max, item) => 
                    item.revenue > max.revenue ? item : max
                  ).displayDate}
                </span>
              </div>
            )}
            
            {/* Growth trend */}
            {chartData.length >= 2 && (
              <div className="insight-item">
                <span className="insight-icon">📊</span>
                <span className="insight-text">
                  {chartData[chartData.length - 1][selectedMetric] > chartData[0][selectedMetric] 
                    ? 'Positive growth trend detected' 
                    : 'Declining trend - review operations'}
                </span>
              </div>
            )}
            
            {/* Consistency insight */}
            <div className="insight-item">
              <span className="insight-icon">🎯</span>
              <span className="insight-text">
                Revenue consistency: {summaryStats && (
                  (parseFloat(summaryStats.peak.replace(/[^\d.]/g, '')) / parseFloat(summaryStats.average.replace(/[^\d.]/g, '')) < 2) 
                    ? 'Stable performance' 
                    : 'High variability'
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueTrendChart;
