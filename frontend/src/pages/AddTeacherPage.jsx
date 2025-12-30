import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import api from '../utils/api';
import { Box, Paper, Typography, TextField, Stack, Button, Alert, Chip, MenuItem } from '@mui/material';
import PhotoUpload from '../components/PhotoUpload';

export default function AddTeacherPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    educational_qualification: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  // Optional first assignment
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [assignment, setAssignment] = useState({ subject_id: '', classroom_id: '', section_id: '' });

  const [usernameCheck, setUsernameCheck] = useState({ loading: false, available: null, suggestions: [], msg: '' });
  const username = form.username.trim();

  useEffect(() => {
    // Load subjects and classrooms; sections will load when a class is selected
    const load = async () => {
      try {
        const [subj, classes] = await Promise.all([
          api.get(`/api/academics/subjects/?school=${id}`),
          api.get(`/api/academics/classrooms/?school=${id}`)
        ]);
        setSubjects(subj.data || []);
        setClassrooms(classes.data || []);
        setSections([]);
      } catch (e) {
        console.error("Error loading dropdown data:", e);
      }
    };
    load();
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

  // Load sections when classroom changes
  useEffect(() => {
    const cls = assignment.classroom_id;
    if (!cls) { setSections([]); return; }
    api.get(`/api/academics/sections/?classroom=${cls}`)
      .then(res => setSections(res.data || []))
      .catch(err => { console.error('Failed to load sections:', err); setSections([]); });
  }, [assignment.classroom_id]);

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
      // Backend expects school_id for teacher role creation
      fd.append('school_id', id);
      if (form.username) fd.append('username', form.username);
      if (form.password) fd.append('password', form.password);
      fd.append('first_name', form.first_name || '');
      fd.append('last_name', form.last_name || '');
      fd.append('email', form.email || '');
      fd.append('phone_number', form.phone_number || '');
      fd.append('educational_qualification', form.educational_qualification || '');
      if (photoFile) fd.append('photo', photoFile);

      const resp = await api.post('/api/users/teachers/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      // Optionally create first assignment if subject & classroom selected
      const teacherId = resp.data?.id || resp.data?.teacher?.id || resp.data?.user?.id;
      if (teacherId && assignment.subject_id && assignment.classroom_id) {
        try {
          await api.post('/api/academics/assignments/', {
            teacher: teacherId,
            subject: assignment.subject_id,
            classroom: assignment.classroom_id,
            section: assignment.section_id || null,
          });
        } catch (e) {
          // non-fatal
        }
      }
      navigate(`/school/${id}/teacher`);
    } catch (e) {
      const n = e.normalized || { message: 'Failed to add teacher', suggestions: [], fieldErrors: {} };
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
          Add Teacher
        </Typography>
        <Typography variant="body2" color="text.secondary">
          School ID: {id}
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Profile Photo (Optional)</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <PhotoUpload 
              currentPhoto={null} 
              onPhotoChange={(file) => {
                setPhotoFile(file);
                // Create preview URL if file exists
                if (file) {
                  const previewUrl = URL.createObjectURL(file);
                  // Clean up the URL when component unmounts
                  return () => URL.revokeObjectURL(previewUrl);
                }
              }} 
              userName={form.first_name || form.username || 'User'} 
            />
          </Box>

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

          <TextField label="Phone Number" value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} placeholder="+8801712345678" error={!!formErrors.phone_number} helperText={formErrors.phone_number || ''} />

          <TextField 
            label="শিক্ষাগত যোগ্যতা (Educational Qualification)" 
            value={form.educational_qualification} 
            onChange={e => setForm({ ...form, educational_qualification: e.target.value })} 
            placeholder="e.g., B.A., M.A., B.Ed., এম.এ., বি.এড."
            error={!!formErrors.educational_qualification} 
            helperText={formErrors.educational_qualification || 'Optional - শিক্ষাগত যোগ্যতা লিখুন'} 
          />

          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>Optional First Assignment</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField 
              select 
              label="Subject" 
              value={assignment.subject_id} 
              onChange={e => setAssignment({ ...assignment, subject_id: e.target.value })} 
              fullWidth
            >
              <MenuItem value="">Select Subject</MenuItem>
              {subjects.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
            <TextField 
              select 
              label="Class" 
              value={assignment.classroom_id} 
              onChange={e => setAssignment({ ...assignment, classroom_id: e.target.value })} 
              fullWidth
            >
              <MenuItem value="">Select Class</MenuItem>
              {classrooms.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
          <TextField 
            select 
            label="Section (Optional)" 
            value={assignment.section_id} 
            onChange={e => setAssignment({ ...assignment, section_id: e.target.value })} 
            fullWidth
            disabled={!assignment.classroom_id}
          >
            <MenuItem value="">No Section</MenuItem>
            {sections
              .filter(s => String(s.classroom) === String(assignment.classroom_id))
              .map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))
            }
          </TextField>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => navigate(-1)}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : 'Add Teacher'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
