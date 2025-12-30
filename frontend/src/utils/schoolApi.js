// src/utils/schoolApi.js
import api from './api';

// Helper that injects ?school=ID and a cache buster _t into GETs
export function scopedGet(path, schoolId, extraParams = {}, config = {}) {
  const params = { ...(extraParams || {}) };
  if (schoolId && !('school' in params) && !/\bschool=/.test(path)) {
    params.school = schoolId;
  }
  params._t = Date.now();
  const mergedParams = { ...(config && config.params ? config.params : {}), ...params };
  const finalConfig = { ...(config || {}), params: mergedParams };
  return api.get(path, finalConfig);
}

// Helper for POST that guarantees school is present in body
export function scopedPost(path, schoolId, body = {}, config = {}) {
  const payload = { ...(body || {}) };
  if (schoolId && !('school' in payload)) payload.school = schoolId;
  return api.post(path, payload, config);
}

// Helper for FormData POST
export function scopedPostForm(path, schoolId, formData) {
  const fd = formData instanceof FormData ? formData : new FormData();
  if (schoolId && !fd.has('school')) fd.append('school', schoolId);
  return api.post(path, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
}

// === EXAMINATION UTILITIES ===

// Get all examinations for a school
export function getExaminations(schoolId, filters = {}) {
  return scopedGet('/api/results/examinations/', schoolId, filters);
}

// Create a new examination
export function createExamination(schoolId, examData) {
  return scopedPost('/api/results/examinations/', schoolId, examData);
}

// Update an examination
export function updateExamination(examId, examData) {
  return api.put(`/api/results/examinations/${examId}/`, examData);
}

// Delete an examination
export function deleteExamination(examId) {
  return api.delete(`/api/results/examinations/${examId}/`);
}

// Get examination by ID
export function getExamination(examId) {
  return api.get(`/api/results/examinations/${examId}/`);
}

// Bulk upload results for an examination
export function bulkUploadResults(examId, resultsData) {
  return api.post(`/api/results/examinations/${examId}/bulk_results/`, {
    results: resultsData
  });
}
