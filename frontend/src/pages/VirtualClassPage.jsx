import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  TextField,
  Chip,
  Paper,
  IconButton,
  CircularProgress
} from '@mui/material';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import StopIcon from '@mui/icons-material/Stop';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import { useToast } from '../components/Toast';
import { isAuthenticated } from '../utils/auth';

const VirtualClassPage = () => {
  const { id: schoolId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [activeClasses, setActiveClasses] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Create Class Dialog
  const [open, setOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [creating, setCreating] = useState(false);

  // Live Class State
  const [currentClass, setCurrentClass] = useState(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get('/api/users/me/');
      // res.data will be { user: { ... }, profile: { role: ... } }
      setUser(res.data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  }, []);

  const fetchActiveClasses = useCallback(async () => {
    try {
      const res = await api.get(`/api/academics/virtual-classes/?school=${schoolId}&active=true`);
      setActiveClasses(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch active classes:', err);
    }
  }, [schoolId]);

  const fetchMyAssignments = useCallback(async (userId, userData) => {
    const currentUser = userData || user;
    const targetUserId = userId || currentUser?.user?.id;
    if (!targetUserId && !currentUser?.user?.is_superuser) return;
    
    try {
      const isAdmin = currentUser?.user?.is_superuser || currentUser?.user?.is_staff || currentUser?.profile?.role === 'admin';
      const url = isAdmin 
        ? `/api/academics/assignments/?school=${schoolId}`
        : `/api/academics/assignments/?school=${schoolId}&teacher=${targetUserId}`;
        
      const res = await api.get(url);
      setMyAssignments(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
    }
  }, [schoolId, user]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    const init = async () => {
      setLoading(true);
      try {
        const [userRes, classesRes] = await Promise.all([
          api.get('/api/users/me/'),
          api.get(`/api/academics/virtual-classes/?school=${schoolId}&active=true`)
        ]);
        
        setUser(userRes.data);
        setActiveClasses(classesRes.data.results || classesRes.data || []);
        
        const userId = userRes.data?.user?.id;
        if (userId || userRes.data?.user?.is_superuser) {
          await fetchMyAssignments(userId, userRes.data);
        }
      } catch (err) {
        console.error('Initialization failed:', err);
      } finally {
        setLoading(false);
      }
    };
    
    init();
  }, [schoolId, navigate, fetchActiveClasses, fetchMyAssignments]);

  const handleStartClass = async () => {
    if (!selectedAssignment) return;
    
    const assignment = myAssignments.find(a => a.id === selectedAssignment);
    if (!assignment) return;

    setCreating(true);
    try {
      const payload = {
        school: schoolId,
        classroom: assignment.classroom.id,
        section: assignment.section?.id || null,
        subject: assignment.subject.id,
      };
      const res = await api.post('/api/academics/virtual-classes/', payload);
      setCurrentClass(res.data);
      setOpen(false);
      toast.success('ভার্চুয়াল ক্লাস শুরু হয়েছে');
      fetchActiveClasses();
    } catch (err) {
      console.error('Failed to start class:', err);
      toast.error('ক্লাস শুরু করতে সমস্যা হয়েছে');
    } finally {
      setCreating(false);
    }
  };

  const handleEndClass = async (classId) => {
    try {
      await api.post(`/api/academics/virtual-classes/${classId}/end_class/`);
      if (currentClass?.id === classId) setCurrentClass(null);
      toast.success('ক্লাস সমাপ্ত হয়েছে');
      fetchActiveClasses();
    } catch (err) {
      console.error('Failed to end class:', err);
      toast.error('ক্লাস শেষ করতে সমস্যা হয়েছে');
    }
  };

  const joinClass = (vclass) => {
    // Generate Jitsi Link
    // In a real app, we'd embed Jitsi iframe here
    const jitsiUrl = `https://meet.jit.si/${vclass.meeting_id}`;
    window.open(jitsiUrl, '_blank');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Handle both user with profile and superuser without profile
  const role = user?.profile?.role || (user?.user?.is_superuser || user?.user?.is_staff ? 'admin' : '');
  const isTeacher = role === 'teacher' || role === 'admin' || user?.user?.is_superuser || user?.user?.is_staff;
  const currentUserId = user?.user?.id;

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a237e' }}>
          ভার্চুয়াল ক্লাস (Live)
        </Typography>
        {isTeacher && (
          <Button
            variant="contained"
            startIcon={<VideoCallIcon />}
            onClick={() => setOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            নতুন ক্লাস শুরু করুন
          </Button>
        )}
      </Stack>

      <Typography variant="h6" mb={2} sx={{ fontWeight: 600 }}>
        চলমান ক্লাসসমূহ
      </Typography>

      {activeClasses.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5', borderRadius: 3, mb: 4 }}>
          <SchoolIcon sx={{ fontSize: 60, color: '#bdbdbd', mb: 2 }} />
          <Typography color="textSecondary">এই মুহূর্তে কোনো লাইভ ক্লাস চলছে না</Typography>
        </Paper>
      ) : (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {activeClasses.map((vclass) => (
            <Grid item xs={12} sm={6} md={4} key={vclass.id}>
              <Card sx={{ borderRadius: 3, boxShadow: 3, borderLeft: '6px solid #4caf50' }}>
                <CardHeader
                  avatar={<Avatar sx={{ bgcolor: '#1a237e' }}><PersonIcon /></Avatar>}
                  title={vclass.subject_name}
                  subheader={`${vclass.classroom_name} ${vclass.section_name ? `(${vclass.section_name})` : ''}`}
                />
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    শিক্ষক: {vclass.teacher_name}
                  </Typography>
                  <Typography variant="caption" display="block" color="textSecondary">
                    শুরু হয়েছে: {new Date(vclass.started_at).toLocaleTimeString()}
                  </Typography>
                </CardContent>
                <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    onClick={() => joinClass(vclass)}
                    sx={{ borderRadius: 2 }}
                  >
                    জয়েন করুন
                  </Button>
                  {isTeacher && (vclass.teacher === currentUserId || user?.user?.is_staff || user?.user?.is_superuser) && (
                    <IconButton 
                      color="error" 
                      onClick={() => handleEndClass(vclass.id)}
                      title="ক্লাস শেষ করুন"
                    >
                      <StopIcon />
                    </IconButton>
                  )}
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Instructions Section */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, bgcolor: '#e8f5e9' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
              👨‍🏫 শিক্ষকদের জন্য নির্দেশিকা
            </Typography>
            <Typography variant="body2" component="div">
              <ol>
                <li>"নতুন ক্লাস শুরু করুন" বাটনে ক্লিক করে আপনার বিষয় নির্বাচন করুন।</li>
                <li>মিটিং উইন্ডো ওপেন হলে আপনার ক্যামেরা এবং মাইক্রোফোন পারমিশন দিন।</li>
                <li>ক্লাস শেষে অবশ্যই লাল "Stop" আইকন বা "End Class" বাটনে ক্লিক করবেন।</li>
              </ol>
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, bgcolor: '#e3f2fd' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#1565c0', fontWeight: 'bold' }}>
              🎓 শিক্ষার্থীদের জন্য নির্দেশিকা
            </Typography>
            <Typography variant="body2" component="div">
              <ol>
                <li>চলমান ক্লাসের তালিকা থেকে আপনার ক্লাসের "জয়েন করুন" বাটনে ক্লিক করুন।</li>
                <li>আপনার নাম লিখে ভিডিও কনফারেন্সে যুক্ত হন।</li>
                <li>প্রশ্ন করার জন্য "Raise Hand" ফিচার ব্যবহার করতে পারেন।</li>
              </ol>
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 3, borderRadius: 3, bgcolor: '#fff3e0' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ color: '#ef6c00', fontWeight: 'bold' }}>
              🔴 রেকর্ডিং সংক্রান্ত তথ্য
            </Typography>
            <Typography variant="body2">
              বর্তমানে Jitsi Meet-এর মাধ্যমে লাইভ ক্লাস পরিচালিত হচ্ছে। Jitsi-তে সরাসরি সার্ভারে রেকর্ডিং করার জন্য অতিরিক্ত কনফিগারেশন প্রয়োজন। তবে শিক্ষক চাইলে তার কম্পিউটার থেকে <strong>Screen Recording</strong> সফটওয়্যার ব্যবহার করে ক্লাসটি রেকর্ড করে পরবর্তীতে স্টুডেন্টদের সাথে শেয়ার করতে পারেন। ভবিষ্যতে আমরা সরাসরি ক্লাউড রেকর্ডিং সুবিধা যোগ করার চেষ্টা করছি।
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Start Class Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>লাইভ ক্লাস শুরু করুন</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              select
              fullWidth
              label="বিষয় এবং ক্লাস নির্বাচন করুন"
              value={selectedAssignment}
              onChange={(e) => setSelectedAssignment(e.target.value)}
              sx={{ mb: 2 }}
            >
              {myAssignments.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.subject.name} - {a.classroom.name} {a.section ? `(${a.section.name})` : ''}
                </MenuItem>
              ))}
            </TextField>
            <Typography variant="caption" color="textSecondary">
              * ক্লাস শুরু করলে ছাত্রছাত্রীরা তাদের ড্যাশবোর্ডে জয়েন করার লিঙ্ক পাবে।
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)}>বাতিল</Button>
          <Button 
            variant="contained" 
            onClick={handleStartClass} 
            disabled={!selectedAssignment || creating}
          >
            {creating ? <CircularProgress size={24} /> : 'শুরু করুন'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VirtualClassPage;
