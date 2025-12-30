import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  TextField,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  IconButton,
  Chip,
  Paper,
  Alert,
  CardActions
} from '@mui/material';
import ProtectedButton from '../components/ProtectedButton';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import PhotoUpload from '../components/PhotoUpload';

export default function TeachersPage() {
  const { id } = useParams();
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const toast = useToast();
  
  // Add Teacher Dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedTeacherProfile, setSelectedTeacherProfile] = useState(null);
  const [selectedTeacherAssignments, setSelectedTeacherAssignments] = useState([]);
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    phone_number: '',
    educational_qualification: '',
    _photoFile: null
  });
  
  const [newTeacher, setNewTeacher] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    subject_id: '',
    classroom_id: '',
    section_id: ''
  });
  const [newTeacherErrors, setNewTeacherErrors] = useState({});

  // Live username availability for legacy Add Teacher dialog
  const [usernameCheck, setUsernameCheck] = useState({ loading: false, available: null, suggestions: [], msg: '' });
  useEffect(() => {
    const uname = (newTeacher.username || '').trim();
    if (!uname) {
      setUsernameCheck({ loading: false, available: null, suggestions: [], msg: '' });
      return;
    }
    let cancelled = false;
    setUsernameCheck(prev => ({ ...prev, loading: true, msg: '' }));
    const h = setTimeout(async () => {
      try {
        const res = await api.get('/api/users/username-availability/', { params: { q: uname } });
        if (cancelled) return;
        setUsernameCheck({ loading: false, available: res.data.available, suggestions: res.data.suggestions || [], msg: '' });
      } catch (e) {
        if (cancelled) return;
        setUsernameCheck({ loading: false, available: null, suggestions: [], msg: e?.response?.data?.error || 'Check failed' });
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(h); };
  }, [newTeacher.username]);
  
  const [setupLoading, setSetupLoading] = useState(false);

  const getPhotoUrl = (userObj, teacherProfile = null) => {
    if (!userObj) return undefined;
    
    const API_BASE = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
    
    // Priority 1: Use photo_url if available (absolute URL from backend)
    if (userObj.photo_url) {
      return userObj.photo_url;
    }
    
    // Priority 2: Check teacherProfile for photo_url
    if (teacherProfile?.user?.photo_url) {
      return teacherProfile.user.photo_url;
    }
    
    // Priority 3: Build URL from photo path
    const path = userObj.photo || teacherProfile?.user?.photo;
    if (path && typeof path === 'string') {
      // If already absolute URL, return as-is
      if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
      }
      // Build absolute URL from relative path
      const normalized = path.replace(/\\/g, '/');
      const cleanPath = normalized.startsWith('/') ? normalized : `/media/${normalized}`;
      return `${API_BASE}${cleanPath}`;
    }
    
    return undefined;
  };

  const loadAssignments = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get(`/api/academics/assignments/?classroom__school=${id}`),
      api.get(`/api/users/teachers/?school=${id}`)
    ])
      .then(([assignRes, teacherRes]) => {
        const assignData = assignRes.data || [];
        const teacherProfiles = teacherRes.data || [];
        setTeachers(teacherProfiles);
        
        // Create a map of user ID to teacher profile for easy lookup
        const userIdToProfile = new Map();
        teacherProfiles.forEach(p => {
          if (p.user?.id) {
            userIdToProfile.set(p.user.id, p);
          }
        });
        
        // Add teacherProfile to all assignments
        const enrichedAssignments = assignData.map(a => {
          const profile = a.teacher?.id ? userIdToProfile.get(a.teacher.id) : null;
          if (a.teacher?.id && !profile) {
            console.warn(`No profile found for teacher user ID ${a.teacher.id}. This teacher may have been deleted.`);
          }
          return {
            ...a,
            teacherProfile: profile
          };
        });
        
        // Build a set of teacher user IDs that already have assignments
        const assignedTeacherIds = new Set(enrichedAssignments.map(a => a.teacher?.id).filter(Boolean));
        
        // Create placeholder rows for unassigned teachers so they appear in the grid
        const placeholders = teacherProfiles
          .filter(p => !assignedTeacherIds.has(p.user?.id))
          .map(p => ({
            id: `t-${p.id}`,
            teacher: p.user,
            teacherProfile: p,  // Store the full profile for deletion
            subject: null,
            classroom: null,
            section: null
          }));
        
        // Filter out orphaned assignments (teacher deleted but assignment remains)
        const validAssignments = enrichedAssignments.filter(a => {
          if (a.teacher?.id && !a.teacherProfile) {
            console.warn(`Filtering out orphaned assignment for deleted teacher ID ${a.teacher.id}`);
            return false; // Skip this assignment
          }
          return true;
        });
        
        const combined = [...validAssignments, ...placeholders];
        setAssignments(combined);
        setLoading(false);
        if (combined.length > 0) {
          toast.success(`Loaded ${combined.length} teacher${combined.length === 1 ? '' : 's'} (including unassigned)`);
        }
        
        // Show warning if orphaned assignments were found
        const orphanedCount = enrichedAssignments.length - validAssignments.length;
        if (orphanedCount > 0) {
          toast.warning(`${orphanedCount} assignment(s) with deleted teachers were hidden. Please clean up the database.`);
        }
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load teachers/assignments');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadAssignments();
    loadFormData();
  }, [id]);
  
  // Populate edit form when a teacher is selected for editing
  useEffect(() => {
    if (selectedTeacher && editDialogOpen) {
      // Check if data is in the teacher object or in teacher.user
      const userData = selectedTeacher.user || selectedTeacher;
      
      setEditFormData({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        username: userData.username || '',
        phone_number: userData.phone_number || '',
        educational_qualification: userData.educational_qualification || ''
      });
    }
  }, [selectedTeacher, editDialogOpen]);
  
  // Handle updating a teacher profile
  const handleUpdateTeacher = async () => {
    if (!selectedTeacher) {
      toast.error('No teacher selected');
      return;
    }
    
    console.log('=== Starting teacher update ===');
    console.log('Selected teacher object:', selectedTeacher);
    console.log('Edit form data:', editFormData);
    
    try {
      const userId = selectedTeacher.id;
      
      if (!userId) {
        console.error('No user ID found. Selected teacher:', selectedTeacher);
        toast.error('Unable to update: User ID not found');
        return;
      }
      
      // Find the teacher profile that matches this user
      const teacherProfileRes = await api.get(`/api/users/teachers/?user=${userId}`);
      const teacherProfiles = teacherProfileRes.data || [];
      
      if (teacherProfiles.length === 0) {
        console.error('No teacher profile found for user ID:', userId);
        toast.error('Teacher profile not found');
        return;
      }
      
      const teacherProfile = teacherProfiles[0];
      console.log('Teacher profile found:', teacherProfile);
      
      // Update the teacher profile using the writable serializer
      // The TeacherProfile serializer accepts user fields and photo
      const formData = new FormData();
      
      // Add user fields
      formData.append('first_name', editFormData.first_name || '');
      formData.append('last_name', editFormData.last_name || '');
      formData.append('email', editFormData.email || '');
      formData.append('phone_number', editFormData.phone_number || '');
      formData.append('educational_qualification', editFormData.educational_qualification || '');
      
      // Don't send username on update - it can't be changed
      // formData.append('username', editFormData.username || '');
      
      // Add photo only if a new one was selected
      if (editFormData._photoFile) {
        console.log('Adding photo file to form data');
        formData.append('photo', editFormData._photoFile);
      }
      
      const endpoint = `/api/users/teachers/${teacherProfile.id}/`;
      console.log('Updating teacher profile at:', endpoint);
      
      const response = await api.patch(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      console.log('Update successful:', response.data);
      console.log('Updated teacher profile:', response.data);
      console.log('Updated user data:', response.data.user);
      console.log('Updated photo URL:', response.data.user?.photo_url);
      
      toast.success('Teacher profile updated successfully');
      setEditDialogOpen(false);
      setEditFormData({
        first_name: '',
        last_name: '',
        email: '',
        username: '',
        phone_number: '',
        _photoFile: null
      });
      
      // Clear the selected teacher to force fresh data on next load
      setSelectedTeacher(null);
      
      // Force a complete refresh with a delay to ensure backend has processed the update
      // Also clear any browser cache for the images
      setTimeout(() => {
        // Force reload all data
        setLoading(true);
        Promise.all([
          api.get(`/api/academics/assignments/?classroom__school=${id}`),
          api.get(`/api/users/teachers/?school=${id}`)
        ])
          .then(([assignRes, teacherRes]) => {
            const assignData = assignRes.data || [];
            const teacherProfiles = teacherRes.data || [];
            console.log('Refreshed teacher profiles:', teacherProfiles);
            setTeachers(teacherProfiles);
            const assignedTeacherIds = new Set(assignData.map(a => a.teacher?.id).filter(Boolean));
            const placeholders = teacherProfiles
              .filter(p => !assignedTeacherIds.has(p.user?.id))
              .map(p => ({
                id: `t-${p.id}`,
                teacher: p.user,
                subject: null,
                classroom: null,
                section: null
              }));
            const combined = [...assignData, ...placeholders];
            setAssignments(combined);
            setLoading(false);
            toast.success('Teacher list refreshed');
          })
          .catch(err => {
            console.error('Error refreshing:', err);
            setLoading(false);
            // Fallback to simple refresh
            loadAssignments();
          });
      }, 800);
    } catch (error) {
      console.error('=== Error updating teacher ===');
      console.error('Error object:', error);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      let errorMsg = 'Failed to update teacher profile';
      
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
          errorMsg = data;
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        } else {
          // Try to extract field errors
          const fieldErrors = Object.entries(data)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
            .join('; ');
          if (fieldErrors) {
            errorMsg = fieldErrors;
          }
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
    }
  };
  
  // Handle deleting a teacher profile
  const handleDeleteTeacher = async () => {
    if (!selectedTeacher?.id) return;
    
    setSaving(true); // Show loading state
    
    try {
      console.log('=== Delete Teacher Debug ===');
      console.log('Selected teacher (user):', selectedTeacher);
      console.log('Selected teacher profile:', selectedTeacherProfile);
      
      let teacherProfile = selectedTeacherProfile;
      
      // If we don't have the profile, try to find it
      if (!teacherProfile) {
        console.log('No profile in state, fetching from API...');
        const response = await api.get(`/api/users/teachers/?school=${id}`);
        const allProfiles = response.data || [];
        console.log('All teacher profiles for school:', allProfiles);
        
        // Find the profile that matches this user
        teacherProfile = allProfiles.find(t => t.user?.id === selectedTeacher.id);
        
        if (!teacherProfile) {
          console.error('=== Profile Not Found ===');
          console.error('Looking for user ID:', selectedTeacher.id);
          console.error('Available profiles:', allProfiles.map(p => ({
            profileId: p.id,
            userId: p.user?.id,
            username: p.user?.username,
            role: p.role
          })));
          
          toast.error('Teacher profile not found. The teacher may not have a profile in the system.');
          setSaving(false);
          return;
        }
      }
      
      console.log('Using teacher profile:', teacherProfile);
      console.log('Profile ID:', teacherProfile.id);
      
      // Delete the teacher profile (this will cascade delete the user)
      const endpoint = `/api/users/teachers/${teacherProfile.id}/`;
      console.log('DELETE endpoint:', endpoint);
      
      const deleteResponse = await api.delete(endpoint);
      console.log('Delete response status:', deleteResponse.status);
      
      if (deleteResponse.status === 204 || deleteResponse.status === 200) {
        toast.success('Teacher deleted successfully');
        setDeleteDialogOpen(false);
        setSelectedTeacher(null);
        setSelectedTeacherProfile(null);
        setSaving(false);
        loadAssignments(); // Refresh the data
      }
    } catch (error) {
      console.error('=== Delete Error ===');
      console.error('Error:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      
      setSaving(false);
      let errorMsg = 'Failed to delete teacher';
      
      if (error.response?.status === 404) {
        errorMsg = 'Teacher not found. It may have already been deleted. Refreshing the list...';
        setTimeout(() => {
          setDeleteDialogOpen(false);
          setSelectedTeacher(null);
          setSelectedTeacherProfile(null);
          loadAssignments();
        }, 1500);
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
    }
  };

  const loadFormData = async () => {
    try {
      const [subjectsRes, classroomsRes] = await Promise.all([
        api.get(`/api/academics/subjects/?school=${id}`),
        api.get(`/api/academics/classrooms/?school=${id}`)
      ]);
      setSubjects(subjectsRes.data);
      setClassrooms(classroomsRes.data);
      setSections([]);
      
      // Show warning if no data
      if (subjectsRes.data.length === 0) {
        toast.warning('No subjects found for this school. Please add subjects first.');
      }
      if (classroomsRes.data.length === 0) {
        toast.warning('No classes found for this school. Please add classes first.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load form data');
    }
  };

  // Load sections when classroom is selected in dialog
  useEffect(() => {
    const cls = newTeacher.classroom_id;
    if (!cls) { setSections([]); return; }
    api.get(`/api/academics/sections/?classroom=${cls}`)
      .then(res => setSections(res.data || []))
      .catch(err => { console.error('Failed to load sections:', err); setSections([]); });
  }, [newTeacher.classroom_id]);

  const handleAddTeacher = async () => {
    // Validation & auto-generate
    const genIfMissing = () => {
      const base = (newTeacher.first_name || newTeacher.username || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const suffix = String(Math.floor(Math.random() * 900) + 100);
      const username = newTeacher.username || (base ? `${base}${suffix}` : `teacher${suffix}`);
      const password = newTeacher.password || '12345678';
      return { username, password };
    };

    const creds = genIfMissing();

    if (newTeacher.username && usernameCheck.available === false) {
      toast.error('This username is already taken. Please choose another.');
      return;
    }
    if (!newTeacher.first_name && !newTeacher.username) {
      toast.warning('Provide at least a first name or username');
      return;
    }
    if (!newTeacher.subject_id || !newTeacher.classroom_id) {
      toast.warning('Please select subject and classroom');
      return;
    }

    setSaving(true);
    try {
      // Step 1: Ensure a teacher profile exists (preferred endpoint)
      let teacherId = null;
      try {
        const fd = new FormData();
        // Backend expects school_id for role profile creation
        fd.append('school_id', id);
        fd.append('username', creds.username);
        fd.append('password', creds.password);
        fd.append('first_name', newTeacher.first_name || '');
        fd.append('last_name', newTeacher.last_name || '');
        fd.append('email', newTeacher.email || '');
        fd.append('phone_number', newTeacher.phone_number || '');
        const teacherRes = await api.post('/api/users/teachers/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        teacherId = teacherRes.data?.id || teacherRes.data?.teacher?.id || teacherRes.data?.user?.id || null;
      } catch (e) {
        // fallback: try register() if teachers endpoint not available
        const userRes = await api.post('/api/users/register/', {
          username: creds.username,
          password: creds.password,
          confirm_password: creds.password,
          first_name: newTeacher.first_name || '',
          last_name: newTeacher.last_name || '',
          email: newTeacher.email || '',
          phone_number: newTeacher.phone_number || '',
          school: id,
          role: 'teacher'
        });
        teacherId = userRes.data?.teacher?.id || userRes.data?.user?.id || null;
      }

      // Step 2: Create teacher assignment
      await api.post('/api/academics/assignments/', {
        teacher_id: teacherId,
        subject_id: newTeacher.subject_id,
        classroom_id: newTeacher.classroom_id,
        section_id: newTeacher.section_id || null
      });

      toast.success('Teacher added successfully!');
      setAddDialogOpen(false);
      resetForm();
      loadAssignments();
    } catch (err) {
      console.error('Error adding teacher:', err);
      const n = err.normalized || { message: 'Failed to add teacher', suggestions: [], fieldErrors: {} };
      setNewTeacherErrors(n.fieldErrors || {});
      toast.error(n.message);
      if (n.suggestions?.length) toast.info('Suggestions: ' + n.suggestions.join(', '));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setNewTeacher({
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      email: '',
      phone_number: '',
      subject_id: '',
      classroom_id: '',
      section_id: ''
    });
  };

  const handleQuickSetup = async () => {
    setSetupLoading(true);
    try {
      // Create classes
      const classNames = [
        'Class 6 (ষষ্ঠ শ্রেণী)',
        'Class 7 (সপ্তম শ্রেণী)',
        'Class 8 (অষ্টম শ্রেণী)',
        'Class 9 (নবম শ্রেণী)',
        'Class 10 (দশম শ্রেণী)',
      ];
      
      for (const name of classNames) {
        try {
          await api.post('/api/academics/classrooms/', {
            school_id: id,
            name: name
          });
        } catch (err) {
          // Ignore if already exists
          if (!err.response?.data?.name?.includes('already exists')) {
            console.error(err);
          }
        }
      }
      
      // Create subjects
      const subjectData = [
        { name: 'বাংলা (Bengali)', code: 'BANG' },
        { name: 'ইংরেজি (English)', code: 'ENG' },
        { name: 'গণিত (Mathematics)', code: 'MATH' },
        { name: 'বিজ্ঞান (Science)', code: 'SCI' },
        { name: 'সামাজিক বিজ্ঞান (Social Science)', code: 'SS' },
        { name: 'ধর্ম ও নৈতিক শিক্ষা (Religion)', code: 'REL' },
        { name: 'কৃষি শিক্ষা (Agriculture)', code: 'AGR' },
        { name: 'তথ্য ও যোগাযোগ প্রযুক্তি (ICT)', code: 'ICT' },
      ];
      
      for (const subject of subjectData) {
        try {
          await api.post('/api/academics/subjects/', {
            school_id: id,
            name: subject.name,
            code: subject.code
          });
        } catch (err) {
          // Ignore if already exists
          if (!err.response?.data?.name?.includes('already exists')) {
            console.error(err);
          }
        }
      }
      
      toast.success('✅ Setup complete! Added 5 classes and 8 subjects.');
      
      // Reload data
      await loadFormData();
      
    } catch (err) {
      console.error(err);
      toast.error('Failed to setup. Please try again.');
    } finally {
      setSetupLoading(false);
    }
  };

  const filtered = assignments
    .filter(a => {
      const teacherName = a.teacher?.username || '';
      const subjectName = a.subject?.name || '';
      const className = a.classroom?.name || '';
      const searchLower = searchQuery.toLowerCase();
      return teacherName.toLowerCase().includes(searchLower) ||
             subjectName.toLowerCase().includes(searchLower) ||
             className.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      // Sort by teacher ID (ascending) - first added teacher appears first
      const teacherIdA = a.teacher?.id || 0;
      const teacherIdB = b.teacher?.id || 0;
      return teacherIdA - teacherIdB;
    });

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
              <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              শিক্ষক ব্যবস্থাপনা
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              নতুন শিক্ষক যোগ করুন এবং অ্যাসাইনমেন্ট পরিচালনা করুন
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => window.location.assign(`/school/${id}/teacher/add`)}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
              }}
            >
              শিক্ষক যোগ করুন (অ্যাকাউন্ট)
            </Button>
            <Button 
              variant="contained"
              onClick={() => window.location.assign(`/school/${id}/teacher/cards`)}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
              }}
            >
              শিক্ষক কার্ডসমূহ
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />} 
              onClick={loadAssignments}
              sx={{ 
                borderColor: 'rgba(255,255,255,0.5)', 
                color: 'white',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              রিফ্রেশ
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <TextField
        placeholder="শিক্ষক/বিষয়/শ্রেণী দিয়ে অনুসন্ধান"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
        fullWidth
        InputProps={{
          endAdornment: (
            <Tooltip title="শিক্ষক, বিষয় বা শ্রেণীর নাম দিয়ে অনুসন্ধান করুন">
              <HelpOutlineIcon sx={{ color: 'text.secondary', cursor: 'help' }} />
            </Tooltip>
          )
        }}
      />

      {loading && <CardSkeleton count={6} />}

      {!loading && assignments.length === 0 && (
        <EmptyState
          icon={SchoolIcon}
          title="এখনও কোনো শিক্ষক অ্যাসাইনমেন্ট নেই"
          message="সিস্টেমে তৈরি হলে এখানে শিক্ষক অ্যাসাইনমেন্টগুলো দেখা যাবে"
        />
      )}

      {!loading && assignments.length > 0 && filtered.length === 0 && (
        <EmptyState
          title="মিলে যাওয়া অ্যাসাইনমেন্ট নেই"
          message={`"${searchQuery}" এর সাথে মিলে কোনো অ্যাসাইনমেন্ট পাওয়া যায়নি। অন্যভাবে অনুসন্ধান করুন।`}
        />
      )}

      {!loading && filtered.length > 0 && (
        <Grid container spacing={2}>
          {filtered.map(a => {
            // Get educational qualification from teacher object
            const qualification = a.teacher?.educational_qualification || '';
            
            // Debug log
            console.log('Teacher data:', a.teacher);
            console.log('Educational qualification:', qualification);
            
            return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={a.id}>
              <Card sx={{ borderRadius: 2, boxShadow: 3, transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 } }}>
                <CardHeader
                      onClick={async () => {
                        // Load detailed data for this teacher (assignments, etc.)
                        const teacherId = a.teacher?.id;
                        if (!teacherId) return;
                        try {
                          const res = await api.get(`/api/academics/assignments/?teacher=${teacherId}`);
                          setSelectedTeacherAssignments(res.data || []);
                        } catch (e) {
                          setSelectedTeacherAssignments([]);
                        }
                        setSelectedTeacher(a.teacher);
                        setDetailOpen(true);
                      }}
                      sx={{ cursor: 'pointer' }}
                      avatar={
                        <Avatar src={getPhotoUrl(a.teacher, a.teacherProfile)}>
                          {!getPhotoUrl(a.teacher, a.teacherProfile) ? (a.teacher?.first_name?.[0] || a.teacher?.username?.[0] || '?') : null}
                        </Avatar>
                      }
                      title={
                        <Box>
                          <Typography variant="h6">
                            {`${a.teacher?.first_name || ''} ${a.teacher?.last_name || ''}`.trim() || a.teacher?.username || 'Unknown Teacher'}
                          </Typography>
                          {qualification && (
                            <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 0.5 }}>
                              {qualification}
                            </Typography>
                          )}
                        </Box>
                      }
                      subheader={`${a.subject?.name || ''} — ${a.classroom?.name || ''}${a.section ? ' (' + a.section.name + ')' : ''}`}
                      titleTypographyProps={{ variant: 'h6' }}
                    />

                <CardContent onClick={async () => {
                  // Load detailed data for this teacher (assignments, etc.)
                  const teacherId = a.teacher?.id;
                  if (!teacherId) return;
                  try {
                    const res = await api.get(`/api/academics/assignments/?teacher=${teacherId}`);
                    setSelectedTeacherAssignments(res.data || []);
                  } catch (e) {
                    setSelectedTeacherAssignments([]);
                  }
                  setSelectedTeacher(a.teacher);
                  setDetailOpen(true);
                }} sx={{ cursor: 'pointer' }}>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Subject:</strong> {a.subject?.name || 'Not assigned'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Mobile:</strong> {a.teacher?.phone_number || a.teacher?.mobile_number || 'Not available'}
                    </Typography>
                    {a.classroom?.name && (
                      <Typography variant="body2" color="textSecondary">
                        <strong>Class:</strong> {a.classroom.name}
                        {a.section ? `, Section ${a.section.name}` : ''}
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
                
                <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
                  <ProtectedButton 
                    size="small" 
                    color="primary" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTeacher(a.teacher);
                      setEditDialogOpen(true);
                    }}
                    aria-label="edit"
                  >
                    <EditIcon fontSize="small" />
                  </ProtectedButton>
                  <ProtectedButton 
                    size="small" 
                    color="error" 
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Delete button clicked for:', a.teacher);
                      console.log('Teacher profile available:', a.teacherProfile);
                      setSelectedTeacher(a.teacher);
                      setSelectedTeacherProfile(a.teacherProfile || null);
                      setDeleteDialogOpen(true);
                    }}
                    aria-label="delete"
                  >
                    <DeleteIcon fontSize="small" />
                  </ProtectedButton>
                </CardActions>
              </Card>
            </Grid>
            );
          })}
        </Grid>
      )}

      {/* Teacher Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {`${selectedTeacher?.first_name || ''} ${selectedTeacher?.last_name || ''}`.trim() || selectedTeacher?.username || 'Teacher'} Details
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Avatar src={getPhotoUrl(selectedTeacher)} sx={{ width: 56, height: 56 }}>
              {!getPhotoUrl(selectedTeacher) ? (selectedTeacher?.first_name?.[0] || selectedTeacher?.username?.[0] || '?') : null}
            </Avatar>
            <Box>
              <Typography variant="h6">{`${selectedTeacher?.first_name || ''} ${selectedTeacher?.last_name || ''}`.trim() || selectedTeacher?.username}</Typography>
              <Typography variant="body2" color="text.secondary">{selectedTeacher?.email || ''}</Typography>
            </Box>
          </Stack>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Assignments</Typography>
          {selectedTeacherAssignments.length === 0 ? (
            <Alert severity="info">No assignments found.</Alert>
          ) : (
            <Stack spacing={1}>
              {selectedTeacherAssignments.map(x => (
                <Paper key={x.id} sx={{ p: 1.5 }}>
                  <Typography>
                    {x.subject?.name || 'Subject'} — {x.classroom?.name || 'Class'}{x.section ? ` (${x.section.name})` : ''}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Edit Teacher Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Teacher Profile
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Profile Photo */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Profile Photo
              </Typography>
              <PhotoUpload 
                currentPhoto={getPhotoUrl(selectedTeacher)} 
                onPhotoChange={(file) => setEditFormData({...editFormData, _photoFile: file})} 
                userName={`${editFormData.first_name || ''} ${editFormData.last_name || ''}`.trim() || editFormData.username || 'Teacher'} 
              />
            </Box>
            
            <TextField
              label="First Name"
              fullWidth
              value={editFormData.first_name}
              onChange={(e) => setEditFormData({...editFormData, first_name: e.target.value})}
            />
            <TextField
              label="Last Name"
              fullWidth
              value={editFormData.last_name}
              onChange={(e) => setEditFormData({...editFormData, last_name: e.target.value})}
            />
            <TextField
              label="Email"
              fullWidth
              value={editFormData.email}
              onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
            />
            <TextField
              label="Username"
              fullWidth
              value={editFormData.username}
              onChange={(e) => setEditFormData({...editFormData, username: e.target.value})}
              disabled
              helperText="Username cannot be changed"
            />
            <TextField
              label="Phone Number"
              fullWidth
              value={editFormData.phone_number}
              onChange={(e) => setEditFormData({...editFormData, phone_number: e.target.value})}
            />
            <TextField
              label="শিক্ষাগত যোগ্যতা (Educational Qualification)"
              fullWidth
              value={editFormData.educational_qualification}
              onChange={(e) => setEditFormData({...editFormData, educational_qualification: e.target.value})}
              placeholder="e.g., B.A., M.A., B.Ed., এম.এ., বি.এড."
              helperText="Optional - শিক্ষাগত যোগ্যতা লিখুন"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleUpdateTeacher}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the teacher profile for {`${selectedTeacher?.first_name || ''} ${selectedTeacher?.last_name || ''}`.trim() || selectedTeacher?.username}?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleDeleteTeacher}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Teacher Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                👨‍🏫 Add New Teacher
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create a new teacher account and assign to class
              </Typography>
            </Box>
            <IconButton onClick={() => setAddDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        
        <DialogContent dividers>
          <Grid container spacing={2}>
            {/* Account Information */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                🔐 Account Information
              </Typography>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Username *"
                value={newTeacher.username}
                onChange={(e) => setNewTeacher({...newTeacher, username: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.username || usernameCheck.available === false}
                helperText={newTeacherErrors.username || (usernameCheck.loading ? 'Checking availability…' : usernameCheck.available === false ? 'Username not available' : 'Used for login')}
              />
              {usernameCheck.available === false && usernameCheck.suggestions?.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {usernameCheck.suggestions.map((sug, i) => (
                    <Chip key={i} label={sug} onClick={() => setNewTeacher(nt => ({ ...nt, username: sug }))} clickable />
                  ))}
                </Stack>
              )}
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Password *"
                type="password"
                value={newTeacher.password}
                onChange={(e) => setNewTeacher({...newTeacher, password: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.password}
                helperText={newTeacherErrors.password || 'Minimum 8 characters'}
              />
            </Grid>

            {/* Personal Information */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, mt: 2 }}>
                👤 Personal Information
              </Typography>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="First Name *"
                value={newTeacher.first_name}
                onChange={(e) => setNewTeacher({...newTeacher, first_name: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.first_name}
                helperText={newTeacherErrors.first_name || ''}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Last Name *"
                value={newTeacher.last_name}
                onChange={(e) => setNewTeacher({...newTeacher, last_name: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.last_name}
                helperText={newTeacherErrors.last_name || ''}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Email"
                type="email"
                value={newTeacher.email}
                onChange={(e) => setNewTeacher({...newTeacher, email: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.email}
                helperText={newTeacherErrors.email || ''}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Phone Number"
                value={newTeacher.phone_number}
                onChange={(e) => setNewTeacher({...newTeacher, phone_number: e.target.value})}
                fullWidth
                placeholder="+8801712345678"
                error={!!newTeacherErrors.phone_number}
                helperText={newTeacherErrors.phone_number || 'Include country code'}
              />
            </Grid>

            {/* Teaching Assignment */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, mt: 2 }}>
                📚 Teaching Assignment
              </Typography>
              {(subjects.length === 0 || classrooms.length === 0) && (
                <Alert 
                  severity="warning" 
                  sx={{ mb: 2 }}
                  action={
                    <Button 
                      color="inherit" 
                      size="small" 
                      onClick={handleQuickSetup}
                      disabled={setupLoading}
                      variant="outlined"
                    >
                      {setupLoading ? 'Setting up...' : '🚀 Quick Setup'}
                    </Button>
                  }
                >
                  ⚠️ No {subjects.length === 0 ? 'subjects' : ''} 
                  {subjects.length === 0 && classrooms.length === 0 ? ' or ' : ''}
                  {classrooms.length === 0 ? 'classes' : ''} found!
                  <br />
                  Click "Quick Setup" to automatically add common subjects and classes.
                </Alert>
              )}
            </Grid>
            
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="Subject *"
                value={newTeacher.subject_id}
                onChange={(e) => setNewTeacher({...newTeacher, subject_id: e.target.value})}
                fullWidth
                disabled={subjects.length === 0}
                error={!!newTeacherErrors.subject_id}
                helperText={newTeacherErrors.subject_id || (subjects.length === 0 ? 'No subjects available' : '')}
              >
                <MenuItem value="">Select Subject</MenuItem>
                {subjects.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="Class *"
                value={newTeacher.classroom_id}
                onChange={(e) => setNewTeacher({...newTeacher, classroom_id: e.target.value})}
                fullWidth
                disabled={classrooms.length === 0}
                error={!!newTeacherErrors.classroom_id}
                helperText={newTeacherErrors.classroom_id || (classrooms.length === 0 ? 'No classes available' : '')}
              >
                <MenuItem value="">Select Class</MenuItem>
                {classrooms.map(c => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="Section (Optional)"
                value={newTeacher.section_id}
                onChange={(e) => setNewTeacher({...newTeacher, section_id: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.section_id}
                helperText={newTeacherErrors.section_id || ''}
              >
                <MenuItem value="">No Section</MenuItem>
                {sections.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAddTeacher}
            disabled={saving}
            startIcon={<AddIcon />}
          >
            {saving ? 'Adding...' : 'Add Teacher'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
