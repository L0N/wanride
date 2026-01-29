import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

// Initial authentication state
const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  roles: [],
  permissions: []
};

// Authentication action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REFRESH_TOKEN: 'REFRESH_TOKEN',
  SET_LOADING: 'SET_LOADING',
  CLEAR_ERROR: 'CLEAR_ERROR',
  UPDATE_USER: 'UPDATE_USER'
};

// Authentication reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        roles: action.payload.user.roles || [],
        permissions: calculatePermissions(action.payload.user.roles || [])
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
        roles: [],
        permissions: []
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false
      };

    case AUTH_ACTIONS.REFRESH_TOKEN:
      return {
        ...state,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken
      };

    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
        roles: action.payload.roles || state.roles,
        permissions: calculatePermissions(action.payload.roles || state.roles)
      };

    default:
      return state;
  }
}

// Calculate user permissions based on roles
function calculatePermissions(roles) {
  const permissions = new Set();

  roles.forEach(role => {
    switch (role) {
      case 'PASSENGER':
        permissions.add('book_ride');
        permissions.add('view_ride_history');
        permissions.add('rate_driver');
        break;

      case 'DRIVER':
        permissions.add('accept_rides');
        permissions.add('complete_rides');
        permissions.add('update_location');
        permissions.add('view_earnings');
        break;

      case 'DISPATCHER':
        permissions.add('view_fleet');
        permissions.add('assign_rides');
        permissions.add('monitor_drivers');
        permissions.add('handle_sos');
        permissions.add('override_assignments');
        break;

      case 'OWNER':
        permissions.add('view_analytics');
        permissions.add('manage_fleet');
        permissions.add('manage_drivers');
        permissions.add('view_financials');
        permissions.add('export_reports');
        break;

      default:
        break;
    }
  });

  return Array.from(permissions);
}

// Create authentication context
const AuthContext = createContext();

// Custom hook to use authentication context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Authentication provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Configure axios defaults
  useEffect(() => {
    // Set base URL for PNG deployment
    axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    
    // Add request interceptor for authentication
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (state.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for token refresh
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await refreshToken();
            return axios(originalRequest);
          } catch (refreshError) {
            logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    // Cleanup interceptors
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [state.token]);

  // Load authentication state from localStorage on mount
  useEffect(() => {
    const loadAuthState = () => {
      try {
        const token = localStorage.getItem('wanride_token');
        const refreshToken = localStorage.getItem('wanride_refresh_token');
        const user = localStorage.getItem('wanride_user');

        if (token && refreshToken && user) {
          const userData = JSON.parse(user);
          dispatch({
            type: AUTH_ACTIONS.LOGIN_SUCCESS,
            payload: {
              token,
              refreshToken,
              user: userData
            }
          });
        } else {
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        }
      } catch (error) {
        console.error('Failed to load auth state:', error);
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    };

    loadAuthState();
  }, []);

  // Login function
  const login = async (credentials) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const response = await axios.post('/api/auth/login', credentials);
      const { token, refreshToken, user } = response.data;

      // Store in localStorage for persistence
      localStorage.setItem('wanride_token', token);
      localStorage.setItem('wanride_refresh_token', refreshToken);
      localStorage.setItem('wanride_user', JSON.stringify(user));

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { token, refreshToken, user }
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Register function
  const register = async (userData) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const response = await axios.post('/api/auth/register', userData);
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Verify OTP function
  const verifyOTP = async (phone, otp) => {
    try {
      const response = await axios.post('/api/auth/verify-otp', { phone, otp });
      const { token, refreshToken, user } = response.data;

      // Store in localStorage
      localStorage.setItem('wanride_token', token);
      localStorage.setItem('wanride_refresh_token', refreshToken);
      localStorage.setItem('wanride_user', JSON.stringify(user));

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { token, refreshToken, user }
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'OTP verification failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Refresh token function
  const refreshToken = async () => {
    try {
      const currentRefreshToken = localStorage.getItem('wanride_refresh_token');
      if (!currentRefreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post('/api/auth/refresh-token', {
        refreshToken: currentRefreshToken
      });

      const { token, refreshToken: newRefreshToken } = response.data;

      localStorage.setItem('wanride_token', token);
      localStorage.setItem('wanride_refresh_token', newRefreshToken);

      dispatch({
        type: AUTH_ACTIONS.REFRESH_TOKEN,
        payload: { token, refreshToken: newRefreshToken }
      });

      return { success: true };
    } catch (error) {
      logout();
      return { success: false, error: 'Token refresh failed' };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Call logout endpoint if token exists
      if (state.token) {
        await axios.post('/api/auth/logout');
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear localStorage
      localStorage.removeItem('wanride_token');
      localStorage.removeItem('wanride_refresh_token');
      localStorage.removeItem('wanride_user');

      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  // Update user function
  const updateUser = (userData) => {
    const updatedUser = { ...state.user, ...userData };
    localStorage.setItem('wanride_user', JSON.stringify(updatedUser));
    
    dispatch({
      type: AUTH_ACTIONS.UPDATE_USER,
      payload: userData
    });
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return state.roles.includes(role);
  };

  // Check if user has specific permission
  const hasPermission = (permission) => {
    return state.permissions.includes(permission);
  };

  // Get primary role for UI display
  const getPrimaryRole = () => {
    const roleHierarchy = ['OWNER', 'DISPATCHER', 'DRIVER', 'PASSENGER'];
    return roleHierarchy.find(role => state.roles.includes(role)) || 'PASSENGER';
  };

  const value = {
    // State
    ...state,
    
    // Actions
    login,
    register,
    verifyOTP,
    logout,
    refreshToken,
    updateUser,
    clearError,
    
    // Utilities
    hasRole,
    hasPermission,
    getPrimaryRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
