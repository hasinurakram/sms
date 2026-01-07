import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Stack,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  IconButton,
  Autocomplete
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import ProtectedButton from '../components/ProtectedButton';
import { scopedGet } from '../utils/schoolApi';
import { isAuthenticated } from '../utils/auth';

// Examination types mapping (labels)
const EXAM_TYPES = [
  { value: 'half_yearly', label: 'অর্ধবার্ষিক' },
  { value: 'annual', label: 'বার্ষিক' },
  { value: 'test', label: 'বিশেষ মূল্যায়ন' },
  { value: 'terminal', label: 'টার্মিনাল' },
  { value: 'model', label: 'মডেল টেস্ট' }
];

const getExamTypeLabel = (type) => {
  const t = EXAM_TYPES.find(x => x.value === type);
  return t ? t.label : (type || 'Examination');
};

export default function ResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  
  // Examinations
  const [examinations, setExaminations] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  
  // Results
  const [results, setResults] = useState([]);
  const [overallResults, setOverallResults] = useState([]);
  
  // Add Results Dialog
  const [addResultsDialogOpen, setAddResultsDialogOpen] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  // Section selection for Add Result dialog
  const [sectionsForAdd, setSectionsForAdd] = useState([]);
  const [selectedSectionAdd, setSelectedSectionAdd] = useState('');
  const [marks, setMarks] = useState({
    written: '',
    mcq: '',
    practical: ''
  });
  const [multiSubjectMarks, setMultiSubjectMarks] = useState({});
  const [calculatedGrade, setCalculatedGrade] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ classroom: '', section: '', subject: '', exam: '' });
  const [bulkStudents, setBulkStudents] = useState([]);
  const [bulkMarks, setBulkMarks] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  // Edit/Delete state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState(null);
  const [editMarks, setEditMarks] = useState({ written: 0, mcq: 0, practical: 0 });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });
  
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryExamType, setSummaryExamType] = useState('annual');
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const toast = useToast();

  useEffect(() => {
    if (!id) return;
    // Load classes and all examinations initially
    loadClasses();
    loadExaminations();
  }, [id]);

  const loadExaminations = () => {
    setLoading(true);
    scopedGet('/api/results/examinations/', id, {}, { timeout: 30000 })
      .then(res => {
        console.log('Examinations API response:', res.data);
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setExaminations(data);
        setLoading(false);
        if (data.length === 0) {
          toast.info('No examinations found for this school');
        }
      })
      .catch(err => {
        console.error('Error loading examinations:', err);
        toast.error('Failed to load examinations');
        setLoading(false);
      });
  };

  const loadExaminationsByClass = (classId) => {
    if (!classId) { setExaminations([]); return; }
    setLoading(true);
    scopedGet('/api/results/examinations/', id, { classroom: classId }, { timeout: 30000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setExaminations(data);
        setLoading(false);
        if (data.length === 0) {
          toast.info('এই শ্রেণীর জন্য কোনো পরীক্ষা পাওয়া যায়নি');
        }
      })
      .catch(err => {
        console.error('Error loading examinations for class:', err);
        toast.error('পরীক্ষা লোড ব্যর্থ');
        setLoading(false);
      });
  };

  // Open Edit dialog prefilled with selected result
  const handleOpenEdit = (result) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setEditingResult(result);
    setEditMarks({
      written: parseFloat(result.written_marks) || 0,
      mcq: parseFloat(result.mcq_marks) || 0,
      practical: parseFloat(result.practical_marks) || 0
    });
    setEditDialogOpen(true);
  };

  const handleCloseEdit = () => {
    setEditDialogOpen(false);
    setEditingResult(null);
  };

  // Save edited marks
  const handleSaveEdit = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!editingResult) return;
    try {
      setSavingEdit(true);
      const examObj = examinations.find(ex => String(ex.id) === String(editingResult.examination?.id || editingResult.examination)) || null;
      const examId = parseInt(editingResult.examination?.id || editingResult.examination);
      const w = parseFloat(editMarks.written) || 0;
      const m = parseFloat(editMarks.mcq) || 0;
      const p = parseFloat(editMarks.practical) || 0;
      const totalObtained = (w + m + p);
      const wm = parseFloat(examObj?.written_max) || 0;
      const mm = parseFloat(examObj?.mcq_max) || 0;
      const pm = parseFloat(examObj?.practical_max) || 0;
      const denom = (wm || mm || pm) ? (wm + mm + pm) : (parseFloat(examObj?.total_marks) || 0);
      const pct = denom > 0 ? (totalObtained / denom) * 100 : 0;
      const calcGrade = pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 60 ? 'A-' : pct >= 50 ? 'B' : pct >= 40 ? 'C' : pct >= 33 ? 'D' : 'F';
      const calcGpa = calcGrade === 'A+' ? 5.00 : calcGrade === 'A' ? 4.00 : calcGrade === 'A-' ? 3.50 : calcGrade === 'B' ? 3.00 : calcGrade === 'C' ? 2.00 : calcGrade === 'D' ? 1.00 : 0.00;
      let calcPassed;
      if ((wm || mm || pm)) {
        const thrW = wm ? Math.round(wm / 3) : 0;
        const thrM = mm ? Math.round(mm / 3) : 0;
        const thrP = pm ? Math.round(pm / 3) : 0;
        const okW = wm ? (w >= thrW) : true;
        const okM = mm ? (m >= thrM) : true;
        const okP = pm ? (p >= thrP) : true;
        calcPassed = !!(okW && okM && okP);
      } else {
        const passMarks = parseFloat(examObj?.pass_marks) || 33;
        calcPassed = totalObtained >= passMarks;
      }
      const payload = {
        // Keep immutable relations as-is to satisfy serializers
        examination: editingResult.examination?.id || editingResult.examination,
        student: editingResult.student?.id || editingResult.student,
        subject: editingResult.subject?.id || editingResult.subject,
        written_marks: w,
        mcq_marks: m,
        practical_marks: p,
        total_obtained: totalObtained,
        gpa: calcPassed ? calcGpa : 0.00,
        grade: calcPassed ? calcGrade : 'F',
        is_passed: calcPassed
      };
      await api.post(`/api/results/examinations/${examId}/bulk_results/`, {
        results: [{
          student_id: parseInt(editingResult.student?.id || editingResult.student, 10),
          subject_id: parseInt(editingResult.subject?.id || editingResult.subject, 10),
          written_marks: w,
          mcq_marks: m,
          practical_marks: p,
          remarks: editingResult.remarks || ''
        }]
      });
      toast.success('Result updated successfully (bulk)');
      handleCloseEdit();
      setSelectedExam(examId);
      loadResults(examId);
    } catch (e) {
      console.error('Failed to update result:', e?.response?.data || e);
      const msg = e?.response?.data?.detail || 'Failed to update result';
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete flow
  const handleOpenDelete = (result) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setDeleteDialog({ open: true, item: result });
  };
  const handleConfirmDelete = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!deleteDialog.item) return;
    try {
      await api.delete(`/api/results/results/${deleteDialog.item.id}/`);
      toast.success('Result deleted');
      setDeleteDialog({ open: false, item: null });
      loadResults(selectedExam);
    } catch (e) {
      console.error('Delete failed:', e?.response?.data || e);
      toast.error('Failed to delete result');
    }
  };
  
  const loadClasses = () => {
    setLoadingClasses(true);
    scopedGet('/api/academics/classrooms/', id, {}, { timeout: 30000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setClasses(data);
        if (selectedClass && !data.some(c => String(c.id) === String(selectedClass))) {
          setSelectedClass('');
        }
        setLoadingClasses(false);
      })
      .catch(err => {
        console.error('Error loading classes:', err);
        toast.error('Failed to load classes');
        setLoadingClasses(false);
      });
  };
  
  const getExamsForClass = (classId) => {
    if (!classId) return [];
    const cidStr = typeof classId === 'string' ? String(classId).replace(/[০-৯]/g, (d) => {
      const m = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };
      return m[d] ?? d;
    }) : classId;
    const cid = parseInt(cidStr, 10);
    return examinations.filter(ex => getClassroomId(ex.classroom) === cid);
  };
  const normalizeName = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
  const findSubjectExam = (subjectName) => {
    try {
      const classId = selectedClass;
      if (!classId || !subjectName) return null;
      const targetType = (getExamById(selectedExam)?.exam_type) || null;
      const targetSection = selectedSectionAdd ? parseInt(String(selectedSectionAdd), 10) : null;
      const exams = getExamsForClass(classId);
      let candidates = exams.filter(ex => normalizeName(ex.name) === normalizeName(subjectName));
      if (targetType) candidates = candidates.filter(ex => String(ex.exam_type) === String(targetType));
      if (targetSection != null && !Number.isNaN(targetSection)) {
        candidates = candidates.filter(ex => parseInt(String(ex.section ?? ex.section_id ?? ex.section), 10) === targetSection);
      } else {
        const sectionLess = candidates.find(ex => ex.section == null);
        if (sectionLess) return sectionLess;
      }
      return candidates[0] || null;
    } catch (_) { return null; }
  };

  // Filter students based on search term
  useEffect(() => {
    if (studentSearchTerm) {
      const filtered = students.filter(student => {
        const searchLower = studentSearchTerm.toLowerCase();
        return (
          student.user?.first_name?.toLowerCase().includes(searchLower) ||
          student.user?.last_name?.toLowerCase().includes(searchLower) ||
          student.roll_number?.toLowerCase().includes(searchLower) ||
          `${student.user?.first_name || ''} ${student.user?.last_name || ''}`.toLowerCase().includes(searchLower)
        );
      });
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents(students);
    }
  }, [studentSearchTerm, students]);

  const handleClassChange = (e) => {
    const classId = e.target.value;
    setSelectedClass(classId);
    setSelectedSubject('');
    setSelectedStudent('');
    setSelectedSectionAdd('');
    setMarks({ written: 0, mcq: 0, practical: 0 });
    setCalculatedGrade('');
    setStudentSearchTerm('');
    // Load exams filtered by class; user will select an exam
    setSelectedExam('');
    loadExaminationsByClass(classId);
    // Only load students after section selection
    loadSubjectsByClass(classId);
    loadSectionsByClass(classId);
  };
  
  const loadStudentsByClass = (classId, sectionId = null) => {
    if (!classId) return;
    setLoadingStudents(true);
    const effectiveSection = sectionId !== null ? sectionId : selectedSectionAdd;
    const sec = effectiveSection ? `&section=${effectiveSection}` : '';
    scopedGet('/api/academics/students/', id, { classroom: classId, section: effectiveSection || undefined }, { timeout: 30000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
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
        setFilteredStudents(sorted);
        setLoadingStudents(false);
      })
      .catch(err => {
        console.error('Error loading students:', err);
        toast.error('Failed to load students');
        setLoadingStudents(false);
      });
  };
  
  const loadSubjectsByClass = (classId) => {
    if (!classId) return;
    setLoadingSubjects(true);
    scopedGet('/api/academics/subjects/', id, {}, { timeout: 30000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setSubjects(data);
        const initial = {};
        for (const s of data) {
        initial[s.id] = { written: '', mcq: '', practical: '' };
        }
        setMultiSubjectMarks(initial);
        setLoadingSubjects(false);
      })
      .catch(err => {
        console.error('Error loading subjects:', err);
        toast.error('Failed to load subjects');
        setLoadingSubjects(false);
      });
  };

  const setMultiSubjectMark = (sid, field, value) => {
    const examObj = getExamById(selectedExam);
    const subjName = (subjects.find(s => s.id === parseInt(sid)) || {}).name;
    const max = getMaxForField(examObj, field, subjName);
    let v = value === '' ? '' : parseFloat(value);
    if (v !== '') {
      if (!Number.isFinite(v)) v = 0;
      if (v < 0) v = 0;
      if (Number.isFinite(max)) v = Math.min(v, max);
    }
    setMultiSubjectMarks(prev => ({
      ...prev,
      [sid]: { ...(prev[sid] || { written: '', mcq: '', practical: '' }), [field]: v }
    }));
  };

  const loadExistingMarksForStudent = async (examId, studentId) => {
    if (!examId || !studentId) return;
    try {
      const res = await scopedGet('/api/results/results/', id, { examination: parseInt(examId, 10), student: parseInt(studentId, 10), page_size: 500 }, { timeout: 20000 });
      const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setMultiSubjectMarks(prev => {
        const next = { ...prev };
        for (const r of arr) {
          const sid = r.subject?.id || r.subject;
          if (sid) {
            next[sid] = {
              written: parseFloat(r.written_marks) || 0,
              mcq: parseFloat(r.mcq_marks) || 0,
              practical: parseFloat(r.practical_marks) || 0
            };
          }
        }
        return next;
      });
    } catch (_) {}
  };

  useEffect(() => {
    if (selectedExam && selectedStudent) {
      loadExistingMarksForStudent(selectedExam, selectedStudent);
      (async () => {
        try {
          const res = await scopedGet('/api/results/results/', id, { examination: parseInt(selectedExam, 10), student: parseInt(selectedStudent, 10), page_size: 1 }, { timeout: 12000 });
          const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
          if (!arr || arr.length === 0) {
            const allRes = await api.get(`/api/results/results/?student=${parseInt(selectedStudent, 10)}&page_size=2000`);
            const list = Array.isArray(allRes.data) ? allRes.data : (allRes.data?.results || []);
            if (list && list.length) {
              const examIds = list.map(r => r.examination?.id || r.examination).filter(Boolean);
              const unique = Array.from(new Set(examIds));
              const candidates = unique
                .map(eid => examinations.find(ex => ex.id === parseInt(eid, 10)))
                .filter(Boolean)
                .filter(ex => !selectedClass || getClassroomId(ex.classroom) === parseInt(selectedClass, 10));
              const sorted = candidates.sort((a, b) => {
                const da = new Date(a.exam_date || a.created_at || 0).getTime();
                const db = new Date(b.exam_date || b.created_at || 0).getTime();
                return db - da;
              });
              const pick = sorted[0] || candidates[0];
              if (pick?.id && String(pick.id) !== String(selectedExam)) {
                setSelectedExam(pick.id);
                loadResults(pick.id);
              }
            }
          }
        } catch (_) {}
      })();
    }
  }, [selectedExam, selectedStudent]);

  // Load sections for selected class in Add Result dialog
  const loadSectionsByClass = (classId) => {
    if (!classId) { setSectionsForAdd([]); return; }
    scopedGet('/api/academics/sections/', id, { classroom: classId }, { timeout: 30000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setSectionsForAdd(data);
      })
      .catch(() => setSectionsForAdd([]));
  };
  
  const handleOpenAddResultsDialog = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    // Reset saving spinner
    setSavingResult(false);
    setAddResultsDialogOpen(true);
    // Preselect first class if none selected to avoid empty state
    try {
      if (!selectedClass && examinations && examinations.length > 0) {
        // no-op for exam; selectedExam already set by loader
      }
      // If classes already loaded in ResultsPage (we keep them in local 'classes')
      if (!selectedClass && classes && classes.length > 0) {
        const firstClassId = classes[0].id;
        setSelectedClass(firstClassId);
        // Ensure an exam for this class is selected
        const classExams = examinations.filter(ex => ex.classroom === parseInt(firstClassId));
        if (classExams.length > 0) setSelectedExam(classExams[0].id);
        // Preload students, subjects, and sections for the class
        loadStudentsByClass(firstClassId);
        loadSubjectsByClass(firstClassId);
        loadSectionsByClass(firstClassId);
      }
    } catch (_) {}
  };
  
  const handleCloseAddResultsDialog = () => {
    setAddResultsDialogOpen(false);
    resetAddResultsForm();
  };
  
  const resetAddResultsForm = () => {
    setSelectedClass('');
    setSelectedStudent('');
    setSelectedSubject('');
    setMarks({
      written: '',
      mcq: '',
      practical: ''
    });
    setCalculatedGrade('');
    setMultiSubjectMarks({});
  };
  
  const getExamById = (eid) => {
    const n = parseInt(eid);
    if (Number.isNaN(n)) return undefined;
    return examinations.find(ex => ex.id === n);
  };
  const getClassGroup = (className) => {
    const x = String(className || '').toLowerCase();
    if (/ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b/.test(x)) return 'six_to_eight';
    if (/নবম|nine|\b9\b|দশম|ten|\b10\b/.test(x)) return 'nine_ten';
    return null;
  };
  const SUBJECT_MAXIMA = {
    six_to_eight: {
      'bangla first paper': { written: 70, mcq: 30, practical: 0 },
      'বাংলা প্রথম পত্র': { written: 70, mcq: 30, practical: 0 },
      'bangla second paper': { written: 35, mcq: 15, practical: 0 },
      'বাংলা দ্বিতীয় পত্র': { written: 35, mcq: 15, practical: 0 },
      'english first paper': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি প্রথম পত্র': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি-১ম': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজী-১ম': { written: 100, mcq: 0, practical: 0 },
      'english second paper': { written: 50, mcq: 0, practical: 0 },
      'ইংরেজি দ্বিতীয় পত্র': { written: 50, mcq: 0, practical: 0 },
      'ইংরেজি-২য়': { written: 50, mcq: 0, practical: 0 },
      'ইংরেজী-২য়': { written: 50, mcq: 0, practical: 0 },
      'mathematics': { written: 70, mcq: 30, practical: 0 },
      'গণিত': { written: 70, mcq: 30, practical: 0 },
      'science': { written: 70, mcq: 30, practical: 0 },
      'বিজ্ঞান': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশ ও বিশ্বপরিচয়': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশ ও বিশ্বপরিয়': { written: 70, mcq: 30, practical: 0 },
      'ict': { written: 10, mcq: 15, practical: 25 },
      'আইসিটি': { written: 10, mcq: 15, practical: 25 },
      'ধর্ম': { written: 70, mcq: 30, practical: 0 },
      'religion': { written: 70, mcq: 30, practical: 0 },
      'কৃষি': { written: 50, mcq: 25, practical: 25 },
      'agriculture': { written: 50, mcq: 25, practical: 25 }
    },
    nine_ten: {
      'bangla 1+2': { written: 140, mcq: 60, practical: 0 },
      'বাংলা ১+২': { written: 140, mcq: 60, practical: 0 },
      'english 1+2': { written: 200, mcq: 0, practical: 0 },
      'ইংরেজি ১+২': { written: 200, mcq: 0, practical: 0 },
      'ইংরেজি-১ম': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজী-১ম': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি-২য়': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজী-২য়': { written: 100, mcq: 0, practical: 0 },
      'mathematics': { written: 70, mcq: 30, practical: 0 },
      'গণিত': { written: 70, mcq: 30, practical: 0 },
      'science': { written: 70, mcq: 30, practical: 0 },
      'বিজ্ঞান': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশ ও বিশ্বপরিচয়': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশ ও বিশ্বপরিয়': { written: 70, mcq: 30, practical: 0 },
      'ict': { written: 10, mcq: 15, practical: 25 },
      'আইসিটি': { written: 10, mcq: 15, practical: 25 },
      'ধর্ম': { written: 70, mcq: 30, practical: 0 },
      'religion': { written: 70, mcq: 30, practical: 0 },
      'কৃষি': { written: 50, mcq: 25, practical: 25 },
      'agriculture': { written: 50, mcq: 25, practical: 25 },
      'পদার্থ': { written: 50, mcq: 25, practical: 25 },
      'রসায়ন': { written: 50, mcq: 25, practical: 25 },
      'জীববিজ্ঞান': { written: 50, mcq: 25, practical: 25 },
      'উচ্চতর গণিত': { written: 50, mcq: 25, practical: 25 },
      'ইতিহাস': { written: 70, mcq: 30, practical: 0 },
      'ব্যবসায় উদ্যোগ': { written: 70, mcq: 30, practical: 0 },
      'ভূগোল': { written: 70, mcq: 30, practical: 0 },
      'ব্যবসায় শিক্ষা': { written: 70, mcq: 30, practical: 0 },
      'পৌরনীতি': { written: 70, mcq: 30, practical: 0 },
      'ফিন্যান্স': { written: 70, mcq: 30, practical: 0 }
    }
  };
  const getSubjectMaximaForClass = (subjectName) => {
    const clsObj = classes.find(c => c.id === parseInt(selectedClass)) || {};
    const g = getClassGroup(clsObj.name);
    if (!g) return null;
    const s = String(subjectName || '').trim().toLowerCase();
    return SUBJECT_MAXIMA[g][s] || null;
  };
  const getMaxForField = (examObj, field, subjectName) => {
    const subjExam = findSubjectExam(subjectName);
    const e = subjExam || ((examObj && normalizeName(examObj.name) === normalizeName(subjectName)) ? examObj : null);
    if (e) {
      const val = field === 'written' ? parseFloat(e.written_max) : field === 'mcq' ? parseFloat(e.mcq_max) : field === 'practical' ? parseFloat(e.practical_max) : undefined;
      if (Number.isFinite(val)) return val;
    }
    const m = getSubjectMaximaForClass(subjectName);
    if (!m) return undefined;
    return field === 'written' ? m.written : field === 'mcq' ? m.mcq : m.practical;
  };

  const handleMarksChange = (field, value) => {
    const examObj = getExamById(selectedExam);
    const subjName = (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name;
    const max = getMaxForField(examObj, field, subjName);
    let v = value === '' ? '' : parseFloat(value);
    if (v !== '') {
      if (!Number.isFinite(v)) v = 0;
      if (v < 0) v = 0;
      if (Number.isFinite(max)) v = Math.min(v, max);
    }
    const newMarks = { ...marks, [field]: v };
    setMarks(newMarks);
    
    // Calculate grade based on total marks
    const totalMarks = (parseFloat(newMarks.written) || 0) + (parseFloat(newMarks.mcq) || 0) + (parseFloat(newMarks.practical) || 0);
    const selectedExamObj = examinations.find(exam => exam.id === selectedExam);
    if (selectedExamObj) {
      const wMax = parseFloat(selectedExamObj.written_max) || 0;
      const mMax = parseFloat(selectedExamObj.mcq_max) || 0;
      const pMax = parseFloat(selectedExamObj.practical_max) || 0;
      const totalMax = (wMax + mMax + pMax) || (parseFloat(selectedExamObj.total_marks) || 0);
      const percentage = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;
      
      let grade = '';
      if (percentage >= 80) grade = 'A+';
      else if (percentage >= 70) grade = 'A';
      else if (percentage >= 60) grade = 'A-';
      else if (percentage >= 50) grade = 'B';
      else if (percentage >= 40) grade = 'C';
      else if (percentage >= 33) grade = 'D';
      else grade = 'F';
      
      setCalculatedGrade(grade);
    }
  };
  
  const getClassroomId = (cls) => {
    const v = typeof cls === 'object' ? (cls?.id ?? null) : cls;
    const s = typeof v === 'string' ? String(v).replace(/[০-৯]/g, (d) => {
      const m = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };
      return m[d] ?? d;
    }) : v;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
  };

  const verifyPersistedResult = async (examId, studentId, subjectId) => {
    try {
      const r = await api.get(`/api/results/results/?examination=${examId}&student=${parseInt(studentId, 10)}&school=${id}`);
      const arr = Array.isArray(r.data) ? r.data : (r.data?.results || []);
      // Consider success if any result exists for this exam & student
      return Array.isArray(arr) && arr.length > 0;
    } catch (_) {
      return false;
    }
  };

  const handleSaveResult = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!selectedExam || !selectedClass || !selectedStudent || !selectedSubject) {
      toast.error('Please select examination, class, student, and subject');
      return;
    }
    // Guard: exam must belong to the selected class
    const examObj = examinations.find(ex => ex.id === parseInt(selectedExam));
    if (!examObj || getClassroomId(examObj.classroom) !== parseInt(selectedClass)) {
      toast.error('Selected examination does not belong to the chosen class');
      return;
    }
    
    setSavingResult(true);
    
    // Convert string values to numbers for marks
    const writtenMarks = marks.written !== '' ? parseFloat(marks.written) : 0;
    const mcqMarks = marks.mcq !== '' ? parseFloat(marks.mcq) : 0;
    const practicalMarks = marks.practical !== '' ? parseFloat(marks.practical) : 0;
    
    // Use the bulk_results endpoint instead of trying to create a result directly
    const examId = parseInt(selectedExam);
    const examObjForRedirect = examinations.find(ex => ex.id === examId) || null;
    const clsIdRedirect = String(selectedClass);
    const stuIdRedirect = String(selectedStudent);
    const secIdRedirect = String(selectedSectionAdd || '');
    const examTypeRedirect = String(examObjForRedirect?.exam_type || 'annual');
    const urlRedirect = `/school/${id}/result-card?classroom=${encodeURIComponent(clsIdRedirect)}&student=${encodeURIComponent(stuIdRedirect)}&exam_type=${encodeURIComponent(examTypeRedirect)}${secIdRedirect ? `&section=${encodeURIComponent(secIdRedirect)}` : ''}&exam=${encodeURIComponent(String(examId))}&auto=1`;
    const resultData = {
      examination: examId,
      results: [
        {
          examination: examId,
          student_id: parseInt(selectedStudent),
          subject_id: parseInt(selectedSubject),
          written_marks: writtenMarks,
          mcq_marks: mcqMarks,
          practical_marks: practicalMarks
        }
      ]
    };
    
    console.log('Sending result data:', resultData);
    
    // Use the bulk_results endpoint on the examination
    api.post(`/api/results/examinations/${examId}/bulk_results/`, resultData)
      .then(res => {
        console.log('Result saved successfully:', res.data);
        const created = res.data?.created ?? 0;
        const updated = res.data?.updated ?? 0;
        const errorsArr = res.data?.errors || [];
        if ((created + updated) === 0 && Array.isArray(errorsArr) && errorsArr.length > 0) {
          console.warn('Bulk results returned errors on first attempt:', errorsArr);
          const firstErr = (errorsArr[0]?.error || JSON.stringify(errorsArr[0] || ''));
          toast.warning(`Server rejected result format: ${firstErr}. Retrying with alternate fields...`);
          // Retry with alternate keys: student, subject (instead of *_id)
          const altPayload = {
            examination: examId,
            results: [
              {
                examination: examId,
                student: parseInt(selectedStudent),
                subject: parseInt(selectedSubject),
                written_marks: writtenMarks,
                mcq_marks: mcqMarks,
                practical_marks: practicalMarks
              }
            ]
          };
          return api.post(`/api/results/examinations/${examId}/bulk_results/`, altPayload).then(async (res2) => {
            console.log('Alternate payload save response:', res2.data);
            let c2 = res2.data?.created ?? 0;
            let u2 = res2.data?.updated ?? 0;
            if ((c2 + u2) === 0) {
              // Try plain array payload with *_id shape
              const plainArray = [
                {
                  examination: examId,
                  student_id: parseInt(selectedStudent),
                  subject_id: parseInt(selectedSubject),
                  written_marks: writtenMarks,
                  mcq_marks: mcqMarks,
                  practical_marks: practicalMarks
                }
              ];
              try {
                const res3 = await api.post(`/api/results/examinations/${examId}/bulk_results/`, { examination: examId, results: plainArray });
                console.log('Plain array payload save response:', res3.data);
                const c3 = res3.data?.created ?? 0;
                const u3 = res3.data?.updated ?? 0;
                if ((c3 + u3) === 0) {
                  // Final attempt: include total_obtained for compatibility
                  const totalObtained = writtenMarks + mcqMarks + practicalMarks;
                  const withTotal = [
                    {
                      examination: examId,
                      student_id: parseInt(selectedStudent),
                      subject_id: parseInt(selectedSubject),
                      written_marks: writtenMarks,
                      mcq_marks: mcqMarks,
                      practical_marks: practicalMarks,
                      total_obtained: totalObtained
                    }
                  ];
                  const res4 = await api.post(`/api/results/examinations/${examId}/bulk_results/`, { examination: examId, results: withTotal });
                  console.log('With total_obtained payload save response:', res4.data);
                  const c4 = res4.data?.created ?? 0;
                  const u4 = res4.data?.updated ?? 0;
                  if ((c4 + u4) === 0) {
                    // Absolute fallback: single-result create API
                    try {
                      const singlePayload = {
                        examination: examId,
                        student_id: parseInt(selectedStudent),
                        subject_id: parseInt(selectedSubject),
                        written_marks: writtenMarks,
                        mcq_marks: mcqMarks,
                        practical_marks: practicalMarks,
                        total_obtained: totalObtained
                      };
                      const singleRes = await api.post(`/api/results/results/`, singlePayload);
                      console.log('Single create response:', singleRes.data);
                      toast.success('Result added successfully');
                      setSavingResult(false);
                      handleCloseAddResultsDialog();
                      loadResults(examId);
                      verifyPersistedResult(examId, selectedStudent, selectedSubject).then(() => {
                        window.location.assign(urlRedirect);
                      });
                      return singleRes;
                    } catch (singleErr) {
                      console.error('Single create error:', singleErr?.response?.data || singleErr);
                      const msg = typeof singleErr?.response?.data === 'string' ? singleErr.response.data : (singleErr?.response?.data?.detail || 'No details');
                      toast.error(`Failed to add result: ${msg}`);
                      setSavingResult(false);
                    }
                  } else {
                    toast.success('Result added successfully');
                    setSavingResult(false);
                    handleCloseAddResultsDialog();
                    loadResults(examId);
                    verifyPersistedResult(examId, selectedStudent, selectedSubject).then(() => {
                      window.location.assign(urlRedirect);
                    });
                  }
                  return res4;
                } else {
                  toast.success('Result added successfully');
                  setSavingResult(false);
                  handleCloseAddResultsDialog();
                  loadResults(examId);
                  verifyPersistedResult(examId, selectedStudent, selectedSubject).then(() => {
                    window.location.assign(urlRedirect);
                  });
                  return res3;
                }
              } catch (e3) {
                console.error('Plain array payload error:', e3?.response?.data || e3);
                throw e3;
              }
            } else {
              toast.success('Result added successfully');
              setSavingResult(false);
              handleCloseAddResultsDialog();
              loadResults(examId);
              verifyPersistedResult(examId, selectedStudent, selectedSubject).then(() => {
                window.location.assign(urlRedirect);
              });
              return res2;
            }
          });
        } else {
          toast.success('Result added successfully');
        }
        handleCloseAddResultsDialog();
        const examObjNow = examinations.find(ex => ex.id === examId) || null;
        const stuObj = students.find(s => s.id === parseInt(selectedStudent)) || { id: parseInt(selectedStudent), user: {} };
        const subjObj = subjects.find(s => s.id === parseInt(selectedSubject)) || { id: parseInt(selectedSubject), name: '' };
        const totalNow = writtenMarks + mcqMarks + practicalMarks;
        const newItem = {
          student: stuObj,
          subject: subjObj,
          written_marks: writtenMarks,
          mcq_marks: mcqMarks,
          practical_marks: practicalMarks,
          total_obtained: totalNow,
          examination: examObjNow || examId
        };
        setResults(prev => {
          const idx = prev.findIndex(r => (r.student?.id === stuObj.id || r.student === stuObj.id) && (r.subject?.id === subjObj.id || r.subject === subjObj.id));
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...newItem };
            return next;
          }
          return [newItem, ...prev];
        });
        loadResults(examId);
        verifyPersistedResult(examId, selectedStudent, selectedSubject).then(ok => {
          if (ok) {
            toast.success('Result added successfully');
          } else {
            toast.error('Result could not be verified on server. Please retry.');
          }
          window.location.assign(urlRedirect);
        });
      })
      .catch(err => {
        console.error('Error saving result:', err);
        if (err.response && err.response.data) {
          console.error('Server response:', err.response.data);
        }
        const serverMsg = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.detail || '');
        const serverErrors = err.response?.data?.errors ? JSON.stringify(err.response.data.errors) : '';
        const msg = serverMsg || err.message || 'Failed to save result';
        toast.error(`Failed to save result: ${msg}${serverErrors ? ' | ' + serverErrors : ''}`);
        setSavingResult(false);
      })
      .catch(err => {
        const msg = (err?.response?.data?.detail) || 'অনুমতি নেই বা ইনপুট ব্যর্থ';
        toast.error(msg);
        setSavingResult(false);
      });
  };

  const loadResults = (examId) => {
    if (!examId) {
      console.log('loadResults called with no examId');
      return;
    }
    console.log('Loading results for examination:', examId);
    setLoading(true);

    // Use paginated fetch with optimized page size
    scopedGet('/api/results/results/', id, { examination: examId, page_size: 500 }, { timeout: 15000 })
      .then(resultsRes => {
        const resultsData = Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || []);
        setResults(resultsData);
        return scopedGet('/api/results/overall/', id, { examination: examId, page_size: 500 }, { timeout: 15000 });
      })
      .then(overallRes => {
        const overallData = Array.isArray(overallRes.data) ? overallRes.data : (overallRes.data?.results || []);
        setOverallResults(overallData);
        setLoading(false);
        toast.success('Results loaded');
      })
      .catch(async err => {
        console.error('Error loading results:', err);
        // Fallback: paginated fetch to avoid timeouts on large datasets
        const fetchResultsPaginated = async () => {
          let page = 1;
          const maxPages = 10; // safety cap
          let all = [];
          let hadNext = false;
          for (; page <= maxPages; page++) {
            try {
              const res = await scopedGet('/api/results/results/', id, { examination: examId, classroom: selectedClass || undefined, page, page_size: 500 }, { timeout: 12000 });
              const data = res.data;
              const arr = Array.isArray(data) ? data : (data?.results || []);
              all = all.concat(arr);
              if (data?.next) { hadNext = true; } else { break; }
              if (!arr.length) break;
            } catch (e) {
              if (e?.code === 'ECONNABORTED' || String(e?.message || '').includes('timeout')) {
                break;
              } else {
                throw e;
              }
            }
          }
          return { items: all, partial: hadNext };
        };

        try {
          const { items, partial } = await fetchResultsPaginated();
          setResults(items);
          try {
            const overallRes = await scopedGet('/api/results/overall/', id, { examination: examId, page_size: 500 }, { timeout: 12000 });
            const overallData = Array.isArray(overallRes.data) ? overallRes.data : (overallRes.data?.results || []);
            setOverallResults(overallData);
          } catch (eOver) {
            console.error('Error loading overall (fallback path):', eOver);
            setOverallResults([]);
          }
          setLoading(false);
          toast[partial ? 'info' : 'success'](partial ? `Loaded ${items.length} results (partial)` : 'Results loaded');
        } catch (e2) {
          console.error('Fallback paginated load failed:', e2);
          setLoading(false);
          toast.error('Failed to load results');
        }
      });
  };

  const handleExamChange = (e) => {
    const examId = parseInt(e.target.value, 10);
    if (!Number.isNaN(examId)) {
      setSelectedExam(examId);
      loadResults(examId);
    } else {
      setSelectedExam('');
    }
  };

  const handleExportResults = () => {
    toast.info('Downloading results...');
    const base = api.defaults?.baseURL || (process.env.REACT_APP_API_URL || window.location.origin);
    const url = `${String(base).replace(/\/+$/,'')}/api/results/results/export_csv/?examination=${selectedExam}&school=${id}`;
    window.open(url, '_blank');
  };

  const handleExportOverall = () => {
    toast.info('Downloading overall results...');
    const base = api.defaults?.baseURL || (process.env.REACT_APP_API_URL || window.location.origin);
    const url = `${String(base).replace(/\/+$/,'')}/api/results/overall/export_csv/?examination=${selectedExam}&school=${id}`;
    window.open(url, '_blank');
  };

  const openBulkDialog = () => {
    setBulkDialogOpen(true);
    const cls = selectedClass || (classes[0]?.id || '');
    const ex = selectedExam || (getExamsForClass(cls)[0]?.id || '');
    setBulkForm({ classroom: cls || '', section: '', subject: '', exam: ex || '' });
    if (cls) {
      loadStudentsByClass(cls, null);
      loadSectionsByClass(cls);
      loadSubjectsByClass(cls);
    }
  };

  const closeBulkDialog = () => {
    setBulkDialogOpen(false);
    setBulkForm({ classroom: '', section: '', subject: '', exam: '' });
    setBulkStudents([]);
    setBulkMarks({});
    setBulkSaving(false);
  };

  useEffect(() => {
    if (selectedExam && examinations.length && !examinations.some(ex => String(ex.id) === String(selectedExam))) {
      setSelectedExam('');
    }
  }, [examinations, selectedExam]);

  useEffect(() => {
    if (examinations.length === 0 && selectedExam) {
      setSelectedExam('');
    }
  }, [examinations]);

  useEffect(() => {
    if (selectedClass && !selectedExam) {
      const list = getExamsForClass(selectedClass);
      if (list.length) {
        setSelectedExam(list[0].id);
        loadResults(list[0].id);
      }
    }
  }, [selectedClass, examinations]);
  useEffect(() => {
    setBulkStudents(students);
  }, [students]);

  useEffect(() => {
    const cls = bulkForm.classroom;
    const subjId = bulkForm.subject;
    if (!cls || !subjId) return;
    const subj = subjects.find(s => s.id === parseInt(subjId));
    if (!subj) return;
    const exams = getExamsForClass(cls);
    const match = exams.find(ex => (ex.name || '').trim().toLowerCase() === (subj.name || '').trim().toLowerCase());
    if (match && match.id !== bulkForm.exam) {
      setBulkForm(prev => ({ ...prev, exam: match.id }));
    }
  }, [bulkForm.classroom, bulkForm.subject, subjects, examinations]);

  useEffect(() => {
    const cls = bulkForm.classroom;
    if (!cls) return;
    const exams = getExamsForClass(cls);
    if (!bulkForm.exam && exams.length) {
      setBulkForm(prev => ({ ...prev, exam: exams[0].id }));
    }
  }, [bulkForm.classroom, examinations]);

  const setBulkMark = (sid, field, value) => {
    const examObj = getExamById(bulkForm.exam || selectedExam);
    const subjectName = (subjects.find(s => s.id === parseInt(bulkForm.subject)) || {}).name;
    const max = getMaxForField(examObj, field, subjectName);
    let v = value === '' ? '' : parseFloat(value);
    if (v !== '') {
      if (!Number.isFinite(v)) v = 0;
      if (v < 0) v = 0;
      if (Number.isFinite(max)) v = Math.min(v, max);
    }
    setBulkMarks(prev => ({ ...prev, [sid]: { ...(prev[sid] || {}), [field]: v } }));
  };

  const handleKeyDown = (e, studentId, field) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currentIndex = bulkStudents.findIndex(s => s.id === studentId);
      if (currentIndex < bulkStudents.length - 1) {
        const nextStudentId = bulkStudents[currentIndex + 1].id;
        const nextInput = document.querySelector(`input[data-student-id="${nextStudentId}"][data-field="${field}"]`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    }
  };

  const saveBulkMarks = async () => {
    const examId = parseInt(bulkForm.exam || selectedExam);
    const subjectId = parseInt(bulkForm.subject);
    const classroomId = parseInt(bulkForm.classroom);
    if (!examId || !subjectId || !classroomId) { toast.error('পরীক্ষা, শ্রেণী ও বিষয় নির্বাচন করুন'); return; }
    const examObj = examinations.find(ex => ex.id === examId);
    if (!examObj || examObj.classroom !== classroomId) { toast.error('নির্বাচিত পরীক্ষা ওই শ্রেণীর নয়'); return; }
    if (examObj && examObj.total_marks) {
      toast.info(`এই বাল্ক ইনপুটে হিসাব হবে মোট ${examObj.total_marks} ধরে`);
    }
    const rows = (bulkStudents || []).map(s => ({ sid: s.id, m: bulkMarks[s.id] || {} })).filter(r => ((parseFloat(r.m.written) || 0) + (parseFloat(r.m.mcq) || 0) + (parseFloat(r.m.practical) || 0)) > 0);
    if (rows.length === 0) { toast.info('কোনো নম্বর প্রদান করা হয়নি'); return; }
    setBulkSaving(true);
    const payload = {
      examination: examId,
      results: rows.map(r => ({
        examination: examId,
        student_id: parseInt(r.sid),
        subject_id: subjectId,
        written_marks: r.m.written || 0,
        mcq_marks: r.m.mcq || 0,
        practical_marks: r.m.practical || 0
      }))
    };
    try {
      const res = await api.post(`/api/results/examinations/${examId}/bulk_results/`, payload);
      toast.success('বাল্ক ফলাফল সংরক্ষণ হয়েছে');
      closeBulkDialog();
      loadResults(examId);
    } catch (e) {
      console.error('Bulk save error:', e?.response?.data || e);
      const msg = (e?.response?.status === 403 && (e?.response?.data?.detail)) ? e.response.data.detail : 'বাল্ক ফল সংরক্ষণ ব্যর্থ';
      toast.error(msg);
    } finally {
      setBulkSaving(false);
    }
  };

  // Distinct hex colors per grade to avoid visual similarity (A vs B)
  const getGradeStyle = (grade) => {
    const map = {
      'A+': { bg: '#2e7d32', fg: '#ffffff' },   // deep green
      'A':  { bg: '#1565c0', fg: '#ffffff' },   // darker blue
      'A-': { bg: '#6a1b9a', fg: '#ffffff' },   // purple
      'B':  { bg: '#795548', fg: '#ffffff' },   // brown
      'C':  { bg: '#f9a825', fg: '#000000' },   // amber
      'D':  { bg: '#757575', fg: '#ffffff' },   // grey
      'F':  { bg: '#d32f2f', fg: '#ffffff' }    // red
    };
    return map[grade] || { bg: '#9e9e9e', fg: '#ffffff' };
  };

  const computePercentage = (obtained, exam) => {
    const wMax = parseFloat(exam?.written_max) || 0;
    const mMax = parseFloat(exam?.mcq_max) || 0;
    const pMax = parseFloat(exam?.practical_max) || 0;
    const fallbackExam = examinations.find(ex => ex.id === selectedExam);
    const defaultTotal = parseFloat(exam?.total_marks) || (fallbackExam?.total_marks) || 100;
    const total = (wMax || mMax || pMax) ? (wMax + mMax + pMax) : defaultTotal;
    const numObtained = parseFloat(obtained) || 0;
    if (!total || total <= 0) return 0;
    return Math.round((numObtained / total) * 100);
  };

  const computeGrade = (percentage) => {
    if (percentage >= 80) return 'A+';
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'A-';
    if (percentage >= 50) return 'B';
    if (percentage >= 40) return 'C';
    if (percentage >= 33) return 'D';
    return 'F';
  };

  const computeGpa = (percentage) => {
    if (percentage >= 80) return '5.00';
    if (percentage >= 70) return '4.00';
    if (percentage >= 60) return '3.50';
    if (percentage >= 50) return '3.00';
    if (percentage >= 40) return '2.00';
    if (percentage >= 33) return '1.00';
    return '0.00';
  };

  const computePassed = (obtained, exam) => {
    const passMarks = parseFloat(exam?.pass_marks) || (examinations.find(ex => ex.id === selectedExam)?.pass_marks) || 33;
    const numObtained = parseFloat(obtained) || 0;
    return numObtained >= passMarks;
  };
  const isClassNineOrTen = () => {
    try {
      const clsObj = classes.find(c => c.id === parseInt(selectedClass));
      const name = String(clsObj?.name || '').toLowerCase();
      return /নবম|দশম|\b9\b|\b10\b/.test(name);
    } catch (_) { return false; }
  };
  const isBanglaFirst = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
    const lower = n.toLowerCase();
    return !!(lower.includes('বাংলা প্রথম') || lower.includes('bangla first') || lower.includes('বাংলা-১') || lower.includes('1st'));
  };
  const isBanglaSecond = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
    const lower = n.toLowerCase();
    return !!(lower.includes('বাংলা দ্বিত') || lower.includes('bangla second') || lower.includes('বাংলা-২') || lower.includes('2nd'));
  };
  const isBanglaPaper = (name) => isBanglaFirst(name) || isBanglaSecond(name);
  const banglaCombinedPassForStudent = (studentId) => {
    try {
      const list = (results || []).filter(r => {
        const sid = typeof r.student === 'object' ? r.student?.id : r.student;
        return sid === studentId && isBanglaPaper(r.subject?.name || r.subject_name);
      });
      if (!list.length) return false;
      const examObj = examinations.find(ex => ex.id === selectedExam) || {};
      const passMarks = parseFloat(examObj?.pass_marks) || 33;
      const sumCQ = list.reduce((s, r) => s + (parseFloat(r.written_marks) || 0), 0);
      const sumMCQ = list.reduce((s, r) => s + (parseFloat(r.mcq_marks) || 0), 0);
      return (sumCQ >= passMarks) && (sumMCQ >= passMarks);
    } catch (_) { return false; }
  };

  // Pass rule for display across all tabs: any non-'F' grade counts as Passed
  const isPassed = (row) => {
    const g = row?.grade;
    return (g && g !== 'F') || !!row?.is_passed;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4">
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          রেজাল্ট ও পরীক্ষা
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={handleOpenAddResultsDialog}
        >
          ফলাফল তৈরি করুন
        </Button>
        <Button 
          variant="outlined" 
          color="secondary" 
          onClick={openBulkDialog}
        >
          বাল্ক মার্কস ইনপুট
        </Button>
      </Stack>

      {/* Exam Selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              select
              label="শ্রেণী নির্বাচন করুন"
              value={selectedClass}
              onChange={handleClassChange}
              sx={{ minWidth: 240 }}
            >
              {classes.map(classroom => (
                <MenuItem key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="পরীক্ষা নির্বাচন করুন"
              value={examinations.length ? selectedExam : ''}
              onChange={handleExamChange}
              sx={{ minWidth: 300 }}
              fullWidth
            >
              {(selectedClass ? getExamsForClass(selectedClass) : examinations).map(exam => (
                <MenuItem key={exam.id} value={exam.id}>
                  {(exam.name || 'বিষয়')} — {getExamTypeLabel(exam.exam_type)}
                </MenuItem>
              ))}
            </TextField>
            
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportResults}>
              Export Results
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportOverall}>
              Export Overall
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {loading && <TableSkeleton rows={10} columns={10} />}

      {!loading && examinations.length === 0 && (
        <EmptyState
          icon={AssessmentIcon}
          title="No examinations yet"
          message="Examinations and results will appear here once they are created in the system"
        />
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="বিষয় ভিত্তিক পরীক্ষার ফল" />
          <Tab label="সামগ্রিক ফলাফল" />
          <Tab label="পরিসংখ্যান" />
          <Tab label="Result Summary (Pass-Fail)" />
        </Tabs>
      </Box>

      {/* Tab 1: Subject-wise Results */}
      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>রোল</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>শিক্ষার্থীর নাম</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>বিষয়</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">লিখিত</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">এমসিকিউ</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">প্র্যাকটিক্যাল</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">মোট</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">গ্রেড</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">জিপিএ</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">অবস্থা</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">অ্যাকশন</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result, idx) => {
                const student = result.student;
                const studentName = `${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim() || student.user?.username;
                return (
                  <TableRow key={idx} hover>
                    <TableCell>{student.roll_number || result.student_roll_number || '-'}</TableCell>
                    <TableCell>{studentName}</TableCell>
                    <TableCell>{result.subject?.name}</TableCell>
                    <TableCell align="center">{parseFloat(result.written_marks) || 0}</TableCell>
                    <TableCell align="center">{parseFloat(result.mcq_marks) || 0}</TableCell>
                    <TableCell align="center">{parseFloat(result.practical_marks) || 0}</TableCell>
                    <TableCell align="center">
                      {(() => {
                        const w = parseFloat(result.written_marks) || 0;
                        const m = parseFloat(result.mcq_marks) || 0;
                        const p = parseFloat(result.practical_marks) || 0;
                        const total = w + m + p;
                        return <strong>{total}</strong>;
                      })()}
                    </TableCell>
                    {(() => {
                      const serverGrade = result.grade;
                      const serverGpa = result.gpa;
                      const serverPassed = result.is_passed;
                      const failed = serverPassed === false;
                      const grade = failed ? 'F' : (serverGrade || 'F');
                      const gpa = failed ? '0.00' : ((serverGpa !== undefined && serverGpa !== null) ? parseFloat(serverGpa) : '0.00');
                      const s = getGradeStyle(grade);
                      let passed = !!serverPassed;
                      try {
                        const subjName = result.subject?.name || '';
                        const stuId = typeof result.student === 'object' ? result.student?.id : result.student;
                        if (isClassNineOrTen() && isBanglaPaper(subjName) && stuId) {
                          if (banglaCombinedPassForStudent(stuId)) passed = true;
                        }
                      } catch (_) {}
                      return (
                        <>
                          <TableCell align="center">
                            <Chip label={grade} size="small" sx={{ bgcolor: s.bg, color: s.fg, fontWeight: 'bold' }} />
                          </TableCell>
                          <TableCell align="center">{gpa}</TableCell>
                          <TableCell align="center">
                            <Chip label={passed ? 'Passed' : 'Failed'} color={passed ? 'success' : 'error'} size="small" />
                          </TableCell>
                        </>
                      );
                    })()}
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <ProtectedButton size="small" color="primary" onClick={() => handleOpenEdit(result)}>
                          <EditIcon fontSize="small" />
                        </ProtectedButton>
                        <ProtectedButton size="small" color="error" onClick={() => handleOpenDelete(result)}>
                          <DeleteIcon fontSize="small" />
                        </ProtectedButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 2: Overall Results */}
      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'secondary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rank</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Roll</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Student Name</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Total Obtained</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Total Possible</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Percentage</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">CGPA</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Grade</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overallResults.map((result, idx) => {
                const student = result.student;
                const studentName = `${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim() || student.user?.username;
                return (
                  <TableRow key={idx} hover>
                    <TableCell><strong>{result.rank || idx + 1}</strong></TableCell>
                    <TableCell>{student.roll_number || result.student_roll_number || '-'}</TableCell>
                    <TableCell>{studentName}</TableCell>
                    <TableCell align="center">{result.total_marks_obtained}</TableCell>
                    <TableCell align="center">{result.total_marks_possible}</TableCell>
                    <TableCell align="center">{result.percentage}%</TableCell>
                    <TableCell align="center"><strong>{result.cgpa}</strong></TableCell>
                    <TableCell align="center">
                      {(() => { const s = getGradeStyle(result.grade); return (
                        <Chip label={result.grade} size="small" sx={{ bgcolor: s.bg, color: s.fg, fontWeight: 'bold' }} />
                      ); })()}
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={isPassed(result) ? 'Passed' : 'Failed'} color={isPassed(result) ? 'success' : 'error'} size="small" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 3: Statistics */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Pass Rate</Typography>
                <Typography variant="h3" color="primary">
                  {overallResults.length > 0 
                    ? Math.round((overallResults.filter(r => isPassed(r)).length / overallResults.length) * 100)
                    : 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {overallResults.filter(r => isPassed(r)).length} / {overallResults.length} students passed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Average CGPA</Typography>
                <Typography variant="h3" color="secondary">
                  {overallResults.length > 0
                    ? (overallResults.reduce((sum, r) => sum + parseFloat(r.cgpa), 0) / overallResults.length).toFixed(2)
                    : '0.00'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Across all students
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Top Performer</Typography>
                <Typography variant="h3" color="success.main">
                  {overallResults[0]?.cgpa || '0.00'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {overallResults[0] 
                    ? `${overallResults[0].student.user?.first_name || ''} ${overallResults[0].student.user?.last_name || ''}`.trim()
                    : 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 4: Result Summary */}
      {tabValue === 3 && (
        <Card sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
            <TextField
              select
              label="Exam Type"
              value={summaryExamType}
              onChange={(e) => setSummaryExamType(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {EXAM_TYPES.map(t => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Year"
              value={summaryYear}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setSummaryYear(Number.isNaN(v) ? '' : v);
              }}
              type="number"
              sx={{ width: 140 }}
            />
            <Button
              variant="contained"
              onClick={async () => {
                setSummaryLoading(true);
                try {
                  const clsRes = await scopedGet('/api/academics/classrooms/', id, {}, { timeout: 20000 });
                  const clsArr = Array.isArray(clsRes.data) ? clsRes.data : (clsRes.data?.results || []);
                  const allRows = [];
                  for (const classroom of clsArr) {
                    const secRes = await scopedGet('/api/academics/sections/', id, { classroom: classroom.id }, { timeout: 20000 });
                    const secArr = Array.isArray(secRes.data) ? secRes.data : (secRes.data?.results || []);
                    const exRes = await scopedGet('/api/results/examinations/', id, { classroom: classroom.id }, { timeout: 20000 });
                    const exArr = Array.isArray(exRes.data) ? exRes.data : (exRes.data?.results || []);
                    const exam = exArr.find(e => (String(e.exam_type || '').toLowerCase() === String(summaryExamType).toLowerCase()) && (parseInt(e.academic_year, 10) === parseInt(summaryYear, 10)));
                    for (const section of secArr) {
                      const stuRes = await scopedGet('/api/academics/students/', id, { classroom: classroom.id, section: section.id }, { timeout: 30000 });
                      const studentsArr = Array.isArray(stuRes.data) ? stuRes.data : (stuRes.data?.results || []);
                      let resultsArr = [];
                      if (exam) {
                        const rRes = await scopedGet('/api/results/results/', id, { examination: exam.id, page_size: 2000 }, { timeout: 30000 });
                        resultsArr = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.results || []);
                      }
                      const byStudent = new Map();
                      for (const r of resultsArr) {
                        const sid = typeof r.student === 'object' ? r.student?.id : r.student;
                        if (!sid) continue;
                        if (!byStudent.has(sid)) byStudent.set(sid, []);
                        byStudent.get(sid).push(r);
                      }
                      const totalStudents = studentsArr.length;
                      let present = 0;
                      let passed = 0;
                      let failed = 0;
                      let absent = 0;
                      for (const stu of studentsArr) {
                        const sid = stu.id;
                        const list = byStudent.get(sid) || [];
                        if (!list.length) {
                          absent += 1;
                          continue;
                        }
                        present += 1;
                        let anyFail = list.some(it => (it?.grade === 'F') || (it?.is_passed === false));
                        try {
                          const clsObj = classes.find(c => c.id === classroom.id);
                          const clsName = String(clsObj?.name || classroom.name || '').toLowerCase();
                          const is910 = /নবম|দশম|\b9\b|\b10\b/.test(clsName);
                          if (is910) {
                            const combinedPass = banglaCombinedPassForStudent(sid);
                            if (combinedPass) {
                              const adjusted = list.filter(it => {
                                const nm = it.subject?.name || it.subject_name || '';
                                const fail = (it?.grade === 'F') || (it?.is_passed === false);
                                if (!fail) return false;
                                return isBanglaPaper(nm);
                              });
                              if (adjusted.length) {
                                anyFail = list.some(it => {
                                  const nm = it.subject?.name || it.subject_name || '';
                                  const fail = (it?.grade === 'F') || (it?.is_passed === false);
                                  if (!fail) return false;
                                  return !isBanglaPaper(nm);
                                });
                              }
                            }
                          }
                        } catch (_) {}
                        if (anyFail) failed += 1; else passed += 1;
                      }
                      allRows.push({
                        classroom: classroom.name,
                        section: section.name,
                        total: totalStudents,
                        present,
                        passed,
                        failed,
                        absent
                      });
                    }
                  }
                  setSummaryRows(allRows);
                } catch (e) {
                  setSummaryRows([]);
                } finally {
                  setSummaryLoading(false);
                }
              }}
              disabled={summaryLoading}
            >
              {summaryLoading ? 'Loading…' : 'Generate Summary'}
            </Button>
          </Stack>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Class</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Section</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Total</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Present</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Passed</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Failed</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Absent</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summaryRows.map((row, idx) => (
                  <TableRow key={`${row.classroom}-${row.section}-${idx}`}>
                    <TableCell>{row.classroom}</TableCell>
                    <TableCell>{row.section}</TableCell>
                    <TableCell align="center">{row.total}</TableCell>
                    <TableCell align="center">{row.present}</TableCell>
                    <TableCell align="center">{row.passed}</TableCell>
                    <TableCell align="center">{row.failed}</TableCell>
                    <TableCell align="center">{row.absent}</TableCell>
                  </TableRow>
                ))}
                {summaryRows.length > 0 && (
                  <TableRow sx={{ bgcolor: 'secondary.light' }}>
                    <TableCell colSpan={2}><strong>Total</strong></TableCell>
                    <TableCell align="center"><strong>{summaryRows.reduce((s, r) => s + r.total, 0)}</strong></TableCell>
                    <TableCell align="center"><strong>{summaryRows.reduce((s, r) => s + r.present, 0)}</strong></TableCell>
                    <TableCell align="center"><strong>{summaryRows.reduce((s, r) => s + r.passed, 0)}</strong></TableCell>
                    <TableCell align="center"><strong>{summaryRows.reduce((s, r) => s + r.failed, 0)}</strong></TableCell>
                    <TableCell align="center"><strong>{summaryRows.reduce((s, r) => s + r.absent, 0)}</strong></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
      {/* Add Results Dialog */}
      <Dialog open={addResultsDialogOpen} onClose={handleCloseAddResultsDialog} maxWidth="md" fullWidth>
        <DialogTitle>নতুন ফলাফল যোগ করুন</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Class Selection */}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>শ্রেণী নির্বাচন করুন</InputLabel>
                <Select
                  value={selectedClass}
                  onChange={handleClassChange}
                  label="শ্রেণী নির্বাচন করুন"
                  disabled={loadingClasses}
                >
                  {classes.map(classroom => (
                    <MenuItem key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Section Selection */}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>সেকশন নির্বাচন করুন</InputLabel>
                <Select
                  value={selectedSectionAdd}
                  onChange={(e) => { const secId = e.target.value; setSelectedSectionAdd(secId); if (selectedClass) loadStudentsByClass(selectedClass, secId || null); }}
                  label="সেকশন নির্বাচন করুন"
                  disabled={!selectedClass}
                >
                  <MenuItem value="">সব সেকশন</MenuItem>
                  {sectionsForAdd.map(sec => (
                    <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Examination Selection */
            }
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>পরীক্ষা নির্বাচন করুন</InputLabel>
                <Select
                  value={getExamsForClass(selectedClass).length ? selectedExam : ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setSelectedExam(Number.isNaN(v) ? '' : v);
                  }}
                  label="পরীক্ষা নির্বাচন করুন"
                >
                  {getExamsForClass(selectedClass).map(exam => (
                    <MenuItem key={exam.id} value={exam.id}>
                      {`${exam.name} (${getExamTypeLabel(exam.exam_type)}) — মোট: ${exam.total_marks}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Student Selection */}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <Autocomplete
                  options={students}
                  getOptionLabel={(student) => 
                    `${student.user?.first_name || ''} ${student.user?.last_name || ''} (${student.roll_number || 'No Roll'})`
                  }
                  value={students.find(s => s.id === selectedStudent) || null}
                  onChange={(event, newValue) => {
                    setSelectedStudent(newValue?.id || '');
                  }}
                  inputValue={studentSearchTerm}
                  onInputChange={(event, newInputValue) => {
                    setStudentSearchTerm(newInputValue);
                  }}
                  disabled={!selectedClass || loadingStudents}
                  loading={loadingStudents}
                  noOptionsText="কোন শিক্ষার্থী পাওয়া যায়নি"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="শিক্ষার্থী নির্বাচন করুন"
                      variant="outlined"
                      placeholder="নাম বা রোল নম্বর লিখুন..."
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingStudents ? <CircularProgress color="inherit" size={20} /> : null}
                            {studentSearchTerm && (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStudentSearchTerm('');
                                }}
                              >
                                <ClearIcon fontSize="small" />
                              </IconButton>
                            )}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  filterOptions={(options, { inputValue }) => {
                    if (!inputValue) return options;
                    const searchTerm = inputValue.toLowerCase();
                    return options.filter(option => {
                      const fullName = `${option.user?.first_name || ''} ${option.user?.last_name || ''}`.toLowerCase();
                      const rollNumber = option.roll_number?.toLowerCase() || '';
                      return fullName.includes(searchTerm) || rollNumber.includes(searchTerm);
                    });
                  }}
                  renderOption={(props, student) => (
                    <li {...props}>
                      <div>
                        <div>{student.user?.first_name} {student.user?.last_name}</div>
                        <div style={{ fontSize: '0.8em', color: '#666' }}>
                          রোল: {student.roll_number || 'N/A'}
                        </div>
                      </div>
                    </li>
                  )}
                  fullWidth
                />
              </FormControl>
            </Grid>

            {/* Subject Selection */}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>বিষয় নির্বাচন করুন *</InputLabel>
                <Select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  label="বিষয় নির্বাচন করুন *"
                  disabled={!selectedClass || loadingSubjects}
                >
                  {subjects.map(subject => (
                    <MenuItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </MenuItem>
                  ))}
                </Select>
                {loadingSubjects && <CircularProgress size={24} sx={{ ml: 1 }} />}
              </FormControl>
            </Grid>

            {/* Marks Entry */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" gutterBottom>নম্বর প্রদান করুন</Typography>
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="লিখিত নম্বর"
                type="number"
                fullWidth
                value={marks.written}
                onChange={(e) => handleMarksChange('written', e.target.value)}
                placeholder={String(getMaxForField(getExamById(selectedExam), 'written', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? '')}
                InputProps={{ inputProps: { min: 0, max: getMaxForField(getExamById(selectedExam), 'written', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? undefined } }}
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="এমসিকিউ নম্বর"
                type="number"
                fullWidth
                value={marks.mcq}
                onChange={(e) => handleMarksChange('mcq', e.target.value)}
                placeholder={String(getMaxForField(getExamById(selectedExam), 'mcq', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? '')}
                InputProps={{ inputProps: { min: 0, max: getMaxForField(getExamById(selectedExam), 'mcq', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? undefined } }}
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="প্র্যাকটিক্যাল নম্বর"
                type="number"
                fullWidth
                value={marks.practical}
                onChange={(e) => handleMarksChange('practical', e.target.value)}
                placeholder={String(getMaxForField(getExamById(selectedExam), 'practical', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? '')}
                InputProps={{ inputProps: { min: 0, max: getMaxForField(getExamById(selectedExam), 'practical', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? undefined } }}
              />
            </Grid>

            {/* Calculated Grade */}
            <Grid size={{ xs: 12 }}>
              <Card sx={{ bgcolor: 'background.default', p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body1">মোট নম্বর: <strong>{(parseFloat(marks.written) || 0) + (parseFloat(marks.mcq) || 0) + (parseFloat(marks.practical) || 0)}</strong></Typography>
                  {(() => { const examObj = examinations.find(ex => ex.id === parseInt(selectedExam)); return (
                    <Typography variant="body2" color="text.secondary">বর্তমান পরীক্ষা: মোট {(((parseFloat(examObj?.written_max) || 0) + (parseFloat(examObj?.mcq_max) || 0) + (parseFloat(examObj?.practical_max) || 0)) || examObj?.total_marks) ?? '—'}, পাশ {examObj?.pass_marks ?? '—'}</Typography>
                  ); })()}
                  <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body1" component="span">হিসাবকৃত গ্রেড:</Typography>
                  {(() => { const s = getGradeStyle(calculatedGrade); return (
                    <Chip label={calculatedGrade || 'N/A'} size="small" sx={{ bgcolor: s.bg, color: s.fg, fontWeight: 'bold' }} />
                  ); })()}
                </Stack>
                </Stack>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" gutterBottom>সব বিষয়ের জন্য নম্বর দিন</Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'secondary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>বিষয়</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">লিখিত</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">এমসিকিউ</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">প্র্যাকটিক্যাল</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">মোট</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subjects.map(subject => {
                      const m = multiSubjectMarks[subject.id] || { written: '', mcq: '', practical: '' };
                      const total = (parseFloat(m.written) || 0) + (parseFloat(m.mcq) || 0) + (parseFloat(m.practical) || 0);
                      return (
                        <TableRow key={subject.id}>
                          <TableCell>{subject.name}</TableCell>
                          <TableCell align="center">
                            <TextField type="number" size="small" value={m.written} onChange={(e) => setMultiSubjectMark(subject.id, 'written', e.target.value)} placeholder={String(getMaxForField(getExamById(selectedExam), 'written', subject.name) ?? '')} inputProps={{ min: 0, max: getMaxForField(getExamById(selectedExam), 'written', subject.name) ?? undefined }} />
                          </TableCell>
                          <TableCell align="center">
                            <TextField type="number" size="small" value={m.mcq} onChange={(e) => setMultiSubjectMark(subject.id, 'mcq', e.target.value)} placeholder={String(getMaxForField(getExamById(selectedExam), 'mcq', subject.name) ?? '')} inputProps={{ min: 0, max: getMaxForField(getExamById(selectedExam), 'mcq', subject.name) ?? undefined }} />
                          </TableCell>
                          <TableCell align="center">
                            <TextField type="number" size="small" value={m.practical} onChange={(e) => setMultiSubjectMark(subject.id, 'practical', e.target.value)} placeholder={String(getMaxForField(getExamById(selectedExam), 'practical', subject.name) ?? '')} inputProps={{ min: 0, max: getMaxForField(getExamById(selectedExam), 'practical', subject.name) ?? undefined }} />
                          </TableCell>
                          <TableCell align="center"><strong>{total}</strong></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddResultsDialog}>বাতিল</Button>
          <Button 
            onClick={handleSaveResult} 
            variant="contained" 
            color="primary"
            disabled={savingResult || !selectedClass || !selectedStudent || !selectedSubject}
          >
            {savingResult ? <CircularProgress size={24} /> : 'সংরক্ষণ করুন'}
          </Button>
          <Button
            onClick={async () => {
              if (!selectedExam || !selectedClass || !selectedStudent) { toast.error('পরীক্ষা, শ্রেণী ও শিক্ষার্থী নির্বাচন করুন'); return; }
              const examId = parseInt(selectedExam);
              const examObjForRedirect = examinations.find(ex => ex.id === examId) || null;
              const clsIdRedirect = String(selectedClass);
              const stuIdRedirect = String(selectedStudent);
              const secIdRedirect = String(selectedSectionAdd || '');
              const examTypeRedirect = String(examObjForRedirect?.exam_type || 'annual');
              const urlRedirect = `/school/${id}/result-card?classroom=${encodeURIComponent(clsIdRedirect)}&student=${encodeURIComponent(stuIdRedirect)}&exam_type=${encodeURIComponent(examTypeRedirect)}${secIdRedirect ? `&section=${encodeURIComponent(secIdRedirect)}` : ''}&exam=${encodeURIComponent(String(examId))}&auto=1`;
              try {
                setSavingResult(true);
                const rows = subjects.map(s => {
                  const m = multiSubjectMarks[s.id] || { written: '', mcq: '', practical: '' };
                  return {
                    examination: examId,
                    student_id: parseInt(selectedStudent),
                    subject_id: s.id,
                    written_marks: parseFloat(m.written) || 0,
                    mcq_marks: parseFloat(m.mcq) || 0,
                    practical_marks: parseFloat(m.practical) || 0
                  };
                }).filter(r => (r.written_marks || 0) + (r.mcq_marks || 0) + (r.practical_marks || 0) > 0);
                if (rows.length === 0) { toast.info('কোনো বিষয়ের নম্বর প্রদান করা হয়নি'); setSavingResult(false); return; }
                const payload = { examination: examId, results: rows };
                const res = await api.post(`/api/results/examinations/${examId}/bulk_results/`, payload);
                toast.success('সব বিষয়ের ফলাফল সংরক্ষণ হয়েছে');
                handleCloseAddResultsDialog();
                loadResults(examId);
                window.location.assign(urlRedirect);
              } catch (e) {
                console.error('Save all subjects error:', e?.response?.data || e);
                toast.error('সব বিষয়ের ফলাফল সংরক্ষণ ব্যর্থ');
              } finally {
                setSavingResult(false);
              }
            }}
            variant="contained"
            color="secondary"
            disabled={savingResult || !selectedClass || !selectedStudent || !subjects.length || !selectedExam}
          >
            {savingResult ? <CircularProgress size={24} /> : 'সব বিষয় সংরক্ষণ করুন'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Result Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle>ফলাফল সম্পাদনা</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                type="number"
                label="লিখিত"
                value={editMarks.written}
                onChange={(e) => setEditMarks({ ...editMarks, written: e.target.value })}
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                type="number"
                label="এমসিকিউ"
                value={editMarks.mcq}
                onChange={(e) => setEditMarks({ ...editMarks, mcq: e.target.value })}
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                type="number"
                label="প্র্যাকটিক্যাল"
                value={editMarks.practical}
                onChange={(e) => setEditMarks({ ...editMarks, practical: e.target.value })}
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit}>বাতিল</Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={savingEdit}>
            {savingEdit ? 'আপডেট হচ্ছে...' : 'আপডেট করুন'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, item: null })}
        onConfirm={handleConfirmDelete}
        title="ফলাফল মুছুন"
        message={`আপনি কি নিশ্চিত আপনি "${deleteDialog.item?.subject?.name || 'Subject'}" (${deleteDialog.item?.student?.user?.first_name || ''} ${deleteDialog.item?.student?.user?.last_name || ''}) ফলাফলটি মুছে ফেলতে চান?`}
      />

      <Dialog open={bulkDialogOpen} onClose={closeBulkDialog} maxWidth="lg" fullWidth>
        <DialogTitle>বাল্ক মার্কস ইনপুট</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>শ্রেণী</InputLabel>
                <Select
                  value={bulkForm.classroom}
                  onChange={(e) => { const v = e.target.value; setBulkForm(prev => ({ ...prev, classroom: v })); loadStudentsByClass(v, bulkForm.section || null); loadSectionsByClass(v); loadSubjectsByClass(v); loadExaminationsByClass(v); const exams = getExamsForClass(v); setBulkForm(prev => ({ ...prev, exam: exams[0]?.id || '' })); }}
                  label="শ্রেণী"
                  disabled={loadingClasses}
                >
                  {classes.map(classroom => (
                    <MenuItem key={classroom.id} value={classroom.id}>{classroom.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>সেকশন</InputLabel>
                <Select
                  value={bulkForm.section}
                  onChange={(e) => { const v = e.target.value; setBulkForm(prev => ({ ...prev, section: v })); if (bulkForm.classroom) loadStudentsByClass(bulkForm.classroom, v || null); }}
                  label="সেকশন"
                  disabled={!bulkForm.classroom}
                >
                  <MenuItem value="">সব সেকশন</MenuItem>
                  {sectionsForAdd.map(sec => (<MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>পরীক্ষা</InputLabel>
                <Select
                  value={bulkForm.exam}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, exam: e.target.value }))}
                  label="পরীক্ষা"
                >
                  {getExamsForClass(bulkForm.classroom).map(exam => (
                    <MenuItem key={exam.id} value={exam.id}>
                      {`${exam.name} (${getExamTypeLabel(exam.exam_type)}) — মোট: ${exam.total_marks}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>বিষয়</InputLabel>
                <Select
                  value={bulkForm.subject}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, subject: e.target.value }))}
                  label="বিষয়"
                  disabled={!bulkForm.classroom || loadingSubjects}
                >
                  {subjects.map(subject => (<MenuItem key={subject.id} value={subject.id}>{subject.name}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>রোল</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>নাম</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>লিখিত</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>এমসিকিউ</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>প্র্যাকটিক্যাল</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(bulkStudents || []).map(s => {
                      const name = `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim() || s.user?.username;
                      const m = bulkMarks[s.id] || { written: '', mcq: '', practical: '' };
                      return (
                        <TableRow key={s.id}>
                          <TableCell>{s.roll_number || '-'}</TableCell>
                          <TableCell>{name}</TableCell>
                          <TableCell><TextField type="number" size="small" value={m.written} onChange={(e) => setBulkMark(s.id, 'written', e.target.value)} onKeyDown={(e) => handleKeyDown(e, s.id, 'written')} placeholder={String(getMaxForField(getExamById(bulkForm.exam || selectedExam), 'written', (subjects.find(sub => sub.id === parseInt(bulkForm.subject)) || {}).name) ?? '')} inputProps={{ min: 0, max: getMaxForField(getExamById(bulkForm.exam || selectedExam), 'written', (subjects.find(sub => sub.id === parseInt(bulkForm.subject)) || {}).name) ?? undefined, 'data-student-id': s.id, 'data-field': 'written' }} /></TableCell>
                          <TableCell><TextField type="number" size="small" value={m.mcq} onChange={(e) => setBulkMark(s.id, 'mcq', e.target.value)} onKeyDown={(e) => handleKeyDown(e, s.id, 'mcq')} placeholder={String(getMaxForField(getExamById(bulkForm.exam || selectedExam), 'mcq', (subjects.find(sub => sub.id === parseInt(bulkForm.subject)) || {}).name) ?? '')} inputProps={{ min: 0, max: getMaxForField(getExamById(bulkForm.exam || selectedExam), 'mcq', (subjects.find(sub => sub.id === parseInt(bulkForm.subject)) || {}).name) ?? undefined, 'data-student-id': s.id, 'data-field': 'mcq' }} /></TableCell>
                          <TableCell><TextField type="number" size="small" value={m.practical} onChange={(e) => setBulkMark(s.id, 'practical', e.target.value)} onKeyDown={(e) => handleKeyDown(e, s.id, 'practical')} placeholder={String(getMaxForField(getExamById(bulkForm.exam || selectedExam), 'practical', (subjects.find(sub => sub.id === parseInt(bulkForm.subject)) || {}).name) ?? '')} inputProps={{ min: 0, max: getMaxForField(getExamById(bulkForm.exam || selectedExam), 'practical', (subjects.find(sub => sub.id === parseInt(bulkForm.subject)) || {}).name) ?? undefined, 'data-student-id': s.id, 'data-field': 'practical' }} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBulkDialog}>বাতিল</Button>
          <Button onClick={saveBulkMarks} variant="contained" disabled={bulkSaving || !bulkForm.classroom || !bulkForm.subject || !bulkForm.exam}>{bulkSaving ? <CircularProgress size={24} /> : 'সংরক্ষণ করুন'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
