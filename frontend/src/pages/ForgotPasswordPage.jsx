import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Stack, Typography, TextField, Button, Alert } from '@mui/material';
import api from '../utils/api';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/api/users/password/forgot/', {
        username: identifier,
        email: identifier.includes('@') ? identifier : undefined,
      });
      setMessage(res.data?.message || 'If the account exists, a reset link will be sent.');
      if (res.data?.debug_reset_url) {
        navigate(res.data.debug_reset_url.replace(/^https?:\/\/[^/]+/i, ''));
      }
    } catch (err) {
      setMessage('If the account exists, a reset link will be sent.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#f5f7fb' }}>
      <Paper sx={{ p: 3, width: 420 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Forgot Password</Typography>
        {message ? <Alert severity="info" sx={{ mb: 2 }}>{message}</Alert> : null}
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={2} component="form" onSubmit={onSubmit}>
          <TextField
            label="Username or Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Send Reset Link'}
          </Button>
          <Button variant="text" onClick={() => navigate('/login')}>
            Back to Login
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default ForgotPasswordPage;
