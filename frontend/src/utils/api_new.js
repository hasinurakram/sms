// src/utils/api.js
import axios from 'axios';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './auth';

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Request interceptor to add auth token and CSRF token
api.interceptors.request.use(
  (config) => {
    try {
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Add CSRF token for non-GET requests
      if (config.method !== 'get' && config.method !== 'GET') {
        const csrfToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('csrftoken='))
          ?.split('=')[1];
        
        if (csrfToken) {
          config.headers['X-CSRFToken'] = csrfToken;
        }
      }
    } catch (e) {
      console.error('Error in request interceptor:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          // Try to refresh the token
          const response = await axios.post(
            `${(process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')}/api/token/refresh/`,
            { refresh: refreshToken },
            { 
              withCredentials: true,
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              }
            }
          );
          
          if (response.data && response.data.access) {
            const { access } = response.data;
            saveTokens(access, refreshToken);
            
            // Retry the original request with the new token
            originalRequest.headers.Authorization = `Bearer ${access}`;
            return api(originalRequest);
          }
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        // If refresh fails, clear tokens and redirect to login
        clearTokens();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    
    // For other errors, just reject with the error
    return Promise.reject(error);
  }
);

export default api;
