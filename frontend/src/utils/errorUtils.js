// src/utils/errorUtils.js
// Normalize API errors into a consistent, user-friendly shape
export function normalizeApiError(err) {
  const def = {
    title: 'Invalid input',
    message: 'Please review the highlighted fields and try again.',
    fieldErrors: {},
    suggestions: [],
    status: err?.response?.status || null,
  };

  // Network/timeout
  if (!err?.response) {
    return {
      ...def,
      title: 'Network error',
      message: 'Unable to reach the server. Check your internet connection and try again.',
      suggestions: ['Ensure the backend is running', 'Verify your network connection'],
    };
  }

  const data = err.response.data || {};

  // Simple string detail
  if (typeof data === 'string') {
    return { ...def, message: data };
  }

  // DRF ValidationError style: field: [messages]
  const fieldErrors = {};
  Object.keys(data || {}).forEach((k) => {
    if (Array.isArray(data[k])) {
      fieldErrors[k] = data[k][0];
    }
  });

  let message = data.detail || data.error || null;

  // Username taken + suggestions
  let suggestions = [];
  if (data.suggestions && Array.isArray(data.suggestions)) {
    suggestions = data.suggestions;
  }

  // Friendly hints for common fields
  if (fieldErrors.username?.toLowerCase().includes('taken')) {
    suggestions = suggestions.length ? suggestions : suggestions.concat(['Try adding a number to the end of the username', 'Combine first and last name']);
  }

  if (fieldErrors.password?.toLowerCase().includes('short')) {
    suggestions.push('Use at least 8 characters');
  }

  if (fieldErrors.phone_number) {
    suggestions.push('Include country code, e.g., +8801712345678');
  }

  // Missing minimal requirements
  if (!message && Object.keys(fieldErrors).length === 0) {
    if (def.status === 400) {
      message = 'Some inputs look incomplete or invalid. Please review and try again.';
    } else if (def.status >= 500) {
      message = 'Server encountered an issue. Please try again shortly.';
    }
  }

  // Default message if still none
  if (!message) {
    message = 'Please correct the highlighted inputs and try again.';
  }

  return { ...def, message, fieldErrors, suggestions };
}
