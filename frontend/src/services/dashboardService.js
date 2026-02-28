// src/services/dashboardService.js
import api from '../utils/api';
import { getAccessToken } from '../utils/auth';

// Configure axios to use JWT token
const configureAxios = () => {
  const token = getAccessToken();
  if (token) {
    return { headers: { Authorization: `Bearer ${token}` } };
  }
  return {};
};

// Get dashboard statistics
export const getDashboardStats = async (schoolId = null, year = null) => {
  try {
    console.log('getDashboardStats called with schoolId:', schoolId);
    const config = configureAxios();
    console.log('Auth config:', config);
    console.log('Making request to: /api/dashboard-stats/');
    const response = await api.get('/api/dashboard-stats/', {
      ...config,
      params: { school_id: schoolId || undefined, year: year || undefined, _t: Date.now() },
      timeout: 45000
    });
    console.log('Dashboard stats response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    console.error('Error details:', error.response?.data);
    console.error('Error status:', error.response?.status);
    throw error;
  }
};

// Get current school ID from localStorage or set default
export const getCurrentSchoolId = () => {
  return localStorage.getItem('currentSchoolId') || null;
};

// Set current school ID
export const setCurrentSchoolId = (schoolId) => {
  localStorage.setItem('currentSchoolId', schoolId);
};
