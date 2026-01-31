import React from 'react';

const FinancialSummaryCards = ({ data, formatCurrency }) => {
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

  // Get trend icon and color
  const getTrendDisplay = (direction, isProfit = false) => {
    const icons = {
      up: isProfit ? '📈' : '📈',
      down: isProfit ? '📉' : '📉',
      neutral: '➡️'
    };
    
    const colors = {
      up: isProfit ? '#4CAF50' : '#4CAF50',
      down: isProfit ? '#F44336' : '#F44336',
      neutral: '#757575'
    };
    
    return { icon: icons[direction], color: colors[direction] };
  };

  // Calculate profit margin
  const getProfitMargin = () => {
    if (!data.gross || data.gross === 0) return 0;
    return ((data.profit || 0) / data.gross) * 100;
  };

  // Get margin health status
  const getMarginStatus = (margin) => {
    if (margin >= 20) return { status: 'excellent', color: '#4CAF50', text: 'Excellent' };
    if (margin >= 15) return { status: 'good', color: '#8BC34A', text: 'Good' };
    if (margin >= 10) return { status: 'fair', color: '#FF9800', text: 'Fair' };
    return { status: 'poor', color: '#F44336', text: 'Poor' };
  };

  const profitMargin = getProfitMargin();
  const marginStatus = getMarginStatus(profitMargin);

  return (
    <div className="financial-summary-cards">
      <div className="cards-header">
        <h3>💰 Financial Summary</h3>
        <p className="cards-subtitle">Revenue, costs, and profitability overview</p>
      </div>

      <div className="financial-cards-grid">
        {/* Gross Revenue */}
        <div className="financial-card gross-revenue">
          <div className="card-header">
            <div className="card-icon">💵</div>
            <div className="card-title">Gross Revenue</div>
          </div>
          
          <div className="card-value">
            {formatCurrency(data.gross || 0)}
          </div>
          
          <div className="card-trend">
            {data.grossTrend && (
              <>
                <span 
                  className="trend-indicator"
                  style={{ color: getTrendDisplay(getTrendIndicator(data.gross, data.grossPrevious).direction).color }}
                >
                  {getTrendDisplay(getTrendIndicator(data.gross, data.grossPrevious).direction).icon}
                  {getTrendIndicator(data.gross, data.grossPrevious).percentage.toFixed(1)}%
                </span>
                <span className="trend-label">vs previous period</span>
              </>
            )}
          </div>
          
          <div className="card-details">
            <div className="detail-item">
              <span className="detail-label">Total Fares:</span>
              <span className="detail-value">{formatCurrency(data.totalFares || 0)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">K5 Adjustments:</span>
              <span className="detail-value">{formatCurrency(data.k5Adjustments || 0)}</span>
            </div>
          </div>
        </div>

        {/* Driver Commissions */}
        <div className="financial-card commissions">
          <div className="card-header">
            <div className="card-icon">👥</div>
            <div className="card-title">Driver Commissions</div>
          </div>
          
          <div className="card-value">
            {formatCurrency(data.commissions || 0)}
          </div>
          
          <div className="card-trend">
            {data.commissionsTrend && (
              <>
                <span 
                  className="trend-indicator"
                  style={{ color: getTrendDisplay(getTrendIndicator(data.commissions, data.commissionsPrevious).direction).color }}
                >
                  {getTrendDisplay(getTrendIndicator(data.commissions, data.commissionsPrevious).direction).icon}
                  {getTrendIndicator(data.commissions, data.commissionsPrevious).percentage.toFixed(1)}%
                </span>
                <span className="trend-label">vs previous period</span>
              </>
            )}
          </div>
          
          <div className="card-details">
            <div className="detail-item">
              <span className="detail-label">Paid:</span>
              <span className="detail-value">{formatCurrency(data.commissionsPaid || 0)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Outstanding:</span>
              <span className="detail-value outstanding">{formatCurrency(data.commissionsOutstanding || 0)}</span>
            </div>
          </div>
        </div>

        {/* Net Revenue */}
        <div className="financial-card net-revenue">
          <div className="card-header">
            <div className="card-icon">💰</div>
            <div className="card-title">Net Revenue</div>
          </div>
          
          <div className="card-value">
            {formatCurrency(data.net || 0)}
          </div>
          
          <div className="card-trend">
            {data.netTrend && (
              <>
                <span 
                  className="trend-indicator"
                  style={{ color: getTrendDisplay(getTrendIndicator(data.net, data.netPrevious).direction).color }}
                >
                  {getTrendDisplay(getTrendIndicator(data.net, data.netPrevious).direction).icon}
                  {getTrendIndicator(data.net, data.netPrevious).percentage.toFixed(1)}%
                </span>
                <span className="trend-label">vs previous period</span>
              </>
            )}
          </div>
          
          <div className="card-details">
            <div className="detail-item">
              <span className="detail-label">Gross Revenue:</span>
              <span className="detail-value">{formatCurrency(data.gross || 0)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Less Commissions:</span>
              <span className="detail-value">-{formatCurrency(data.commissions || 0)}</span>
            </div>
          </div>
        </div>

        {/* Operating Costs */}
        <div className="financial-card operating-costs">
          <div className="card-header">
            <div className="card-icon">🏭</div>
            <div className="card-title">Operating Costs</div>
          </div>
          
          <div className="card-value">
            {formatCurrency(data.costs || 0)}
          </div>
          
          <div className="card-trend">
            {data.costsTrend && (
              <>
                <span 
                  className="trend-indicator"
                  style={{ color: getTrendDisplay(getTrendIndicator(data.costs, data.costsPrevious).direction, false).color }}
                >
                  {getTrendDisplay(getTrendIndicator(data.costs, data.costsPrevious).direction, false).icon}
                  {getTrendIndicator(data.costs, data.costsPrevious).percentage.toFixed(1)}%
                </span>
                <span className="trend-label">vs previous period</span>
              </>
            )}
          </div>
          
          <div className="card-details">
            <div className="detail-item">
              <span className="detail-label">Fuel:</span>
              <span className="detail-value">{formatCurrency(data.fuelCosts || 0)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Maintenance:</span>
              <span className="detail-value">{formatCurrency(data.maintenanceCosts || 0)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Insurance:</span>
              <span className="detail-value">{formatCurrency(data.insuranceCosts || 0)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Other:</span>
              <span className="detail-value">{formatCurrency(data.otherCosts || 0)}</span>
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="financial-card net-profit">
          <div className="card-header">
            <div className="card-icon">🎯</div>
            <div className="card-title">Net Profit</div>
          </div>
          
          <div className="card-value profit">
            {formatCurrency(data.profit || 0)}
          </div>
          
          <div className="card-trend">
            {data.profitTrend && (
              <>
                <span 
                  className="trend-indicator"
                  style={{ color: getTrendDisplay(getTrendIndicator(data.profit, data.profitPrevious).direction, true).color }}
                >
                  {getTrendDisplay(getTrendIndicator(data.profit, data.profitPrevious).direction, true).icon}
                  {getTrendIndicator(data.profit, data.profitPrevious).percentage.toFixed(1)}%
                </span>
                <span className="trend-label">vs previous period</span>
              </>
            )}
          </div>
          
          <div className="card-details">
            <div className="detail-item">
              <span className="detail-label">Net Revenue:</span>
              <span className="detail-value">{formatCurrency(data.net || 0)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Less Costs:</span>
              <span className="detail-value">-{formatCurrency(data.costs || 0)}</span>
            </div>
          </div>
        </div>

        {/* Profit Margin */}
        <div className="financial-card profit-margin">
          <div className="card-header">
            <div className="card-icon">📊</div>
            <div className="card-title">Profit Margin</div>
          </div>
          
          <div className="card-value margin">
            <span style={{ color: marginStatus.color }}>
              {profitMargin.toFixed(1)}%
            </span>
          </div>
          
          <div className="card-trend">
            <span 
              className="margin-status"
              style={{ color: marginStatus.color }}
            >
              {marginStatus.text} margin
            </span>
          </div>
          
          <div className="margin-bar">
            <div 
              className="margin-fill"
              style={{ 
                width: `${Math.min(profitMargin, 30) * (100/30)}%`, // Scale to 30% max
                backgroundColor: marginStatus.color
              }}
            />
          </div>
          
          <div className="card-details">
            <div className="detail-item">
              <span className="detail-label">Industry Target:</span>
              <span className="detail-value">15-20%</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Break-even:</span>
              <span className="detail-value">{formatCurrency(data.breakEven || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Health Summary */}
      <div className="financial-health">
        <div className="health-header">
          <h4>🏥 Financial Health</h4>
        </div>
        
        <div className="health-indicators">
          {/* Revenue Growth */}
          <div className="health-item">
            <span className="health-label">Revenue Growth:</span>
            <span className={`health-value ${data.revenueGrowth >= 0 ? 'positive' : 'negative'}`}>
              {data.revenueGrowth ? `${data.revenueGrowth > 0 ? '+' : ''}${data.revenueGrowth.toFixed(1)}%` : 'N/A'}
            </span>
          </div>
          
          {/* Cost Control */}
          <div className="health-item">
            <span className="health-label">Cost Control:</span>
            <span className={`health-value ${(data.costs || 0) / (data.gross || 1) <= 0.6 ? 'good' : 'warning'}`}>
              {data.gross ? `${(((data.costs || 0) / data.gross) * 100).toFixed(1)}% of revenue` : 'N/A'}
            </span>
          </div>
          
          {/* Cash Flow */}
          <div className="health-item">
            <span className="health-label">Cash Flow:</span>
            <span className={`health-value ${(data.profit || 0) > 0 ? 'positive' : 'negative'}`}>
              {(data.profit || 0) > 0 ? 'Positive' : 'Negative'}
            </span>
          </div>
          
          {/* Commission Ratio */}
          <div className="health-item">
            <span className="health-label">Commission Ratio:</span>
            <span className="health-value">
              {data.gross ? `${(((data.commissions || 0) / data.gross) * 100).toFixed(1)}%` : 'N/A'}
            </span>
          </div>
        </div>
        
        {/* Recommendations */}
        <div className="financial-recommendations">
          <h5>💡 Recommendations</h5>
          <div className="recommendations-list">
            {profitMargin < 10 && (
              <div className="recommendation warning">
                <span className="rec-icon">⚠️</span>
                <span className="rec-text">Low profit margin - review pricing strategy and cost optimization</span>
              </div>
            )}
            
            {data.commissionsOutstanding > (data.gross * 0.1) && (
              <div className="recommendation warning">
                <span className="rec-icon">💰</span>
                <span className="rec-text">High outstanding commissions - schedule driver payments</span>
              </div>
            )}
            
            {(data.costs || 0) / (data.gross || 1) > 0.7 && (
              <div className="recommendation warning">
                <span className="rec-icon">🏭</span>
                <span className="rec-text">High operating costs - investigate fuel and maintenance efficiency</span>
              </div>
            )}
            
            {profitMargin >= 20 && (
              <div className="recommendation success">
                <span className="rec-icon">🌟</span>
                <span className="rec-text">Excellent profit margin - consider fleet expansion opportunities</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialSummaryCards;
