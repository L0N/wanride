import React from 'react';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';

const DriverStats = ({ stats }) => {
  // Format hours worked
  const formatHoursWorked = (hours) => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
  };

  // Format cash amount with K5 rounding
  const formatCash = (amount) => {
    const rounded = Math.round(amount / 5) * 5; // Round to nearest K5
    return `PGK K${rounded}`;
  };

  // Calculate commission percentage based on rating
  const getCommissionRate = (rating) => {
    if (rating >= 4.8) return 30;
    if (rating >= 4.6) return 25;
    if (rating >= 4.2) return 20;
    return 15;
  };

  // Format rating display
  const formatRating = (rating) => {
    if (!rating || rating === 0) return 'N/A';
    return rating.toFixed(1);
  };

  // Get rating color
  const getRatingColor = (rating) => {
    if (!rating || rating === 0) return '#9e9e9e';
    if (rating >= 4.8) return '#4caf50'; // Green
    if (rating >= 4.6) return '#8bc34a'; // Light green
    if (rating >= 4.2) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  // Calculate average per ride
  const getAveragePerRide = () => {
    if (!stats.ridesCompleted || stats.ridesCompleted === 0) return 0;
    return stats.cashCollected / stats.ridesCompleted;
  };

  return (
    <div className="driver-stats">
      <div className="stats-header">
        <h3>📊 Today's Performance</h3>
        <p className="stats-date">{format(new Date(), 'EEEE, MMM dd')}</p>
      </div>

      <div className="stats-grid">
        {/* Hours Worked */}
        <div className="stat-card hours">
          <div className="stat-icon">⏰</div>
          <div className="stat-content">
            <div className="stat-value">{formatHoursWorked(stats.hoursWorked || 0)}</div>
            <div className="stat-label">Hours Worked</div>
          </div>
        </div>

        {/* Rides Completed */}
        <div className="stat-card rides">
          <div className="stat-icon">🚗</div>
          <div className="stat-content">
            <div className="stat-value">{stats.ridesCompleted || 0}</div>
            <div className="stat-label">Rides Completed</div>
          </div>
        </div>

        {/* Cash Collected */}
        <div className="stat-card cash">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">{formatCash(stats.cashCollected || 0)}</div>
            <div className="stat-label">Cash Collected</div>
          </div>
        </div>

        {/* Average Rating */}
        <div className="stat-card rating">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <div 
              className="stat-value"
              style={{ color: getRatingColor(stats.averageRating) }}
            >
              {formatRating(stats.averageRating)}
            </div>
            <div className="stat-label">Average Rating</div>
          </div>
        </div>
      </div>

      {/* Additional Stats Row */}
      <div className="stats-secondary">
        {/* Average per Ride */}
        <div className="secondary-stat">
          <span className="secondary-label">Avg per Ride:</span>
          <span className="secondary-value">{formatCash(getAveragePerRide())}</span>
        </div>

        {/* Commission Rate */}
        {stats.averageRating && stats.averageRating > 0 && (
          <div className="secondary-stat">
            <span className="secondary-label">Commission Rate:</span>
            <span className="secondary-value">{getCommissionRate(stats.averageRating)}%</span>
          </div>
        )}

        {/* Estimated Commission */}
        {stats.estimatedCommission && (
          <div className="secondary-stat commission">
            <span className="secondary-label">Est. Commission:</span>
            <span className="secondary-value">{formatCash(stats.estimatedCommission)}</span>
          </div>
        )}
      </div>

      {/* Performance Indicators */}
      <div className="performance-indicators">
        {/* Rating Performance */}
        {stats.averageRating && stats.averageRating > 0 && (
          <div className="performance-item">
            <div className="performance-label">Rating Performance</div>
            <div className="performance-bar">
              <div 
                className="performance-fill"
                style={{ 
                  width: `${(stats.averageRating / 5) * 100}%`,
                  backgroundColor: getRatingColor(stats.averageRating)
                }}
              />
            </div>
            <div className="performance-text">
              {stats.averageRating >= 4.8 && '🌟 Excellent'}
              {stats.averageRating >= 4.6 && stats.averageRating < 4.8 && '👍 Very Good'}
              {stats.averageRating >= 4.2 && stats.averageRating < 4.6 && '👌 Good'}
              {stats.averageRating < 4.2 && '📈 Needs Improvement'}
            </div>
          </div>
        )}

        {/* Productivity Indicator */}
        <div className="performance-item">
          <div className="performance-label">Productivity</div>
          <div className="productivity-stats">
            {stats.hoursWorked > 0 && (
              <span className="productivity-metric">
                {(stats.ridesCompleted / stats.hoursWorked).toFixed(1)} rides/hour
              </span>
            )}
            {stats.ridesCompleted >= 10 && (
              <span className="productivity-badge high">🔥 High Productivity</span>
            )}
            {stats.ridesCompleted >= 5 && stats.ridesCompleted < 10 && (
              <span className="productivity-badge medium">⚡ Good Pace</span>
            )}
            {stats.ridesCompleted < 5 && stats.hoursWorked > 2 && (
              <span className="productivity-badge low">📈 Room to Improve</span>
            )}
          </div>
        </div>
      </div>

      {/* Goals Progress (if applicable) */}
      {stats.dailyGoal && (
        <div className="goals-section">
          <h4>🎯 Daily Goal Progress</h4>
          <div className="goal-progress">
            <div className="goal-bar">
              <div 
                className="goal-fill"
                style={{ 
                  width: `${Math.min((stats.ridesCompleted / stats.dailyGoal) * 100, 100)}%`
                }}
              />
            </div>
            <div className="goal-text">
              {stats.ridesCompleted} / {stats.dailyGoal} rides
              {stats.ridesCompleted >= stats.dailyGoal && ' 🎉 Goal Achieved!'}
            </div>
          </div>
        </div>
      )}

      {/* Quick Tips */}
      {stats.ridesCompleted === 0 && stats.hoursWorked > 1 && (
        <div className="stats-tip">
          <div className="tip-icon">💡</div>
          <p>No rides completed yet today. Make sure you're in a busy area and your status is available.</p>
        </div>
      )}

      {stats.averageRating && stats.averageRating < 4.2 && (
        <div className="stats-tip warning">
          <div className="tip-icon">⚠️</div>
          <p>Your rating is below 4.2. Focus on customer service to increase your commission rate.</p>
        </div>
      )}

      {stats.ridesCompleted >= 15 && (
        <div className="stats-tip success">
          <div className="tip-icon">🌟</div>
          <p>Great job! You've completed {stats.ridesCompleted} rides today. Keep up the excellent work!</p>
        </div>
      )}
    </div>
  );
};

export default DriverStats;
