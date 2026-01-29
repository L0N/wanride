import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { toast } from 'react-toastify';

// Dispatcher components
import DispatcherMap from '../../components/dispatcher/DispatcherMap';
import RideQueuePanel from '../../components/dispatcher/RideQueuePanel';
import DriverStatusPanel from '../../components/dispatcher/DriverStatusPanel';
import ActiveRidesPanel from '../../components/dispatcher/ActiveRidesPanel';
import RideHistoryPanel from '../../components/dispatcher/RideHistoryPanel';
import FleetMetricsPanel from '../../components/dispatcher/FleetMetricsPanel';
import ActionLogPanel from '../../components/dispatcher/ActionLogPanel';
import ManualAssignmentModal from '../../components/dispatcher/ManualAssignmentModal';

// Styles
import '../../styles/dispatcher.css';

const DispatcherDashboard = () => {
  const { user, hasPermission } = useAuth();
  const { 
    isConnected, 
    connectionQuality, 
    notifications, 
    removeNotification,
    clearNotifications 
  } = useSocket();

  // Dashboard state
  const [activePanel, setActivePanel] = useState('fleet'); // fleet, queue, drivers, active, history, metrics, log
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedRideForAssignment, setSelectedRideForAssignment] = useState(null);
  const [dashboardLayout, setDashboardLayout] = useState('desktop'); // desktop, tablet, mobile

  // Check dispatcher permissions
  useEffect(() => {
    if (!hasPermission('view_fleet')) {
      toast.error('Access denied: Dispatcher permissions required');
      // Redirect to appropriate dashboard based on user role
      window.location.href = '/';
    }
  }, [hasPermission]);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 1200) {
        setDashboardLayout('desktop');
      } else if (width >= 768) {
        setDashboardLayout('tablet');
      } else {
        setDashboardLayout('mobile');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle SOS alerts
  useEffect(() => {
    const sosNotifications = notifications.filter(n => n.type === 'sos_alert');
    if (sosNotifications.length > 0) {
      // Play urgent sound and show critical alert
      sosNotifications.forEach(notification => {
        toast.error(
          `🚨 SOS ALERT: ${notification.message}`,
          {
            position: 'top-center',
            autoClose: false,
            hideProgressBar: false,
            closeOnClick: false,
            pauseOnHover: false,
            draggable: false,
            className: 'sos-alert-toast'
          }
        );
      });
    }
  }, [notifications]);

  // Handle ride assignment request
  const handleAssignRide = (ride) => {
    setSelectedRideForAssignment(ride);
    setIsAssignmentModalOpen(true);
  };

  // Handle assignment completion
  const handleAssignmentComplete = () => {
    setIsAssignmentModalOpen(false);
    setSelectedRideForAssignment(null);
    toast.success('Ride assigned successfully');
  };

  // Connection status indicator
  const getConnectionStatusColor = () => {
    if (!isConnected) return '#f44336'; // Red
    switch (connectionQuality) {
      case 'excellent': return '#4caf50'; // Green
      case 'good': return '#8bc34a'; // Light green
      case 'poor': return '#ff9800'; // Orange
      default: return '#9e9e9e'; // Gray
    }
  };

  // Render desktop layout
  const renderDesktopLayout = () => (
    <div className="dispatcher-dashboard desktop-layout">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>🚕 WanRide Dispatch Center</h1>
          <span className="location-badge">📍 Port Moresby, PNG</span>
        </div>
        <div className="header-center">
          <div className="connection-status">
            <div 
              className="connection-indicator"
              style={{ backgroundColor: getConnectionStatusColor() }}
            />
            <span className="connection-text">
              {isConnected ? `${connectionQuality} connection` : 'Offline'}
            </span>
          </div>
        </div>
        <div className="header-right">
          <span className="dispatcher-name">👤 {user?.name}</span>
          <button 
            className="notifications-btn"
            onClick={clearNotifications}
            disabled={notifications.length === 0}
          >
            🔔 {notifications.length > 0 && <span className="notification-count">{notifications.length}</span>}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="dashboard-content">
        {/* Left sidebar */}
        <aside className="left-sidebar">
          <FleetMetricsPanel />
          <div className="sidebar-divider" />
          <DriverStatusPanel onCallDriver={(driverId) => console.log('Call driver:', driverId)} />
        </aside>

        {/* Center map */}
        <main className="center-map">
          <DispatcherMap 
            onMarkerClick={(driver) => console.log('Driver clicked:', driver)}
            onRideRouteClick={(ride) => console.log('Ride route clicked:', ride)}
          />
        </main>

        {/* Right panel */}
        <aside className="right-panel">
          <div className="panel-tabs">
            <button 
              className={`tab-btn ${activePanel === 'queue' ? 'active' : ''}`}
              onClick={() => setActivePanel('queue')}
            >
              📋 Queue ({0})
            </button>
            <button 
              className={`tab-btn ${activePanel === 'active' ? 'active' : ''}`}
              onClick={() => setActivePanel('active')}
            >
              🚕 Active ({0})
            </button>
            <button 
              className={`tab-btn ${activePanel === 'history' ? 'active' : ''}`}
              onClick={() => setActivePanel('history')}
            >
              📊 History
            </button>
          </div>

          <div className="panel-content">
            {activePanel === 'queue' && (
              <RideQueuePanel onAssignRide={handleAssignRide} />
            )}
            {activePanel === 'active' && (
              <ActiveRidesPanel />
            )}
            {activePanel === 'history' && (
              <RideHistoryPanel />
            )}
          </div>
        </aside>
      </div>

      {/* Bottom drawer */}
      <div className="bottom-drawer">
        <ActionLogPanel />
      </div>

      {/* Assignment modal */}
      {isAssignmentModalOpen && selectedRideForAssignment && (
        <ManualAssignmentModal
          ride={selectedRideForAssignment}
          onAssign={handleAssignmentComplete}
          onCancel={() => setIsAssignmentModalOpen(false)}
        />
      )}
    </div>
  );

  // Render tablet layout
  const renderTabletLayout = () => (
    <div className="dispatcher-dashboard tablet-layout">
      <header className="dashboard-header">
        <h1>🚕 WanRide Dispatch</h1>
        <div className="connection-status">
          <div 
            className="connection-indicator"
            style={{ backgroundColor: getConnectionStatusColor() }}
          />
          <span>{isConnected ? connectionQuality : 'Offline'}</span>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Map section */}
        <section className="map-section">
          <DispatcherMap 
            onMarkerClick={(driver) => console.log('Driver clicked:', driver)}
            onRideRouteClick={(ride) => console.log('Ride route clicked:', ride)}
          />
        </section>

        {/* Panels section */}
        <section className="panels-section">
          <div className="panel-tabs">
            <button 
              className={`tab-btn ${activePanel === 'queue' ? 'active' : ''}`}
              onClick={() => setActivePanel('queue')}
            >
              Queue
            </button>
            <button 
              className={`tab-btn ${activePanel === 'active' ? 'active' : ''}`}
              onClick={() => setActivePanel('active')}
            >
              Active
            </button>
            <button 
              className={`tab-btn ${activePanel === 'drivers' ? 'active' : ''}`}
              onClick={() => setActivePanel('drivers')}
            >
              Drivers
            </button>
            <button 
              className={`tab-btn ${activePanel === 'metrics' ? 'active' : ''}`}
              onClick={() => setActivePanel('metrics')}
            >
              Metrics
            </button>
          </div>

          <div className="panel-content">
            {activePanel === 'queue' && <RideQueuePanel onAssignRide={handleAssignRide} />}
            {activePanel === 'active' && <ActiveRidesPanel />}
            {activePanel === 'drivers' && <DriverStatusPanel />}
            {activePanel === 'metrics' && <FleetMetricsPanel />}
          </div>
        </section>
      </div>

      {/* Assignment modal */}
      {isAssignmentModalOpen && selectedRideForAssignment && (
        <ManualAssignmentModal
          ride={selectedRideForAssignment}
          onAssign={handleAssignmentComplete}
          onCancel={() => setIsAssignmentModalOpen(false)}
        />
      )}
    </div>
  );

  // Render mobile layout
  const renderMobileLayout = () => (
    <div className="dispatcher-dashboard mobile-layout">
      <header className="dashboard-header">
        <h1>🚕 Dispatch</h1>
        <div className="connection-indicator" style={{ backgroundColor: getConnectionStatusColor() }} />
      </header>

      <div className="mobile-tabs">
        <button 
          className={`mobile-tab ${activePanel === 'queue' ? 'active' : ''}`}
          onClick={() => setActivePanel('queue')}
        >
          📋 Queue
        </button>
        <button 
          className={`mobile-tab ${activePanel === 'active' ? 'active' : ''}`}
          onClick={() => setActivePanel('active')}
        >
          🚕 Active
        </button>
        <button 
          className={`mobile-tab ${activePanel === 'drivers' ? 'active' : ''}`}
          onClick={() => setActivePanel('drivers')}
        >
          👥 Drivers
        </button>
        <button 
          className={`mobile-tab ${activePanel === 'fleet' ? 'active' : ''}`}
          onClick={() => setActivePanel('fleet')}
        >
          🗺️ Map
        </button>
      </div>

      <div className="mobile-content">
        {activePanel === 'queue' && <RideQueuePanel onAssignRide={handleAssignRide} />}
        {activePanel === 'active' && <ActiveRidesPanel />}
        {activePanel === 'drivers' && <DriverStatusPanel />}
        {activePanel === 'fleet' && (
          <DispatcherMap 
            onMarkerClick={(driver) => console.log('Driver clicked:', driver)}
            onRideRouteClick={(ride) => console.log('Ride route clicked:', ride)}
          />
        )}
      </div>

      {/* Assignment modal */}
      {isAssignmentModalOpen && selectedRideForAssignment && (
        <ManualAssignmentModal
          ride={selectedRideForAssignment}
          onAssign={handleAssignmentComplete}
          onCancel={() => setIsAssignmentModalOpen(false)}
        />
      )}
    </div>
  );

  // Render loading state
  if (!user) {
    return (
      <div className="dispatcher-loading">
        <div className="loading-spinner" />
        <p>Loading dispatcher dashboard...</p>
      </div>
    );
  }

  // Render appropriate layout
  switch (dashboardLayout) {
    case 'desktop':
      return renderDesktopLayout();
    case 'tablet':
      return renderTabletLayout();
    case 'mobile':
      return renderMobileLayout();
    default:
      return renderDesktopLayout();
  }
};

export default DispatcherDashboard;
