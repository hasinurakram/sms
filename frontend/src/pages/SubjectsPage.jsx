import React, { useEffect, useState } from 'react';
import DeleteIcon from "@mui/icons-material/Delete";
import { useParams, useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import api from '../utils/api';
import {
  Box,
  Typography,
  Grid,
  Button,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper,
  InputAdornment,
  Alert,
  Fade,
  Zoom,
  Card,
  CardContent,
  CardActionArea,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import BookIcon from '@mui/icons-material/Book';
import ClassIcon from '@mui/icons-material/Class';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmptyState from '../components/EmptyState';
import SubjectCard from '../components/SubjectCard';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';

export default function SubjectsPage() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [classSummary, setClassSummary] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    code: ''
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadSubjects();
    loadTeachers();
  }, [id]);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      // Load subjects first (school-wide)
      const subjectRes = await api.get(`/api/academics/subjects/?school=${id}`);
      const subjectsData = Array.isArray(subjectRes.data) ? subjectRes.data : subjectRes.data.results || [];
      setSubjects(subjectsData);

      // Load classes and derive naive counts (subjects are school-wide; assignments are optional)
      const classRes = await api.get(`/api/academics/classrooms/?school=${id}`);
      const classesData = Array.isArray(classRes.data) ? classRes.data : classRes.data.results || [];
      setClassrooms(classesData);

      const summary = classesData.map(classroom => ({
        id: classroom.id,
        name: classroom.name,
        subjectCount: subjectsData.length,
        subjects: subjectsData
      }));
      setClassSummary(summary);

      if (subjectsData.length > 0) {
        toast.success(`Loaded ${subjectsData.length} subjects`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    try {
      const res = await api.get(`/api/users/teachers/?school=${id}`);
      setTeachers(res.data);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    }
  };
  
  const handleClassSelect = (classroom) => {
    setSelectedClass(classroom);
  };
  
  const handleBackToClasses = () => {
    setSelectedClass(null);
  };

  const handleAdd = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setFormData({ name: '', code: '' });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleDelete = (subject) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setSelectedSubject(subject);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      toast.warning('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/academics/subjects/', {
        ...formData,
        school_id: id
      });
      toast.success('Subject added successfully!');
      setDialogOpen(false);
      loadSubjects();
    } catch (err) {
      console.error(err);
      const n = err.normalized || { message: 'Failed to save subject', fieldErrors: {}, suggestions: [] };
      setFormErrors(n.fieldErrors || {});
      toast.error(n.message);
      if (n.suggestions?.length) toast.info('Suggestions: ' + n.suggestions.join(', '));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/api/academics/subjects/${selectedSubject.id}/`);
      toast.success('Subject deleted successfully!');
      setDeleteDialogOpen(false);
      loadSubjects();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete subject. It may be in use.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = subjects
    .filter(s => {
      // First filter by selected class if any
      if (selectedClass) {
        // Fallback: show all subjects for now because assignments are optional
      }
      
      // Then filter by search query
      const searchLower = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(searchLower) ||
             s.code.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      // Sort by subject ID (ascending) - first added subject appears first
      return a.id - b.id;
    });

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Fade in timeout={500}>
        <Paper 
          elevation={0}
          sx={{ 
            mb: 3, 
            p: 3, 
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            borderRadius: 3
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
                {selectedClass ? (
                  <>
                    <ClassIcon sx={{ mr: 1, fontSize: 40 }} />
                    {selectedClass.name} বিষয়
                  </>
                ) : (
                  <>
                    <BookIcon sx={{ mr: 1, fontSize: 40 }} />
                    বিষয় ব্যবস্থাপনা
                  </>
                )}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {selectedClass 
                  ? `${selectedClass.name} শ্রেণীর বিষয়সমূহ পরিচালনা করুন`
                  : 'বিষয় যোগ, সম্পাদনা এবং শিক্ষকদের সংযুক্ত করুন'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                স্কুল আইডি: {id} | মোট বিষয়: {subjects.length} | শিক্ষক: {teachers.length}
                {selectedClass && ` | শ্রেণীর বিষয়: ${filtered.length}`}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {selectedClass && (
                <Button 
                  variant="outlined" 
                  startIcon={<ArrowBackIcon />} 
                  onClick={handleBackToClasses}
                  sx={{ 
                    borderColor: 'rgba(255,255,255,0.5)', 
                    color: 'white',
                    '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                  }}
                >
                  শ্রেণী তালিকা
                </Button>
              )}
              <Button 
                variant="contained" 
                startIcon={<AddIcon />} 
                onClick={() => {
                  if (!isAuthenticated()) {
                    navigate('/login');
                    return;
                  }
                  handleAdd();
                }}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  backdropFilter: 'blur(10px)'
                }}
              >
                বিষয় যোগ করুন
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<RefreshIcon />} 
                onClick={() => {
                  loadSubjects();
                  loadTeachers();
                }}
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
      </Fade>

      {/* Search Bar - Only show when a class is selected */}
      {selectedClass && (
        <Zoom in timeout={600}>
          <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <TextField
              fullWidth
              placeholder="নাম বা কোড দিয়ে বিষয় খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                }
              }}
            />
          </Paper>
        </Zoom>
      )}

      {/* Content */}
      {loading ? (
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
              <CardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : !selectedClass ? (
        // Class Summary View
        classSummary.length === 0 ? (
          <EmptyState
            icon={ClassIcon}
            title="No classes yet"
            message="Start by adding classes to organize your subjects"
          />
        ) : (
          <Fade in timeout={700}>
            <Grid container spacing={2}>
              {classSummary.map((classroom) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={classroom.id}>
                  <Card 
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4
                      }
                    }}
                  >
                    <CardActionArea 
                      onClick={() => handleClassSelect(classroom)}
                      sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', height: '100%' }}
                    >
                      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h5" component="div" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                          <ClassIcon sx={{ mr: 1, color: 'primary.main' }} />
                          {classroom.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {classroom.subjectCount} {classroom.subjectCount === 1 ? 'Subject' : 'Subjects'} assigned
                        </Typography>
                        <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                          <Chip 
                            label={`View ${classroom.subjectCount} Subjects`} 
                            color="primary" 
                            size="small" 
                            variant="outlined"
                          />
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Fade>
        )
      ) : filtered.length === 0 ? (
        // Empty state for selected class with no subjects
        <EmptyState
          icon={BookIcon}
          title={searchQuery ? "No subjects found" : `No subjects in ${selectedClass.name}`}
          message={searchQuery ? "Try a different search term" : "Start by adding subjects to this class"}
          actionText="Add Subject"
          onAction={handleAdd}
        />
      ) : (
        // Subject cards for selected class
        <Fade in timeout={700}>
          <Grid container spacing={2}>
            {filtered.map((subject) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={subject.id}>
                <SubjectCard
                  subject={subject}
                  teachers={teachers}
                  onUpdate={loadSubjects}
                  onDelete={() => handleDelete(subject)}
                  schoolId={id}
                />
              </Grid>
            ))}
          </Grid>
        </Fade>
      )}

      {/* Add Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                ➕ Add New Subject
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create a new subject for your school
              </Typography>
            </Box>
            <IconButton onClick={() => setDialogOpen(false)}>
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
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSave}
            disabled={saving}
            startIcon={<AddIcon />}
          >
            {saving ? 'Saving...' : 'Add Subject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        TransitionComponent={Zoom}
      >
        <DialogTitle>
          <Typography variant="h6" color="error" fontWeight="bold">
            🗑️ Delete Subject?
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone!
          </Alert>
          <Typography>
            Are you sure you want to delete <strong>{selectedSubject?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This may affect teachers and students assigned to this subject.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={confirmDelete}
            disabled={saving}
            startIcon={<DeleteIcon />}
          >
            {saving ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stats Footer */}
      {!loading && (
        <Fade in timeout={800}>
          <Paper 
            elevation={0} 
            sx={{ 
              mt: 3, 
              p: 2, 
              bgcolor: 'primary.light',
              borderRadius: 2,
              textAlign: 'center'
            }}
          >
            <Typography variant="h6" color="primary.dark">
              {selectedClass ? (
                <>
                  📊 {selectedClass.name} বিষয়: <strong>{filtered.length}</strong> / মোট {subjects.length}
                  {searchQuery && ` | অনুসন্ধান ফলাফল: ${filtered.length}`}
                </>
              ) : (
                <>
                  📊 মোট শ্রেণী: <strong>{classSummary.length}</strong> | মোট বিষয়: <strong>{subjects.length}</strong>
                </>
              )}
            </Typography>
          </Paper>
        </Fade>
      )}
    </Box>
  );
}
