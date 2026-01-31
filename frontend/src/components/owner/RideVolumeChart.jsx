import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

const RideVolumeChart = ({ data, period }) => {
  const [selectedView, setSelectedView] = useState('stacked'); // stacked, grouped, percentage

  // Format data for chart
  const formatChartData = () => {
    if (!data || !data.timeline) return [];
    
    return data.timeline.map(item => ({
      ...item,
      displayDate: formatDateForPeriod(item.date),
      completed: item.completed || 0,
      cancelled: item.cancelled || 0,
      noShow: item.noShow || 0,
      total: (item.completed || 0) + (item.cancelled || 0) + (item.noShow || 0),
      completionRate: item.completed ? ((item.completed / ((item.completed || 0) + (item.cancelled || 0) + (item.noShow || 0))) * 100) : 0
    }));
  };

  // Format date based on period
  const formatDateForPeriod = (dateString) => {
    const date = parseISO(dateString);
    
    switch (period) {
      case 'today':
        return format(date, 'HH:mm');
      case 'week':
        return format(date, 'EEE');
      case 'month':
        return format(date, 'MMM dd');
      case 'year':
        return format(date, 'MMM');
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
          <div className="tooltip-item completed">
            <span className="tooltip-label">✅ Completed:</span>
            <span className="tooltip-value">{data.completed}</span>
          </div>
          <div className="tooltip-item cancelled">
            <span className="tooltip-label">❌ Cancelled:</span>
            <span className="tooltip-value">{data.cancelled}</span>
          </div>
          <div className="tooltip-item no-show">
            <span className="tooltip-label">👻 No Show:</span>
            <span className="tooltip-value">{data.noShow}</span>
          </div>
          <div className="tooltip-item total">
            <span className="tooltip-label">📊 Total:</span>
            <span className="tooltip-value">{data.total}</span>
          </div>
          <div className="tooltip-item rate">
            <span className="tooltip-label">📈 Completion Rate:</span>
            <span className="tooltip-value">{data.completionRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  };

  // Calculate summary statistics
  const getSummaryStats = () => {
    const chartData = formatChartData();
    if (chartData.length === 0) return null;

    const totals = chartData.reduce((acc, item) => ({
      completed: acc.completed + item.completed,
      cancelled: acc.cancelled + item.cancelled,
      noShow: acc.noShow + item.noShow,
      total: acc.total + item.total
    }), { completed: 0, cancelled: 0, noShow: 0, total: 0 });

    const avgCompletionRate = totals.total > 0 ? (totals.completed / totals.total) * 100 : 0;

    return {
      ...totals,
      completionRate: avgCompletionRate,
      cancellationRate: totals.total > 0 ? (totals.cancelled / totals.total) * 100 : 0,
      noShowRate: totals.total > 0 ? (totals.noShow / totals.total) * 100 : 0
    };
  };

  // Get peak hour/day
  const getPeakPeriod = () => {
    const chartData = formatChartData();
    if (chartData.length === 0) return null;

    return chartData.reduce((max, item) => 
      item.total > max.total ? item : max
    );
  };

  const chartData = formatChartData();
  const summaryStats = getSummaryStats();
  const peakPeriod = getPeakPeriod();

  return (
    <div className="ride-volume-chart">
      <div className="chart-header">
        <div className="chart-title">
          <h3>🚗 Ride Volume Analysis</h3>
          <p className="chart-subtitle">
            Ride completion, cancellation, and no-show patterns
          </p>
        </div>
        
        <div className="chart-controls">
          <div className="view-selector">
            <button 
              className={`view-btn ${selectedView === 'stacked' ? 'active' : ''}`}
              onClick={() => setSelectedView('stacked')}
              title="Stacked view"
            >
              📊 Stacked
            </button>
            <button 
              className={`view-btn ${selectedView === 'grouped' ? 'active' : ''}`}
              onClick={() => setSelectedView('grouped')}
              title="Grouped view"
            >
              📋 Grouped
            </button>
            <button 
              className={`view-btn ${selectedView === 'percentage' ? 'active' : ''}`}
              onClick={() => setSelectedView('percentage')}
              title="Percentage view"
            >
              📈 Percentage
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {summaryStats && (
        <div className="chart-summary">
          <div className="summary-item completed">
            <span className="summary-label">✅ Completed:</span>
            <span className="summary-value">{summaryStats.completed}</span>
            <span className="summary-percentage">({summaryStats.completionRate.toFixed(1)}%)</span>
          </div>
          <div className="summary-item cancelled">
            <span className="summary-label">❌ Cancelled:</span>
            <span className="summary-value">{summaryStats.cancelled}</span>
            <span className="summary-percentage">({summaryStats.cancellationRate.toFixed(1)}%)</span>
          </div>
          <div className="summary-item no-show">
            <span className="summary-label">👻 No Show:</span>
            <span className="summary-value">{summaryStats.noShow}</span>
            <span className="summary-percentage">({summaryStats.noShowRate.toFixed(1)}%)</span>
          </div>
          <div className="summary-item total">
            <span className="summary-label">📊 Total:</span>
            <span className="summary-value">{summaryStats.total}</span>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="chart-container">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart 
              data={chartData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="displayDate" 
                stroke="#666"
                fontSize={12}
              />
              <YAxis 
                stroke="#666"
                fontSize={12}
                domain={selectedView === 'percentage' ? [0, 100] : [0, 'dataMax']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {selectedView === 'stacked' && (
                <>
                  <Bar 
                    dataKey="completed" 
                    stackId="rides"
                    fill="#4CAF50" 
                    name="Completed"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    dataKey="cancelled" 
                    stackId="rides"
                    fill="#F44336" 
                    name="Cancelled"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    dataKey="noShow" 
                    stackId="rides"
                    fill="#FF9800" 
                    name="No Show"
                    radius={[4, 4, 0, 0]}
                  />
                </>
              )}
              
              {selectedView === 'grouped' && (
                <>
                  <Bar 
                    dataKey="completed" 
                    fill="#4CAF50" 
                    name="Completed"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="cancelled" 
                    fill="#F44336" 
                    name="Cancelled"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="noShow" 
                    fill="#FF9800" 
                    name="No Show"
                    radius={[4, 4, 0, 0]}
                  />
                </>
              )}
              
              {selectedView === 'percentage' && (
                <Bar 
                  dataKey="completionRate" 
                  fill="#2196F3" 
                  name="Completion Rate (%)"
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="no-chart-data">
            <div className="no-data-icon">🚗</div>
            <h4>No Data Available</h4>
            <p>No ride volume data found for the selected period.</p>
          </div>
        )}
      </div>

      {/* Performance Indicators */}
      {summaryStats && (
        <div className="performance-indicators">
          <div className="indicator-item">
            <div className="indicator-header">
              <span className="indicator-label">Completion Rate</span>
              <span className={`indicator-value ${summaryStats.completionRate >= 90 ? 'excellent' : summaryStats.completionRate >= 80 ? 'good' : 'poor'}`}>
                {summaryStats.completionRate.toFixed(1)}%
              </span>
            </div>
            <div className="indicator-bar">
              <div 
                className="indicator-fill"
                style={{ 
                  width: `${summaryStats.completionRate}%`,
                  backgroundColor: summaryStats.completionRate >= 90 ? '#4CAF50' : 
                                  summaryStats.completionRate >= 80 ? '#FF9800' : '#F44336'
                }}
              />
            </div>
            <div className="indicator-target">Target: 90%</div>
          </div>

          <div className="indicator-item">
            <div className="indicator-header">
              <span className="indicator-label">Cancellation Rate</span>
              <span className={`indicator-value ${summaryStats.cancellationRate <= 5 ? 'excellent' : summaryStats.cancellationRate <= 10 ? 'good' : 'poor'}`}>
                {summaryStats.cancellationRate.toFixed(1)}%
              </span>
            </div>
            <div className="indicator-bar">
              <div 
                className="indicator-fill"
                style={{ 
                  width: `${Math.min(summaryStats.cancellationRate, 20) * 5}%`, // Scale to 20% max
                  backgroundColor: summaryStats.cancellationRate <= 5 ? '#4CAF50' : 
                                  summaryStats.cancellationRate <= 10 ? '#FF9800' : '#F44336'
                }}
              />
            </div>
            <div className="indicator-target">Target: &lt;5%</div>
          </div>
        </div>
      )}

      {/* Insights */}
      {chartData.length > 0 && (
        <div className="chart-insights">
          <h4>💡 Key Insights</h4>
          <div className="insights-list">
            {/* Peak period */}
            {peakPeriod && (
              <div className="insight-item">
                <span className="insight-icon">📈</span>
                <span className="insight-text">
                  Peak {period === 'today' ? 'hour' : 'period'}: {peakPeriod.displayDate} ({peakPeriod.total} rides)
                </span>
              </div>
            )}
            
            {/* Completion rate assessment */}
            <div className="insight-item">
              <span className="insight-icon">
                {summaryStats.completionRate >= 90 ? '🌟' : 
                 summaryStats.completionRate >= 80 ? '👍' : '⚠️'}
              </span>
              <span className="insight-text">
                {summaryStats.completionRate >= 90 ? 'Excellent completion rate - keep it up!' :
                 summaryStats.completionRate >= 80 ? 'Good completion rate - room for improvement' :
                 'Low completion rate - investigate cancellation causes'}
              </span>
            </div>
            
            {/* Cancellation concern */}
            {summaryStats.cancellationRate > 10 && (
              <div className="insight-item warning">
                <span className="insight-icon">🚨</span>
                <span className="insight-text">
                  High cancellation rate ({summaryStats.cancellationRate.toFixed(1)}%) - review dispatcher assignments
                </span>
              </div>
            )}
            
            {/* No-show concern */}
            {summaryStats.noShowRate > 5 && (
              <div className="insight-item warning">
                <span className="insight-icon">👻</span>
                <span className="insight-text">
                  High no-show rate ({summaryStats.noShowRate.toFixed(1)}%) - consider passenger verification
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RideVolumeChart;
