import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { isAuthenticated } from '../utils/auth';
import { useAcademics } from '../context/AcademicsContext';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  InputAdornment,
  Alert,
  Fade,
  Zoom,
  Badge
} from '@mui/material';
import ProtectedButton from '../components/ProtectedButton';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import SchoolIcon from '@mui/icons-material/School';
import ClassIcon from '@mui/icons-material/Class';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PeopleIcon from '@mui/icons-material/People';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';

export default function ClassroomsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { 
    classrooms, 
    sections, 
    students, 
    loading, 
    refreshClassrooms, 
    refreshSections, 
    refreshAll 
  } = useAcademics();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    section: ''
  });

  const [sectionFormData, setSectionFormData] = useState({
    name: '',
    classroom: ''
  });

  useEffect(() => {
    // Data is automatically loaded by the AcademicsContext when schoolId changes
    // We can refresh it if needed
    if (id) {
      refreshAll(id);
    }
  }, [id]); // Remove refreshAll from dependencies to prevent infinite loops

  // Debug log and set initial load complete
  useEffect(() => {
    console.log('Classrooms:', classrooms);
    console.log('Sections:', sections);
    
    // Set initial load complete when we have data and not loading
    if (!loading && classrooms && sections) {
      setInitialLoadComplete(true);
    }
  }, [classrooms, sections, loading]);

  const loadData = async () => {
    // Use the shared context to refresh data
    if (id) {
      await refreshAll(id);
      toast.success(`Refreshed class data`);
    }
  };

  const handleAddClass = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setEditMode(false);
    setSelectedItem(null);
    setFormData({ name: '', section: '' });
    setDialogOpen(true);
  };
  const handleEditClass = (classroom) => {
    setEditMode(true);
    setSelectedItem(classroom);
    // Ensure we capture all necessary fields from the classroom object
    setFormData({ 
      name: classroom.name,
      // Add any other fields that might be needed for the update
    });
    setDialogOpen(true);
  };

  const handleDeleteClass = (classroom) => {
    setSelectedItem(classroom);
    setDeleteDialogOpen(true);
  };

  const handleAddSection = (classroom) => {
    setSelectedClassroom(classroom);
    setSectionFormData({ name: '', classroom: classroom.id });
    setSectionDialogOpen(true);
  };

  const handleSaveClass = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!formData.name) {
      toast.error('Please enter a class name');
      return;
    }

    setSaving(true);
    try {
      if (editMode && selectedItem) {
        // Ensure we have the selectedItem and its ID before updating
        const response = await api.put(`/api/academics/classrooms/${selectedItem.id}/`, {
          ...formData,      // Apply updates
          school_id: id     // Ensure school ID is included
        });
        
        toast.success('Class updated successfully!');
      } else {
        // Create the classroom first
        const classResponse = await api.post('/api/academics/classrooms/', {
          name: formData.name,
          school_id: id
        });
        
        // If section is provided, create a section for this classroom
        if (formData.section) {
          try {
            await api.post('/api/academics/sections/', {
              name: formData.section,
              classroom_id: classResponse.data.id
            });
            toast.success('Class and section added successfully!');
          } catch (sectionErr) {
            console.error('Failed to create section:', sectionErr);
            toast.warning('Class created but failed to add section');
          }
        } else {
          toast.success('Class added successfully!');
        }
      }
      setDialogOpen(false);
      refreshAll(id); // Use context's refresh function instead of loadData
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.name?.[0] || err.response?.data?.detail || 'Failed to save class');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSection = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!sectionFormData.name) {
      toast.error('Please enter a section name');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/academics/sections/', {
        name: sectionFormData.name,
        classroom_id: sectionFormData.classroom
      });
      toast.success('Section added successfully!');
      setSectionDialogOpen(false);
      refreshAll(id); // Use context's refresh function instead of loadData
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.name?.[0] || err.response?.data?.detail || 'Failed to add section');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!selectedItem) return;
    setSaving(true);
    try {
      await api.delete(`/api/academics/classrooms/${selectedItem.id}/`);
      toast.success('Class deleted successfully!');
      setDeleteDialogOpen(false);
      refreshAll(id); // Use context's refresh function instead of loadData
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete class. It may have students enrolled.');
    } finally {
      setSaving(false);
    }
  };

  const getSectionsForClass = (classroomId) => {
    // Section.classroom is a nested object, so we need to check classroom.id
    const filtered = sections.filter(s => {
      const sectionClassroomId = s.classroom?.id || s.classroom;
      return String(sectionClassroomId) === String(classroomId);
    });
    return filtered;
  };

  const getStudentCountForClass = (classroomId) => {
    // Student.classroom may be nested object or id
    return (students || []).reduce((count, st) => {
      const stClassId = st.classroom?.id ?? st.classroom;
      return String(stClassId) === String(classroomId) ? count + 1 : count;
    }, 0);
  };

  // Bangla number words mapping for sorting
  const banglaNumberMap = {
    'প্রথম': 1,
    'দ্বিতীয়': 2,
    'দ্বিতীয়': 2,
    'তৃতীয়': 3,
    'তৃতীয়': 3,
    'চতুর্থ': 4,
    'পঞ্চম': 5,
    'ষষ্ঠ': 6,
    'সপ্তম': 7,
    'অষ্টম': 8,
    'নবম': 9,
    'দশম': 10,
    'একাদশ': 11,
    'দ্বাদশ': 12
  };

  const getClassOrder = (className) => {
    // Check for Bangla numbers
    for (const [bangla, num] of Object.entries(banglaNumberMap)) {
      if (className.includes(bangla)) {
        return num;
      }
    }
    
    // Check for English numbers (Class 6, Class 7, etc.)
    const match = className.match(/\d+/);
    if (match) {
      return parseInt(match[0]);
    }
    
    // Default: return a high number so it goes to the end
    return 999;
  };

  const filtered = useMemo(() => {
    return (classrooms || [])
      .filter(c => {
        const searchLower = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(searchLower);
      })
      .sort((a, b) => {
        const orderA = getClassOrder(a.name);
        const orderB = getClassOrder(b.name);
        return orderA - orderB;
      });
  }, [classrooms, searchQuery]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Fade in={initialLoadComplete} timeout={500}>
        <Paper 
          elevation={0}
          sx={{ 
            mb: 3, 
            p: 3, 
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white',
            borderRadius: 3
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
                <SchoolIcon sx={{ mr: 1, fontSize: 40 }} />
                শ্রেণী ব্যবস্থাপনা
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                আপনার স্কুলের শ্রেণী ও সেকশন পরিচালনা করুন
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button 
                variant="outlined" 
                startIcon={<ArrowBackIcon />} 
                onClick={() => navigate(-1)}
                sx={{ 
                  borderColor: 'rgba(255,255,255,0.5)', 
                  color: 'white',
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                }}
              >
                ব্যাক
              </Button>
              <Button 
                variant="contained" 
                startIcon={<AddIcon />} 
                onClick={handleAddClass}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  backdropFilter: 'blur(10px)'
                }}
              >
                শ্রেণী যোগ করুন
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<RefreshIcon />} 
                onClick={loadData}
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

      {/* Search Bar */}
      <Zoom in={initialLoadComplete} timeout={600}>
        <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
          <TextField
            fullWidth
            placeholder="শ্রেণী খুঁজুন..."
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

      {/* Content */}
      {loading ? (
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map(i => (
            <Grid size={{ xs: 12 }} key={i}>
              <CardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SchoolIcon}
          title={searchQuery ? "কোনো শ্রেণী পাওয়া যায়নি" : "এখনও কোনো শ্রেণী নেই"}
          message={searchQuery ? "অন্য কীওয়ার্ড দিয়ে চেষ্টা করুন" : "প্রথমে একটি শ্রেণী যোগ করুন"}
          actionText={!searchQuery ? "শ্রেণী যোগ করুন" : undefined}
          onAction={!searchQuery ? handleAddClass : undefined}
        />
      ) : (
        <Grid container spacing={2}>
          {filtered.map((classroom, index) => (
            <Grid size={{ xs: 12, md: 6 }} key={classroom.id}>
              <Zoom in={initialLoadComplete} timeout={700 + index * 100}>
                <Card 
                  elevation={3}
                  sx={{ 
                    borderRadius: 3,
                    transition: 'all 0.3s',
                    '&:hover': { 
                      transform: 'translateY(-4px)',
                      boxShadow: 6
                    },
                    cursor: 'pointer'
                  }}
                  onClick={() => window.location.assign(`/school/${id}/student?classroom=${encodeURIComponent(String(classroom.id))}`)}
                >
                  <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          sx={{
                            width: 50,
                            height: 50,
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <ClassIcon sx={{ color: 'white', fontSize: 30 }} />
                        </Box>
                        <Box>
                          <Typography variant="h6" fontWeight="bold">
                            {classroom.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {getSectionsForClass(classroom.id).length} সেকশন | {getStudentCountForClass(classroom.id)} শিক্ষার্থী
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack 
                        direction="row" 
                        spacing={1} 
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <Tooltip title="সেকশন যোগ করুন">
                          <ProtectedButton 
                            size="small" 
                            color="success"
                            onClick={(e) => { e.stopPropagation(); handleAddSection(classroom); }}
                            sx={{ 
                              '&:hover': { bgcolor: 'success.light', color: 'white' }
                            }}
                          >
                            <AddIcon fontSize="small" />
                          </ProtectedButton>
                        </Tooltip>
                        <Tooltip title="সম্পাদনা">
                          <ProtectedButton 
                            size="small" 
                            color="primary"
                            onClick={(e) => { e.stopPropagation(); handleEditClass(classroom); }}
                            sx={{ 
                              '&:hover': { bgcolor: 'primary.light', color: 'white' }
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </ProtectedButton>
                        </Tooltip>
                        <Tooltip title="মুছুন">
                          <ProtectedButton 
                            size="small" 
                            color="error"
                            onClick={(e) => { e.stopPropagation(); handleDeleteClass(classroom); }}
                            sx={{ 
                              '&:hover': { bgcolor: 'error.light', color: 'white' }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </ProtectedButton>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    {/* Sections */}
                    {getSectionsForClass(classroom.id).length > 0 ? (
                      <Stack spacing={1}>
                        {getSectionsForClass(classroom.id).map(section => (
                          <Chip
                            key={section.id}
                            label={`সেকশন ${section.name}`}
                            icon={<PeopleIcon />}
                            variant="outlined"
                            color="primary"
                            sx={{ justifyContent: 'flex-start' }}
                          />
                        ))}
                      </Stack>
                    ) : (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        এখনও কোনো সেকশন নেই। সেকশন যোগ করতে + বাটনে ক্লিক করুন।
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add/Edit Class Dialog */}
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
                {editMode ? '✏️ শ্রেণী সম্পাদনা' : '➕ নতুন শ্রেণী যোগ'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {editMode ? 'শ্রেণীর তথ্য হালনাগাদ করুন' : 'আপনার স্কুলের জন্য নতুন শ্রেণী তৈরি করুন'}
              </Typography>
            </Box>
            <IconButton onClick={() => setDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="শ্রেণীর নাম *"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              fullWidth
              placeholder="যেমন: ষষ্ঠ শ্রেণী, সপ্তম শ্রেণী, Class 6"
              helperText="শ্রেণীর নাম লিখুন"
            />
            <TextField
              label="সেকশন"
              value={formData.section || ''}
              onChange={(e) => setFormData({...formData, section: e.target.value})}
              fullWidth
              placeholder="যেমন: A, B, C, সকাল, বিকাল"
              helperText="সেকশনের নাম (ঐচ্ছিক)"
            />
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>বাতিল</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveClass}
            disabled={saving}
            startIcon={editMode ? <EditIcon /> : <AddIcon />}
          >
            {saving ? 'সংরক্ষণ হচ্ছে...' : (editMode ? 'আপডেট' : 'শ্রেণী যোগ করুন')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog 
        open={sectionDialogOpen} 
        onClose={() => setSectionDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                ➕ সেকশন যোগ
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedClassroom?.name} শ্রেণীতে নতুন সেকশন যোগ করুন
              </Typography>
            </Box>
            <IconButton onClick={() => setSectionDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        
        <DialogContent dividers>
          <TextField
            label="সেকশনের নাম *"
            value={sectionFormData.name}
            onChange={(e) => setSectionFormData({...sectionFormData, name: e.target.value})}
            fullWidth
            placeholder="যেমন: A, B, C, ক, খ"
            helperText="সেকশনের নাম লিখুন (সাধারণত A, B, C ইত্যাদি)"
          />
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSectionDialogOpen(false)}>বাতিল</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveSection}
            disabled={saving}
            startIcon={<AddIcon />}
          >
            {saving ? 'যোগ করা হচ্ছে...' : 'সেকশন যোগ করুন'}
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
            🗑️ শ্রেণী মুছবেন?
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না!
          </Alert>
          <Typography>
            আপনি কি নিশ্চিত যে <strong>{selectedItem?.name}</strong> শ্রেণীটি মুছে ফেলতে চান?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            এতে এই শ্রেণীর সব সেকশন মুছে যাবে এবং ভর্তিকৃত শিক্ষার্থীদের উপর প্রভাব পড়তে পারে।
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>বাতিল</Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={confirmDelete}
            disabled={saving}
            startIcon={<DeleteIcon />}
          >
            {saving ? 'মুছা হচ্ছে...' : 'মুছে ফেলুন'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stats Footer */}
      {!loading && classrooms.length > 0 && (
        <Fade in timeout={800}>
          <Paper 
            elevation={0} 
            sx={{ 
              mt: 3, 
              p: 2, 
              bgcolor: 'info.light',
              borderRadius: 2,
              textAlign: 'center'
            }}
          >
            <Typography variant="h6" color="info.dark">
              📊 মোট শ্রেণী: <strong>{classrooms.length}</strong> | 
              মোট সেকশন: <strong>{sections.length}</strong>
              {searchQuery && ` | দেখানো হচ্ছে: ${filtered.length}`}
            </Typography>
          </Paper>
        </Fade>
      )}
    </Box>
  );
}
