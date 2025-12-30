import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import {
  Card,
  CardContent,
  CardActions,
  Avatar,
  Typography,
  Stack,
  Button,
  IconButton,
  Chip,
  Box,
  Fade,
  Zoom,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Tooltip,
  MenuItem
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import PersonIcon from '@mui/icons-material/Person';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import PhotoUpload from './PhotoUpload';
import { useToast } from './Toast';
import api from '../utils/api';

/**
 * Reusable ProfileCard component with View/Edit functionality
 * Displays user profile with photo, name, role, and contact info
 * Supports inline editing with validation
 */
export default function ProfileCard({ 
  profile, 
  onUpdate, 
  showRole = true,
  showActions = true,
  showDelete = true,
  elevation = 2,
  apiEndpoint, // e.g., '/api/users/parents/{id}/' or '/api/users/teachers/{id}/'
  showDesignation = false, // For committee members
  schoolId,
  enableLinkStudents = false,
  childNames = [],
  childProfiles = [],
  forceLinkStudents = false,
  filterClassroomId,
  filterSectionId
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    blood_group: '',
    occupation: '',
    income: '',
    designation: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [photoFile, setPhotoFile] = useState(null);

  const handlePhotoChange = async (file) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!file) return;
    setPhotoFile(file);
  };
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [unlinkingStudentId, setUnlinkingStudentId] = useState(null);

  const [localProfile, setLocalProfile] = useState(profile);
  useEffect(() => {
    setLocalProfile(prev => {
      const p = profile || {};
      return {
        ...prev,
        ...p,
        user: { ...(prev?.user || {}), ...(p.user || {}) }
      };
    });
  }, [profile]);

  // Extract user data
  const user = (localProfile?.user || localProfile || profile?.user || profile);
  const displayName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'Unknown';
  const role = (localProfile?.role ?? profile?.role) || 'User';
  const displayRole = (role?.toLowerCase?.() === 'parent') ? 'অভিভাবক' : role;
  const roleLower = role?.toLowerCase?.();

  

  // Robust photo URL handling: prefer absolute photo_url, then resolve relative paths
  const rawPhoto = user?.photo_url || profile?.photo_url || user?.photo || profile?.photo || null;
  const photoUrl = (() => {
    if (!rawPhoto) return null;
    if (typeof rawPhoto !== 'string') return rawPhoto;
    // Already absolute
    if (/^https?:\/\//i.test(rawPhoto)) return rawPhoto;
    // Build from axios baseURL
    try {
      const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
      const normalized = rawPhoto.replace(/\\/g, '/');
      // Guard against empty or directory-only paths
      if (!normalized || normalized === '/' || normalized === 'media' || normalized === '/media' || normalized === '/media/') {
        return null;
      }
      if (normalized.startsWith('/')) return `${base}${normalized}`;
      // If it's a plain relative path like 'user_photos/...'
      return `${base}/media/${normalized}`;
    } catch (_) {
      return rawPhoto;
    }
  })();

  const handleEdit = () => {
    setFormData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      phone_number: user?.phone_number || '',
      blood_group: (profile?.blood_group ?? profile?.user?.blood_group ?? ''),
      occupation: (profile?.occupation ?? profile?.user?.occupation ?? ''),
      income: (profile?.income ?? profile?.user?.income ?? '') !== '' ? String(profile?.income ?? profile?.user?.income ?? '') : '',
      designation: profile?.designation || ''
    });
    setFormErrors({});
    setPhotoFile(null);
    setEditDialogOpen(true);
  };

  const loadSchoolStudents = async () => {
    if (!schoolId) return;
    setStudentsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('school', schoolId);
      if (filterClassroomId) params.set('classroom', String(filterClassroomId));
      if (filterSectionId) params.set('section', String(filterSectionId));
      const res = await api.get(`/api/academics/students/?${params.toString()}`);
      let arr = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
      // Safety net: client-side filter
      if (filterClassroomId) {
        const clsIdStr = String(filterClassroomId);
        arr = (arr || []).filter(s => String(s.classroom?.id ?? s.classroom) === clsIdStr);
      }
      if (filterSectionId) {
        const secIdStr = String(filterSectionId);
        arr = (arr || []).filter(s => String(s.section?.id ?? s.section) === secIdStr);
      }
      const sorted = [...(arr || [])].sort((a, b) => {
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
      console.error(e);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleOpenLinkDialog = () => {
    setSelectedStudentIds([]);
    setLinkSearch('');
    setLinkDialogOpen(true);
    loadSchoolStudents();
  };

  const toggleStudent = (sid) => {
    setSelectedStudentIds(prev => prev.includes(sid) ? prev.filter(id => id !== sid) : [...prev, sid]);
  };

  const unlinkStudent = async (studentId) => {
    if (!studentId) return;
    setUnlinkingStudentId(true);
    
    try {
      // First, get the current student data to understand the structure
      const { data: studentData } = await api.get(`/api/academics/students/${studentId}/`);
      console.log('Current student data:', studentData);
      
      // Extract user data to include required fields in the update
      const userData = studentData?.user || {};
      const userId = userData?.id || studentData?.user_id;
      
      // Handle nested classroom/section objects - extract IDs if they exist
      const classroomId = studentData.classroom_id || studentData.classroom?.id;
      const sectionId = studentData.section_id || studentData.section?.id;
      const schoolId = studentData.school_id || studentData.school?.id;
      
      // Try JSON first (supports null values properly)
      // Build update object with all required fields and null guardian
      const updatePayload = {
        user_id: userId,
        username: userData.username || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        phone_number: userData.phone_number || '',
        roll_number: studentData.roll_number || '',
        guardian_id: null  // Explicitly set to null to clear
      };
      
      // Add optional fields if they exist
      if (classroomId) updatePayload.classroom_id = classroomId;
      if (sectionId) updatePayload.section_id = sectionId;
      if (schoolId) updatePayload.school_id = schoolId;
      
      let response;
      try {
        // Try JSON first (supports null properly)
        response = await api.patch(
          `/api/academics/students/${studentId}/`,
          updatePayload,
          { 
            headers: { 
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Successfully unlinked student (JSON):', response.data);
      } catch (jsonError) {
        // If JSON fails, fall back to FormData
        console.warn('JSON update failed, trying with form-data:', jsonError);
        
        // Build FormData with all required fields
        const formData = new FormData();
        
        // Explicitly include user_id to preserve the user relationship
        if (userId) {
          formData.append('user_id', String(userId));
        }
        
        // Include required fields from existing student data
        if (userData.username) {
          formData.append('username', String(userData.username));
        }
        if (userData.first_name) {
          formData.append('first_name', String(userData.first_name));
        }
        if (userData.last_name) {
          formData.append('last_name', String(userData.last_name || ''));
        }
        if (userData.email) {
          formData.append('email', String(userData.email || ''));
        }
        if (userData.phone_number) {
          formData.append('phone_number', String(userData.phone_number || ''));
        }
        
        // Include other student fields
        if (studentData.roll_number !== undefined) {
          formData.append('roll_number', String(studentData.roll_number || ''));
        }
        if (classroomId) {
          formData.append('classroom_id', String(classroomId));
        }
        if (sectionId) {
          formData.append('section_id', String(sectionId));
        }
        if (schoolId) {
          formData.append('school_id', String(schoolId));
        }
        
        // For FormData, try sending empty string for guardian_id
        // DRF's PrimaryKeyRelatedField with allow_null=True should convert empty string to None
        formData.append('guardian_id', '');
        
        response = await api.patch(
          `/api/academics/students/${studentId}/`,
          formData,
          { 
            headers: { 
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        console.log('Successfully unlinked student (form-data):', response.data);
      }
      
      // Verify the student was actually unlinked by fetching it again
      const { data: updatedStudent } = await api.get(`/api/academics/students/${studentId}/`);
      console.log('Updated student data (verification):', updatedStudent);
      
      // Check if guardian was actually cleared - check all possible guardian fields
      const guardianStillLinked = 
        updatedStudent?.guardian_id || 
        updatedStudent?.guardian || 
        updatedStudent?.guardian_user ||
        updatedStudent?.guardian_profile ||
        updatedStudent?.parent ||
        updatedStudent?.parent_id ||
        (updatedStudent?.guardian && typeof updatedStudent.guardian === 'object' && updatedStudent.guardian.id);
      
      if (guardianStillLinked) {
        console.error('ERROR: Guardian is still linked after update!', {
          guardian_id: updatedStudent?.guardian_id,
          guardian: updatedStudent?.guardian,
          guardian_user: updatedStudent?.guardian_user,
          guardian_profile: updatedStudent?.guardian_profile,
          parent: updatedStudent?.parent,
          parent_id: updatedStudent?.parent_id,
          fullResponse: updatedStudent
        });
        toast.error('Failed to unlink student. Guardian is still linked. Please check the console for details.');
        setUnlinkingStudentId(false);
        return;
      }
      
      console.log('Successfully unlinked student - guardian cleared:', {
        guardian_id: updatedStudent?.guardian_id,
        guardian: updatedStudent?.guardian
      });
      toast.success('Student unlinked successfully');
      
      // Force immediate refresh - don't wait
      if (onUpdate) {
        try {
          // Call onUpdate immediately and wait for it
          await onUpdate();
          console.log('Refresh completed after unlink');
        } catch (refreshError) {
          console.error('Error refreshing after unlink:', refreshError);
          // Even if refresh fails, show success since the unlink worked
          toast.info('Student unlinked, but refresh failed. Please reload the page.');
        }
      }
      
    } catch (error) {
      console.error('Failed to unlink student:', error);
      
      let errorMessage = 'Failed to unlink student. ';
      
      if (error.response) {
        const { status, data } = error.response;
        errorMessage += `Server responded with ${status}: `;
        
        if (data) {
          if (typeof data === 'object') {
            // Handle different error response formats
            if (data.detail) {
              errorMessage += data.detail;
            } else if (data.non_field_errors) {
              errorMessage += data.non_field_errors.join(', ');
            } else if (Object.keys(data).length > 0) {
              // Include all error messages from the response
              errorMessage += Object.entries(data)
                .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
                .join('; ');
            } else {
              errorMessage += 'Unknown server error';
            }
          } else {
            errorMessage += String(data);
          }
        } else {
          errorMessage += 'No error details provided';
        }
      } else if (error.request) {
        errorMessage += 'No response from server. Please check your connection.';
      } else {
        errorMessage += error.message || 'Unknown error occurred';
      }
      
      console.error('Full error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data,
          headers: error.config?.headers
        }
      });
      
      toast.error(errorMessage);
    } finally {
      setUnlinkingStudentId(false);
    }
  };

  const handleUnlinkStudent = (studentId, studentName) => {
    if (window.confirm(`Are you sure you want to unlink ${studentName}?`)) {
      unlinkStudent(studentId);
    }
  };

  const handleSaveLinks = async () => {
    if (!selectedStudentIds.length) { setLinkDialogOpen(false); return; }
    setLinkSaving(true);
    try {
      const parentUserId = profile?.user?.id != null ? Number(profile.user.id) : null;
      const parentProfileId = profile?.id != null ? Number(profile.id) : null;
      const parentUsername = String(profile?.user?.username || '').trim();
      if (!parentUserId && !parentProfileId && !parentUsername) throw new Error('Invalid parent identifiers');

      // Link each student: prioritize guardian_id with parent PROFILE id using multipart
      const failed = [];
      for (const sid of selectedStudentIds) {
        let linked = false;
        const errors = [];
        // Find the student object to pull minimal required field (first_name)
        let sObj = (students || []).find(st => String(st.id) === String(sid)) || {};
        let uObj = sObj.user || {};
        const minimal = {};
        if (uObj.first_name) minimal.first_name = String(uObj.first_name);

        const tryMultipart = async (field, value) => {
          // If minimal field is empty, fetch latest student detail
          if (!minimal.first_name) {
            try {
              const detail = await api.get(`/api/academics/students/${sid}/`);
              sObj = detail.data || {};
              uObj = sObj.user || {};
              if (uObj.first_name) minimal.first_name = String(uObj.first_name);
            } catch (_) {}
          }
          const fd = new FormData();
          if (Array.isArray(value)) {
            value.forEach(v => fd.append(field, String(v)));
          } else {
            fd.append(field, String(value));
          }
          // Include minimal field to satisfy backend validation if required
          Object.entries(minimal).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') fd.append(k, v);
          });
          // Match StudentsPage working pattern: set multipart header
          await api.patch(`/api/academics/students/${sid}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        };

        // 1) guardian_id = parentProfileId (most likely correct per StudentsPage)
        if (!linked && parentProfileId != null) {
          try { await tryMultipart('guardian_id', parentProfileId); linked = true; } catch (e1) { errors.push({ field: 'guardian_id', status: e1?.response?.status, data: e1?.response?.data }); }
        }
        // 2) guardian = parentProfileId (alternative serializer)
        if (!linked && parentProfileId != null) {
          try { await tryMultipart('guardian', parentProfileId); linked = true; } catch (e2) { errors.push({ field: 'guardian', status: e2?.response?.status, data: e2?.response?.data }); }
        }
        // 3) guardian_user = parentUserId (fallback)
        if (!linked && parentUserId != null) {
          try { await tryMultipart('guardian_user', parentUserId); linked = true; } catch (e3) { errors.push({ field: 'guardian_user', status: e3?.response?.status, data: e3?.response?.data }); }
        }
        // 4) parents[] = parentProfileId (list-based field some backends use)
        if (!linked && parentProfileId != null) {
          try { await tryMultipart('parents', [parentProfileId]); linked = true; } catch (e4) { errors.push({ field: 'parents[]', status: e4?.response?.status, data: e4?.response?.data }); }
        }

        if (!linked) {
          const firstErr = errors[0] || {};
          const detail = firstErr?.data?.detail || firstErr?.data?.error || JSON.stringify(firstErr?.data || {}) || 'Unknown error';
          const statusInfo = firstErr?.status ? ` (status ${firstErr.status})` : '';
          const msg = `All linking attempts failed for student ${sid}${statusInfo}: ${detail}`;
          console.error('Link failures for student', sid, errors);
          toast.error(msg);
          failed.push(sid);
        }
      }

      // Refresh after linking to reflect changes
      if (failed.length < selectedStudentIds.length) {
        toast.success('Students linked successfully');
        if (onUpdate) onUpdate();
      }
      setLinkDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to link students');
    } finally {
      setLinkSaving(false);
    }
  };

  const handleView = () => {
    setViewDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('first_name', formData.first_name || '');
      fd.append('last_name', formData.last_name || '');
      fd.append('email', formData.email || '');
      fd.append('phone_number', formData.phone_number || '');
      fd.append('blood_group', formData.blood_group || '');
      fd.append('occupation', formData.occupation || '');
      fd.append('income', formData.income || '');
      if (showDesignation) {
        fd.append('designation', formData.designation || '');
      }
      if (photoFile) fd.append('photo', photoFile);

      // Choose correct endpoint per role
      let endpoint = apiEndpoint;
      if (!endpoint) {
        if (roleLower === 'parent') {
          endpoint = `/api/users/parents/${profile?.id}/`;
        } else if (roleLower === 'teacher') {
          endpoint = `/api/users/teachers/${profile?.id}/`;
        } else if (roleLower === 'student') {
          endpoint = `/api/academics/students/${profile?.id}/`;
        } else {
          endpoint = `/api/users/${user.id}/`;
        }
      }
      // Append school query if available
      if (schoolId && !/\?/.test(endpoint)) {
        endpoint = `${endpoint}?school=${schoolId}`;
      } else if (schoolId && /\?/.test(endpoint) && !/[?&]school=/.test(endpoint)) {
        endpoint = `${endpoint}&school=${schoolId}`;
      }

      await api.patch(endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setLocalProfile(prev => ({
        ...prev,
        blood_group: formData.blood_group || '',
        occupation: formData.occupation || '',
        income: formData.income || '',
        user: {
          ...(prev?.user || {}),
          blood_group: formData.blood_group || (prev?.user?.blood_group || ''),
          occupation: formData.occupation || (prev?.user?.occupation || ''),
          income: formData.income || (prev?.user?.income || '')
        }
      }));
      toast.success('Profile updated successfully!');
      setEditDialogOpen(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      const n = err.normalized || { message: 'Failed to update profile', fieldErrors: {}, suggestions: [] };
      setFormErrors(n.fieldErrors || {});
      toast.error(n.message);
      if (n.suggestions?.length) toast.info('Suggestions: ' + n.suggestions.join(', '));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setDeleting(true);
    try {
      // Determine primary endpoint to delete profile entity first
      let primaryEndpoint = apiEndpoint;
      if (!primaryEndpoint) {
        if (roleLower === 'parent') {
          primaryEndpoint = `/api/users/parents/${profile?.id}/`;
        } else if (roleLower === 'teacher') {
          primaryEndpoint = `/api/users/teachers/${profile?.id}/`;
        } else if (roleLower === 'student') {
          primaryEndpoint = `/api/academics/students/${profile?.id}/`;
        } else {
          primaryEndpoint = `/api/users/${user?.id}/`;
        }
      }

      // Delete profile-specific resource first
      try {
        await api.delete(primaryEndpoint);
      } catch (errPrimary) {
        // If primary is already users endpoint and failed, rethrow
        if (primaryEndpoint.startsWith('/api/users/') && !primaryEndpoint.includes('/parents/') && !primaryEndpoint.includes('/teachers/')) {
          throw errPrimary;
        }
        // If primary delete fails with 404, proceed to attempt user delete anyway
        const status = errPrimary?.response?.status;
        if (status && status !== 404) {
          throw errPrimary;
        }
      }

      // Attempt to delete the underlying user as well (backend may cascade; ignore 404)
      if (user?.id) {
        try {
          await api.delete(`/api/users/${user.id}/`);
        } catch (errUser) {
          // Ignore if not found; rethrow only for non-404 server errors
          const st = errUser?.response?.status;
          if (st && st !== 404) {
            throw errUser;
          }
        }
      }

      toast.success('Profile deleted successfully!');
      setDeleteDialogOpen(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'Failed to delete profile. Please try again.';
      toast.error(typeof detail === 'string' ? detail : 'Failed to delete profile. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Zoom in timeout={300}>
        <Card
          elevation={elevation}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <CardContent sx={{ flexGrow: 1, p: 3 }}>
            <Stack spacing={2} alignItems="center">
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={photoUrl}
                  sx={{ width: 100, height: 100, border: '4px solid', borderColor: 'primary.light', boxShadow: 3, fontSize: '2.5rem' }}
                >
                  {!photoUrl && <PersonIcon fontSize="inherit" />}
                </Avatar>
                {showRole && (
                  <Chip
                    label={displayRole}
                    size="small"
                    color="primary"
                    sx={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', fontWeight: 'bold', fontSize: '0.7rem', boxShadow: 2 }}
                  />
                )}
              </Box>

              <Box sx={{ textAlign: 'center', width: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 0.5, wordBreak: 'break-word' }}>
                  {displayName}
                </Typography>
                {showRole && displayRole && (role?.toLowerCase?.() !== 'parent') && (
                  <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'primary.main', fontWeight: 500, mb: 0.5 }}>
                    {displayRole}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  @{user?.username}
                </Typography>
              </Box>

              <Stack spacing={1} sx={{ width: '100%' }}>
                {user?.email && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EmailIcon fontSize="small" color="primary" />
                    <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>
                      {user.email}
                    </Typography>
                  </Stack>
                )}
                {user?.phone_number && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhoneIcon fontSize="small" color="success" />
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                      {user.phone_number}
                    </Typography>
                  </Stack>
                )}
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    রক্তের গ্রুপ: {localProfile?.blood_group ?? localProfile?.user?.blood_group ?? 'N/A'}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    পেশা: {localProfile?.occupation ?? localProfile?.user?.occupation ?? 'N/A'}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    আয়: {(localProfile?.income ?? localProfile?.user?.income) != null && (localProfile?.income ?? localProfile?.user?.income) !== '' ? `৳${localProfile?.income ?? localProfile?.user?.income}` : 'N/A'}
                  </Typography>
                </Stack>
                {Array.isArray(childProfiles) && childProfiles.length > 0 ? (
                  <Stack direction="column" spacing={0.5} sx={{ width: '100%' }}>
                    {childProfiles.map(cp => {
                      const raw = cp.photo || '';
                      let src = null;
                      try {
                        if (raw && typeof raw === 'string') {
                          if (/^https?:\/\//i.test(raw)) src = raw; else {
                            const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
                            const normalized = raw.replace(/\\/g, '/');
                            if (normalized && normalized !== '/' && normalized !== 'media' && normalized !== '/media' && normalized !== '/media/') {
                              src = normalized.startsWith('/') ? `${base}${normalized}` : `${base}/media/${normalized}`;
                            }
                          }
                        }
                      } catch (_) { src = null; }
                      return (
                        <Stack key={cp.id} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar src={src} sx={{ width: 24, height: 24 }} />
                            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                              {`${cp.name}${cp?.roll_number ? `(${cp.roll_number})` : ''}`}
                            </Typography>
                          </Stack>
                          <Tooltip title="Unlink student">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlinkStudent(cp.id, cp.name);
                              }}
                              disabled={unlinkingStudentId === cp.id}
                              sx={{ p: 0.5, ml: 1 }}
                            >
                              {unlinkingStudentId === cp.id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <DeleteIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      );
                    })}
                  </Stack>
                ) : (
                  Array.isArray(childNames) && childNames.length > 0 && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PersonIcon fontSize="small" color="secondary" />
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {childNames.join(', ')}
                      </Typography>
                    </Stack>
                  )
                )}
              </Stack>
            </Stack>
          </CardContent>

          <CardActions sx={{ p: 2, pt: 0, justifyContent: 'center', gap: 1, flexWrap: 'wrap', bgcolor: 'action.hover' }}>
            <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={(e) => { e.stopPropagation(); handleView(); }} sx={{ flex: 1, minWidth: '80px', borderRadius: 2 }}>
              View
            </Button>
            <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={(e) => { 
              e.stopPropagation(); 
              if (!isAuthenticated()) {
                navigate('/login');
                return;
              }
              handleEdit(); 
            }} sx={{ flex: 1, minWidth: '80px', borderRadius: 2 }}>
              Edit
            </Button>
            {enableLinkStudents && schoolId && ((roleLower === 'parent') || forceLinkStudents) && (
              <Button size="small" variant="outlined" onClick={(e) => { 
                e.stopPropagation(); 
                if (!isAuthenticated()) {
                  navigate('/login');
                  return;
                }
                handleOpenLinkDialog(); 
              }} sx={{ flex: 1, minWidth: '80px', borderRadius: 2 }}>
                Link Students
              </Button>
            )}
            {showDelete && (
              <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon />} onClick={(e) => { 
                e.stopPropagation(); 
                if (!isAuthenticated()) {
                  navigate('/login');
                  return;
                }
                setDeleteDialogOpen(true); 
              }} sx={{ flex: 1, minWidth: '80px', borderRadius: 2 }}>
                Delete
              </Button>
            )}
          </CardActions>
        </Card>
      </Zoom>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth TransitionComponent={Zoom}>
        <DialogTitle onClick={(e) => e.stopPropagation()}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>👤 Profile Details</Typography>
            <IconButton onClick={() => setViewDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers onClick={(e) => e.stopPropagation()}>
          <Stack spacing={3} alignItems="center">
            <Avatar src={photoUrl} sx={{ width: 120, height: 120, border: '4px solid', borderColor: 'primary.light', fontSize: '3rem' }}>{!photoUrl && '👤'}</Avatar>
            <Box sx={{ width: '100%' }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">Full Name</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{displayName}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">Username</Typography>
                  <Typography variant="body1">@{user?.username}</Typography>
                </Grid>
                {showRole && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">Role</Typography>
                    <Typography variant="body1">{role}</Typography>
                  </Grid>
                )}
                {user?.email && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">Email</Typography>
                    <Typography variant="body1">{user.email}</Typography>
                  </Grid>
                )}
                {user?.phone_number && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">Phone</Typography>
                    <Typography variant="body1">{user.phone_number}</Typography>
                  </Grid>
                )}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">Blood Group</Typography>
                  <Typography variant="body1">{localProfile?.blood_group ?? localProfile?.user?.blood_group ?? 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">Occupation</Typography>
                  <Typography variant="body1">{localProfile?.occupation ?? localProfile?.user?.occupation ?? 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">Income</Typography>
                  <Typography variant="body1">{(localProfile?.income ?? localProfile?.user?.income) != null && (localProfile?.income ?? localProfile?.user?.income) !== '' ? (localProfile?.income ?? localProfile?.user?.income) : 'N/A'}</Typography>
                </Grid>
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }} onClick={(e) => e.stopPropagation()}>
          <Button onClick={(e) => { e.stopPropagation(); setViewDialogOpen(false); }}>Close</Button>
          <Button variant="contained" startIcon={<EditIcon />} onClick={(e) => { e.stopPropagation(); setViewDialogOpen(false); handleEdit(); }}>
            Edit Profile
          </Button>
        </DialogActions>
      </Dialog>

      {enableLinkStudents && (
        <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle onClick={(e) => e.stopPropagation()}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">Link Students</Typography>
              <IconButton onClick={() => setLinkDialogOpen(false)}><CloseIcon /></IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers onClick={(e) => e.stopPropagation()}>
            <Stack spacing={2}>
              <TextField id="link-student-search" name="link_student_search" placeholder="Search students by name/roll/class" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} fullWidth />
              {studentsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
              ) : (
                <List sx={{ maxHeight: 360, overflow: 'auto' }}>
                  {students
                    .filter(s => {
                      const u = s.user || {};
                      const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
                      const roll = String(s.roll_number || '').toLowerCase();
                      const cls = String(s.classroom?.name || '').toLowerCase();
                      const q = linkSearch.toLowerCase();
                      return !q || name.includes(q) || roll.includes(q) || cls.includes(q);
                    })
                    .map(s => (
                      <ListItem key={s.id} dense disableGutters secondaryAction={
                        (() => {
                          const checkboxId = `link-student-${s.id}`;
                          return (
                            <Checkbox edge="end" onChange={() => toggleStudent(s.id)} checked={selectedStudentIds.includes(s.id)} inputProps={{ id: checkboxId, name: checkboxId }} />
                          );
                        })()
                      }>
                        {(() => {
                          const checkboxId = `link-student-${s.id}`;
                          const primary = `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim() || s.user?.username || `Student #${s.id}`;
                          const secondary = `Class: ${s.classroom?.name || 'N/A'}${s.section?.name ? ` (${s.section.name})` : ''} • Roll: ${s.roll_number || 'N/A'}`;
                          return (
                            <label htmlFor={checkboxId} style={{ cursor: 'pointer', width: '100%' }}>
                              <ListItemText primary={primary} secondary={secondary} />
                            </label>
                          );
                        })()}
                      </ListItem>
                    ))}
                </List>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }} onClick={(e) => e.stopPropagation()}>
            <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveLinks} disabled={linkSaving || selectedStudentIds.length === 0}>
              {linkSaving ? 'Linking...' : 'Link Selected'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle onClick={(e) => e.stopPropagation()}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DeleteIcon color="error" />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Confirm Delete</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete <strong>{displayName}</strong>'s profile?
          </Typography>
          <Typography variant="body2" color="error">⚠️ This action cannot be undone. All associated data will be permanently removed.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }} onClick={(e) => e.stopPropagation()}>
          <Button onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(false); }}>Cancel</Button>
          <Button variant="contained" color="error" startIcon={<DeleteIcon />} onClick={(e) => { e.stopPropagation(); handleDelete(); }} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth TransitionComponent={Zoom}>
        <DialogTitle onClick={(e) => e.stopPropagation()}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>✏️ Edit Profile</Typography>
              <Typography variant="body2" color="text.secondary">Update profile information and photo</Typography>
            </Box>
            <IconButton onClick={() => setEditDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers onClick={(e) => e.stopPropagation()}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>🖼️ Profile Photo</Typography>
              <PhotoUpload currentPhoto={photoUrl} onPhotoChange={handlePhotoChange} userName={displayName} />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>👤 Personal Information</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField id="edit-first-name" name="first_name" label="First Name" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} fullWidth error={!!formErrors.first_name} helperText={formErrors.first_name || ''} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField id="edit-last-name" name="last_name" label="Last Name" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} fullWidth error={!!formErrors.last_name} helperText={formErrors.last_name || ''} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField id="edit-email" name="email" label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} fullWidth error={!!formErrors.email} helperText={formErrors.email || ''} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField id="edit-phone-number" name="phone_number" label="Phone Number" value={formData.phone_number} onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} placeholder="+8801712345678" fullWidth error={!!formErrors.phone_number} helperText={formErrors.phone_number || 'Include country code'} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField select label="Blood Group" value={formData.blood_group} onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })} fullWidth>
                    <MenuItem value="">Select</MenuItem>
                    <MenuItem value="A+">A+</MenuItem>
                    <MenuItem value="A-">A-</MenuItem>
                    <MenuItem value="B+">B+</MenuItem>
                    <MenuItem value="B-">B-</MenuItem>
                    <MenuItem value="AB+">AB+</MenuItem>
                    <MenuItem value="AB-">AB-</MenuItem>
                    <MenuItem value="O+">O+</MenuItem>
                    <MenuItem value="O-">O-</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Occupation" value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Monthly Income" type="number" value={formData.income} onChange={(e) => setFormData({ ...formData, income: e.target.value })} fullWidth inputProps={{ min: 0 }} />
                </Grid>
                {showDesignation && (
                  <Grid size={{ xs: 12 }}>
                    <TextField id="edit-designation" name="designation" label="পদবী (Designation)" value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} placeholder="e.g., সভাপতি, সাধারণ সম্পাদক, সদস্য" fullWidth error={!!formErrors.designation} helperText={formErrors.designation || 'Committee member designation'} />
                  </Grid>
                )}
              </Grid>
            </Box>
            {enableLinkStudents && schoolId && ((roleLower === 'parent') || forceLinkStudents) && (
              <Box>
                <Button variant="outlined" onClick={(e) => { e.stopPropagation(); handleOpenLinkDialog(); }}>Link Students</Button>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }} onClick={(e) => e.stopPropagation()}>
          <Button onClick={(e) => { e.stopPropagation(); setEditDialogOpen(false); }}>Cancel</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={(e) => { e.stopPropagation(); handleUpdate(); }} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
