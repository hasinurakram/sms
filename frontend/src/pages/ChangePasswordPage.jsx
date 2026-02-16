import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Stack, Typography, TextField, Button, Alert } from '@mui/material';
import api from '../utils/api';

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
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
      const res = await api.post('/api/users/password/change/', {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      if (res.data?.success) {
        setMessage('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে');
        setTimeout(() => navigate(-1), 1000);
      } else {
        setError(res.data?.error || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#f5f7fb' }}>
      <Paper sx={{ p: 3, width: 420 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>পাসওয়ার্ড পরিবর্তন</Typography>
        {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={2} component="form" onSubmit={onSubmit}>
          <TextField type="password" label="পুরানো পাসওয়ার্ড" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
          <TextField type="password" label="নতুন পাসওয়ার্ড" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <TextField type="password" label="নিশ্চিত পাসওয়ার্ড" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'সাবমিট হচ্ছে…' : 'পাসওয়ার্ড আপডেট'}
          </Button>
          <Button variant="text" onClick={() => navigate(-1)}>ব্যাক</Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default ChangePasswordPage;
