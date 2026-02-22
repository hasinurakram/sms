// src/utils/api.js
import axios from 'axios';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './auth';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
  timeout: 60000,
  withCredentials: true,
});

// Request interceptor to add auth token and CSRF token
api.interceptors.request.use(
  (config) => {
    try {
      // If sending FormData, let the browser set the multipart boundary
      const isFormData = (d) => {
        if (!d) return false;
        if (typeof FormData !== 'undefined' && d instanceof FormData) return true;
        return typeof d.append === 'function' && (d[Symbol.toStringTag] === 'FormData' || d.constructor?.name === 'FormData');
      };
      if (isFormData(config.data)) {
        if (config.headers && config.headers['Content-Type']) {
          delete config.headers['Content-Type'];
        }
      }

      const token = getAccessToken();
      const method = (config.method || 'get').toLowerCase();
      const urlPath = (config.url || '').toString();
      const isPublicGet =
        method === 'get' &&
        (
          /^\/?api\/schools\/?(\?.*)?$/i.test(urlPath) ||
          /^\/?api\/schools\/\d+\/?(\?.*)?$/i.test(urlPath)
        );
      const isAuthEndpoint = /^\/?api\/(token\/?|auth\/login\/?|users\/login\/?)$/i.test(urlPath);

      if (token && !isPublicGet && !isAuthEndpoint) {
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

    // Retry GET requests on timeout or transient server errors
    const isGet = (originalRequest?.method || '').toLowerCase() === 'get';
    const status = error.response?.status;
    const isTimeout = error.code === 'ECONNABORTED';
    const isTransient = status === 502 || status === 503 || status === 504;
    if (isGet && (isTimeout || isTransient)) {
      originalRequest._retryCount = originalRequest._retryCount || 0;
      if (originalRequest._retryCount < 2) {
        originalRequest._retryCount += 1;
        const backoffMs = 500 * Math.pow(2, originalRequest._retryCount - 1);
        await new Promise((res) => setTimeout(res, backoffMs));
        return api(originalRequest);
      }
    }

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
            { withCredentials: true }
          );

          const { access } = response.data;
          saveTokens(access, refreshToken);

          // Retry the original request with the new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        // If refresh fails and this was a GET, try once without Authorization (public endpoints)
        const isGet = (originalRequest?.method || '').toLowerCase() === 'get';
        if (isGet && !originalRequest._retryNoAuth) {
          originalRequest._retryNoAuth = true;
          // Remove Authorization header and tokens for this retry only
          if (originalRequest.headers) {
            delete originalRequest.headers.Authorization;
          }
          return api(originalRequest);
        }
        // Otherwise, clear tokens and redirect to login
        clearTokens();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    // For other errors, just reject with the error
    return Promise.reject(error);
  }
);

export default api;
