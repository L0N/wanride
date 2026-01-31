import React from 'react';

const GoalsProgress = ({ data, formatCurrency }) => {
  // Calculate progress percentage
  const getProgressPercentage = (current, target) => {
    if (!target || target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  // Get progress status
  const getProgressStatus = (percentage) => {
    if (percentage >= 100) return { status: 'completed', color: '#4CAF50', text: 'Completed' };
    if (percentage >= 80) return { status: 'on-track', color: '#8BC34A', text: 'On Track' };
    if (percentage >= 60) return { status: 'behind', color: '#FF9800', text: 'Behind' };
    return { status: 'critical', color: '#F44336', text: 'Critical' };
  };

  // Get time remaining text
  const getTimeRemaining = (goalType) => {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    switch (goalType) {
      case 'daily':
        const hoursLeft = Math.max(0, Math.ceil((endOfDay - now) / (1000 * 60 * 60)));
        return `${hoursLeft}h remaining`;
      case 'weekly':
        const daysLeft = Math.max(0, Math.ceil((endOfWeek - now) / (1000 * 60 * 60 * 24)));
        return `${daysLeft}d remaining`;
      case 'monthly':
        const monthDaysLeft = Math.max(0, Math.ceil((endOfMonth - now) / (1000 * 60 * 60 * 24)));
        return `${monthDaysLeft}d remaining`;
      default:
        return '';
    }
  };

  return (
    <div className="goals-progress">
      <div className="goals-header">
        <h3>🎯 Goals Progress</h3>
        <p className="goals-subtitle">Track performance against targets</p>
      </div>

      <div className="goals-grid">
        {/* Revenue Goal */}
        {data.revenue && (
          <div className="goal-card revenue-goal">
            <div className="goal-header">
              <div className="goal-info">
                <h4>💰 Revenue Target</h4>
                <p className="goal-period">{data.revenue.period || 'Daily'}</p>
              </div>
              <div className="goal-status">
                <span 
                  className={`status-badge ${getProgressStatus(getProgressPercentage(data.revenue.current, data.revenue.target)).status}`}
                  style={{ backgroundColor: getProgressStatus(getProgressPercentage(data.revenue.current, data.revenue.target)).color }}
                >
                  {getProgressStatus(getProgressPercentage(data.revenue.current, data.revenue.target)).text}
                </span>
              </div>
            </div>

            <div className="goal-progress">
              <div className="progress-values">
                <span className="current-value">{formatCurrency(data.revenue.current || 0)}</span>
                <span className="target-value">of {formatCurrency(data.revenue.target || 0)}</span>
              </div>
              
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${getProgressPercentage(data.revenue.current, data.revenue.target)}%`,
                    backgroundColor: getProgressStatus(getProgressPercentage(data.revenue.current, data.revenue.target)).color
                  }}
                />
              </div>
              
              <div className="progress-details">
                <span className="progress-percentage">
                  {getProgressPercentage(data.revenue.current, data.revenue.target).toFixed(1)}%
                </span>
                <span className="time-remaining">
                  {getTimeRemaining(data.revenue.period)}
                </span>
              </div>
            </div>

            <div className="goal-insights">
              {getProgressPercentage(data.revenue.current, data.revenue.target) >= 100 ? (
                <div className="insight success">
                  <span className="insight-icon">🎉</span>
                  <span className="insight-text">Revenue target achieved!</span>
                </div>
              ) : (
                <div className="insight">
                  <span className="insight-icon">📊</span>
                  <span className="insight-text">
                    Need {formatCurrency((data.revenue.target || 0) - (data.revenue.current || 0))} more
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rides Goal */}
        {data.rides && (
          <div className="goal-card rides-goal">
            <div className="goal-header">
              <div className="goal-info">
                <h4>🚗 Rides Target</h4>
                <p className="goal-period">{data.rides.period || 'Daily'}</p>
              </div>
              <div className="goal-status">
                <span 
                  className={`status-badge ${getProgressStatus(getProgressPercentage(data.rides.current, data.rides.target)).status}`}
                  style={{ backgroundColor: getProgressStatus(getProgressPercentage(data.rides.current, data.rides.target)).color }}
                >
                  {getProgressStatus(getProgressPercentage(data.rides.current, data.rides.target)).text}
                </span>
              </div>
            </div>

            <div className="goal-progress">
              <div className="progress-values">
                <span className="current-value">{data.rides.current || 0}</span>
                <span className="target-value">of {data.rides.target || 0} rides</span>
              </div>
              
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${getProgressPercentage(data.rides.current, data.rides.target)}%`,
                    backgroundColor: getProgressStatus(getProgressPercentage(data.rides.current, data.rides.target)).color
                  }}
                />
              </div>
              
              <div className="progress-details">
                <span className="progress-percentage">
                  {getProgressPercentage(data.rides.current, data.rides.target).toFixed(1)}%
                </span>
                <span className="time-remaining">
                  {getTimeRemaining(data.rides.period)}
                </span>
              </div>
            </div>

            <div className="goal-insights">
              {getProgressPercentage(data.rides.current, data.rides.target) >= 100 ? (
                <div className="insight success">
                  <span className="insight-icon">🎉</span>
                  <span className="insight-text">Rides target achieved!</span>
                </div>
              ) : (
                <div className="insight">
                  <span className="insight-icon">🚗</span>
                  <span className="insight-text">
                    Need {(data.rides.target || 0) - (data.rides.current || 0)} more rides
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Utilization Goal */}
        {data.utilization && (
          <div className="goal-card utilization-goal">
            <div className="goal-header">
              <div className="goal-info">
                <h4>📊 Utilization Target</h4>
                <p className="goal-period">{data.utilization.period || 'Daily'}</p>
              </div>
              <div className="goal-status">
                <span 
                  className={`status-badge ${getProgressStatus(getProgressPercentage(data.utilization.current, data.utilization.target)).status}`}
                  style={{ backgroundColor: getProgressStatus(getProgressPercentage(data.utilization.current, data.utilization.target)).color }}
                >
                  {getProgressStatus(getProgressPercentage(data.utilization.current, data.utilization.target)).text}
                </span>
              </div>
            </div>

            <div className="goal-progress">
              <div className="progress-values">
                <span className="current-value">{(data.utilization.current || 0).toFixed(1)}%</span>
                <span className="target-value">of {(data.utilization.target || 0).toFixed(1)}%</span>
              </div>
              
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${getProgressPercentage(data.utilization.current, data.utilization.target)}%`,
                    backgroundColor: getProgressStatus(getProgressPercentage(data.utilization.current, data.utilization.target)).color
                  }}
                />
              </div>
              
              <div className="progress-details">
                <span className="progress-percentage">
                  {getProgressPercentage(data.utilization.current, data.utilization.target).toFixed(1)}%
                </span>
                <span className="time-remaining">
                  {getTimeRemaining(data.utilization.period)}
                </span>
              </div>
            </div>

            <div className="goal-insights">
              {getProgressPercentage(data.utilization.current, data.utilization.target) >= 100 ? (
                <div className="insight success">
                  <span className="insight-icon">🎉</span>
                  <span className="insight-text">Utilization target achieved!</span>
                </div>
              ) : (
                <div className="insight">
                  <span className="insight-icon">📊</span>
                  <span className="insight-text">
                    Need {((data.utilization.target || 0) - (data.utilization.current || 0)).toFixed(1)}% more
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Profit Goal */}
        {data.profit && (
          <div className="goal-card profit-goal">
            <div className="goal-header">
              <div className="goal-info">
                <h4>🎯 Profit Target</h4>
                <p className="goal-period">{data.profit.period || 'Daily'}</p>
              </div>
              <div className="goal-status">
                <span 
                  className={`status-badge ${getProgressStatus(getProgressPercentage(data.profit.current, data.profit.target)).status}`}
                  style={{ backgroundColor: getProgressStatus(getProgressPercentage(data.profit.current, data.profit.target)).color }}
                >
                  {getProgressStatus(getProgressPercentage(data.profit.current, data.profit.target)).text}
                </span>
              </div>
            </div>

            <div className="goal-progress">
              <div className="progress-values">
                <span className="current-value">{formatCurrency(data.profit.current || 0)}</span>
                <span className="target-value">of {formatCurrency(data.profit.target || 0)}</span>
              </div>
              
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${getProgressPercentage(data.profit.current, data.profit.target)}%`,
                    backgroundColor: getProgressStatus(getProgressPercentage(data.profit.current, data.profit.target)).color
                  }}
                />
              </div>
              
              <div className="progress-details">
                <span className="progress-percentage">
                  {getProgressPercentage(data.profit.current, data.profit.target).toFixed(1)}%
                </span>
                <span className="time-remaining">
                  {getTimeRemaining(data.profit.period)}
                </span>
              </div>
            </div>

            <div className="goal-insights">
              {getProgressPercentage(data.profit.current, data.profit.target) >= 100 ? (
                <div className="insight success">
                  <span className="insight-icon">🎉</span>
                  <span className="insight-text">Profit target achieved!</span>
                </div>
              ) : (
                <div className="insight">
                  <span className="insight-icon">💰</span>
                  <span className="insight-text">
                    Need {formatCurrency((data.profit.target || 0) - (data.profit.current || 0))} more profit
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Overall Progress Summary */}
      <div className="goals-summary">
        <h4>📈 Overall Progress</h4>
        <div className="summary-stats">
          <div className="summary-item">
            <span className="summary-label">Goals on Track:</span>
            <span className="summary-value">
              {[data.revenue, data.rides, data.utilization, data.profit]
                .filter(goal => goal && getProgressPercentage(goal.current, goal.target) >= 80)
                .length} of {[data.revenue, data.rides, data.utilization, data.profit]
                .filter(goal => goal).length}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Completed Goals:</span>
            <span className="summary-value">
              {[data.revenue, data.rides, data.utilization, data.profit]
                .filter(goal => goal && getProgressPercentage(goal.current, goal.target) >= 100)
                .length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalsProgress;
