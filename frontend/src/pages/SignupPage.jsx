import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Paper, Stack, Typography, TextField, MenuItem, Button, Alert } from '@mui/material';
import api from '../utils/api';
import { isAuthenticated } from '../utils/auth';

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'parent', label: 'Parent' },
  { value: 'committee', label: 'Committee' },
  { value: 'student', label: 'Student' },
];

const SignupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search || '');
  const next = params.get('next') || '/';
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirm_password: '',
    school: '',
    role: 'teacher',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        role: form.role,
        school: form.school ? parseInt(form.school, 10) : undefined,
      };
      const res = await api.post('/api/users/register/', payload);
      setSuccess('Account created successfully. You can now log in.');
      setTimeout(() => {
        navigate(`/login?next=${encodeURIComponent(next)}`);
      }, 1000);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.response?.data?.role || err?.message || 'Failed to create account';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated()) {
    /* allow showing page but registration requires admin by default */
  }

  return (
    <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#f5f7fb' }}>
      <Paper sx={{ p: 3, width: 420 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Sign Up</Typography>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {success ? <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert> : null}
        <Stack spacing={2} component="form" onSubmit={submit}>
          <TextField name="username" label="Username" value={form.username} onChange={onChange} required />
          <TextField name="email" label="Email" value={form.email} onChange={onChange} />
          <Stack direction="row" spacing={1}>
            <TextField name="first_name" label="First Name" value={form.first_name} onChange={onChange} fullWidth />
            <TextField name="last_name" label="Last Name" value={form.last_name} onChange={onChange} fullWidth />
          </Stack>
          <TextField name="password" type="password" label="Password" value={form.password} onChange={onChange} required />
          <TextField name="confirm_password" type="password" label="Confirm Password" value={form.confirm_password} onChange={onChange} required />
          <TextField name="school" label="School ID" value={form.school} onChange={onChange} />
          <TextField name="role" label="Role" select value={form.role} onChange={onChange}>
            {roles.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained" fullWidth disabled={submitting}>
              {submitting ? 'Submitting...' : 'Create Account'}
            </Button>
            <Button variant="outlined" fullWidth onClick={() => navigate(`/login?next=${encodeURIComponent(next)}`)}>
              Login
            </Button>
          </Stack>
        </Stack>
        <Typography variant="body2" sx={{ mt: 2 }}>
          Registration may require admin privileges.
        </Typography>
      </Paper>
    </Box>
  );
};

export default SignupPage;
