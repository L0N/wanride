import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import ExecutiveSummary from '../../components/owner/ExecutiveSummary';
import RevenueTrendChart from '../../components/owner/RevenueTrendChart';
import RideVolumeChart from '../../components/owner/RideVolumeChart';
import FinancialSummaryCards from '../../components/owner/FinancialSummaryCards';
import GoalsProgress from '../../components/owner/GoalsProgress';
import DateRangePicker from '../../components/owner/DateRangePicker';

const OwnerDashboard = () => {
  const { user, logout } = useAuth();
  const { isConnected, emit } = useSocket();
  const navigate = useNavigate();
  
  // State
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('today'); // today, week, month, year
  const [dateRange, setDateRange] = useState({
    from: startOfDay(new Date()),
    to: endOfDay(new Date())
  });
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Check if user is an owner
  useEffect(() => {
    if (!user || !user.roles.includes('OWNER')) {
      toast.error('Access denied: Owner account required');
      navigate('/login');
      return;
    }
  }, [user, navigate]);

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod, dateRange]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadDashboardData(false); // Silent refresh
      setLastUpdated(new Date());
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, selectedPeriod, dateRange]);

  // Listen for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const handleDashboardUpdate = (data) => {
      console.log('Real-time dashboard update:', data);
      setDashboardData(prevData => ({
        ...prevData,
        ...data
      }));
      setLastUpdated(new Date());
    };

    // Listen for Socket.io updates
    const socket = window.socket;
    if (socket) {
      socket.on('owner:dashboard:update', handleDashboardUpdate);
    }

    return () => {
      if (socket) {
        socket.off('owner:dashboard:update', handleDashboardUpdate);
      }
    };
  }, [isConnected]);

  // Load dashboard data from API
  const loadDashboardData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    
    try {
      const params = new URLSearchParams({
        period: selectedPeriod,
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString()
      });

      const response = await fetch(`/api/owner/dashboard?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Dashboard data error:', error);
      toast.error('Failed to load dashboard. Check your connection.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  // Handle period change
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    
    // Update date range based on period
    const now = new Date();
    let from, to;
    
    switch (period) {
      case 'today':
        from = startOfDay(now);
        to = endOfDay(now);
        break;
      case 'week':
        from = startOfDay(subDays(now, 7));
        to = endOfDay(now);
        break;
      case 'month':
        from = startOfDay(subDays(now, 30));
        to = endOfDay(now);
        break;
      case 'year':
        from = startOfDay(subDays(now, 365));
        to = endOfDay(now);
        break;
      default:
        from = startOfDay(now);
        to = endOfDay(now);
    }
    
    setDateRange({ from, to });
  };

  // Handle custom date range
  const handleDateRangeChange = (newRange) => {
    setDateRange(newRange);
    setSelectedPeriod('custom');
  };

  // Export dashboard as PDF
  const handleExportPDF = async () => {
    try {
      toast.info('Generating PDF report...');
      
      const response = await fetch('/api/owner/reports/dashboard-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          period: selectedPeriod,
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
          data: dashboardData
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wanride-dashboard-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Dashboard exported as PDF');
      } else {
        toast.error('Failed to generate PDF report');
      }
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  // Handle logout
  const handleLogout = () => {
    const confirmed = window.confirm('Are you sure you want to log out?');
    if (confirmed) {
      logout();
      navigate('/login');
    }
  };

  // Format currency with K5 rounding
  const formatCurrency = (amount) => {
    const rounded = Math.round(amount / 5) * 5; // Round to nearest K5
    return `PGK K${rounded.toLocaleString()}`;
  };

  // Loading state
  if (isLoading && !dashboardData) {
    return (
      <div className="owner-dashboard loading">
        <div className="loading-container">
          <div className="loading-spinner large" />
          <h2>Loading Dashboard...</h2>
          <p>Analyzing fleet performance and financial data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="owner-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>📊 WanRide Analytics</h1>
          <p>Fleet Performance Dashboard</p>
          <div className="last-updated">
            Last updated: {format(lastUpdated, 'HH:mm:ss')}
            {!isConnected && <span className="offline-indicator">📵 Offline</span>}
          </div>
        </div>
        
        <div className="header-controls">
          {/* Period Selector */}
          <div className="period-selector">
            <button 
              className={`period-btn ${selectedPeriod === 'today' ? 'active' : ''}`}
              onClick={() => handlePeriodChange('today')}
            >
              Today
            </button>
            <button 
              className={`period-btn ${selectedPeriod === 'week' ? 'active' : ''}`}
              onClick={() => handlePeriodChange('week')}
            >
              Week
            </button>
            <button 
              className={`period-btn ${selectedPeriod === 'month' ? 'active' : ''}`}
              onClick={() => handlePeriodChange('month')}
            >
              Month
            </button>
            <button 
              className={`period-btn ${selectedPeriod === 'year' ? 'active' : ''}`}
              onClick={() => handlePeriodChange('year')}
            >
              Year
            </button>
          </div>
          
          {/* Date Range Picker */}
          <DateRangePicker 
            value={dateRange}
            onChange={handleDateRangeChange}
          />
          
          {/* Action Buttons */}
          <div className="action-buttons">
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`refresh-btn ${autoRefresh ? 'active' : ''}`}
              title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              🔄 {autoRefresh ? 'Auto' : 'Manual'}
            </button>
            
            <button 
              onClick={() => loadDashboardData()}
              className="refresh-btn"
              title="Refresh now"
            >
              ↻ Refresh
            </button>
            
            <button 
              onClick={handleExportPDF}
              className="export-btn"
              title="Export as PDF"
            >
              📄 Export PDF
            </button>
            
            <button 
              onClick={handleLogout}
              className="logout-btn"
              title="Logout"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="dashboard-content">
        {dashboardData ? (
          <>
            {/* Executive Summary - KPI Cards */}
            <ExecutiveSummary 
              data={dashboardData}
              period={selectedPeriod}
              formatCurrency={formatCurrency}
            />

            {/* Main Charts Row */}
            <div className="charts-row">
              {/* Revenue Trend Chart */}
              <div className="chart-container revenue-chart">
                <RevenueTrendChart 
                  data={dashboardData.revenue}
                  period={selectedPeriod}
                  formatCurrency={formatCurrency}
                />
              </div>
              
              {/* Ride Volume Chart */}
              <div className="chart-container ride-volume-chart">
                <RideVolumeChart 
                  data={dashboardData.rides}
                  period={selectedPeriod}
                />
              </div>
            </div>

            {/* Financial Summary Cards */}
            <FinancialSummaryCards 
              data={dashboardData.financials}
              formatCurrency={formatCurrency}
            />

            {/* Goals Progress */}
            {dashboardData.goals && (
              <GoalsProgress 
                data={dashboardData.goals}
                formatCurrency={formatCurrency}
              />
            )}

            {/* Quick Links */}
            <div className="quick-links">
              <h3>📋 Detailed Reports</h3>
              <div className="links-grid">
                <button 
                  onClick={() => navigate('/owner/financial-reports')}
                  className="quick-link-btn"
                >
                  💰 Financial Reports
                </button>
                <button 
                  onClick={() => navigate('/owner/fleet-analytics')}
                  className="quick-link-btn"
                >
                  🚗 Fleet Analytics
                </button>
                <button 
                  onClick={() => navigate('/owner/driver-performance')}
                  className="quick-link-btn"
                >
                  👥 Driver Performance
                </button>
                <button 
                  onClick={() => navigate('/owner/operational-analytics')}
                  className="quick-link-btn"
                >
                  📊 Operational Analytics
                </button>
                <button 
                  onClick={() => navigate('/owner/comparative-reports')}
                  className="quick-link-btn"
                >
                  📈 Comparative Reports
                </button>
                <button 
                  onClick={() => navigate('/owner/report-scheduler')}
                  className="quick-link-btn"
                >
                  📧 Report Scheduler
                </button>
                <button 
                  onClick={() => navigate('/owner/data-export')}
                  className="quick-link-btn"
                >
                  📥 Data Export
                </button>
                <button 
                  onClick={() => navigate('/owner/settings')}
                  className="quick-link-btn"
                >
                  ⚙️ Settings
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="no-data">
            <div className="no-data-icon">📊</div>
            <h3>No Data Available</h3>
            <p>Unable to load dashboard data. Please check your connection and try again.</p>
            <button onClick={() => loadDashboardData()} className="retry-btn">
              🔄 Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerDashboard;
