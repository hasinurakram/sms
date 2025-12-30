import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Stack,
  Button,
  Chip,
  Avatar,
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Divider,
  Zoom
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BookIcon from '@mui/icons-material/Book';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import { useToast } from './Toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAuthenticated } from '../utils/auth';
import ProtectedButton from './ProtectedButton';
import api from '../utils/api';

/**
 * SubjectCard component with teacher linking
 * Shows subject info and assigned teachers with their details
 */
export default function SubjectCard({ 
  subject, 
  teachers = [],
  onUpdate,
  onDelete,
  schoolId
}) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [linkTeacherDialogOpen, setLinkTeacherDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: subject.name || '',
    code: subject.code || ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);

  // Get assigned teachers for this subject
  const assignedTeachers = subject.assigned_teachers || [];

  // Load classrooms when dialog opens
  useEffect(() => {
    if (linkTeacherDialogOpen && schoolId) {
      loadClassrooms();
    }
  }, [linkTeacherDialogOpen, schoolId]);

  // Load sections when classroom changes
  useEffect(() => {
    if (selectedClassroomId) {
      loadSections(selectedClassroomId);
    } else {
      setSections([]);
    }
  }, [selectedClassroomId]);

  const loadClassrooms = async () => {
    try {
      const res = await api.get(`/api/academics/classrooms/?school=${schoolId}`);
      setClassrooms(res.data || []);
    } catch (err) {
      console.error('Failed to load classrooms:', err);
      toast.error('Failed to load classrooms');
    }
  };

  const loadSections = async (classroomId) => {
    try {
      const res = await api.get(`/api/academics/sections/?classroom=${classroomId}`);
      setSections(res.data || []);
    } catch (err) {
      console.error('Failed to load sections:', err);
      setSections([]);
    }
  };

  const handleEdit = () => {
    setFormData({
      name: subject.name || '',
      code: subject.code || ''
    });
    setFormErrors({});
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      toast.warning('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/api/academics/subjects/${subject.id}/`, {
        ...formData,
        school_id: schoolId
      });
      toast.success('Subject updated successfully!');
      setEditDialogOpen(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      const n = err.normalized || { message: 'Failed to update subject', fieldErrors: {}, suggestions: [] };
      setFormErrors(n.fieldErrors || {});
      toast.error(n.message);
      if (n.suggestions?.length) toast.info('Suggestions: ' + n.suggestions.join(', '));
    } finally {
      setSaving(false);
    }
  };

  const handleLinkTeacher = async () => {
    if (!selectedTeacherId) {
      toast.warning('Please select a teacher');
      return;
    }
    if (!selectedClassroomId) {
      toast.warning('Please select a classroom');
      return;
    }

    setSaving(true);
    try {
      // Link teacher to subject using the assignments endpoint
      await api.post('/api/academics/assignments/', {
        teacher_id: selectedTeacherId,
        subject_id: subject.id,
        classroom_id: selectedClassroomId,
        section_id: selectedSectionId || null
      });
      toast.success('Teacher linked successfully!');
      setLinkTeacherDialogOpen(false);
      setSelectedTeacherId('');
      setSelectedClassroomId('');
      setSelectedSectionId('');
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Link teacher error:', err);
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to link teacher';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Zoom in timeout={300}>
        <Card 
          elevation={2}
          sx={{ 
            borderRadius: 3,
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: 6
            },
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <CardContent sx={{ flexGrow: 1, p: 3 }}>
            <Stack spacing={2}>
              {/* Subject Header */}
              <Box sx={{ textAlign: 'center' }}>
                <Box 
                  sx={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    bgcolor: 'primary.light',
                    mb: 2
                  }}
                >
                  <BookIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                </Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 'bold',
                    color: 'text.primary',
                    mb: 1,
                    wordBreak: 'break-word'
                  }}
                >
                  {subject.name}
                </Typography>
                <Chip 
                  label={subject.code} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>

              <Divider />

              {/* Assigned Teachers */}
              <Box>
                <Typography 
                  variant="subtitle2" 
                  color="text.secondary" 
                  sx={{ mb: 1, fontWeight: 'bold' }}
                >
                  👨‍🏫 Assigned Teachers
                </Typography>
                {assignedTeachers.length > 0 ? (
                  <Stack spacing={1.5}>
                    {assignedTeachers.map((teacher, index) => (
                      <Card 
                        key={`${subject.id}-teacher-${teacher.id || teacher.user?.id || index}`} 
                        variant="outlined" 
                        sx={{ 
                          p: 1.5,
                          bgcolor: 'background.default',
                          borderRadius: 2
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar 
                            src={teacher.photo_url} 
                            sx={{ width: 40, height: 40 }}
                          >
                            {!teacher.photo_url && '👨‍🏫'}
                          </Avatar>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography 
                              variant="body2" 
                              sx={{ fontWeight: 'bold', wordBreak: 'break-word' }}
                            >
                              {`${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.username}
                            </Typography>
                            {teacher.email && (
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <EmailIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                                <Typography 
                                  variant="caption" 
                                  color="text.secondary"
                                  sx={{ 
                                    wordBreak: 'break-all',
                                    fontSize: '0.7rem'
                                  }}
                                >
                                  {teacher.email}
                                </Typography>
                              </Stack>
                            )}
                            {teacher.phone_number && (
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <PhoneIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                  {teacher.phone_number}
                                </Typography>
                              </Stack>
                            )}
                          </Box>
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                    No teachers assigned yet
                  </Typography>
                )}
              </Box>
            </Stack>
          </CardContent>

          <CardActions sx={{ p: 2, pt: 0, justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => {
                if (!isAuthenticated()) {
                  navigate('/login');
                  return;
                }
                setLinkTeacherDialogOpen(true);
              }}
              sx={{ flex: 1, minWidth: '120px', borderRadius: 2 }}
            >
              Link Teacher
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => {
                if (!isAuthenticated()) {
                  navigate('/login');
                  return;
                }
                handleEdit();
              }}
              sx={{ borderRadius: 2 }}
            >
              Edit
            </Button>
            <ProtectedButton
              size="small"
              color="error"
              onClick={onDelete}
              sx={{ 
                '&:hover': { bgcolor: 'error.light', color: 'white' },
                transition: 'all 0.2s'
              }}
            >
              <DeleteIcon fontSize="small" />
            </ProtectedButton>
          </CardActions>
        </Card>
      </Zoom>

      {/* Edit Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                ✏️ Edit Subject
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Update subject information
              </Typography>
            </Box>
            <IconButton onClick={() => setEditDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        
        <DialogContent dividers>
          <Stack spacing={3}>
            <TextField
              label="Subject Name *"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              fullWidth
              placeholder="e.g., Mathematics, বাংলা, English"
              error={!!formErrors.name}
              helperText={formErrors.name || 'Enter the full name of the subject'}
            />
            
            <TextField
              label="Subject Code *"
              value={formData.code}
              onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
              fullWidth
              placeholder="e.g., MATH, BANG, ENG"
              error={!!formErrors.code}
              helperText={formErrors.code || 'Short code for the subject (will be uppercase)'}
              inputProps={{ style: { textTransform: 'uppercase' } }}
            />
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Teacher Dialog */}
      <Dialog 
        open={linkTeacherDialogOpen} 
        onClose={() => setLinkTeacherDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                👨‍🏫 Link Teacher
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Assign a teacher to {subject.name}
              </Typography>
            </Box>
            <IconButton onClick={() => setLinkTeacherDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              select
              label="Select Teacher *"
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              fullWidth
              helperText="Choose a teacher to assign to this subject"
            >
              <MenuItem value="">-- Select Teacher --</MenuItem>
              {teachers.map((teacher) => {
                const user = teacher.user || teacher;
                const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
                return (
                  <MenuItem key={teacher.id || user.id} value={user.id}>
                    {name} ({user.email || user.username})
                  </MenuItem>
                );
              })}
            </TextField>

            <TextField
              select
              label="Select Classroom *"
              value={selectedClassroomId}
              onChange={(e) => setSelectedClassroomId(e.target.value)}
              fullWidth
              helperText="Choose the classroom for this assignment"
            >
              <MenuItem value="">-- Select Classroom --</MenuItem>
              {classrooms.map((classroom) => (
                <MenuItem key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Select Section (Optional)"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              fullWidth
              disabled={!selectedClassroomId}
              helperText="Choose a section if applicable"
            >
              <MenuItem value="">-- No Section --</MenuItem>
              {sections.map((section) => (
                <MenuItem key={section.id} value={section.id}>
                  {section.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLinkTeacherDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            startIcon={<PersonAddIcon />}
            onClick={handleLinkTeacher}
            disabled={saving}
          >
            {saving ? 'Linking...' : 'Link Teacher'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
