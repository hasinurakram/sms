// src/utils/auth.js
import api from './api';

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
  localStorage.removeItem('currentSchoolId');
  delete api.defaults.headers.common['Authorization'];
}

// Login function with fallback to session auth
export async function login(username, password) {
  try {
    // Try JWT login first
    const response = await api.post('/api/token/', { username, password });
    saveTokens(response.data.access, response.data.refresh);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('JWT Login failed, trying session auth:', error);
    try {
      // Fallback to session auth
      const sessionResponse = await api.post('/api/auth/login/', { 
        username, 
        password,
        csrfmiddlewaretoken: getCSRFToken()
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      return { success: true, data: sessionResponse.data };
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
