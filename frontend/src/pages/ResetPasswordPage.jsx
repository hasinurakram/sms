import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Paper, Stack, Typography, TextField, Button, Alert } from '@mui/material';
import api from '../utils/api';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { uid, token } = useParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/api/users/password/reset-confirm/', {
        uid,
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      if (res.data?.success) {
        setMessage('Password reset successful. Redirecting to login…');
        setTimeout(() => navigate('/login'), 1000);
      } else {
        setError(res.data?.error || 'Failed to reset password.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#f5f7fb' }}>
      <Paper sx={{ p: 3, width: 420 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Reset Password</Typography>
        {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={2} component="form" onSubmit={onSubmit}>
          <TextField
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <TextField
            type="password"
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Set New Password'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default ResetPasswordPage;
