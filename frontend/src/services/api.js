// src/services/api.js
import api from '../utils/api';

export async function fetchSchools() {
  const response = await api.get('/api/schools/');
  return response.data;
}

export async function fetchSchoolById(id) {
  const response = await api.get(`/api/schools/${id}/`);
  return response.data;
}
