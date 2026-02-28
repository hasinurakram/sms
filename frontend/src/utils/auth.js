// src/utils/auth.js
import api from './api';
import axios from 'axios';

// Save tokens to localStorage
export function saveTokens(access, refresh = null) {
  if (access) {
    localStorage.setItem('accessToken', access);
    api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
  }
  if (refresh) {
    localStorage.setItem('refreshToken', refresh);
  }
}

// Clear tokens from localStorage
export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  delete api.defaults.headers.common['Authorization'];
}

// Login function with fallback to session auth
export async function login(username, password) {
  try {
    clearTokens();
    const candidates = [
      (process.env.REACT_APP_API_URL || '').replace(/\/$/, ''),
      (typeof window !== 'undefined' ? window.location.origin : '').replace(/\/$/, ''),
      'http://127.0.0.1:8000',
      'http://localhost:8000'
    ].filter(Boolean);
    let lastErr;
    for (const origin of candidates) {
      try {
        const resp = await axios.post(`${origin}/api/token/`, { username, password }, { withCredentials: true });
        if (resp?.data?.access) {
          saveTokens(resp.data.access, resp.data.refresh);
          api.defaults.baseURL = origin;
          return { success: true, data: resp.data };
        }
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    if (lastErr) throw lastErr;
  } catch (error) {
    console.error('JWT Login failed, trying session auth:', error);
    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);
      const csrf = getCSRFToken();
      if (csrf) params.append('csrfmiddlewaretoken', csrf);
      const candidates = [
        (process.env.REACT_APP_API_URL || '').replace(/\/$/, ''),
        (typeof window !== 'undefined' ? window.location.origin : '').replace(/\/$/, ''),
        'http://127.0.0.1:8000',
        'http://localhost:8000'
      ].filter(Boolean);
      let okData = null;
      for (const origin of candidates) {
        try {
          const r = await axios.post(`${origin}/api/auth/login/`, params, { withCredentials: true, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' } });
          if (r?.data) {
            api.defaults.baseURL = origin;
            okData = r.data;
            break;
          }
        } catch (_) { continue; }
      }
      if (!okData) throw new Error('Session login failed');
      return { success: true, data: okData };
    } catch (sessionError) {
      console.error('Session login failed:', sessionError);
      throw sessionError;
    }
  }
}

// Logout function
export async function logout() {
  try {
    await api.post('/api/auth/logout/');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearTokens();
    window.location.href = '/login';
  }
}

// Get CSRF token from cookies
export function getCSRFToken() {
  const name = 'csrftoken=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(';');
  
  for (let i = 0; i < cookieArray.length; i++) {
    let c = cookieArray[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return '';
}

// Check if user is authenticated (require explicit access token)
export function isAuthenticated() {
  return !!localStorage.getItem('accessToken');
}

// Get access token
export function getAccessToken() {
  return localStorage.getItem('accessToken');
}

// Get refresh token
export function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}
