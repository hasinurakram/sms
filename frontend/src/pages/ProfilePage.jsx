import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { isAuthenticated } from '../utils/auth';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Button,
  Stack,
  Divider,
  Chip,
  Card,
  CardContent,
  Avatar,
  IconButton,
  Tooltip
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SaveIcon from '@mui/icons-material/Save';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import BadgeIcon from '@mui/icons-material/Badge';
import SchoolIcon from '@mui/icons-material/School';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import PhotoUpload from '../components/PhotoUpload';
import { useToast } from '../components/Toast';
import { CardSkeleton } from '../components/LoadingSkeleton';

export default function ProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    school: '',
    classroom: '',
    section: '',
    category: ''
  });
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadProfile();
    loadOptions();
  }, []);

  const [schools, setSchools] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const loadOptions = async () => {
    try {
      const [schoolsRes] = await Promise.all([
        api.get('/api/schools/')
      ]);
      setSchools(Array.isArray(schoolsRes.data) ? schoolsRes.data : schoolsRes.data.results || []);
    } catch (e) {
      // ignore
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setUser({ first_name: '', last_name: '', email: '', phone_number: '' });
        setEditing(true);
        toast.info('Please login to load your profile, or create a new one.');
        setLoading(false);
        return;
      }
      const res = await api.get('/api/users/me/');
      console.log('Profile data:', res.data);
      
      if (!res.data || (!res.data.user && !res.data.profile)) {
        toast.error('Invalid profile data received');
        setLoading(false);
        return;
      }
      
      // Handle different API response formats
      const userData = res.data.user || res.data;
      const profileData = res.data.profile || {};
      
      setUser(userData);
      setProfile(profileData);
      
      setFormData({
        username: userData.username || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        phone_number: userData.phone_number || '',
        school: profileData.school?.id || userData.school || '',
        classroom: profileData.classroom?.id || '',
        section: profileData.section?.id || '',
        category: profileData.category?.id || profileData.category || ''
      });
      
      toast.success('Profile loaded successfully');
      setLoading(false);
    } catch (err) {
      console.error('Profile loading error:', err);
      
      // Handle 401 error specifically
      if (err.response && err.response.status === 401) {
        setLoading(false);
        setUser({
          first_name: '',
          last_name: '',
          email: '',
          phone_number: ''
        });
        setEditing(true); // Automatically go into edit mode
        toast.info('Please create your profile to continue');
        return;
      }
      
      toast.error('Failed to load profile: ' + (err.message || 'Unknown error'));
      setLoading(false);
    }
  };

  const handlePhotoChange = async (file) => {
    if (!file) {
      // Remove photo
      toast.info('Photo removal not implemented yet');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo size must be less than 5MB');
      return;
    }

    // Guard: ensure logged in
    const access = localStorage.getItem('accessToken');
    if (!access) {
      toast.info('Please login to upload a photo');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    try {
      setLoading(true);
      const res = await api.patch('/api/users/me/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Handle different API response formats
      const userData = res.data.user || res.data;
      setUser(userData);
      
      toast.success('Photo uploaded successfully!');
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error('Failed to upload photo: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
  const handlePasswordChange = (e) => {
    setPasswordForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Check if we're creating a new profile or updating existing one
      if (!user.id) {
        // If unauthenticated/new user: register, login, then create profile and set school
        const first = (formData.first_name || '').trim();
        if (!first) {
          toast.error('Please enter first name');
          setLoading(false);
          return;
        }
        let base = first;
        try {
          base = first.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
        } catch (_) {
          base = first.toLowerCase().replace(/\s+/g, '');
        }
        const suffix = String(Math.floor(Math.random() * 900) + 100);
        const username = `${base}${suffix}`;
        const emailCandidate = (formData.email || '').trim() || `${base}.${id || 'school'}@example.com`;

        // 1) Register lightweight account
        try {
          await api.post('/api/users/register/', {
            username,
            email: emailCandidate,
            password: '12345678',
            confirm_password: '12345678',
            first_name: first,
            last_name: formData.last_name || ''
          });
        } catch (e) {
          throw e;
        }

        // 2) Login to obtain JWT
        try {
          const { login } = await import('../utils/auth');
          await login(username, '12345678');
        } catch (e) {
          throw e;
        }

        // 3) Create profile for current user
        const createRes = await api.post('/api/users/me/create_profile/', {
          role: 'student'
        });

        // 4) Set school (and optional classroom/section) on profile via profile endpoint
        try {
          const schoolId = formData.school || id;
          if (schoolId) {
            await api.patch('/api/users/profile/', { school: schoolId });
          }
        } catch (_) {}

        const userData = createRes.data.user || createRes.data;
        setUser(userData);
        setEditing(false);
        setFormErrors({});
        toast.success('Profile created successfully!');
      } else {
        // Update existing profile (user fields)
        let uname = formData.username;
        if (typeof uname === 'string') {
          try {
            uname = uname.normalize('NFKC').trim();
          } catch (_) {}
        }
        const userPayload = {
          username: uname,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone_number: formData.phone_number
        };
        const ures = await api.patch('/api/users/me/', userPayload);
        const userData = ures.data.user || ures.data;
        setUser(userData);

        // Change password if provided
        if (passwordForm.new_password) {
          if (!passwordForm.old_password) {
            toast.error('পুরানো পাসওয়ার্ড দিন');
          } else if (passwordForm.new_password !== passwordForm.confirm_password) {
            toast.error('নতুন পাসওয়ার্ড মিলছে না');
          } else {
            try {
              const pres = await api.post('/api/users/password/change/', passwordForm);
              if (pres.data?.success) {
                toast.success('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে');
                setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
              } else {
                toast.error(pres.data?.error || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ');
              }
            } catch (e) {
              toast.error(e.response?.data?.error || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ');
            }
          }
        }

        setEditing(false);
        setFormErrors({});
        toast.success('প্রোফাইল আপডেট হয়েছে');
      }
      
      // Reload profile to ensure we have the latest data
      loadProfile();
    } catch (err) {
      console.error('Profile update error:', err);
      const n = err.normalized || { message: 'Failed to update profile', fieldErrors: {}, suggestions: [] };
      setFormErrors(n.fieldErrors || {});
      toast.error(n.message);
      if (n.suggestions?.length) toast.info('Suggestions: ' + n.suggestions.join(', '));
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Paper 
          elevation={0}
          sx={{ 
            mb: 3, 
            p: 3, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: 3
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                My Profile
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Loading your profile information...
              </Typography>
            </Box>
          </Stack>
        </Paper>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <CardSkeleton count={1} height={300} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <CardSkeleton count={1} height={500} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>No profile data available</Typography>
      </Box>
    );
  }

  const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;

  return (
    <Box sx={{ p: 3 }}>
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3, 
          p: 3, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 3
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              My Profile
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Manage your personal information and settings
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh Profile">
              <IconButton 
                color="inherit" 
                onClick={loadProfile}
                sx={{ bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Chip 
              label={profile?.role?.toUpperCase() || 'USER'} 
              sx={{ 
                fontWeight: 'bold',
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontSize: '1rem',
                px: 2,
                py: 3
              }}
            />
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={3}>
        {/* Photo Section */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3, boxShadow: 3 }}>
            <PhotoUpload
              currentPhoto={user.photo_url}
              onPhotoChange={handlePhotoChange}
              userName={userName}
            />
            
            <Divider sx={{ my: 3 }} />
            
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
              {userName}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
              @{user.username}
            </Typography>
            <Chip 
              label={profile?.role || 'User'} 
              color="primary"
              sx={{ fontWeight: 'bold', px: 2, py: 2.5 }}
            />
            
            {/* Quick Info Cards */}
            <Stack spacing={2} sx={{ mt: 3 }}>
              {user.email && (
                <Card variant="outlined" sx={{ textAlign: 'left' }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <EmailIcon color="primary" fontSize="small" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Email</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{user.email}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              )}
              
              {user.phone_number && (
                <Card variant="outlined" sx={{ textAlign: 'left' }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PhoneIcon color="success" fontSize="small" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Phone</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{user.phone_number}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              )}
              
              {profile?.school && (
                <Card variant="outlined" sx={{ textAlign: 'left' }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <SchoolIcon color="secondary" fontSize="small" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">School</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{profile.school.name}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Details Section */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Personal Information</Typography>
                <Typography variant="body2" color="text.secondary">Update your personal details</Typography>
              </Box>
              {!editing && (
                <Button 
                  variant="contained" 
                  startIcon={<EditIcon />}
                  onClick={() => {
                    if (!isAuthenticated()) {
                      navigate('/login');
                      return;
                    }
                    setEditing(true);
                  }}
                  sx={{ borderRadius: 2 }}
                >
                  Edit Profile
                </Button>
              )}
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  fullWidth
                  disabled={!editing}
                  error={!!formErrors.first_name}
                  helperText={formErrors.first_name || ''}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  fullWidth
                  disabled={!editing}
                  error={!!formErrors.last_name}
                  helperText={formErrors.last_name || ''}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  fullWidth
                  disabled={!editing}
                  error={!!formErrors.email}
                  helperText={formErrors.email || ''}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Phone Number"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  placeholder="+8801712345678"
                  helperText={formErrors.phone_number || 'Include country code (e.g., +880)'}
                  error={!!formErrors.phone_number}
                  fullWidth
                  disabled={!editing}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Username (Login ID)"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  fullWidth
                  disabled={!editing}
                  error={!!formErrors.username}
                  helperText={formErrors.username || ''}
                />
              </Grid>

              {/* Editable selects when in editing mode */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="School"
                  name="school"
                  value={formData.school}
                  onChange={(e) => {
                    handleInputChange(e);
                    // when school changes, clear class/section options and reload classes
                    setClasses([]);
                    setSections([]);
                    const sid = e.target.value;
                    if (sid) {
                      api.get(`/api/academics/classrooms/?school=${sid}`).then(res => {
                        setClasses(res.data || []);
                      }).catch(() => setClasses([]));
                    }
                  }}
                  disabled={!editing}
                  fullWidth
                  helperText={formErrors.school || ''}
                  SelectProps={{ native: false }}
                >
                  <MenuItem value="">Select School</MenuItem>
                  {schools.map(s => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Class"
                  name="classroom"
                  value={formData.classroom}
                  onChange={(e) => {
                    handleInputChange(e);
                    const cid = e.target.value;
                    if (!cid) { setSections([]); return; }
                    api.get(`/api/academics/sections/?classroom=${cid}`).then(res => setSections(res.data || [])).catch(() => setSections([]));
                  }}
                  disabled={!editing || !formData.school}
                  fullWidth
                  helperText={formErrors.classroom || ''}
                  SelectProps={{ native: false }}
                >
                  <MenuItem value="">Select Class</MenuItem>
                  {classes.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Section"
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  disabled={!editing || !formData.classroom}
                  fullWidth
                  helperText={formErrors.section || ''}
                >
                  <MenuItem value="">No Section</MenuItem>
                  {sections.map(sec => (
                    <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  disabled={!editing}
                  fullWidth
                  helperText={formErrors.category || 'Optional'}
                />
              </Grid>
            </Grid>

            {editing && (
              <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                >
                  Save Changes
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      username: user.username || '',
                      first_name: user.first_name || '',
                      last_name: user.last_name || '',
                      email: user.email || '',
                      phone_number: user.phone_number || '',
                      school: profile?.school?.id || '',
                      classroom: profile?.classroom?.id || '',
                      section: profile?.section?.id || '',
                      category: profile?.category || ''
                    });
                    setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
                  }}
                >
                  Cancel
                </Button>
              </Stack>
            )}
          </Paper>
        </Grid>
        {/* Password change section */}
        {editing && (
          <Grid size={{ xs: 12, md: 8 }} sx={{ mt: 3 }}>
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>Change Password</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    type="password"
                    label="Old Password"
                    name="old_password"
                    value={passwordForm.old_password}
                    onChange={handlePasswordChange}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    type="password"
                    label="New Password"
                    name="new_password"
                    value={passwordForm.new_password}
                    onChange={handlePasswordChange}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    type="password"
                    label="Confirm New Password"
                    name="confirm_password"
                    value={passwordForm.confirm_password}
                    onChange={handlePasswordChange}
                    fullWidth
                  />
                </Grid>
              </Grid>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                নোট: পাসওয়ার্ড পরিবর্তন করতে চাইলে উপরের ফিল্ডগুলো পূরণ করুন; না হলে ফাঁকা রাখুন।
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
