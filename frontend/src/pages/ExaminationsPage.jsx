import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Button,
  Stack,
  TextField,
  Autocomplete,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton
} from '@mui/material';
import {
  Assignment as ExamIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  School as SchoolIcon,
  FilterList as FilterIcon,
  Autorenew as RecalcIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../utils/api';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import ProtectedButton from '../components/ProtectedButton';
import { isAuthenticated } from '../utils/auth';

const EXAM_TYPES = [
  { value: 'half_yearly', label: 'অর্ধবার্ষিক' },
  { value: 'annual', label: 'বার্ষিক' },
  { value: 'test', label: 'বিশেষ মূল্যায়ন' },
  { value: 'terminal', label: 'টার্মিনাল' },
  { value: 'model', label: 'মডেল টেস্ট' }
];

export default function ExaminationsPage() {
  const { id } = useParams(); // school id
  const navigate = useNavigate();
  const [examinations, setExaminations] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, exam: null });
  const toast = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    exam_type: 'test',
    classroom: '',
    section: '',
    exam_date: null,
    total_marks: 100,
    pass_marks: 33,
    written_max: 0,
    mcq_max: 0,
    practical_max: 0
  });

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    subjects: [],
    exam_type: 'half_yearly',
    exam_date: null,
    total_marks: 100,
    pass_marks: 33,
    classrooms: [],
    sections: [],
    written_max: 0,
    mcq_max: 0,
    practical_max: 0
  });
  const [bulkSections, setBulkSections] = useState([]);
  const [bulkSubjects, setBulkSubjects] = useState([]);

  const resetBulkForm = () => {
    setBulkForm({
      subjects: [],
      exam_type: 'half_yearly',
      exam_date: null,
      total_marks: 100,
      pass_marks: 33,
      classrooms: [],
      sections: [],
      written_max: 0,
      mcq_max: 0,
      practical_max: 0
    });
    setBulkSections([]);
  };

  const closeBulkDialog = () => {
    setBulkDialogOpen(false);
    resetBulkForm();
  };

  useEffect(() => {
    if (bulkDialogOpen) {
      // Initialize classroom selection: preselect current filter if any, else keep as-is
      setBulkForm(prev => ({
        ...prev,
        classrooms: selectedClassroom ? [selectedClassroom.id] : [],
        sections: []
      }));
    }
  }, [bulkDialogOpen, selectedClassroom]);

  useEffect(() => {
    (async () => {
      try {
        if (!bulkDialogOpen) return;
        if (classrooms && classrooms.length > 0) return;
        const res = await api.get(`/api/academics/classrooms/?school=${id}`);
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setClassrooms(data);
      } catch (_) {
        setClassrooms([]);
      }
    })();
  }, [bulkDialogOpen, id]);

  // Load subjects for subject dropdown on bulk dialog open
  useEffect(() => {
    (async () => {
      try {
        if (!bulkDialogOpen || !id) return;
        let url = `/api/academics/subjects/?school=${id}`;
        const all = [];
        while (url) {
          const res = await api.get(url);
          const data = res.data;
          const items = Array.isArray(data) ? data : (data?.results || []);
          all.push(...items);
          url = Array.isArray(data) ? null : (data?.next || null);
        }
        setBulkSubjects(all);
      } catch (_) {
        setBulkSubjects([]);
      }
    })();
  }, [bulkDialogOpen, id]);

  // Load sections for selected classes in bulk dialog
  useEffect(() => {
    (async () => {
      try {
        if (!bulkDialogOpen) return;
        const classIds = bulkForm.classrooms || [];
        if (classIds.length === 0) { setBulkSections([]); setBulkForm(prev => ({ ...prev, sections: [] })); return; }
        const all = [];
        for (const cid of classIds) {
          try {
            const res = await api.get(`/api/academics/sections/?classroom=${cid}`);
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            data.forEach(d => all.push(d));
          } catch (_) {}
        }
        // Deduplicate by id
        const uniq = [];
        const seen = new Set();
        for (const s of all) { if (!seen.has(s.id)) { seen.add(s.id); uniq.push(s); } }
        setBulkSections(uniq);
        // Remove any previously selected sections that no longer belong to selected classes
        setBulkForm(prev => ({ ...prev, sections: (prev.sections || []).filter(sid => uniq.some(u => u.id === sid)) }));
      } catch (_) {
        setBulkSections([]);
      }
    })();
  }, [bulkDialogOpen, bulkForm.classrooms]);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  // Load sections when a classroom is chosen inside the dialog
  useEffect(() => {
    const clsId = formData.classroom;
    if (dialogOpen && clsId) {
      (async () => {
        try {
          const res = await api.get(`/api/academics/sections/?classroom=${clsId}`);
          setSections(Array.isArray(res.data) ? res.data : res.data?.results || []);
        } catch (_) {
          setSections([]);
        }
      })();
    } else if (dialogOpen && !clsId) {
      setSections([]);
      // Ensure section clears if classroom cleared
      setFormData(prev => ({ ...prev, section: '' }));
    }
  }, [dialogOpen, formData.classroom]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [examsRes, classroomsRes] = await Promise.all([
        api.get(`/api/results/examinations/?school=${id}`),
        api.get(`/api/academics/classrooms/?school=${id}`)
      ]);
      
      setExaminations(Array.isArray(examsRes.data) ? examsRes.data : examsRes.data.results || []);
      const rawCls = Array.isArray(classroomsRes.data) ? classroomsRes.data : classroomsRes.data.results || [];
      const bnDigits = { '০':0,'১':1,'২':2,'৩':3,'৪':4,'৫':5,'৬':6,'৭':7,'৮':8,'৯':9 };
      const parseBn = (s) => String(s||'').replace(/[০-৯]/g, d => (bnDigits[d] ?? d));
      const gFromName = (name) => {
        const t = parseBn(name).toLowerCase();
        if (/(^|\D)6(\D|$)/.test(t) || t.includes('ষষ্ঠ')) return 6;
        if (/(^|\D)7(\D|$)/.test(t) || t.includes('সপ্তম')) return 7;
        if (/(^|\D)8(\D|$)/.test(t) || t.includes('অষ্টম')) return 8;
        if (/(^|\D)9(\D|$)/.test(t) || t.includes('নবম')) return 9;
        if (/(^|\D)10(\D|$)/.test(t) || t.includes('দশম')) return 10;
        return null;
      };
      const sorted = [...rawCls].sort((a,b) => {
        const ga = gFromName(a.name);
        const gb = gFromName(b.name);
        const oa = ga ? ga : 1000;
        const ob = gb ? gb : 1000;
        if (oa !== ob) return oa - ob;
        return String(a.name||'').localeCompare(String(b.name||''));
      });
      setClassrooms(sorted);
      toast.success('Data loaded successfully');
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDialogOpen = (exam = null) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (exam) {
      setEditingExam(exam);
      setFormData({
        name: exam.name,
        exam_type: exam.exam_type,
        classroom: exam.classroom,
        section: exam.section || '',
        exam_date: exam.exam_date ? new Date(exam.exam_date) : null,
        total_marks: exam.total_marks,
        pass_marks: exam.pass_marks,
        written_max: exam.written_max || 0,
        mcq_max: exam.mcq_max || 0,
        practical_max: exam.practical_max || 0
      });
    } else {
      setEditingExam(null);
      setFormData({
        name: '',
        exam_type: 'test',
        classroom: '',
        section: '',
        exam_date: null,
        total_marks: 100,
        pass_marks: 33,
        written_max: 0,
        mcq_max: 0,
        practical_max: 0
      });
    }
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingExam(null);
    setFormData({
      name: '',
      exam_type: 'test',
      classroom: '',
      section: '',
      exam_date: null,
      total_marks: 100,
      pass_marks: 33,
      written_max: 0,
      mcq_max: 0,
      practical_max: 0
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const roundPass = (max) => {
    const n = parseFloat(max || 0);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.round(n / 3);
  };

  // Auto update total/pass based on maxima in Add/Edit dialog
  useEffect(() => {
    const w = parseInt(formData.written_max || 0) || 0;
    const m = parseInt(formData.mcq_max || 0) || 0;
    const p = parseInt(formData.practical_max || 0) || 0;
    const total = w + m + p;
    const passSum = roundPass(w) + roundPass(m) + roundPass(p);
    if (total > 0) {
      setFormData(prev => ({ ...prev, total_marks: total, pass_marks: passSum }));
    }
  }, [formData.written_max, formData.mcq_max, formData.practical_max]);

  useEffect(() => {
    const w = parseInt(bulkForm.written_max || 0) || 0;
    const m = parseInt(bulkForm.mcq_max || 0) || 0;
    const p = parseInt(bulkForm.practical_max || 0) || 0;
    const total = w + m + p;
    const passSum = roundPass(w) + roundPass(m) + roundPass(p);
    if (total > 0) {
      setBulkForm(prev => ({ ...prev, total_marks: total, pass_marks: passSum }));
    }
  }, [bulkForm.written_max, bulkForm.mcq_max, bulkForm.practical_max]);

  const handleSubmit = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!formData.name || !formData.classroom) {
      toast.error('Name and Classroom are required');
      return;
    }

    const examData = {
      ...formData,
      school: parseInt(id),
      exam_date: formData.exam_date ? formData.exam_date.toISOString().split('T')[0] : null,
      section: formData.section ? Number(formData.section) : null,
      written_max: parseInt(formData.written_max || 0) || null,
      mcq_max: parseInt(formData.mcq_max || 0) || null,
      practical_max: parseInt(formData.practical_max || 0) || null
    };

    try {
      if (editingExam) {
        await api.put(`/api/results/examinations/${editingExam.id}/`, examData);
        toast.success('Examination updated successfully');
      } else {
        await api.post('/api/results/examinations/', examData);
        toast.success('Examination created successfully');
      }
      handleDialogClose();
      loadData();
    } catch (error) {
      console.error('Error saving examination:', error);
      toast.error(`Failed to ${editingExam ? 'update' : 'create'} examination`);
    }
  };

  const handleDelete = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!deleteDialog.exam) return;
    
    try {
      await api.delete(`/api/results/examinations/${deleteDialog.exam.id}/`);
      toast.success('Examination deleted successfully');
      setDeleteDialog({ open: false, exam: null });
      loadData();
    } catch (error) {
      console.error('Error deleting examination:', error);
      toast.error('Failed to delete examination');
    }
  };

  const getExamTypeLabel = (type) => {
    const examType = EXAM_TYPES.find(t => t.value === type);
    return examType ? examType.label : type;
  };

  // Filter examinations by selected classroom
  const filteredExaminations = selectedClassroom
    ? examinations.filter(exam => exam.classroom === selectedClassroom.id)
    : examinations;

  // Get exam count per classroom
  const getClassroomExamCount = (classroomId) => {
    return examinations.filter(exam => exam.classroom === classroomId).length;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4">
              <ExamIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              পরীক্ষাসমূহ
            </Typography>
            {selectedClassroom && (
              <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1 }}>
                <FilterIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} />
                দেখানো হচ্ছে: {selectedClassroom.name}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={() => {
                if (!isAuthenticated()) {
                  navigate('/login');
                  return;
                }
                setBulkDialogOpen(true);
              }}
            >
              বিষয়ভিত্তিক নাম্বার সেট করুন
            </Button>
            {selectedClassroom && (
              <Button
                variant="outlined"
                onClick={() => setSelectedClassroom(null)}
              >
                সব শ্রেণী দেখাও
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleDialogOpen()}
              sx={{ minWidth: 150 }}
            >
              পরীক্ষা যোগ করুন
            </Button>
          </Stack>
        </Stack>

        {/* Class Selection Cards */}
        {!selectedClassroom && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <SchoolIcon sx={{ mr: 1 }} />
              পরীক্ষাসমূহ দেখতে শ্রেণী নির্বাচন করুন
            </Typography>
            <Grid container spacing={2}>
              {classrooms.map((classroom) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={classroom.id}>
                  <Paper
                    sx={{
                      p: 3,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      border: '2px solid transparent',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                        borderColor: 'primary.main'
                      }
                    }}
                    onClick={() => setSelectedClassroom(classroom)}
                  >
                    <Stack spacing={1} alignItems="center">
                      <SchoolIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                      <Typography variant="h6" fontWeight="bold">
                        {classroom.name}
                      </Typography>
                      <Chip
                        label={`${getClassroomExamCount(classroom.id)} টি পরীক্ষা`}
                        color="primary"
                        size="small"
                      />
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {loading && <TableSkeleton rows={10} columns={8} />}

        {!loading && filteredExaminations.length === 0 && selectedClassroom && (
          <EmptyState
            icon={ExamIcon}
            title="এই শ্রেণীর জন্য কোনো পরীক্ষা নেই"
            message={`${selectedClassroom.name} শ্রেণীর জন্য কোনো পরীক্ষা পাওয়া যায়নি। 'পরীক্ষা যোগ করুন' বাটনে ক্লিক করে নতুন পরীক্ষা তৈরি করুন।`}
          />
        )}

        {!loading && examinations.length === 0 && !selectedClassroom && (
          <EmptyState
            icon={ExamIcon}
            title="এখনও কোনো পরীক্ষা নেই"
            message="প্রথম পরীক্ষা তৈরি করতে 'পরীক্ষা যোগ করুন' ক্লিক করুন"
          />
        )}

        {!loading && filteredExaminations.length > 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>নাম</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ধরন</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>শ্রেণি</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>সেকশন</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>তারিখ</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">মোট নম্বর</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">পাশ নম্বর</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">অ্যাকশন</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredExaminations.map((exam) => (
                  <TableRow key={exam.id} hover>
                    <TableCell>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {exam.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getExamTypeLabel(exam.exam_type)} 
                        color="primary" 
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{exam.classroom_name}</TableCell>
                    <TableCell>{exam.section_name || '-'}</TableCell>
                    <TableCell>
                      {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell align="center">{exam.total_marks}</TableCell>
                    <TableCell align="center">{exam.pass_marks}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1}>
                        <ProtectedButton
                          size="small"
                          onClick={() => handleDialogOpen(exam)}
                          color="primary"
                        >
                          <EditIcon />
                        </ProtectedButton>
                        <ProtectedButton
                          size="small"
                          onClick={() => setDeleteDialog({ open: true, exam })}
                          color="error"
                        >
                          <DeleteIcon />
                        </ProtectedButton>
                        <ProtectedButton
                          size="small"
                          onClick={async () => {
                            try {
                              await api.post(`/api/results/examinations/${exam.id}/recalculate/`);
                              toast.success('রেজাল্ট পুনরায় গণনা করা হয়েছে');
                            } catch (e) {
                              console.error(e);
                              toast.error('রেজাল্ট পুনরায় গণনা ব্যর্থ হয়েছে');
                            }
                          }}
                          color="secondary"
                        >
                          <RecalcIcon />
                        </ProtectedButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingExam ? 'পরীক্ষা সম্পাদনা' : 'নতুন পরীক্ষা যোগ'}
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="পরীক্ষার নাম *"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="উদাহরণ: বাংলা-১ম পরীক্ষা ২০২৫"
                />
              </Grid>
              
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="পরীক্ষার ধরন"
                  value={formData.exam_type}
                  onChange={(e) => handleInputChange('exam_type', e.target.value)}
                >
                  {EXAM_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="পরীক্ষার তারিখ"
                  value={formData.exam_date}
                  onChange={(date) => handleInputChange('exam_date', date)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="শ্রেণি *"
                  value={formData.classroom}
                  onChange={(e) => handleInputChange('classroom', e.target.value)}
                >
                  {classrooms.map((classroom) => (
                    <MenuItem key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="সেকশন (ঐচ্ছিক)"
                  value={formData.section}
                  onChange={(e) => handleInputChange('section', e.target.value)}
                  disabled={!formData.classroom}
                >
                  <MenuItem value="">সব সেকশন</MenuItem>
                  {sections.map(sec => (
                    <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="মোট নম্বর"
                  value={formData.total_marks}
                  onChange={(e) => handleInputChange('total_marks', parseInt(e.target.value) || 0)}
                  inputProps={{ min: 1 }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="পাশ নম্বর"
                  value={formData.pass_marks}
                  onChange={(e) => handleInputChange('pass_marks', parseInt(e.target.value) || 0)}
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid size={12}>
                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>বিষয়ভিত্তিক নম্বর বিভাজন</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="CQ মোট"
                  value={formData.written_max}
                  onChange={(e) => handleInputChange('written_max', parseInt(e.target.value) || 0)}
                  helperText={`পাশ: ${roundPass(formData.written_max)} (মোটের ১/৩ রাউন্ড)`}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="MCQ মোট"
                  value={formData.mcq_max}
                  onChange={(e) => handleInputChange('mcq_max', parseInt(e.target.value) || 0)}
                  helperText={`পাশ: ${roundPass(formData.mcq_max)} (মোটের ১/৩ রাউন্ড)`}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="প্র্যাকটিক্যাল মোট"
                  value={formData.practical_max}
                  onChange={(e) => handleInputChange('practical_max', parseInt(e.target.value) || 0)}
                  helperText={`পাশ: ${roundPass(formData.practical_max)} (মোটের ১/৩ রাউন্ড)`}
                  inputProps={{ min: 0 }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose}>বাতিল</Button>
            <Button onClick={handleSubmit} variant="contained">
              {editingExam ? 'আপডেট' : 'তৈরি করুন'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Bulk Subject Marks Dialog */}
        <Dialog open={bulkDialogOpen} onClose={closeBulkDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            সকল শ্রেণীর জন্য নাম্বার সেট
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid size={12}>
                <Autocomplete
                  freeSolo
                  multiple
                  options={(bulkSubjects || []).map(s => s.name || s.title || '')
                    .filter(Boolean)
                    .filter((v, i, a) => a.indexOf(v) === i)}
                  value={bulkForm.subjects || []}
                  onChange={(_, newValue) => setBulkForm(prev => ({ ...prev, subjects: (newValue || []).filter(v => String(v).trim().length > 0) }))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      label="বিষয়ের নামগুলো"
                      placeholder="উদাহরণ: বাংলা, গণিত, ধর্ম"
                      helperText="Subjects পেজ থেকে ফেচ করা তালিকা; প্রয়োজনে নতুন নাম টাইপ করে Enter চাপুন"
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  select
                  fullWidth
                  label="যে শ্রেণীগুলোর জন্য প্রযোজ্য"
                  value={bulkForm.classrooms}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, classrooms: typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : e.target.value }))}
                  SelectProps={{ multiple: true, renderValue: (selected) => {
                    const ids = Array.isArray(selected) ? selected : [];
                    if (!ids.length) return 'ফাঁকা রাখলে সব শ্রেণীতে প্রযোজ্য';
                    return ids.map(idv => {
                      const match = classrooms.find(c => Number(c.id) === Number(idv));
                      return match?.name || String(idv);
                    }).join(', ');
                  }}}
                  helperText="যে শ্রেণীগুলোর মধ্যে এই বিষয়টি আছে সেগুলো সিলেক্ট করুন (ফাঁকা রাখলে সব শ্রেণী)"
                >
                  {classrooms.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={12}>
                <TextField
                  select
                  fullWidth
                  disabled={!bulkForm.classrooms || bulkForm.classrooms.length === 0}
                  label="যে সেকশনগুলোর জন্য প্রযোজ্য (ঐচ্ছিক)"
                  value={bulkForm.sections}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, sections: typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : e.target.value }))}
                  SelectProps={{ multiple: true, renderValue: (selected) => {
                    const ids = Array.isArray(selected) ? selected : [];
                    if (!ids.length) return 'নির্বাচন না করলে সব সেকশন (প্রযোজ্য ক্লাসে)';
                    return ids.map(idv => bulkSections.find(s => s.id === idv)?.name || idv).join(', ');
                  }}}
                  helperText="প্রয়োজনে নির্দিষ্ট সেকশনগুলি সিলেক্ট করুন; ফাঁকা রাখলে নির্বাচিত শ্রেণীর সব সেকশনে প্রযোজ্য"
                >
                  {bulkSections.map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="পরীক্ষার ধরন"
                  value={bulkForm.exam_type}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, exam_type: e.target.value }))}
                >
                  {EXAM_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="পরীক্ষার তারিখ (ঐচ্ছিক)"
                  value={bulkForm.exam_date}
                  onChange={(date) => setBulkForm(prev => ({ ...prev, exam_date: date }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="মোট"
                  value={bulkForm.total_marks}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, total_marks: parseInt(e.target.value) || 0 }))}
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="পাশ"
                  value={bulkForm.pass_marks}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, pass_marks: parseInt(e.target.value) || 0 }))}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid size={12}>
                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>বিষয়ভিত্তিক নম্বর বিভাজন</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="CQ মোট"
                  value={bulkForm.written_max}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, written_max: parseInt(e.target.value) || 0 }))}
                  helperText={`পাশ: ${roundPass(bulkForm.written_max)} (মোটের ১/৩ রাউন্ড)`}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="MCQ মোট"
                  value={bulkForm.mcq_max}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, mcq_max: parseInt(e.target.value) || 0 }))}
                  helperText={`পাশ: ${roundPass(bulkForm.mcq_max)} (মোটের ১/৩ রাউন্ড)`}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="প্র্যাকটিক্যাল মোট"
                  value={bulkForm.practical_max}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, practical_max: parseInt(e.target.value) || 0 }))}
                  helperText={`পাশ: ${roundPass(bulkForm.practical_max)} (মোটের ১/৩ রাউন্ড)`}
                  inputProps={{ min: 0 }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeBulkDialog} disabled={bulkLoading}>বাতিল</Button>
            <Button onClick={async () => {
              if (!isAuthenticated()) { navigate('/login'); return; }
              const subjects = (bulkForm.subjects || []).map(s => String(s).trim()).filter(Boolean);
              if (subjects.length === 0) { toast.error('বিষয়ের নাম দিন'); return; }
              try {
                setBulkLoading(true);
                let success = 0;
                const selectedClasses = (!bulkForm.classrooms || bulkForm.classrooms.length === 0)
                  ? classrooms
                  : classrooms.filter(c => bulkForm.classrooms.includes(c.id));
                const selectedClassIds = new Set(selectedClasses.map(c => c.id));

                const applyToSections = (bulkForm.sections && bulkForm.sections.length > 0);
                if (applyToSections) {
                  const selectedSections = bulkSections.filter(s => bulkForm.sections.includes(s.id) && selectedClassIds.has(s.classroom?.id ?? s.classroom));
                  for (const sec of selectedSections) {
                    const classroomId = sec.classroom?.id ?? sec.classroom;
                    for (const subj of subjects) {
                      const subjKey = subj.trim().toLowerCase();
                      const exists = examinations.find(ex => ex.classroom === classroomId && (ex.section === sec.id) && ex.exam_type === bulkForm.exam_type && (ex.name || '').trim().toLowerCase() === subjKey);
                      if (exists) {
                        await api.put(`/api/results/examinations/${exists.id}/`, {
                          name: exists.name,
                          exam_type: bulkForm.exam_type,
                          classroom: classroomId,
                          section: sec.id,
                          exam_date: bulkForm.exam_date ? bulkForm.exam_date.toISOString().split('T')[0] : (exists.exam_date || null),
                          total_marks: bulkForm.total_marks,
                          pass_marks: bulkForm.pass_marks,
                          written_max: parseInt(bulkForm.written_max || 0) || null,
                          mcq_max: parseInt(bulkForm.mcq_max || 0) || null,
                          practical_max: parseInt(bulkForm.practical_max || 0) || null,
                          school: parseInt(id)
                        });
                        success += 1;
                      } else {
                        await api.post('/api/results/examinations/', {
                          name: subj,
                          exam_type: bulkForm.exam_type,
                          classroom: classroomId,
                          section: sec.id,
                          exam_date: bulkForm.exam_date ? bulkForm.exam_date.toISOString().split('T')[0] : null,
                          total_marks: bulkForm.total_marks,
                          pass_marks: bulkForm.pass_marks,
                          written_max: parseInt(bulkForm.written_max || 0) || null,
                          mcq_max: parseInt(bulkForm.mcq_max || 0) || null,
                          practical_max: parseInt(bulkForm.practical_max || 0) || null,
                          school: parseInt(id)
                        });
                        success += 1;
                      }
                    }
                  }
                } else {
                  for (const classroom of selectedClasses) {
                    for (const subj of subjects) {
                      const subjKey = subj.trim().toLowerCase();
                      const exists = examinations.find(ex => ex.classroom === classroom.id && (ex.section === null || ex.section === undefined) && ex.exam_type === bulkForm.exam_type && (ex.name || '').trim().toLowerCase() === subjKey);
                      if (exists) {
                        await api.put(`/api/results/examinations/${exists.id}/`, {
                          name: exists.name,
                          exam_type: bulkForm.exam_type,
                          classroom: classroom.id,
                          section: null,
                          exam_date: bulkForm.exam_date ? bulkForm.exam_date.toISOString().split('T')[0] : (exists.exam_date || null),
                          total_marks: bulkForm.total_marks,
                          pass_marks: bulkForm.pass_marks,
                          written_max: parseInt(bulkForm.written_max || 0) || null,
                          mcq_max: parseInt(bulkForm.mcq_max || 0) || null,
                          practical_max: parseInt(bulkForm.practical_max || 0) || null,
                          school: parseInt(id)
                        });
                        success += 1;
                      } else {
                        await api.post('/api/results/examinations/', {
                          name: subj,
                          exam_type: bulkForm.exam_type,
                          classroom: classroom.id,
                          section: null,
                          exam_date: bulkForm.exam_date ? bulkForm.exam_date.toISOString().split('T')[0] : null,
                          total_marks: bulkForm.total_marks,
                          pass_marks: bulkForm.pass_marks,
                          written_max: parseInt(bulkForm.written_max || 0) || null,
                          mcq_max: parseInt(bulkForm.mcq_max || 0) || null,
                          practical_max: parseInt(bulkForm.practical_max || 0) || null,
                          school: parseInt(id)
                        });
                        success += 1;
                      }
                    }
                  }
                }
                toast.success(`সফলভাবে ${success} টি সেটিং সম্পন্ন হয়েছে`);
                closeBulkDialog();
                loadData();
              } catch (e) {
                console.error(e);
                toast.error('সেট করতে ব্যর্থ হয়েছে');
              } finally {
                setBulkLoading(false);
              }
            }} variant="contained" disabled={bulkLoading}>{bulkLoading ? 'সেট করা হচ্ছে...' : 'সেট করুন'}</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ open: false, exam: null })}
          onConfirm={handleDelete}
          title="পরীক্ষা মুছুন"
          message={`আপনি কি নিশ্চিত আপনি "${deleteDialog.exam?.name}" পরীক্ষা মুছে ফেলতে চান? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না এবং সংশ্লিষ্ট সব রেজাল্টও মুছে যাবে।`}
        />
      </Box>
    </LocalizationProvider>
  );
}
