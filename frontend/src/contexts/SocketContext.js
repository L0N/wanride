import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

// Initial socket state
const initialState = {
  socket: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  reconnectAttempts: 0,
  lastPing: null,
  
  // Real-time data
  activeRides: [],
  driverLocations: new Map(),
  fleetStatus: {},
  notifications: [],
  
  // Connection quality for PNG networks
  connectionQuality: 'unknown', // 'excellent', 'good', 'poor', 'offline'
  latency: null
};

// Socket action types
const SOCKET_ACTIONS = {
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
  RECONNECT_ATTEMPT: 'RECONNECT_ATTEMPT',
  UPDATE_LATENCY: 'UPDATE_LATENCY',
  UPDATE_CONNECTION_QUALITY: 'UPDATE_CONNECTION_QUALITY',
  
  // Real-time data updates
  UPDATE_ACTIVE_RIDES: 'UPDATE_ACTIVE_RIDES',
  UPDATE_DRIVER_LOCATION: 'UPDATE_DRIVER_LOCATION',
  UPDATE_FLEET_STATUS: 'UPDATE_FLEET_STATUS',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  CLEAR_NOTIFICATIONS: 'CLEAR_NOTIFICATIONS'
};

// Socket reducer
function socketReducer(state, action) {
  switch (action.type) {
    case SOCKET_ACTIONS.CONNECTING:
      return {
        ...state,
        isConnecting: true,
        error: null
      };

    case SOCKET_ACTIONS.CONNECTED:
      return {
        ...state,
        socket: action.payload.socket,
        isConnected: true,
        isConnecting: false,
        error: null,
        reconnectAttempts: 0,
        lastPing: Date.now()
      };

    case SOCKET_ACTIONS.DISCONNECTED:
      return {
        ...state,
        isConnected: false,
        isConnecting: false,
        connectionQuality: 'offline'
      };

    case SOCKET_ACTIONS.ERROR:
      return {
        ...state,
        error: action.payload,
        isConnecting: false
      };

    case SOCKET_ACTIONS.RECONNECT_ATTEMPT:
      return {
        ...state,
        reconnectAttempts: state.reconnectAttempts + 1,
        isConnecting: true
      };

    case SOCKET_ACTIONS.UPDATE_LATENCY:
      return {
        ...state,
        latency: action.payload,
        lastPing: Date.now()
      };

    case SOCKET_ACTIONS.UPDATE_CONNECTION_QUALITY:
      return {
        ...state,
        connectionQuality: action.payload
      };

    case SOCKET_ACTIONS.UPDATE_ACTIVE_RIDES:
      return {
        ...state,
        activeRides: action.payload
      };

    case SOCKET_ACTIONS.UPDATE_DRIVER_LOCATION:
      const newDriverLocations = new Map(state.driverLocations);
      newDriverLocations.set(action.payload.driverId, action.payload.location);
      return {
        ...state,
        driverLocations: newDriverLocations
      };

    case SOCKET_ACTIONS.UPDATE_FLEET_STATUS:
      return {
        ...state,
        fleetStatus: { ...state.fleetStatus, ...action.payload }
      };

    case SOCKET_ACTIONS.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [action.payload, ...state.notifications.slice(0, 9)] // Keep last 10
      };

    case SOCKET_ACTIONS.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };

    case SOCKET_ACTIONS.CLEAR_NOTIFICATIONS:
      return {
        ...state,
        notifications: []
      };

    default:
      return state;
  }
}

// Create socket context
const SocketContext = createContext();

// Custom hook to use socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

// Socket provider component
export const SocketProvider = ({ children }) => {
  const [state, dispatch] = useReducer(socketReducer, initialState);
  const { user, token, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Calculate connection quality based on latency
  const calculateConnectionQuality = (latency) => {
    if (latency === null) return 'unknown';
    if (latency < 100) return 'excellent';
    if (latency < 300) return 'good';
    if (latency < 1000) return 'poor';
    return 'offline';
  };

  // Connect to socket server
  const connect = () => {
    if (socketRef.current?.connected || !isAuthenticated || !token) {
      return;
    }

    dispatch({ type: SOCKET_ACTIONS.CONNECTING });

    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    
    // Socket.io configuration optimized for PNG networks
    const socket = io(socketUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'], // Fallback to polling for poor connections
      timeout: 5000, // 5 second timeout for PNG conditions
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000, // Start with 2 seconds
      reconnectionDelayMax: 10000, // Max 10 seconds between attempts
      maxReconnectionAttempts: 10,
      forceNew: true
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[Socket] Connected to WanRide server');
      dispatch({
        type: SOCKET_ACTIONS.CONNECTED,
        payload: { socket }
      });

      // Join user-specific room based on role
      if (user?.roles) {
        user.roles.forEach(role => {
          socket.emit('join_room', `${role.toLowerCase()}_${user.id}`);
        });
      }

      // Start ping monitoring for connection quality
      startPingMonitoring();
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      dispatch({ type: SOCKET_ACTIONS.DISCONNECTED });
      stopPingMonitoring();

      // Auto-reconnect for certain disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        scheduleReconnect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      dispatch({
        type: SOCKET_ACTIONS.ERROR,
        payload: error.message
      });
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[Socket] Reconnection attempt ${attemptNumber}`);
      dispatch({ type: SOCKET_ACTIONS.RECONNECT_ATTEMPT });
    });

    // Real-time event handlers
    setupEventHandlers(socket);
  };

  // Setup real-time event handlers
  const setupEventHandlers = (socket) => {
    // Ride events
    socket.on('ride:assigned', (data) => {
      dispatch({
        type: SOCKET_ACTIONS.ADD_NOTIFICATION,
        payload: {
          id: Date.now(),
          type: 'ride_assigned',
          title: 'Ride Assigned',
          message: `New ride assigned to ${data.driverName}`,
          data: data,
          timestamp: new Date().toISOString()
        }
      });
    });

    socket.on('ride:status_update', (data) => {
      // Update active rides
      dispatch({
        type: SOCKET_ACTIONS.UPDATE_ACTIVE_RIDES,
        payload: data.activeRides || []
      });

      // Add notification for status changes
      dispatch({
        type: SOCKET_ACTIONS.ADD_NOTIFICATION,
        payload: {
          id: Date.now(),
          type: 'ride_update',
          title: 'Ride Update',
          message: `Ride ${data.rideId} status: ${data.status}`,
          data: data,
          timestamp: new Date().toISOString()
        }
      });
    });

    // Driver location updates
    socket.on('driver:location_update', (data) => {
      dispatch({
        type: SOCKET_ACTIONS.UPDATE_DRIVER_LOCATION,
        payload: {
          driverId: data.driverId,
          location: {
            lat: data.lat,
            lng: data.lng,
            heading: data.heading,
            speed: data.speed,
            timestamp: data.timestamp
          }
        }
      });
    });

    // Fleet status updates
    socket.on('fleet:update', (data) => {
      dispatch({
        type: SOCKET_ACTIONS.UPDATE_FLEET_STATUS,
        payload: data
      });
    });

    // SOS alerts
    socket.on('sos:alert', (data) => {
      dispatch({
        type: SOCKET_ACTIONS.ADD_NOTIFICATION,
        payload: {
          id: Date.now(),
          type: 'sos_alert',
          title: '🚨 SOS ALERT',
          message: `Emergency alert from ${data.driverName || 'Driver'}`,
          data: data,
          timestamp: new Date().toISOString(),
          urgent: true
        }
      });
    });

    // Ping response for latency monitoring
    socket.on('pong', (timestamp) => {
      const latency = Date.now() - timestamp;
      dispatch({
        type: SOCKET_ACTIONS.UPDATE_LATENCY,
        payload: latency
      });
      
      const quality = calculateConnectionQuality(latency);
      dispatch({
        type: SOCKET_ACTIONS.UPDATE_CONNECTION_QUALITY,
        payload: quality
      });
    });
  };

  // Start ping monitoring for connection quality
  const startPingMonitoring = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('ping', Date.now());
      }
    }, 5000); // Ping every 5 seconds
  };

  // Stop ping monitoring
  const stopPingMonitoring = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  // Schedule reconnection with exponential backoff
  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(2000 * Math.pow(2, state.reconnectAttempts), 30000);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!socketRef.current?.connected && isAuthenticated) {
        connect();
      }
    }, delay);
  };

  // Disconnect from socket server
  const disconnect = () => {
    stopPingMonitoring();
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    dispatch({ type: SOCKET_ACTIONS.DISCONNECTED });
  };

  // Emit socket event
  const emit = (event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
      return true;
    }
    return false;
  };

  // Join specific room
  const joinRoom = (room) => {
    return emit('join_room', room);
  };

  // Leave specific room
  const leaveRoom = (room) => {
    return emit('leave_room', room);
  };

  // Remove notification
  const removeNotification = (notificationId) => {
    dispatch({
      type: SOCKET_ACTIONS.REMOVE_NOTIFICATION,
      payload: notificationId
    });
  };

  // Clear all notifications
  const clearNotifications = () => {
    dispatch({ type: SOCKET_ACTIONS.CLEAR_NOTIFICATIONS });
  };

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && token && user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, token, user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPingMonitoring();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const value = {
    // State
    ...state,
    
    // Actions
    connect,
    disconnect,
    emit,
    joinRoom,
    leaveRoom,
    removeNotification,
    clearNotifications
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
