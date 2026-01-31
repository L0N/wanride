import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionQuality, setConnectionQuality] = useState('unknown');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastOnlineTime, setLastOnlineTime] = useState(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setRetryCount(0);
      setIsRetrying(false);
      toast.success('📶 Connection restored!');
      checkConnectionQuality();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOnlineTime(new Date());
      toast.warning('📵 Connection lost - Working offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial connection quality check
    if (navigator.onLine) {
      checkConnectionQuality();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check connection quality
  const checkConnectionQuality = async () => {
    if (!navigator.onLine) {
      setConnectionQuality('offline');
      return;
    }

    try {
      // Use Network Information API if available
      if ('connection' in navigator) {
        const connection = navigator.connection;
        const effectiveType = connection.effectiveType;
        
        switch (effectiveType) {
          case 'slow-2g':
          case '2g':
            setConnectionQuality('poor');
            break;
          case '3g':
            setConnectionQuality('fair');
            break;
          case '4g':
            setConnectionQuality('good');
            break;
          default:
            setConnectionQuality('unknown');
        }
      } else {
        // Fallback: Test connection speed with a small request
        const startTime = Date.now();
        
        try {
          await fetch('/api/ping', { 
            method: 'HEAD',
            cache: 'no-cache',
            timeout: 3000
          });
          
          const responseTime = Date.now() - startTime;
          
          if (responseTime < 500) {
            setConnectionQuality('good');
          } else if (responseTime < 1500) {
            setConnectionQuality('fair');
          } else {
            setConnectionQuality('poor');
          }
        } catch (error) {
          setConnectionQuality('poor');
        }
      }
    } catch (error) {
      setConnectionQuality('unknown');
    }
  };

  // Retry connection
  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    try {
      // Test connection with a simple request
      const response = await fetch('/api/ping', {
        method: 'HEAD',
        cache: 'no-cache',
        timeout: 5000
      });
      
      if (response.ok) {
        setIsOnline(true);
        setRetryCount(0);
        toast.success('📶 Connection restored!');
        checkConnectionQuality();
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error) {
      toast.error(`Retry ${retryCount + 1} failed. Check your connection.`);
      
      // Exponential backoff for retries
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      setTimeout(() => {
        setIsRetrying(false);
      }, delay);
    }
  };

  // Get connection icon and color
  const getConnectionInfo = () => {
    if (!isOnline) {
      return {
        icon: '📵',
        text: 'Offline',
        color: '#f44336',
        bgColor: '#ffebee'
      };
    }

    switch (connectionQuality) {
      case 'good':
        return {
          icon: '📶',
          text: '4G/WiFi',
          color: '#4caf50',
          bgColor: '#e8f5e8'
        };
      case 'fair':
        return {
          icon: '📶',
          text: '3G',
          color: '#ff9800',
          bgColor: '#fff3e0'
        };
      case 'poor':
        return {
          icon: '📶',
          text: '2G/Slow',
          color: '#f44336',
          bgColor: '#ffebee'
        };
      default:
        return {
          icon: '📶',
          text: 'Online',
          color: '#2196f3',
          bgColor: '#e3f2fd'
        };
    }
  };

  // Format offline duration
  const getOfflineDuration = () => {
    if (!lastOnlineTime || isOnline) return '';
    
    const now = new Date();
    const diffMs = now - lastOnlineTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs}s`;
    }
    return `${diffSecs}s`;
  };

  const connectionInfo = getConnectionInfo();

  // Don't show banner if online with good connection
  if (isOnline && connectionQuality === 'good') {
    return null;
  }

  return (
    <div 
      className="offline-banner"
      style={{ 
        backgroundColor: connectionInfo.bgColor,
        borderColor: connectionInfo.color
      }}
    >
      <div className="banner-content">
        <div className="connection-status">
          <span className="connection-icon">{connectionInfo.icon}</span>
          <div className="connection-info">
            <span 
              className="connection-text"
              style={{ color: connectionInfo.color }}
            >
              {connectionInfo.text}
            </span>
            {!isOnline && lastOnlineTime && (
              <span className="offline-duration">
                Offline for {getOfflineDuration()}
              </span>
            )}
          </div>
        </div>

        <div className="banner-actions">
          {!isOnline && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="retry-btn"
            >
              {isRetrying ? (
                <>
                  <div className="loading-spinner small" />
                  Retrying...
                </>
              ) : (
                <>
                  🔄 Retry {retryCount > 0 && `(${retryCount})`}
                </>
              )}
            </button>
          )}
          
          {connectionQuality === 'poor' && (
            <button
              onClick={checkConnectionQuality}
              className="test-btn"
            >
              📊 Test Speed
            </button>
          )}
        </div>
      </div>

      {/* Offline mode information */}
      {!isOnline && (
        <div className="offline-info">
          <div className="offline-capabilities">
            <h4>📱 Offline Mode Active</h4>
            <div className="capability-list">
              <div className="capability-item available">
                <span className="capability-icon">✅</span>
                <span>View current shift information</span>
              </div>
              <div className="capability-item available">
                <span className="capability-icon">✅</span>
                <span>Complete active rides (sync later)</span>
              </div>
              <div className="capability-item available">
                <span className="capability-icon">✅</span>
                <span>Record cash payments</span>
              </div>
              <div className="capability-item unavailable">
                <span className="capability-icon">❌</span>
                <span>Receive new ride assignments</span>
              </div>
              <div className="capability-item unavailable">
                <span className="capability-icon">❌</span>
                <span>Real-time location updates</span>
              </div>
              <div className="capability-item warning">
                <span className="capability-icon">⚠️</span>
                <span>SOS alerts (queued until online)</span>
              </div>
            </div>
          </div>
          
          <div className="offline-tips">
            <h4>💡 Tips for Offline Mode</h4>
            <ul>
              <li>Move to an area with better signal</li>
              <li>Check if mobile data is enabled</li>
              <li>Restart your device if connection issues persist</li>
              <li>All data will sync when connection is restored</li>
            </ul>
          </div>
        </div>
      )}

      {/* Poor connection warning */}
      {isOnline && connectionQuality === 'poor' && (
        <div className="poor-connection-warning">
          <div className="warning-content">
            <span className="warning-icon">⚠️</span>
            <div className="warning-text">
              <strong>Slow Connection Detected</strong>
              <p>Some features may be delayed. Consider moving to an area with better signal.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineBanner;
