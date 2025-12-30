import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import api from '../utils/api';
import { Box, Paper, Typography, TextField, Stack, Button, Alert, Chip } from '@mui/material';
import PhotoUpload from '../components/PhotoUpload';
import { useToast } from '../components/Toast';

export default function AddCommitteePage() {
  const { id } = useParams(); // school id
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    designation: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const toast = useToast();

  const [usernameCheck, setUsernameCheck] = useState({ loading: false, available: null, suggestions: [], msg: '' });
  const username = form.username.trim();

  useEffect(() => {
    if (!username) {
      setUsernameCheck({ loading: false, available: null, suggestions: [], msg: '' });
      return;
    }
    let cancelled = false;
    setUsernameCheck(prev => ({ ...prev, loading: true, msg: '' }));
    const h = setTimeout(async () => {
      try {
        const res = await api.get(`/api/users/username-availability/`, { params: { q: username } });
        if (cancelled) return;
        setUsernameCheck({ loading: false, available: res.data.available, suggestions: res.data.suggestions || [], msg: '' });
      } catch (e) {
        if (cancelled) return;
        setUsernameCheck({ loading: false, available: null, suggestions: [], msg: e?.response?.data?.error || 'Check failed' });
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(h); };
  }, [username]);

  const handleSubmit = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setError('');
    if (!form.username && !form.first_name) {
      setError('Provide either a username or a first name.');
      return;
    }
    if (form.username && usernameCheck.available === false) {
      setError('This username is already taken. Please choose another.');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('school_id', id);
      if (form.username) fd.append('username', form.username);
      if (form.password) fd.append('password', form.password);
      fd.append('first_name', form.first_name || '');
      fd.append('last_name', form.last_name || '');
      fd.append('email', form.email || '');
      fd.append('phone_number', form.phone_number || '');
      fd.append('designation', form.designation || '');
      if (photoFile) fd.append('photo', photoFile);
      await api.post('/api/users/committees/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Committee member created');
      navigate(`/school/${id}/committee`);
    } catch (e) {
      const n = e.normalized || { message: 'Failed to add committee member', suggestions: [], fieldErrors: {} };
      setError(n.message);
      setFormErrors(n.fieldErrors || {});
      if (n.suggestions?.length) setUsernameCheck(prev => ({ ...prev, available: false, suggestions: n.suggestions }));
    } finally {
      setSaving(false);
    }
  };

  const applySuggestion = (sug) => setForm(prev => ({ ...prev, username: sug }));

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Add Committee Member
        </Typography>
        <Typography variant="body2" color="text.secondary">
          School ID: {id}
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Profile Photo (Optional)</Typography>
          <PhotoUpload currentPhoto={null} onPhotoChange={setPhotoFile} userName={form.first_name || form.username || 'User'} />

          <TextField
            label="Username"
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            helperText={formErrors.username || (usernameCheck.loading ? 'Checking availability…' : usernameCheck.available === false ? 'Username not available' : 'Optional — auto-generated if left blank')}
            error={!!formErrors.username || usernameCheck.available === false}
          />

          {usernameCheck.available === false && usernameCheck.suggestions?.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {usernameCheck.suggestions.map((sug, i) => (
                <Chip key={i} label={sug} onClick={() => applySuggestion(sug)} clickable />
              ))}
            </Stack>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} helperText={formErrors.password || 'Optional — generated if blank'} error={!!formErrors.password} fullWidth />
            <TextField label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} fullWidth error={!!formErrors.email} helperText={formErrors.email || ''} />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="First Name" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} helperText={formErrors.first_name || 'Provide either a username or first name'} error={!!formErrors.first_name} fullWidth />
            <TextField label="Last Name" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} fullWidth error={!!formErrors.last_name} helperText={formErrors.last_name || ''} />
          </Stack>

          <TextField label="Designation" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="e.g., President, Secretary, Treasurer" error={!!formErrors.designation} helperText={formErrors.designation || 'Committee role or position'} fullWidth />

          <TextField label="Phone Number" value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} placeholder="+8801712345678" error={!!formErrors.phone_number} helperText={formErrors.phone_number || ''} />

          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => navigate(-1)}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : 'Add Committee Member'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
