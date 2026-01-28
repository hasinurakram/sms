import React, { useEffect, useState } from 'react';
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
  CardActions,
  useMediaQuery,
  Autocomplete
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ProtectedButton from '../components/ProtectedButton';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import PhotoUpload from '../components/PhotoUpload';

export default function TeachersPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
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
  const [selectedTeacherSubjects, setSelectedTeacherSubjects] = useState([]);
  const [selectedTeacherClasses, setSelectedTeacherClasses] = useState([]);
  const [editSelectedSubjectIds, setEditSelectedSubjectIds] = useState([]);
  const [editSelectedClassroomIds, setEditSelectedClassroomIds] = useState([]);
  const [editSelectedSectionId, setEditSelectedSectionId] = useState('');
  const [editSections, setEditSections] = useState([]);
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
    section_id: '',
    _photoFile: null
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

  const buildAssignments = (assignDataRaw, teacherProfiles) => {
    const assignData = assignDataRaw || [];
    const profiles = teacherProfiles || [];

    setTeachers(profiles);

    const userIdToProfile = new Map();
    const profileIdToProfile = new Map();

    profiles.forEach(p => {
      if (p.user?.id) {
        userIdToProfile.set(p.user.id, p);
      }
      if (p.id) {
        profileIdToProfile.set(p.id, p);
      }
    });

    const enrichedAssignments = assignData.map(a => {
      const rawTeacher = a.teacher || {};
      const userId = rawTeacher.user?.id || null;
      const teacherId = rawTeacher.id || null;

      let profile = null;
      if (userId && userIdToProfile.has(userId)) {
        profile = userIdToProfile.get(userId);
      } else if (teacherId && userIdToProfile.has(teacherId)) {
        profile = userIdToProfile.get(teacherId);
      } else if (teacherId && profileIdToProfile.has(teacherId)) {
        profile = profileIdToProfile.get(teacherId);
      }

      if ((userId || teacherId) && !profile) {
        console.warn('No profile found for teacher', { userId, teacherId, teacher: rawTeacher });
      }

      return {
        ...a,
        teacher: rawTeacher,
        teacherProfile: profile
      };
    });

    const assignedTeacherIds = new Set(
      enrichedAssignments
        .map(a => a.teacher?.user?.id || a.teacher?.id)
        .filter(Boolean)
    );

    const placeholders = profiles
      .filter(p => p.user?.id && !assignedTeacherIds.has(p.user.id))
      .map(p => ({
        id: `t-${p.id}`,
        teacher: p.user,
        teacherProfile: p,
        subject: null,
        classroom: null,
        section: null
      }));

    const validAssignments = enrichedAssignments.filter(a => !!a.teacher && !!a.teacherProfile);

    return [...validAssignments, ...placeholders];
  };

  const loadAssignments = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get(`/api/academics/assignments/?classroom__school=${id}`),
      api.get(`/api/users/teachers/?school=${id}`)
    ])
      .then(([assignRes, teacherRes]) => {
        const rawAssignments = Array.isArray(assignRes.data)
          ? assignRes.data
          : (assignRes.data?.results || []);

        const filteredAssignments = rawAssignments.filter(a => {
          const schoolId =
            a.classroom?.school?.id ||
            a.classroom?.school_id ||
            a.classroom?.school ||
            a.school?.id ||
            a.school_id ||
            a.school;
          if (!id) return true;
          if (!schoolId) return true;
          return String(schoolId) === String(id);
        });

        const teacherData = teacherRes.data || [];
        const teacherProfiles = Array.isArray(teacherData) ? teacherData : (teacherData.results || []);
        const filteredProfiles = teacherProfiles.filter(p => {
          const schoolId =
            p.school?.id ||
            p.school_id ||
            p.school ||
            p.user?.school?.id ||
            p.user?.school_id ||
            p.user?.school;
          if (!id) return true;
          if (!schoolId) return false;
          return String(schoolId) === String(id);
        });

        const combined = buildAssignments(filteredAssignments, filteredProfiles);
        setAssignments(combined);
        setLoading(false);
        if (combined.length > 0) {
          toast.success(`Loaded ${combined.length} teacher${combined.length === 1 ? '' : 's'} (including unassigned)`);
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
      // Find profile to get designation
      let prof = selectedTeacherProfile;
      if (!prof && Array.isArray(teachers) && userData?.id) {
        prof = teachers.find(tp => tp.user?.id === userData.id) || null;
      }
      
      setEditFormData({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        username: userData.username || '',
        phone_number: userData.phone_number || '',
        educational_qualification: userData.educational_qualification || '',
        designation: prof?.designation || ''
      });
    }
  }, [selectedTeacher, editDialogOpen]);
  
  const handleUpdateTeacher = async () => {
    if (!selectedTeacher) {
      toast.error('No teacher selected');
      return;
    }
    
    try {
      const userData = selectedTeacher.user || selectedTeacher;
      const userId = userData.id;
      if (!userId) {
        toast.error('Unable to update: User ID not found');
        return;
      }
      
      let teacherProfile = selectedTeacherProfile;
      if (!teacherProfile && Array.isArray(teachers)) {
        teacherProfile = teachers.find(tp => tp.user?.id === userId) || null;
      }
      
      if (!teacherProfile || !teacherProfile.id) {
        toast.error('Teacher profile not found');
        return;
      }
      
      const formData = new FormData();
      formData.append('first_name', editFormData.first_name || '');
      formData.append('last_name', editFormData.last_name || '');
      formData.append('email', editFormData.email || '');
      formData.append('phone_number', editFormData.phone_number || '');
      formData.append('educational_qualification', editFormData.educational_qualification || '');
      formData.append('designation', editFormData.designation || '');
      if (editFormData._photoFile) {
        formData.append('photo', editFormData._photoFile);
      }
      
      const endpoint = `/api/users/teachers/${teacherProfile.id}/`;
      await api.patch(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
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
      setSelectedTeacher(null);
      setTimeout(() => {
        loadAssignments();
      }, 800);
    } catch (error) {
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
  
  const handleDeleteTeacher = async () => {
    if (!selectedTeacher) return;
    
    setSaving(true);
    
    try {
      const userData = selectedTeacher.user || selectedTeacher;
      const userId = userData?.id;
      
      let teacherProfile = selectedTeacherProfile;
      if (!teacherProfile && userId && Array.isArray(teachers)) {
        teacherProfile = teachers.find(tp => tp.user?.id === userId) || null;
      }
      
      try {
        const resp = await api.get(`/api/academics/assignments/?classroom__school=${id}`);
        const raw = Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
        const tpid = teacherProfile?.id;
        const target = raw.filter(a => {
          const tid = a?.teacher?.id;
          const tuid = a?.teacher?.user?.id;
          if (tpid && String(tid) === String(tpid)) return true;
          if (userId && String(tuid) === String(userId)) return true;
          return false;
        });
        for (const a of target) {
          if (a?.id) {
            try {
              await api.delete(`/api/academics/assignments/${a.id}/`);
            } catch (e) {
              const st = e?.response?.status;
              if (st && st !== 404) {
                console.error('Assignment delete error', e);
              }
            }
          }
        }
      } catch (_) {}
      
      let primaryEndpoint = null;
      if (teacherProfile?.id) {
        primaryEndpoint = `/api/users/teachers/${teacherProfile.id}/`;
      } else if (userId) {
        primaryEndpoint = `/api/users/${userId}/`;
      }
      
      if (!primaryEndpoint) {
        setSaving(false);
        toast.error('Unable to delete: teacher identifiers not found');
        return;
      }
      
      if (primaryEndpoint.startsWith('/api/users/teachers/') && id) {
        primaryEndpoint = primaryEndpoint.includes('?')
          ? `${primaryEndpoint}&school=${id}`
          : `${primaryEndpoint}?school=${id}`;
      }
      
      let primaryFailed = false;
      try {
        await api.delete(primaryEndpoint);
      } catch (errPrimary) {
        const status = errPrimary?.response?.status;
        if (status && status !== 404) {
          primaryFailed = true;
        }
      }
      
      if (primaryFailed) {
        setSaving(false);
        toast.error('Failed to delete teacher');
        return;
      }
      
      if (userId && primaryEndpoint.indexOf(`/api/users/${userId}/`) === -1) {
        try {
          await api.delete(`/api/users/${userId}/`);
        } catch (errUser) {
          const st = errUser?.response?.status;
          if (st && st !== 404) {
            console.error('Secondary user delete error:', errUser);
          }
        }
      }
      
      toast.success('Teacher deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedTeacher(null);
      setSelectedTeacherProfile(null);
      setSaving(false);
      loadAssignments();
    } catch (error) {
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

  useEffect(() => {
    if (editSelectedClassroomIds.length !== 1) {
      setEditSections([]);
      setEditSelectedSectionId('');
      return;
    }
    const cls = editSelectedClassroomIds[0];
    api.get(`/api/academics/sections/?classroom=${cls}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setEditSections(data || []);
      })
      .catch(err => { console.error('Failed to load sections:', err); setEditSections([]); });
  }, [editSelectedClassroomIds]);

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
        if (newTeacher._photoFile) {
          fd.append('photo', newTeacher._photoFile);
        }
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
      section_id: '',
      _photoFile: null
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

  const groupAssignments = (items) => {
    const grouped = [];
    const byUser = new Map();
    items.forEach(a => {
      const uid = a.teacher?.user?.id || a.teacher?.id;
      if (!uid) return;
      let g = byUser.get(uid);
      if (!g) {
        g = {
          teacher: a.teacher,
          teacherProfile: a.teacherProfile || null,
          subjects: new Set(),
          classes: new Set(),
          sectionsByClass: new Map(),
          assignmentCount: 0
        };
        byUser.set(uid, g);
        grouped.push(g);
      }
      if (a.subject?.name) g.subjects.add(a.subject.name);
      if (a.classroom?.name) {
        g.classes.add(a.classroom.name);
        if (a.section?.name) {
          const key = a.classroom.name;
          const sec = g.sectionsByClass.get(key) || new Set();
          sec.add(a.section.name);
          g.sectionsByClass.set(key, sec);
        }
      }
      g.assignmentCount += 1;
    });
    return grouped;
  };

  const aggregated = groupAssignments(assignments);

  const normalizeClassBase = (name) => {
    const s = String(name || '').toLowerCase();
    return s.replace(/\s*শ্রেণি\s*$/i, '').trim();
  };
  const classOrder = ['প্রথম','দ্বিতীয়','দ্বিতীয়','তৃতীয়','তৃতীয়','চতুর্থ','পঞ্চম','ষষ্ঠ','সপ্তম','অষ্টম','নবম','দশম','একাদশ','দ্বাদশ'];
  const classIndex = (name) => {
    const base = normalizeClassBase(name);
    const idx = classOrder.indexOf(base);
    return idx >= 0 ? idx : 999;
  };
  const formatClassRange = (classesSet) => {
    const arr = Array.from(classesSet || []);
    if (!arr.length) return '';
    const sorted = arr.slice().sort((a, b) => classIndex(a) - classIndex(b));
    if (sorted.length >= 2) {
      const first = normalizeClassBase(sorted[0]);
      const last = normalizeClassBase(sorted[sorted.length - 1]);
      return `${first}-${last} শ্রেণি`;
    }
    const single = normalizeClassBase(sorted[0]);
    return `${single} শ্রেণি`;
  };

  const filtered = aggregated
    .filter(g => {
      const teacherName = g.teacher?.username || '';
      const subjJoined = Array.from(g.subjects).join(', ');
      const classJoined = Array.from(g.classes).join(', ');
      const q = searchQuery.toLowerCase();
      return teacherName.toLowerCase().includes(q) ||
             subjJoined.toLowerCase().includes(q) ||
             classJoined.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const teacherIdA = a.teacher?.user?.id || a.teacher?.id || 0;
      const teacherIdB = b.teacher?.user?.id || a.teacher?.id || 0;
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
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}>ব্যাক</Button>
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
          {filtered.map(g => {
            const a = g; // aggregated item
            const qualification = a.teacher?.educational_qualification || '';
            const qualificationText = qualification ? qualification.replace(/\s*,\s*/g, ' ও ') : '';
            const classTextRaw = formatClassRange(a.classes) || Array.from(a.classes).join(', ');
            const hasHyphen = classTextRaw.includes('-');
            const classParts = hasHyphen ? classTextRaw.split('-').map(s => s.trim()) : [classTextRaw, ''];
            // Debug log
            console.log('Teacher data:', a.teacher);
            console.log('Educational qualification:', qualification);
            
            return (
            <Grid item xs={12} sm={6} md={4} key={a.id}>
              <Card sx={{ borderRadius: 2, boxShadow: { xs: 2, sm: 3 }, transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }, p: { xs: 1, sm: 2 } }}>
                <CardHeader
                      onClick={async () => {
                        // Load detailed data for this teacher (assignments, etc.)
                        setSelectedTeacher(a.teacher);
                        setSelectedTeacherProfile(a.teacherProfile || null);
                        setSelectedTeacherSubjects(Array.from(a.subjects || []));
                        setSelectedTeacherClasses(Array.from(a.classes || []));
                        setDetailOpen(true);
                      }}
                      sx={{ cursor: 'pointer' }}
                      avatar={
                        <Avatar src={getPhotoUrl(a.teacher, a.teacherProfile)} sx={{ width: 64, height: 64 }}>
                          {!getPhotoUrl(a.teacher, a.teacherProfile) ? (a.teacher?.first_name?.[0] || a.teacher?.username?.[0] || '?') : null}
                        </Avatar>
                      }
                      title={
                        <Typography variant="h6" sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                          {`${a.teacher?.first_name || ''} ${a.teacher?.last_name || ''}`.trim() || a.teacher?.username || 'Unknown Teacher'}
                        </Typography>
                      }
                      subheader={null}
                      titleTypographyProps={{ variant: 'h5' }}
                    />

                <CardContent onClick={async () => {
                  // Load detailed data for this teacher (assignments, etc.)
                  setSelectedTeacher(a.teacher);
                  setSelectedTeacherProfile(a.teacherProfile || null);
                  setSelectedTeacherSubjects(Array.from(a.subjects || []));
                  setSelectedTeacherClasses(Array.from(a.classes || []));
                  setDetailOpen(true);
                }} sx={{ cursor: 'pointer' }}>
                  <Stack spacing={1.25}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {a.teacherProfile?.designation && (
                        <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 700 }}>
                          {a.teacherProfile.designation}
                        </Typography>
                      )}
                      <Typography variant="body1" color="secondary" sx={{ fontWeight: 600 }}>
                        {qualificationText || 'এম.এস.এস. ও এম.এড.'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {Array.from(a.subjects).length > 0
                        ? Array.from(a.subjects).map((s, i) => (
                            <Chip
                              key={`${s}-${i}`}
                              label={s}
                              color={['primary','secondary','success','warning','info','error'][i % 6]}
                              size="medium"
                              sx={{ '& .MuiChip-label': { fontSize: '0.95rem', fontWeight: 600 } }}
                            />
                          ))
                        : <Chip label="No subjects" size="medium" sx={{ '& .MuiChip-label': { fontSize: '0.9rem' } }} />}
                    </Box>
                    <Typography variant="body1" sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere', fontWeight: 600 }}>
                      {hasHyphen ? (
                        <>
                          <Box component="span" sx={{ color: 'primary.main' }}>{classParts[0]}</Box>
                          <Box component="span" sx={{ color: 'primary.main' }}>{' - '}</Box>
                          <Box component="span" sx={{ color: 'secondary.main' }}>{classParts[1]}</Box>
                        </>
                      ) : (
                        <Box component="span" sx={{ color: 'info.main' }}>{classTextRaw}</Box>
                      )}
                    </Typography>
                    <Typography variant="body1" color="textSecondary">
                      <strong>Mobile:</strong> {a.teacher?.phone_number || a.teacher?.mobile_number || 'Not available'}
                    </Typography>
                  </Stack>
                </CardContent>
                
                <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
                  <ProtectedButton 
                    size="small" 
                    color="primary" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTeacher(a.teacher);
                      setSelectedTeacherProfile(a.teacherProfile || null);
                      setEditSelectedSubjectIds(
                        Array.from(a.subjects || []).map(name => {
                          const s = (subjects || []).find(x => x.name === name);
                          return s?.id;
                        }).filter(Boolean)
                      );
                      setEditSelectedClassroomIds(
                        Array.from(a.classes || []).map(name => {
                          const c = (classrooms || []).find(x => x.name === name);
                          return c?.id;
                        }).filter(Boolean)
                      );
                      setEditSelectedSectionId('');
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
            <Avatar src={getPhotoUrl(selectedTeacher)} sx={{ width: 96, height: 96 }}>
              {!getPhotoUrl(selectedTeacher) ? (selectedTeacher?.first_name?.[0] || selectedTeacher?.username?.[0] || '?') : null}
            </Avatar>
            <Box>
              <Typography variant="h6">{`${selectedTeacher?.first_name || ''} ${selectedTeacher?.last_name || ''}`.trim() || selectedTeacher?.username}</Typography>
              <Typography variant="body2" color="text.secondary">{selectedTeacher?.email || ''}</Typography>
            </Box>
          </Stack>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {selectedTeacherProfile?.designation && (
                <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 700 }}>
                  {selectedTeacherProfile.designation}
                </Typography>
              )}
              <Typography variant="body1" color="secondary" sx={{ fontWeight: 600 }}>
                {(selectedTeacher?.educational_qualification || '').replace(/\s*,\s*/g, ' ও ') || 'এম.এস.এস. ও এম.এড.'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {selectedTeacherSubjects.length > 0
                ? selectedTeacherSubjects.map((s, i) => (
                    <Chip
                      key={`${s}-${i}`}
                      label={s}
                      color={['primary','secondary','success','warning','info','error'][i % 6]}
                      size="medium"
                      sx={{ '& .MuiChip-label': { fontSize: '0.95rem', fontWeight: 600 } }}
                    />
                  ))
                : <Chip label="No subjects" size="medium" sx={{ '& .MuiChip-label': { fontSize: '0.9rem' } }} />}
            </Box>
            {(() => {
              const classTextRaw = formatClassRange(new Set(selectedTeacherClasses)) || selectedTeacherClasses.join(', ');
              const hasHyphen = classTextRaw.includes('-');
              const parts = hasHyphen ? classTextRaw.split('-').map(s => s.trim()) : [classTextRaw, ''];
              return (
                <Typography variant="body1" sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere', fontWeight: 600 }}>
                  {hasHyphen ? (
                    <>
                      <Box component="span" sx={{ color: 'primary.main' }}>{parts[0]}</Box>
                      <Box component="span" sx={{ color: 'primary.main' }}>{' - '}</Box>
                      <Box component="span" sx={{ color: 'secondary.main' }}>{parts[1]}</Box>
                    </>
                  ) : (
                    <Box component="span" sx={{ color: 'info.main' }}>{classTextRaw}</Box>
                  )}
                </Typography>
              );
            })()}
            <Typography variant="body1" color="textSecondary">
              <strong>Mobile:</strong> {selectedTeacher?.phone_number || selectedTeacher?.mobile_number || 'Not available'}
            </Typography>
          </Stack>
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
              label="Designation"
              fullWidth
              value={editFormData.designation || ''}
              onChange={(e) => setEditFormData({...editFormData, designation: e.target.value})}
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
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Teaching Assignments</Typography>
            <Autocomplete
              multiple
              options={subjects || []}
              getOptionLabel={(s) => s?.name || ''}
              value={(subjects || []).filter(s => editSelectedSubjectIds.includes(s.id))}
              onChange={(e, vals) => setEditSelectedSubjectIds(vals.map(v => v.id))}
              renderInput={(params) => (
                <TextField {...params} label="Subjects (multiple)" placeholder="Select one or more" />
              )}
            />
            <Autocomplete
              multiple
              options={classrooms || []}
              getOptionLabel={(c) => c?.name || ''}
              value={(classrooms || []).filter(c => editSelectedClassroomIds.includes(c.id))}
              onChange={(e, vals) => setEditSelectedClassroomIds(vals.map(v => v.id))}
              renderInput={(params) => (
                <TextField {...params} label="Classes (multiple)" placeholder="Select one or more" />
              )}
            />
            {editSelectedClassroomIds.length === 1 && (
              <Autocomplete
                options={(editSections || [])}
                getOptionLabel={(s) => s?.name || ''}
                value={(editSections || []).find(s => String(s.id) === String(editSelectedSectionId)) || null}
                onChange={(e, val) => setEditSelectedSectionId(val ? val.id : '')}
                renderInput={(params) => (
                  <TextField {...params} label="Section (optional, for selected class)" placeholder="Select section" />
                )}
              />
            )}
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
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                🖼️ Profile Photo
              </Typography>
              <PhotoUpload
                currentPhoto={null}
                onPhotoChange={(file) => setNewTeacher(nt => ({ ...nt, _photoFile: file }))}
                userName={`${newTeacher.first_name || ''} ${newTeacher.last_name || ''}`.trim() || newTeacher.username || 'Teacher'}
              />
            </Grid>
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
