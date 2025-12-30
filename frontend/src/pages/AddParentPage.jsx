import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import api from '../utils/api';
import { Box, Paper, Typography, TextField, Stack, Button, Alert, Chip, Autocomplete, CircularProgress } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PhotoUpload from '../components/PhotoUpload';
import { useToast } from '../components/Toast';

export default function AddParentPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  // Optional first child link
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const toast = useToast();

  const [usernameCheck, setUsernameCheck] = useState({ loading: false, available: null, suggestions: [], msg: '' });
  const username = form.username.trim();

  // Preserve context: classroom/section from URL
  const [fromClassroom, setFromClassroom] = useState('');
  const [fromSection, setFromSection] = useState('');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cls = params.get('classroom');
      const sec = params.get('section');
      if (cls) setFromClassroom(String(cls));
      if (sec) setFromSection(String(sec));
    } catch (_) {}
  }, []);

  useEffect(() => {
    // Load students for optional link
    const load = async () => {
      try {
        const res = await api.get(`/api/academics/students/?school=${id}`);
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const sorted = [...data].sort((a, b) => {
          const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
          const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
          const aNum = Number.isNaN(ar) ? null : ar;
          const bNum = Number.isNaN(br) ? null : br;
          if (aNum !== null && bNum !== null) return aNum - bNum;
          const as = String(a?.roll_number ?? '');
          const bs = String(b?.roll_number ?? '');
          return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
        });
        setStudents(sorted);
      } catch (e) {
        // ignore
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
        const res = await api.get(`/api/users/username-availability/`, { 
          params: { 
            q: username,
            school_id: id  // Add school_id to check username uniqueness within school
          },
          headers: { 
            'X-Requested-With': 'XMLHttpRequest',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (!cancelled) {
          setUsernameCheck({ 
            loading: false, 
            available: res.data.available, 
            suggestions: res.data.suggestions || [], 
            msg: '' 
          });
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Username check error:', e);
          setUsernameCheck({ 
            loading: false, 
            available: null, 
            suggestions: [], 
            msg: e?.response?.data?.error || 'Check failed' 
          });
        }
      }
    }, 500);
    
    return () => {
      cancelled = true;
      clearTimeout(h);
    };
  }, [username, id]);

  const handleSubmit = async () => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    setError('');
    setFormErrors({});
    
    // Basic validation
    if (!form.first_name) {
      setError('অনুগ্রহ করে অভিভাবকের নাম লিখুন');
      setFormErrors({ first_name: 'নাম আবশ্যক' });
      return;
    }

    setSaving(true);
    
    try {
      // Get student data first if a student is selected
      let studentData = null;
      if (selectedStudentId) {
        try {
          const studentRes = await api.get(`/api/academics/students/${selectedStudentId}/`);
          studentData = studentRes.data;
          console.log('Student data:', studentData);
        } catch (err) {
          console.error('Error fetching student data:', err);
          throw new Error('শিক্ষার্থীর তথ্য লোড করতে সমস্যা হয়েছে');
        }
      }

      // Create form data for parent creation
      const cleanFormData = new FormData();
      
      // Add required fields
      cleanFormData.append('school_id', id);
      cleanFormData.append('username', form.username || `${form.phone_number || Date.now()}`);
      cleanFormData.append('password', form.password || '123456');
      cleanFormData.append('first_name', form.first_name);
      
      // Add optional fields if they have values
      if (form.last_name) cleanFormData.append('last_name', form.last_name);
      if (form.email) cleanFormData.append('email', form.email);
      if (form.phone_number) cleanFormData.append('phone_number', form.phone_number);
      if (photoFile) cleanFormData.append('photo', photoFile);
      
      // Set default role and status
      cleanFormData.append('role', 'parent');
      cleanFormData.append('is_active', 'true');
      
      console.log('Form data to submit:', Object.fromEntries(cleanFormData.entries()));
      
      // Create parent
      const resp = await api.post('/api/users/parents/', cleanFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      console.log('Parent created successfully:', resp.data);
      const parentData = resp.data;
      
      // If a student is selected, link the parent to the student
      if (selectedStudentId && studentData) {
        try {
          const studentUpdateData = new FormData();
          studentUpdateData.append('guardian', parentData.user.id);
          
          console.log('Linking parent to student:', {
            studentId: selectedStudentId,
            guardianId: parentData.user.id
          });
          
          // Update student with new guardian
          const updateResponse = await api.patch(
            `/api/academics/students/${selectedStudentId}/`,
            {
              guardian: parentData.user.id,
              guardian_id: parentData.user.id,
              guardian_user: parentData.user.id,
              guardian_username: parentData.user.username
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              }
            }
          );
          
          console.log('Successfully linked parent to student:', updateResponse.data);
          
          // Update the studentData with the updated information
          studentData = updateResponse.data;
          
        } catch (linkErr) {
          console.error('Error linking student:', linkErr);
          // Don't fail the entire operation if linking fails
          toast.warning('অভিভাবক যোগ করা হয়েছে, তবে শিক্ষার্থীর সাথে লিঙ্ক করতে সমস্যা হয়েছে');
        }
      }
      
      // Show success message
      toast.success('অভিভাবক সফলভাবে যোগ করা হয়েছে');
      
      // Navigate to parents list with a small delay to show the toast
      setTimeout(() => {
        // Prepare URL parameters
        const params = new URLSearchParams();
        
        // Always use the student's class/section for navigation
        const classroomId = studentData?.classroom?.id || studentData?.classroom;
        const sectionId = studentData?.section?.id || studentData?.section;
        
        if (classroomId) params.set('classroom', classroomId);
        if (sectionId) params.set('section', sectionId);
        
        // Ensure we're not in showAll mode
        params.set('showAll', '0');
        
        // Add parent ID to focus on the newly created parent
        if (parentData?.user?.id) {
          params.set('parent', parentData.user.id);
        }
        
        // Force refresh the data
        params.set('refresh', Date.now());
        
        console.log('Navigating with params:', params.toString());
        
        // Navigate using react-router for SPA behavior
        navigate(`/school/${id}/parent?${params.toString()}`, { replace: true });
      }, 1000);
      
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      
      // Handle different types of errors
      if (err.response) {
        // Server responded with an error status
        if (err.response.status === 401) {
          setError('আপনার লগইন সেশন শেষ হয়ে গেছে। দয়া করে আবার লগইন করুন।');
        } else if (err.response.data) {
          // Try to extract error message from response
          const data = err.response.data;
          if (typeof data === 'object') {
            const errorMessages = [];
            Object.entries(data).forEach(([field, messages]) => {
              if (Array.isArray(messages)) {
                errorMessages.push(...messages);
              } else if (typeof messages === 'string') {
                errorMessages.push(messages);
              }
            });
            setError(errorMessages.join(' ') || 'ফর্ম জমা দিতে সমস্যা হয়েছে');
          } else if (typeof data === 'string') {
            setError(data);
          } else {
            setError('সার্ভার থেকে ভুল রেসপন্স এসেছে');
          }
        } else {
          setError(`সার্ভার থেকে ${err.response.status} ত্রুটি পাওয়া গেছে`);
        }
      } else if (err.request) {
        // Request was made but no response received
        setError('সার্ভার থেকে কোনো রেসপন্স পাওয়া যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।');
      } else {
        // Something else happened
        setError(err.message || 'অভিভাবক যোগ করতে সমস্যা হয়েছে');
      }
    } finally {
      setSaving(false);
      console.log('Form submission finished');
    }
  };

  const applySuggestion = (sug) => setForm(prev => ({ ...prev, username: sug }));

  // Add a loading state that prevents interaction during submission
  if (saving) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '80vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={60} />
        <Typography variant="h6" color="primary">অভিভাবক যোগ করা হচ্ছে...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <div>
            <Typography variant="h4" gutterBottom>
              অভিভাবক যোগ করুন
            </Typography>
            <Typography variant="body2" color="text.secondary">
              স্কুল আইডি: {id}
            </Typography>
          </div>
          <Button 
            variant="outlined" 
            startIcon={<SaveIcon />}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Profile Photo (Optional)</Typography>
          <PhotoUpload currentPhoto={null} onPhotoChange={setPhotoFile} userName={form.first_name || form.username || 'User'} />

          <TextField
            label="ইউজারনেম"
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            helperText={formErrors.username || (usernameCheck.loading ? 'চেক করা হচ্ছে…' : usernameCheck.available === false ? 'ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হয়েছে' : 'ঐচ্ছিক - ফোন নম্বর ব্যবহার করা হবে')}
            error={!!formErrors.username || usernameCheck.available === false}
            fullWidth
          />

          {usernameCheck.available === false && usernameCheck.suggestions?.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {usernameCheck.suggestions.map((sug, i) => (
                <Chip key={i} label={sug} onClick={() => applySuggestion(sug)} clickable />
              ))}
            </Stack>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField 
              label="পাসওয়ার্ড" 
              type="password" 
              value={form.password} 
              onChange={e => setForm({ ...form, password: e.target.value })} 
              helperText={formErrors.password || 'ঐচ্ছিক - ডিফল্ট: 123456'} 
              error={!!formErrors.password} 
              fullWidth 
            />
            <TextField 
              label="ইমেইল" 
              type="email" 
              value={form.email} 
              onChange={e => setForm({ ...form, email: e.target.value })} 
              fullWidth 
              error={!!formErrors.email} 
              helperText={formErrors.email || ''} 
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField 
              label="নাম (আবশ্যক)" 
              value={form.first_name} 
              onChange={e => setForm({ ...form, first_name: e.target.value })} 
              helperText={formErrors.first_name || 'অভিভাবকের নাম লিখুন'} 
              error={!!formErrors.first_name} 
              fullWidth 
              required
            />
            <TextField 
              label="পদবী/উপাধি" 
              value={form.last_name} 
              onChange={e => setForm({ ...form, last_name: e.target.value })} 
              fullWidth 
              error={!!formErrors.last_name} 
              helperText={formErrors.last_name || ''} 
            />
          </Stack>

          <TextField 
            label="মোবাইল নম্বর" 
            value={form.phone_number} 
            onChange={e => setForm({ ...form, phone_number: e.target.value })} 
            placeholder="01XXXXXXXXX" 
            error={!!formErrors.phone_number} 
            helperText={formErrors.phone_number || 'বাংলাদেশি মোবাইল নম্বর লিখুন'} 
            inputProps={{ pattern: "01[3-9]\\d{8}" }}
          />

          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>শিক্ষার্থী লিংক করুন (ঐচ্ছিক)</Typography>
          <Autocomplete
            options={students || []}
            getOptionLabel={(s) => {
              try {
                const name = `${s?.user?.first_name || ''} ${s?.user?.last_name || ''}`.trim() || s?.user?.username || '';
                const cls = s?.classroom?.name ? ` — ${s.classroom.name}` : '';
                const sec = s?.section?.name ? ` (${s.section.name})` : '';
                const roll = s?.roll_number ? ` - রোল: ${s.roll_number}` : '';
                return `${name}${cls}${sec}${roll}`.trim() || 'নামবিহীন শিক্ষার্থী';
              } catch (_) { return 'অজানা শিক্ষার্থী'; }
            }}
            value={(students || []).find(s => String(s.id) === String(selectedStudentId)) || null}
            onChange={(e, val) => {
              console.log('Selected student:', val);
              setSelectedStudentId(val ? val.id : '');
            }}
            fullWidth
            noOptionsText="কোন শিক্ষার্থী পাওয়া যায়নি"
            renderInput={(params) => (
              <TextField
                {...params}
                label="শিক্ষার্থী নির্বাচন করুন"
                helperText="একজন শিক্ষার্থী নির্বাচন করলে নতুন অভিভাবক স্বয়ংক্রিয়ভাবে ঐ শিক্ষার্থীর সাথে যুক্ত হবেন"
              />
            )}
          />

          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button 
              variant="outlined" 
              onClick={() => navigate(-1)}
              disabled={saving}
              fullWidth
            >
              বাতিল
            </Button>
            <Button 
              variant="contained" 
              onClick={handleSubmit} 
              disabled={saving || !form.first_name}
              fullWidth
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            >
              {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
