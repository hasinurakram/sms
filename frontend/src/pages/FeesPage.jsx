import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  Snackbar,
  IconButton,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Chip,
  useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useTheme } from '@mui/material/styles';
import api from '../utils/api';
import StudentFeeSlipCard from '../components/StudentFeeSlipCard';
import { useSchool } from '../context/SchoolContext';
import { isAuthenticated } from '../utils/auth';

const StudentAvatar = ({ photo, name, size = 40 }) => {
  if (photo) {
    return (
      <Avatar
        src={photo}
        alt={name}
        sx={{ width: size, height: size }}
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
    );
  }
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: 'primary.main' }}>
      {name ? name.charAt(0).toUpperCase() : <PersonIcon />}
    </Avatar>
  );
};

const FeesPage = () => {
  const { id: schoolId } = useParams(); // Get school ID from URL
  const navigate = useNavigate();
  // Removed page-level authentication check to allow public view
  const { school } = useSchool(); // School context provides current school if available
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [feeStructures, setFeeStructures] = useState([]);
  const [isLoadingFeeStructures, setIsLoadingFeeStructures] = useState(false);
  const [assignedStructureIds, setAssignedStructureIds] = useState([]);
  // Student Ledger states
  const [selectedLedgerStudentId, setSelectedLedgerStudentId] = useState('');
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [ledger, setLedger] = useState({ assignments: [], collections: [], rows: [], totals: { amount: 0, paid: 0, due: 0 } });
  // Record Payment dialog state
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date(),
    method: '',
    reference: '',
    note: '',
    bkash_to: '',
    bkash_from: ''
  });
  // Inline payment inputs (bottom Payment Method Ledger)
  const [inlinePayment, setInlinePayment] = useState({ amount: '', paymentDate: new Date(), method: '', reference: '', note: '', bkash_to: '', bkash_from: '' });
  // Due slip dialog state
  const [isDueSlipOpen, setIsDueSlipOpen] = useState(false);
  const handleOpenDueSlip = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    try {
      setIsDueSlipOpen(true);
      if (selectedLedgerStudentId) {
        await fetchStudentLedger(String(selectedLedgerStudentId));
        await fetchPaymentHistory(String(selectedLedgerStudentId));
      }
    } catch (_) {}
  };

  // Generate and display Result Card for the selected class/student
  const handleGenerateResultCard = async () => {
    if (!selectedClass || !selectedLedgerStudentId) return;
    try {
      // Ensure latest assignments and ledger reflect plan/payments
      await ensureStudentAssignments(String(selectedLedgerStudentId));
      await fetchStudentLedger(String(selectedLedgerStudentId));
    } catch (_) {}
    const examType = 'annual'; // default exam type; user can change in UI
    const url = `/school/${schoolId}/result-card?classroom=${encodeURIComponent(String(selectedClass))}&student=${encodeURIComponent(String(selectedLedgerStudentId))}&exam_type=${encodeURIComponent(examType)}&auto=1`;
    window.location.assign(url);
  };
  const [duePayments, setDuePayments] = useState({}); // key: assignmentId -> { amount, date, method, docText, docFile }
  // Payment method ledger states
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  // Payment Method input rows (when no history)
  const [pmInputs, setPmInputs] = useState([]);
  const addPmRow = () => setPmInputs(prev => ([...prev, { id: `new-${Date.now()}`, assignmentId: '', date: new Date(), amount: '', method: 'cash', docText: '', docFile: null }]));
  const updatePmRow = (rowId, patch) => setPmInputs(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
  const removePmRow = (rowId) => setPmInputs(prev => prev.filter(r => r.id !== rowId));
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Helper function to set fees for a specific class
  const setClassWiseFees = async (classId, monthlyTuition, sessionFee, assessmentFee) => {
    const classIdStr = String(classId);
    const schoolIdNum = Number(schoolId);
    const academicYear = new Date().getFullYear().toString();
    const monthsBn = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    
    try {
      // Create monthly tuition fees
      for (let i = 0; i < 12; i++) {
        const feeData = {
          name: `${monthsBn[i]} মাসের বেতন`,
          title: `${monthsBn[i]} মাসের বেতন`,
          amount: monthlyTuition,
          frequency: 'monthly',
          fee_type: 'tuition',
          classroom_id: classId,  // Changed from class_id to classroom_id
          school_id: schoolIdNum,
          academic_year: academicYear,
          month: i + 1
        };
        
        await api.post('/api/fees/fees/', feeData);
      }
      
      // Create session fee
      if (sessionFee > 0) {
        const sessionData = {
          name: 'সেশন ফি',
          title: 'সেশন ফি',
          amount: sessionFee,
          frequency: 'one_time',
          fee_type: 'session',
          classroom_id: classId,  // Changed from class_id to classroom_id
          school_id: schoolIdNum,
          academic_year: academicYear
        };
        
        await api.post('/api/fees/fees/', sessionData);
      }
      
      // Create assessment fee
      if (assessmentFee > 0) {
        const assessmentData = {
          name: 'ষান্মাসিক/বাৎসরিক মূল্যায়ন ফি',
          title: 'ষান্মাসিক/বাৎসরিক মূল্যায়ন ফি',
          amount: assessmentFee,
          frequency: 'one_time',
          fee_type: 'assessment',
          classroom_id: classId,  // Changed from class_id to classroom_id
          school_id: schoolIdNum,
          academic_year: academicYear
        };
        
        await api.post('/api/fees/fees/', assessmentData);
      }
      
      return { success: true, message: `Class ${classId} fees set successfully` };
    } catch (error) {
      console.error('Error setting class fees:', error);
      return { success: false, message: 'Error setting fees', error };
    }
  };
  
  // Function to set class-wise fees as per user requirements
  const setupClassWiseFees = async () => {
    try {
      if (!isAuthenticated()) {
        navigate('/login');
        return;
      }
      if (!selectedClass) {
        setSnackbar({ open: true, message: 'শ্রেণি নির্বাচন করুন', severity: 'error' });
        return;
      }
      const cid = String(selectedClass);
      const derived = deriveClassPlan(cid) || {};
      const monthly = Number(derived.monthlyAmount ?? planForm.monthlyAmount ?? 0) || 0;
      const session = Number(derived.sessionAmount ?? planForm.sessionAmount ?? 0) || 0;
      const assessment = Number(derived.assessmentAmount ?? planForm.assessmentAmount ?? 0) || 0;
      if (monthly <= 0 && session <= 0 && assessment <= 0) {
        setSnackbar({ open: true, message: 'কমপক্ষে মাসিক/সেশন/মূল্যায়নের একটির পরিমাণ দিন', severity: 'warning' });
        return;
      }
      const result = await setClassWiseFees(selectedClass, monthly, session, assessment);
      if (!result.success) {
        setSnackbar({ open: true, message: 'ক্লাসের ফি সেট করতে সমস্যা হয়েছে', severity: 'error' });
        return;
      }
      await fetchFeeStructures(String(selectedClass));
      try { await generateClassSlips(); } catch (_) {}
      if (selectedLedgerStudentId) {
        await ensureStudentAssignments(String(selectedLedgerStudentId));
        await fetchStudentLedger(String(selectedLedgerStudentId));
      }
      setSnackbar({ open: true, message: 'নির্বাচিত ক্লাসের ফি সফলভাবে সেট হয়েছে!', severity: 'success' });
    } catch (e) {
      console.error('setupClassWiseFees error:', e.response?.data || e.message);
      setSnackbar({ open: true, message: 'ক্লাস ভিত্তিক ফি সেট করতে সমস্যা হয়েছে', severity: 'error' });
    }
  };
  
  // Class Fee Plan dialog state
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
    monthlyAmount: '',
    halfYearlyAmount: '',
    annualAmount: '',
    sessionAmount: '',
    registrationAmount: '',
    assessmentAmount: '',
    boardAmount: '',
    examCenterAmount: '',
    ictAmount: '',
    sportsAmount: '',
    developmentAmount: '',
    electricityAmount: '',
    tcAmount: '',
    computerLabAmount: '',
    scoutsAmount: '',
    admissionAmount: '',
    m1: '', m2: '', m3: '', m4: '', m5: '', m6: '', m7: '', m8: '', m9: '', m10: '', m11: '', m12: ''
  });
  // Cache per-class plan so due slip can show values immediately
  const [classPlans, setClassPlans] = useState({});

  // Helper: POST with client-side timeout/abort
  const postWithTimeout = async (url, data, timeoutMs = 30000) => {
    try {
      // Prefer axios timeout to ensure request fails after timeoutMs
      return await api.post(url, data, { timeout: timeoutMs });
    } catch (e) {
      throw e;
    }
  };

  // Helper: throttle concurrency for async ops
  const runThrottled = async (items, batchSize, makePromise) => {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const slice = items.slice(i, i + batchSize);
      const settled = await Promise.allSettled(slice.map(makePromise));
      results.push(...settled);
    }
    return results;
  };

  const [feeForm, setFeeForm] = useState({
    studentId: '',
    feeStructureId: '',
    amount: '',
    dueDate: null,
    description: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Hydrate saved filters (class/student) so the UI remains consistent after navigation
  useEffect(() => {
    try {
      const key = `feesPageFilters_${schoolId}`;
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved) {
        if (saved.classroom) {
          setSelectedClass(String(saved.classroom));
        }
        if (saved.student) setSelectedLedgerStudentId(String(saved.student));
      }
    } catch (_) {}
  }, [schoolId]);

  // Persist filters when they change
  useEffect(() => {
    try {
      const key = `feesPageFilters_${schoolId}`;
      localStorage.setItem(key, JSON.stringify({
        classroom: selectedClass ? parseInt(selectedClass) : '',
        student: selectedLedgerStudentId ? parseInt(selectedLedgerStudentId) : ''
      }));
    } catch (_) {}
  }, [schoolId, selectedClass, selectedLedgerStudentId]);

  const studentsFetchTimer = useRef(null);
  useEffect(() => {
    if (studentsFetchTimer.current) {
      clearTimeout(studentsFetchTimer.current);
      studentsFetchTimer.current = null;
    }
    if (!selectedClass) {
      setStudents([]);
      return;
    }
    studentsFetchTimer.current = setTimeout(() => {
      fetchStudents(String(selectedClass)).catch(() => {});
    }, 300);
    return () => {
      if (studentsFetchTimer.current) {
        clearTimeout(studentsFetchTimer.current);
        studentsFetchTimer.current = null;
      }
    };
  }, [selectedClass]);

  // Clamp selectedClass to available classes when classes list changes
  useEffect(() => {
    if (!selectedClass) return;
    const exists = classes.some((c) => String(c.id) === String(selectedClass));
    if (!exists) {
      setSelectedClass('');
      setStudents([]);
      setSelectedLedgerStudentId('');
    }
  }, [classes]);

  // Clamp selected student IDs to available options
  useEffect(() => {
    if (selectedLedgerStudentId && !students.some(s => String(s.id) === String(selectedLedgerStudentId))) {
      setSelectedLedgerStudentId('');
    }
    if (feeForm.studentId && !students.some(s => String(s.id) === String(feeForm.studentId))) {
      setFeeForm(prev => ({ ...prev, studentId: '' }));
    }
  }, [students]);

  // Helper: generate Bengali-friendly structure label
  const getStructureLabel = (s, fallbackId = '') => {
    if (!s) return null;
    const monthsBn = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    const type = s.type || s.category || s.kind;
    const month = s.month || s.month_no || s.month_number;
    const exam = s.exam_code || s.exam || s.exam_type;
    if (type && String(type).toLowerCase().includes('tuition') && month >= 1 && month <= 12) {
      return `${monthsBn[Number(month) - 1]} মাসের বেতন`;
    }
    if (type && String(type).toLowerCase().includes('exam')) {
      const examMap = {
        'half': 'অর্ধ-বার্ষিকী পরীক্ষার ফি',
        'half-yearly': 'অর্ধ-বার্ষিকী পরীক্ষার ফি',
        'annual': 'বার্ষিক পরীক্ষার ফি',
        'final': 'বার্ষিক পরীক্ষার ফি',
        'session': 'সেশন ফি'
      };
      const key = String(exam || '').toLowerCase();
      if (examMap[key]) return examMap[key];
      return `${exam || 'পরীক্ষার ফি'}`;
      return 'পরীক্ষার ফি';
    }
    // Fallback to provided name/title/label
    return s.name || s.title || s.label || (fallbackId ? `Structure ${fallbackId}` : 'Structure');
  };

  // Helper: generate proper Bengali fee category names based on structure properties
  const getFeeCategoryName = (s, fallbackId = '') => {
    if (!s) return null;
    
    const type = String(s.type || s.category || s.kind || '').toLowerCase();
    const name = String(s.name || '').toLowerCase();
    const frequency = String(s.frequency || '').toLowerCase();
    
    // Map to Bengali fee category names
    const feeCategoryMap = {
      'registration': 'রেজিস্ট্রেশন ফি',
      'session': 'সেশন ফি', 
      'assessment': 'মূল্যায়ন ফি',
      'evaluation': 'মূল্যায়ন ফি',
      'board': 'বোর্ড ফি',
      'exam_center': 'পরীক্ষা কেন্দ্র ফি',
      'ict': 'আইসিটি ফি',
      'sports': 'ক্রীড়া ফি',
      'development': 'উন্নয়ন ফি',
      'electricity': 'বিদ্যুৎ/কল্যাণ ফি',
      'welfare': 'বিদ্যুৎ/কল্যাণ ফি',
      'tc': 'টিসি/প্রশংসাপত্র ফি',
      'certificate': 'টিসি/প্রশংসাপত্র ফি',
      'computer_lab': 'কম্পিউটার ল্যাব ফি',
      'lab': 'কম্পিউটার ল্যাব ফি',
      'scouts': 'স্কাউটস ফি',
      'admission': 'ভর্তি ফি'
    };
    
    // Check type/category first
    for (const [key, bengaliName] of Object.entries(feeCategoryMap)) {
      if (type.includes(key) || name.includes(key)) {
        return bengaliName;
      }
    }
    
    // Check frequency-based names
    if (frequency === 'monthly') {
      return 'মাসিক বেতন';
    } else if (frequency === 'one_time' || frequency === 'exam') {
      // Try to determine exam type
      if (name.includes('half') || name.includes('অর্ধ')) {
        return 'অর্ধ-বার্ষিকী পরীক্ষার ফি';
      } else if (name.includes('annual') || name.includes('final') || name.includes('বার্ষিক')) {
        return 'বার্ষিক পরীক্ষার ফি';
      } else if (name.includes('session') || name.includes('সেশন')) {
        return 'সেশন ফি';
      }
      return 'পরীক্ষার ফি';
    }
    
    return null;
  };

  // Helper: label for a fee row using available structures list
  const labelForFeeRow = (fee) => {
    if (!fee) return '-';
    const sObj = fee.fee_structure || null;
    const sid = fee.fee_structure_id || (sObj && sObj.id) || fee.fee_structure || '';
    // Try direct object first
    const byObj = getStructureLabel(sObj, sid);
    if (byObj) return byObj;
    // Try lookup in fetched structures
    const s = feeStructures.find(x => String(x.id) === String(sid));
    const byMap = getStructureLabel(s, sid);
    if (byMap) return byMap;
    // Fallbacks
    return (s && (s.name || s.title || s.label)) || fee.fee_type || fee.type || (sid ? `ফি #${sid}` : '-');
  };

  // Determine if a fee structure looks legacy/unlabeled
  const isLegacyStructure = (s, sid) => {
    if (!s) return true;
    const type = String(s.type || s.category || s.kind || '').toLowerCase();
    const month = Number(s.month || s.month_no || s.month_number || 0);
    const exam = String(s.exam_code || s.exam || s.exam_type || '').toLowerCase();
    const hasMeta = (type === 'tuition' && month >= 1 && month <= 12) || (type === 'exam' && !!exam);
    const nm = s.name || s.title || s.label || '';
    const generic = /^structure\b/i.test(nm) || nm.trim() === '';
    return !hasMeta && generic;
  };

  // Replace legacy assignments for selected student: delete legacy items and recreate from plan
  const replaceLegacyForStudent = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!selectedLedgerStudentId) {
      setSnackbar({ open: true, message: 'শিক্ষার্থী নির্বাচন করুন', severity: 'warning' });
      return;
    }
    if (!selectedClass) {
      setSnackbar({ open: true, message: 'শ্রেণি নির্বাচন করুন', severity: 'warning' });
      return;
    }
    try {
      setIsLoadingLedger(true);
      // Ensure we have latest structures and assignments
      const structures = await fetchFeeStructures();
      const structMap = new Map((structures || []).map(s => [String(s.id || s._id), s]));
      const aResp = await api.get(`/api/fees/assignments/?student_id=${selectedLedgerStudentId}&school=${schoolId}`);
      let assignments = [];
      if (Array.isArray(aResp.data)) assignments = aResp.data; else if (aResp.data?.results) assignments = aResp.data.results; else if (aResp.data?.data) assignments = aResp.data.data;
      // Pick legacy ones
      const legacy = assignments.filter(a => {
        const sid = String(a.fee_structure_id || a.fee_structure?.id || a.fee_structure || '');
        const s = structMap.get(sid);
        const name = a.fee_structure?.name || a.name || '';
        const genericName = /^structure\b/i.test(name);
        return isLegacyStructure(s, sid) || genericName;
      });
      // Delete legacy assignments one by one (best-effort)
      for (const a of legacy) {
        const id = a.id || a._id;
        if (!id) continue;
        try {
          await api.delete(`/api/fees/assignments/${id}/`);
        } catch (e) {
          console.warn('Failed to delete legacy assignment', id, e.response?.data || e.message);
        }
      }
      // Recreate from plan for this student
      await ensureStudentAssignments(String(selectedLedgerStudentId));
      await fetchStudentLedger(String(selectedLedgerStudentId));
      setSnackbar({ open: true, message: 'লিগ্যাসি আইটেম প্রতিস্থাপন সম্পন্ন', severity: 'success' });
    } catch (e) {
      console.error('Replace legacy failed:', e.response?.data || e.message);
      setSnackbar({ open: true, message: 'লিগ্যাসি আইটেম প্রতিস্থাপনে সমস্যা হয়েছে', severity: 'error' });
    } finally {
      setIsLoadingLedger(false);
    }
  };
  
  

  // Class Fee Plan dialog handlers
  const handleOpenPlanDialog = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    // Try to prefill from derived class plan if available
    const derived = deriveClassPlan(selectedClass);
    if (derived && (derived.monthlyAmount > 0 || derived.halfYearlyAmount > 0 || derived.annualAmount > 0 || derived.sessionAmount > 0)) {
      setPlanForm({
        monthlyAmount: String(derived.monthlyAmount || ''),
        halfYearlyAmount: String(derived.halfYearlyAmount || ''),
        annualAmount: String(derived.annualAmount || ''),
        sessionAmount: String(derived.sessionAmount || ''),
        registrationAmount: String(derived.registrationAmount || ''),
        assessmentAmount: String(derived.assessmentAmount || ''),
        boardAmount: String(derived.boardAmount || ''),
        examCenterAmount: String(derived.examCenterAmount || ''),
        ictAmount: String(derived.ictAmount || ''),
        sportsAmount: String(derived.sportsAmount || ''),
        developmentAmount: String(derived.developmentAmount || ''),
        electricityAmount: String(derived.electricityAmount || ''),
        tcAmount: String(derived.tcAmount || ''),
        computerLabAmount: String(derived.computerLabAmount || ''),
        scoutsAmount: String(derived.scoutsAmount || ''),
        admissionAmount: String(derived.admissionAmount || ''),
        m1: String(derived.monthlyAmount || ''), m2: String(derived.monthlyAmount || ''), m3: String(derived.monthlyAmount || ''), m4: String(derived.monthlyAmount || ''), m5: String(derived.monthlyAmount || ''), m6: String(derived.monthlyAmount || ''), m7: String(derived.monthlyAmount || ''), m8: String(derived.monthlyAmount || ''), m9: String(derived.monthlyAmount || ''), m10: String(derived.monthlyAmount || ''), m11: String(derived.monthlyAmount || ''), m12: String(derived.monthlyAmount || '')
      });
    } else {
      setPlanForm({ 
        monthlyAmount: '', 
        halfYearlyAmount: '', 
        annualAmount: '', 
        sessionAmount: '',
        registrationAmount: '',
        assessmentAmount: '',
        boardAmount: '',
        examCenterAmount: '',
        ictAmount: '',
        sportsAmount: '',
        developmentAmount: '',
        electricityAmount: '',
        tcAmount: '',
        computerLabAmount: '',
        scoutsAmount: '',
        admissionAmount: '',
        m1: '', m2: '', m3: '', m4: '', m5: '', m6: '', m7: '', m8: '', m9: '', m10: '', m11: '', m12: '' 
      });
    }
    setIsPlanDialogOpen(true);
  };
  const handleClosePlanDialog = () => {
    setIsPlanDialogOpen(false);
    // Blur any focused element to avoid aria-hidden focus warnings
    try { requestAnimationFrame(() => { const el = document.activeElement; if (el && typeof el.blur === 'function') el.blur(); }); } catch (_) {}
  };
  const handlePlanInputChange = (e) => {
    const { name, value } = e.target;
    setPlanForm(prev => ({ ...prev, [name]: value }));
  };

  // Save class plan: create 12 tuition + 2 exams (half_yearly, annual)
  // Try to derive plan for a class from existing fee structures
  const deriveClassPlan = (classId) => {
    const cid = String(classId || selectedClass || '');
    const list = (feeStructures || []).filter(s => {
      const clsId = s.class_id ?? s.classId ?? s.classroom?.id ?? s.classroom_id ?? s.classroomId ?? s.classroom ?? s.class;
      return clsId && String(clsId) === cid;
    });
    if (list.length === 0) return null;
    // Pick most common amount for monthly frequency
    const monthly = list.filter(x => (x.frequency || '').toLowerCase() === 'monthly');
    const oneTime = list.filter(x => (x.frequency || '').toLowerCase() === 'one_time');
    const mode = (arr, key) => {
      const freq = {};
      let best = null, bestC = 0;
      for (const it of arr) {
        const v = Number(it[key] ?? it.amount ?? it.default_amount ?? 0);
        freq[v] = (freq[v] || 0) + 1;
        if (freq[v] > bestC) { bestC = freq[v]; best = v; }
      }
      return best || 0;
    };
    const monthlyAmount = monthly.length ? mode(monthly, 'amount') : 0;
    // Try to distinguish half-yearly vs annual by name hints
    const pickByName = (arr, hints) => {
      const item = arr.find(x => {
        const n = String(x.name || x.title || '').toLowerCase();
        return hints.some(h => n.includes(h));
      });
      if (!item) return 0;
      return Number(item.amount ?? item.default_amount ?? 0) || 0;
    };
    const halfYearlyAmount = pickByName(oneTime, ['half', 'mid', 'অর্ধ']);
    const annualAmount = pickByName(oneTime, ['annual', 'final', 'বার্ষিক']);
    // Session may be named differently; search full list then fallback to oneTime
    const sessionFromAll = pickByName(list, ['session', 'সেশন']);
    const sessionFromOneTime = pickByName(oneTime, ['session', 'সেশন']);
    const sessionAmount = sessionFromAll || sessionFromOneTime || 0;
    const fallback = oneTime.length ? mode(oneTime, 'amount') : 0;
    return {
      monthlyAmount,
      halfYearlyAmount: halfYearlyAmount || 0,
      annualAmount: annualAmount || 0,
      sessionAmount: sessionAmount || 0,
      registrationAmount: pickByName(oneTime, ['registration', 'রেজিস্ট্রেশন']),
      assessmentAmount: pickByName(oneTime, ['assessment', 'evaluation', 'মূল্যায়ন']),
      boardAmount: pickByName(oneTime, ['board', 'বোর্ড']),
      examCenterAmount: pickByName(oneTime, ['exam_center', 'center', 'কেন্দ্র']),
      ictAmount: pickByName(oneTime, ['ict', 'আইসিটি']),
      sportsAmount: pickByName(oneTime, ['sports', 'ক্রীড়া']),
      developmentAmount: pickByName(oneTime, ['development', 'উন্নয়ন']),
      electricityAmount: pickByName(oneTime, ['electricity', 'welfare', 'বিদ্যুৎ', 'কল্যাণ']),
      tcAmount: pickByName(oneTime, ['tc', 'certificate', 'টিসি', 'প্রশংসা']),
      computerLabAmount: pickByName(oneTime, ['computer_lab', 'lab', 'কম্পিউটার']),
      scoutsAmount: pickByName(oneTime, ['scouts', 'স্কাউটস']),
      admissionAmount: pickByName(oneTime, ['admission', 'ভর্তি']),
      // Keep a hidden fallback in case both are 0 but there are exams
      _fallbackExamAmount: fallback
    };
  };

  const saveClassPlan = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!selectedClass) {
      setSnackbar({ open: true, message: 'শ্রেণি নির্বাচন করুন', severity: 'error' });
      return;
    }
    const anyAmount = [
      planForm.monthlyAmount, 
      planForm.halfYearlyAmount, 
      planForm.annualAmount, 
      planForm.sessionAmount,
      planForm.registrationAmount,
      planForm.assessmentAmount,
      planForm.boardAmount,
      planForm.examCenterAmount,
      planForm.ictAmount,
      planForm.sportsAmount,
      planForm.developmentAmount,
      planForm.electricityAmount,
      planForm.tcAmount,
      planForm.computerLabAmount,
      planForm.scoutsAmount,
      planForm.admissionAmount,
      planForm.m1, planForm.m2, planForm.m3, planForm.m4, planForm.m5, planForm.m6, planForm.m7, planForm.m8, planForm.m9, planForm.m10, planForm.m11, planForm.m12
    ]
      .some(v => Number(v || 0) > 0);
    if (!anyAmount) {
      setSnackbar({ open: true, message: 'কমপক্ষে একটি বৈধ পরিমাণ লিখুন (যেকোনো ফি ক্যাটেগরি)', severity: 'error' });
      return;
    }
    try {
      setIsSavingPlan(true);
      const classId = selectedClass;
      const classIdNum = Number(classId);
      const schoolIdNum = Number(schoolId);
      const academicYear = new Date().getFullYear().toString();
      const monthsBn = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
      const tuitionAmount = Number(planForm.monthlyAmount);
      const monthVals = Array.from({ length: 12 }, (_, i) => {
        const key = `m${i+1}`;
        const v = Number(planForm[key] || 0);
        if (v > 0) return v;
        return Number(planForm.monthlyAmount || 0) || 0;
      });
      const halfAmount = Number(planForm.halfYearlyAmount || 0);
      const annualAmount = Number(planForm.annualAmount || 0);
      const sessionAmount = Number(planForm.sessionAmount || 0);
      let createdCount = 0;
      let failedCount = 0;

      // Skip heavy deletion of previous plan to avoid long blocking operations

      let existingList = await fetchFeeStructures(classId);
      existingList = (existingList || []).filter(s => {
        const clsId = s.class_id ?? s.classId ?? s.classroom?.id ?? s.classroom_id ?? s.classroomId ?? s.classroom ?? s.class;
        return clsId && String(clsId) === String(classId);
      });
      if (monthVals.some(v => v > 0)) {
        const monthlyExisting = existingList.filter(x => String(x.frequency || '').toLowerCase() === 'monthly');
        if (monthlyExisting.length > 0) {
          const delAll = await runThrottled(monthlyExisting, 4, (it) => api.delete(`/api/fees/fees/${it.id}/`));
          for (const r of delAll) { if (r.status === 'fulfilled') createdCount += 1; else failedCount += 1; }
        }
        const createItems = Array.from({ length: 12 }).map((_, idx) => idx);
        const tuitionResults = await runThrottled(createItems, 4, (mi) => {
          const amt = monthVals[mi] || 0;
          const name = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'][mi] + ' মাসের বেতন';
          const payload = {
            school_id: schoolIdNum,
            school: schoolIdNum,
            classroom: classIdNum,
            classroom_id: classIdNum,
            class_id: classIdNum,
            class: classIdNum,
            amount: Number(amt),
            frequency: 'monthly',
            month: mi + 1,
            due_day: 10,
            late_fee_amount: 0,
            late_fee_after_days: 7,
            is_active: true,
            academic_year: academicYear,
            name,
            title: name,
          };
          return postWithTimeout('/api/fees/fees/', payload, 30000);
        });
        for (const r of tuitionResults) {
          if (r.status === 'fulfilled' && (r.value?.status === 201 || r.value?.status === 200)) createdCount += 1; else failedCount += 1;
        }
      }

      // Upsert exam/session structures: single item each
      const labelMap = [
        { key: 'half_yearly', name: 'অর্ধ-বার্ষিকী পরীক্ষার ফি', amount: halfAmount },
        { key: 'annual', name: 'বার্ষিক পরীক্ষার ফি', amount: annualAmount },
        { key: 'session', name: 'সেশন ফি', amount: sessionAmount },
        { key: 'registration', name: 'রেজিস্ট্রেশন ফি', amount: Number(planForm.registrationAmount || 0) },
        { key: 'assessment', name: 'ষান্মাসিক/বাৎসরিক মূল্যায়ন ফি', amount: Number(planForm.assessmentAmount || 0) },
        { key: 'board', name: 'বোর্ড ফি', amount: Number(planForm.boardAmount || 0) },
        { key: 'exam_center', name: 'পরীক্ষার কেন্দ্র ফি', amount: Number(planForm.examCenterAmount || 0) },
        { key: 'ict', name: 'আইসিটি ফি', amount: Number(planForm.ictAmount || 0) },
        { key: 'sports', name: 'ক্রীড়া ফি', amount: Number(planForm.sportsAmount || 0) },
        { key: 'development', name: 'উন্নয়ন ফি', amount: Number(planForm.developmentAmount || 0) },
        { key: 'electricity', name: 'বিদ্যুৎ/কল্যাণ ফি', amount: Number(planForm.electricityAmount || 0) },
        { key: 'tc', name: 'টিসি/প্রশংসা পত্র ফি', amount: Number(planForm.tcAmount || 0) },
        { key: 'computer_lab', name: 'কম্পিউটার ল্যাব ফি', amount: Number(planForm.computerLabAmount || 0) },
        { key: 'scouts', name: 'স্কাউটস ফি', amount: Number(planForm.scoutsAmount || 0) },
        { key: 'admission', name: 'ভর্তি ফি', amount: Number(planForm.admissionAmount || 0) },
      ];
      for (const meta of labelMap) {
        const candidates = existingList.filter(x => String(x.frequency || '').toLowerCase() === 'one_time')
          .filter(x => {
            const n = String(x.name || x.title || x.label || '').toLowerCase();
            return n.includes(meta.key) || n.includes(meta.name.toLowerCase()) || (String(x.exam_code || x.exam_type || '').toLowerCase() === meta.key);
          });
        if (meta.amount > 0) {
          if (candidates.length > 0) {
            // Update the first, delete the rest
            const [first, ...extra] = candidates;
            try { await api.patch(`/api/fees/fees/${first.id}/`, { amount: meta.amount, name: meta.name, title: meta.name }); createdCount += 1; } catch (_) { failedCount += 1; }
            if (extra.length > 0) {
              const exDel = await runThrottled(extra, 3, (it) => api.delete(`/api/fees/fees/${it.id}/`));
              for (const r of exDel) { if (r.status === 'fulfilled') createdCount += 1; else failedCount += 1; }
            }
          } else {
            // Create new
            try {
              const payload = {
                school_id: schoolIdNum,
                school: schoolIdNum,
                classroom: classIdNum,
                classroom_id: classIdNum,
                class_id: classIdNum,
                class: classIdNum,
                amount: Number(meta.amount),
                frequency: 'one_time',
                name: meta.name,
                title: meta.name,
                academic_year: academicYear,
                is_active: true,
              };
              const resp = await postWithTimeout('/api/fees/fees/', payload, 30000);
              if (resp?.status === 201 || resp?.status === 200) createdCount += 1; else failedCount += 1;
            } catch (_) { failedCount += 1; }
          }
        } else {
          // Amount is 0 => ensure none exist (delete duplicates and primary)
          if (candidates.length > 0) {
            const delAll = await runThrottled(candidates, 3, (it) => api.delete(`/api/fees/fees/${it.id}/`));
            for (const r of delAll) { if (r.status === 'fulfilled') createdCount += 1; else failedCount += 1; }
          }
        }
      }
      if (createdCount > 0) {
        setSnackbar({ open: true, message: `ক্লাস ফি প্ল্যান সংরক্ষিত হয়েছে — সফল: ${createdCount}, ব্যর্থ: ${failedCount}`, severity: 'success' });
        // Cache plan locally for quick due-slip preview
        setClassPlans(prev => ({
          ...prev,
          [String(classId)]: { monthlyAmount: tuitionAmount, halfYearlyAmount: halfAmount, annualAmount, sessionAmount }
        }));
        // Trigger assignment generation asynchronously (do not block UI)
        try {
          if (typeof generateClassSlips === 'function') {
            setTimeout(() => { try { generateClassSlips(); } catch (_) {} }, 0);
          }
        } catch (_) {}
      } else {
        setSnackbar({ open: true, message: `ক্লাস ফি প্ল্যান সংরক্ষণ ব্যর্থ — সফল: ${createdCount}, ব্যর্থ: ${failedCount}`, severity: 'error' });
      }
      await fetchFeeStructures(classId);
      setIsPlanDialogOpen(false);
    } catch (e) {
      console.error('Save plan error:', e.response?.data || e.message);
      setSnackbar({ open: true, message: 'ক্লাস ফি প্ল্যান সংরক্ষণে সমস্যা হয়েছে', severity: 'error' });
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Generate class slips: assign all structures to all students in class (skip existing)
  const generateClassSlips = async () => {
    if (!selectedClass) {
      setSnackbar({ open: true, message: 'শ্রেণি নির্বাচন করুন', severity: 'error' });
      return;
    }
    try {
      // load students for class
      const list = await fetchStudents(String(selectedClass));
      for (const s of list) {
        const sCls = s.classroom?.id ?? s.classroom ?? s.class?.id;
        if (sCls != null && String(sCls) === String(selectedClass)) {
          await ensureStudentAssignments(String(s.id));
        }
      }
      setSnackbar({ open: true, message: 'ক্লাসের সকল শিক্ষার্থীর জন্য স্লিপ তৈরি হয়েছে', severity: 'success' });
      if (selectedLedgerStudentId) await fetchStudentLedger(selectedLedgerStudentId);
    } catch (e) {
      console.error('Generate slips error:', e.response?.data || e.message);
      setSnackbar({ open: true, message: 'স্লিপ তৈরি করতে সমস্যা হয়েছে', severity: 'error' });
    }
  };

  // Fetch classes function
  const fetchClasses = async () => {
    try {
      setIsLoadingClasses(true);
      // Do not manually enforce token presence here; api interceptor injects Authorization and handles refresh/login

      // Get school ID from URL params (like dashboard does)
      const currentSchoolId = schoolId;
      console.log('Current school ID from URL:', currentSchoolId);

      if (!currentSchoolId) {
        throw new Error('School ID not found in URL. Please access fees from school dashboard.');
      }

      // Try filtered endpoints first (since we have school ID)
      const endpoints = [
        `/api/academics/classrooms/?school=${currentSchoolId}`,
        `/api/classrooms/?school_id=${currentSchoolId}`,
        `/api/classes/?school_id=${currentSchoolId}`,
        '/api/academics/classrooms/', // fallback, but we'll filter client-side
        '/api/classrooms/',
        '/api/classes/'
      ];

      let response;
      let lastError;

      for (const endpoint of endpoints) {
        try {
          console.log('Trying endpoint:', endpoint);
          response = await api.get(endpoint);

          console.log('Response from', endpoint, ':', response.data);
          if (response.data) break;
        } catch (err) {
          console.warn('Failed with endpoint', endpoint, ':', err.message);
          lastError = err;
          continue;
        }
      }

      if (!response) {
        console.error('All endpoints failed. Last error:', lastError);
        throw lastError || new Error('All endpoints failed');
      }

      // Handle different response formats
      let classesData = [];
      if (Array.isArray(response.data)) {
        classesData = response.data;
      } else if (response.data && Array.isArray(response.data.results)) {
        classesData = response.data.results;
      } else if (response.data && Array.isArray(response.data.data)) {
        classesData = response.data.data;
      }

      console.log('Raw classes data:', classesData);

      // Always filter by school ID to ensure only current school's classes are shown
      if (currentSchoolId && classesData.length > 0) {
        const schoolFiltered = classesData.filter(cls => {
          const classSchoolId = cls.school?.id || cls.school_id || cls.schoolId;
          return classSchoolId == currentSchoolId; // Use == for loose comparison
        });
        classesData = schoolFiltered;
        console.log('Filtered classes for school', currentSchoolId, ':', classesData);
      }

      const formattedClasses = classesData.map(cls => ({
        id: cls.id || cls._id,
        name: cls.name || cls.class_name || `Class ${cls.id || ''}`,
        school_id: cls.school?.id || cls.school_id || cls.schoolId,
        ...cls
      }));

      console.log('Formatted classes:', formattedClasses);

      if (formattedClasses.length === 0) {
        setSnackbar({
          open: true,
          message: 'কোন শ্রেণি পাওয়া যায়নি। দয়া করে প্রথমে শ্রেণি তৈরি করুন।',
          severity: 'warning'
        });
      }

      setClasses(formattedClasses);
      return formattedClasses;

    } catch (error) {
      console.error('Error fetching classes:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });

      let errorMessage = 'Failed to load classes. Please try again.';

      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Authentication failed. Please login again.';
        } else if (error.response.status === 404) {
          errorMessage = 'Classes endpoint not found. Please contact administrator.';
        } else if (error.response.data?.detail) {
          errorMessage = error.response.data.detail;
        }
      } else if (error.message.includes('No authentication token')) {
        errorMessage = 'Please login to continue.';
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
        autoHideDuration: 8000
      });
      return [];
    } finally {
      setIsLoadingClasses(false);
    }
  };

  // Ensure the 12 months + 3 exam (all class fee structures) are assigned to the selected student
  const ensureStudentAssignments = async (studentId, classIdOverride) => {
    try {
      if (!studentId || !(classIdOverride || selectedClass)) return;
      // Extra safety: verify the student's classroom matches currently selected class
      try {
        const sResp = await api.get(`/api/academics/students/${studentId}/`);
        const sCls = sResp?.data?.classroom?.id ?? sResp?.data?.classroom ?? sResp?.data?.class?.id;
        const targetCls = String(classIdOverride || selectedClass);
        if (sCls == null || String(sCls) !== targetCls) {
          return;
        }
      } catch (_) { return; }
      // Make sure fee structures are loaded
      let structures = feeStructures;
      if (!structures || structures.length === 0) {
        structures = await fetchFeeStructures(classIdOverride || selectedClass);
      } else {
        try { structures = await fetchFeeStructures(classIdOverride || selectedClass); } catch (_) {}
      }
      // Filter structures for this class (backend may not provide type/month fields)
      const classIdStr = String(classIdOverride || selectedClass);
      const classStructuresAll = (structures || []).filter(s => {
        const clsId = s.class_id ?? s.classId ?? s.class?.id ?? s.classroom_id ?? s.classroomId ?? s.classroom?.id ?? s.classroom ?? s.class;
        return clsId && String(clsId) === classIdStr;
      });
      const classStructures = classStructuresAll.filter(s => {
        const freq = String(s.frequency || '').toLowerCase();
        if (freq === 'monthly') return true;
        if (freq === 'one_time') return true;
        return false;
      });

      if (classStructures.length === 0) return;

      // Fetch student's existing assignments (support student_id and student)
      let assignments = [];
      try {
        const aResp = await api.get(`/api/fees/assignments/?student_id=${studentId}`);
        if (Array.isArray(aResp.data)) assignments = aResp.data;
        else if (aResp.data?.results) assignments = aResp.data.results;
        else if (aResp.data?.data) assignments = aResp.data.data;
      } catch (_) { /* ignore, try fallback */ }
      if (!assignments || assignments.length === 0) {
        try {
          const aResp2 = await api.get(`/api/fees/assignments/?student=${studentId}`);
          if (Array.isArray(aResp2.data)) assignments = aResp2.data;
          else if (aResp2.data?.results) assignments = aResp2.data.results;
          else if (aResp2.data?.data) assignments = aResp2.data.data;
        } catch (_) { /* ignore */ }
      }
      const allowedStructIds = new Set(classStructures.map(s => String(s.id)));
      // 1) Delete assignments not in current class structures
      const toDelete = (assignments || []).filter(a => !allowedStructIds.has(String(a.fee_structure_id || a.fee_structure?.id || a.fee_structure)));
      for (const a of toDelete) {
        const id = a.id || a._id;
        if (!id) continue;
        try { await api.delete(`/api/fees/assignments/${id}/`); } catch (_) {}
      }
      // 2) Remove duplicates per structure (keep latest by id)
      const group = new Map();
      for (const a of assignments) {
        const sid = String(a.fee_structure_id || a.fee_structure?.id || a.fee_structure || '');
        if (!allowedStructIds.has(sid)) continue;
        if (!group.has(sid)) group.set(sid, []);
        group.get(sid).push(a);
      }
      for (const [sid, arr] of group.entries()) {
        if (arr.length <= 1) continue;
        const sorted = arr.slice().sort((x, y) => (Number(y.id || 0) - Number(x.id || 0)));
        const keep = sorted[0];
        const extras = sorted.slice(1);
        for (const ex of extras) {
          const id = ex.id || ex._id;
          if (!id) continue;
          try { await api.delete(`/api/fees/assignments/${id}/`); } catch (_) {}
        }
      }
      // Refresh assignments after deletions
      try {
        const aResp3 = await api.get(`/api/fees/assignments/?student_id=${studentId}&school=${schoolId}`);
        if (Array.isArray(aResp3.data)) assignments = aResp3.data;
        else if (aResp3.data?.results) assignments = aResp3.data.results;
        else if (aResp3.data?.data) assignments = aResp3.data.data;
      } catch (_) {}
      const assignedIds = new Set((assignments || []).map(a => String(a.fee_structure_id || a.fee_structure?.id || a.fee_structure)));
      // 3) Create missing assignments for remaining structures
      const missing = classStructures.filter(s => !assignedIds.has(String(s.id)));
      if (missing.length > 0) {
        const now = new Date();
        const year = now.getFullYear();
        const today = now.toISOString().split('T')[0];
        for (const s of missing) {
          const freq = String(s.frequency || '').toLowerCase();
          const sName = String(s.name || '').toLowerCase();
          let dueDate = today;
          if (freq === 'one_time') {
            if (/(অর্ধ|half|mid)/.test(sName)) {
              dueDate = `${year}-04-01`;
            } else if (/(বার্ষিক|annual|final|year)/.test(sName)) {
              dueDate = `${year}-11-01`;
            }
          }
          const base = {
            student_id: studentId,
            student: studentId,
            fee_structure_id: s.id,
            amount: Number(s.amount ?? s.default_amount ?? 0),
            due_date: dueDate,
            status: 'unpaid',
            school: schoolId,
          };
          try { await api.post('/api/fees/assignments/', base); } catch (e) {
            console.warn('Failed to create assignment for structure', s.id, e.response?.data || e.message);
          }
        }
      }
      // 4) Align existing assignments' amounts with latest structure (remove custom_amount overrides)
      try {
        const structMap2 = new Map(classStructures.map(s => [String(s.id), s]));
        const toAlign = (assignments || []).filter(a => {
          const sid = String(a.fee_structure_id || a.fee_structure?.id || a.fee_structure || '');
          return structMap2.has(sid);
        });
        for (const a of toAlign) {
          const sid = String(a.fee_structure_id || a.fee_structure?.id || a.fee_structure || '');
          const s = structMap2.get(sid);
          const desired = Number(s?.amount ?? s?.default_amount ?? 0) || 0;
          const current = Number(a.custom_amount ?? a.amount ?? 0) || 0;
          const needPatch = (a.custom_amount != null) || (Math.abs(current - desired) > 0.0001);
          if (needPatch && (a.id || a._id)) {
            const id = a.id || a._id;
            try { await api.patch(`/api/fees/assignments/${id}/`, { amount: desired, custom_amount: null }); } catch (_) {}
          }
        }
      } catch (_) {}
      
      try {
        const now = new Date();
        const year = now.getFullYear();
        const structMap2 = new Map(classStructures.map(s => [String(s.id), s]));
        for (const a of assignments || []) {
          const sid = String(a.fee_structure_id || a.fee_structure?.id || a.fee_structure || '');
          const s = structMap2.get(sid);
          if (!s) continue;
          const freq = String(s.frequency || '').toLowerCase();
          if (freq !== 'one_time') continue;
          const sName = String(s.name || '').toLowerCase();
          let targetDue = null;
          if (/(অর্ধ|half|mid)/.test(sName)) {
            targetDue = `${year}-04-01`;
          } else if (/(বার্ষিক|annual|final|year)/.test(sName)) {
            targetDue = `${year}-11-01`;
          }
          if (!targetDue) continue;
          const currentDue = a.due_date || '';
          if (String(currentDue) !== String(targetDue) && (a.id || a._id)) {
            const id = a.id || a._id;
            try { await api.patch(`/api/fees/assignments/${id}/`, { due_date: targetDue }); } catch (_) {}
          }
        }
      } catch (_) {}
      
    } catch (e) {
      console.warn('ensureStudentAssignments failed:', e.response?.data || e.message);
    }
  };

  // Ledger handlers
  const handleLedgerClassChange = async (event) => {
    const classId = event.target.value;
    setSelectedClass(String(classId));
    setSelectedLedgerStudentId('');
    setStudents([]);
    if (classId) {
      await fetchStudents(String(classId));
      // Refresh fee structures for this class so UI shows scoped items only
      try { await fetchFeeStructures(String(classId)); } catch (_) {}
    }
    await fetchStudentLedger('');
  };

  // Initialize PM inputs when selecting a student and no history exists
  useEffect(() => {
    if (!selectedLedgerStudentId) { setPmInputs([]); return; }
    if (paymentHistory.length === 0 && pmInputs.length === 0) {
      setPmInputs([{ id: `new-${Date.now()}`, assignmentId: '', date: new Date(), amount: '', method: 'cash', docText: '', docFile: null }]);
    }
  }, [selectedLedgerStudentId, paymentHistory]);

  const handleLedgerStudentChange = async (event) => {
    const sid = event.target.value;
    setSelectedLedgerStudentId(String(sid));
    await ensureStudentAssignments(String(sid));
    await fetchStudentLedger(String(sid));
    await fetchPaymentHistory(String(sid));
  };

  // Fetch Student Ledger (assignments + collections) and compute breakdown
  const fetchStudentLedger = async (studentId) => {
    console.log(`fetchStudentLedger called with studentId: ${studentId}`);
    if (!studentId) {
      setLedger({ assignments: [], payments: [], rows: [], totals: { amount: 0, paid: 0, due: 0 } });
      return;
    }
    try {
      setIsLoadingLedger(true);
      // Fetch assignments for student (try student_id then fallback student)
      let assignments = [];
      try {
        const aResp = await api.get(`/api/fees/assignments/?student_id=${studentId}&school=${schoolId}`);
        if (Array.isArray(aResp.data)) assignments = aResp.data;
        else if (aResp.data?.results) assignments = aResp.data.results;
        else if (aResp.data?.data) assignments = aResp.data.data;
      } catch (_) { /* ignore */ }
      if (!assignments || assignments.length === 0) {
        try {
          const aResp2 = await api.get(`/api/fees/assignments/?student=${studentId}&school=${schoolId}`);
          if (Array.isArray(aResp2.data)) assignments = aResp2.data;
          else if (aResp2.data?.results) assignments = aResp2.data.results;
          else if (aResp2.data?.data) assignments = aResp2.data.data;
        } catch (_) { /* ignore */ }
      }
      // Client-side filter by student just in case backend doesn't support it
      const sidStr = String(studentId);
      assignments = (assignments || []).filter(a => {
        const sid = a.student_id ?? a.studentId ?? a.student?.id ?? a.student;
        return sid ? String(sid) === sidStr : false;
      });
      const schoolIdNum = Number(schoolId);
      const studentObj = students.find(s => String(s.id) === sidStr);

      // Ensure fee structures are available to enrich assignments (when fee_structure is just an ID)
      let structList = feeStructures;
      if (!structList || structList.length === 0) {
        try { structList = await fetchFeeStructures(); } catch (_) { structList = []; }
      }
      const structMap = (structList || []).reduce((m, s) => { m[String(s.id || s._id)] = s; return m; }, {});

      // Fetch payments (not FeeCollection) and index by assignment
      let payments = [];
      const paymentEndpoints = [
        `/api/fees/payments/?student_id=${studentId}`,
        `/api/fees/payments/?student=${studentId}`,
        `/api/payments/?student_id=${studentId}`,
        `/api/payments/?student=${studentId}`,
        `/api/fees/payments/`,
        `/api/payments/`
      ];
      for (const ep of paymentEndpoints) {
        try {
          const p = await api.get(ep);
          if (Array.isArray(p.data)) { payments = p.data; break; }
          if (p.data?.results) { payments = p.data.results; break; }
          if (p.data?.data) { payments = p.data.data; break; }
        } catch (_) { /* try next */ }
      }
      // Fallback to collections endpoint if payments not available
      if (!payments || payments.length === 0) {
        try {
          const c = await api.get(`/api/fees/collections/?student_id=${studentId}`);
          if (Array.isArray(c.data)) payments = c.data;
          else if (c.data?.results) payments = c.data.results;
          else if (c.data?.data) payments = c.data.data;
        } catch (_) { /* ignore */ }
      }

      const sumByAssignment = {};
      for (const pay of payments) {
        const statusRaw = String(pay.payment_status || pay.status || '').toLowerCase();
        const isCompleted = statusRaw === 'completed' || statusRaw === 'success';
        if (!isCompleted) continue;
        const aid = pay.assignment_id || pay.assignment || pay.fee_assignment || pay.student_fee_assignment || pay.fee_assignment_id || pay.assignment?.id;
        if (!aid) continue;
        sumByAssignment[String(aid)] = (sumByAssignment[String(aid)] || 0) + Number(pay.amount || pay.paid_amount || 0);
      }

      const rowsRaw = (assignments || []).map(a => {
        const aid = a.id || a._id;
        const rawStruct = a.fee_structure || a.fee || {};
        const sid = String(a.fee_structure_id || a.fee_id || rawStruct.id || a.fee_structure || a.fee || '');
        const sObj = (typeof rawStruct === 'object' && rawStruct) ? rawStruct : (structMap[sid] || {});
        const monthVal = (() => {
          const mv = a.month ?? a.billing_month ?? sObj.month ?? sObj.billing_month;
          const n = Number(mv);
          return Number.isFinite(n) && n > 0 ? n : null;
        })();
        const baseCandidates = [
          a.custom_amount,
          a.amount, a.total_amount, a.payable_amount, a.payable, a.price, a.base_amount,
          sObj.amount, sObj.default_amount, sObj.fee_amount, sObj.price, sObj.payable_amount
        ];
        let base = baseCandidates.find(x => x !== undefined && x !== null && Number(x) > 0);
        if (base === undefined || base === null) base = baseCandidates.find(x => x !== undefined && x !== null) ?? 0;
        const discountAmt = Number(a.discount_amount || 0);
        const discountPct = Number(a.discount_percentage ?? a.discount_percent ?? a.discount ?? 0);
        const amount = Math.max(0, Number(base) - discountAmt - (Number(base) * discountPct / 100));
        const name = (() => {
          const feeStruct = a.fee_structure || sObj;
          return getFeeCategoryName(feeStruct, sid) || a.fee_structure?.name || a.fee?.name || sObj.name || getStructureLabel(sObj, sid) || a.fee_type || a.type || a.name || (sid ? `ফি #${sid}` : 'ফি');
        })();
        const paid = Number(sumByAssignment[String(aid)] || 0);
        const due = Math.max(0, amount - paid);
        const freq = String((sObj && sObj.frequency) || a.frequency || '').toLowerCase();
        const rtype = freq === 'monthly' ? 'tuition' : (freq === 'one_time' ? 'exam' : 'other');
        let rowAmount = amount;
        let rowDue = due;
        if (schoolIdNum === 19 && rtype === 'tuition') {
          try {
            const clsRaw = studentObj?.classroom?.id ?? studentObj?.classroom ?? studentObj?.class?.id ?? selectedClass;
            const clsIdStr = clsRaw ? String(clsRaw) : '';
            if (clsIdStr) {
              const plan = deriveClassPlan(clsIdStr) || {};
              const mAmt = Number(plan.monthlyAmount || 0);
              if (mAmt > 0) {
                rowAmount = mAmt;
                rowDue = Math.max(0, rowAmount - paid);
              }
            }
          } catch (_) {}
        }
        return { id: aid, name, amount: rowAmount, paid, due: rowDue, due_date: a.due_date || null, type: rtype, month: monthVal };
      });

      const rows = rowsRaw.filter(r => !(r.amount === 0 && r.paid === 0 && (/^(Structure|ফি\s?#?)/i).test(r.name)));
      // Hide exam fees until their due date arrives
      try {
        const today = new Date();
        const toDate = (d) => {
          try { return d ? new Date(d) : null; } catch (_) { return null; }
        };
        const isExamRow = (r) => {
          const nm = String(r.name || '').toLowerCase();
          return (r.type === 'exam') || /(পরীক্ষা|exam)/.test(nm);
        };
        const filtered = rows.filter(r => {
          if (isExamRow(r)) {
            const dd = toDate(r.due_date);
            return !!dd && dd <= today;
          }
          return true;
        });
        rows = filtered;
      } catch (_) {}
      const totals = rows.reduce((acc, r) => ({ amount: acc.amount + r.amount, paid: acc.paid + r.paid, due: acc.due + r.due }), { amount: 0, paid: 0, due: 0 });

      // If everything is zero but we have structures, build a preview from structures so UI isn't empty
      if ((rows.length === 0 || (totals.amount === 0 && totals.paid === 0 && totals.due === 0)) && structList && structList.length > 0) {
        // Find the student object to get classroom info
        const student = students.find(s => String(s.id) === String(studentId));
        const preview = (() => {
          const monthsBn = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
          const currentMonth = new Date().getMonth() + 1;
          const list = structList
          .filter(s => {
            const sid = s.class_id ?? s.classId ?? s.classroom_id ?? s.classroomId ?? s.classroom?.id;
            return sid && String(sid) === String(student?.classroom?.id);
          })
          const rows = [];
          for (const s of list) {
            const amt = Number(s.amount ?? s.default_amount ?? s.fee_amount ?? s.price ?? 0);
            const freq = String(s.frequency || '').toLowerCase();
            const rtype = freq === 'monthly' ? 'tuition' : (freq === 'one_time' ? 'exam' : 'other');
            if (rtype === 'tuition') {
              for (let m = 1; m <= currentMonth; m++) {
                rows.push({ id: `struct-${s.id}-m${m}`, name: `মাসিক বেতন(${monthsBn[m-1]})`, amount: amt, paid: 0, due: amt, due_date: null, type: rtype, month: m });
              }
            } else {
              rows.push({ id: `struct-${s.id}`, name: s.name || getStructureLabel(s, s.id), amount: amt, paid: 0, due: amt, due_date: null, type: rtype, month: null });
            }
          }
          return rows;
        })();
        const previewTotals = preview.reduce((acc, r) => ({ amount: acc.amount + r.amount, paid: 0, due: acc.due + r.due }), { amount: 0, paid: 0, due: 0 });
        setLedger({ assignments, payments, rows: preview, totals: previewTotals });
        return;
      }

      setLedger({ assignments, payments, rows, totals });
    } catch (e) {
      console.error('Error fetching student ledger:', e.response?.data || e.message);
      setSnackbar({ open: true, message: 'শিক্ষার্থীর ফি বিস্তারিত লোড করতে সমস্যা হয়েছে', severity: 'error' });
      setLedger({ assignments: [], payments: [], rows: [], totals: { amount: 0, paid: 0, due: 0 } });
    } finally {
      setIsLoadingLedger(false);
    }
  };

  // Fetch payment history for selected student
  const fetchPaymentHistory = async (studentId) => {
    if (!studentId) {
      setPaymentHistory([]);
      return;
    }
    try {
      setIsLoadingPayments(true);
      let payments = [];
      // Try multiple payment endpoints
      const endpoints = [
        `/api/fees/payments/?student_id=${studentId}`,
        `/api/fees/payments/?student=${studentId}`,
        `/api/payments/?student_id=${studentId}`,
        `/api/payments/?student=${studentId}`,
        `/api/fees/collections/?student_id=${studentId}`,
        `/api/fees/collections/?student=${studentId}`
      ];
      for (const ep of endpoints) {
        try {
          const resp = await api.get(ep);
          if (Array.isArray(resp.data)) { payments = resp.data; break; }
          if (resp.data?.results) { payments = resp.data.results; break; }
          if (resp.data?.data) { payments = resp.data.data; break; }
        } catch (_) { /* try next */ }
      }
      // Filter by student if endpoint doesn't filter properly
      const sidStr = String(studentId);
      const filtered = payments.filter(p => {
        const sid = p.student_id ?? p.studentId ?? p.student?.id ?? p.student;
        return sid ? String(sid) === sidStr : false;
      });
      // Format payment history rows (preserve assignment id if present)
      const formatted = filtered.map(p => ({
        id: p.id || p._id,
        date: p.payment_date || p.date || p.created_at,
        amount: Number(p.amount || p.paid_amount || 0),
        method: p.payment_method || p.method || 'N/A',
        reference: p.reference || p.transaction_id || p.receipt_number || '',
        assignmentId: String(p.assignment_id || p.assignment || p.fee_assignment || p.student_fee_assignment || p.assignment?.id || ''),
        assignment_name: p.assignment?.fee_structure?.name || p.fee_type || p.type || 'Payment'
      }));
      setPaymentHistory(formatted.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    } catch (e) {
      console.error('Error fetching payment history:', e.response?.data || e.message);
      setPaymentHistory([]);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  // Payment dialog handlers
  const handleOpenPaymentDialog = (assignment) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setSelectedAssignment(assignment);
    setPaymentForm({ amount: '', paymentDate: new Date(), method: '', reference: '', note: '', bkash_to: '', bkash_from: '' });
    setIsPaymentDialogOpen(true);
  };

  const handleClosePaymentDialog = () => {
    setIsPaymentDialogOpen(false);
    try { requestAnimationFrame(() => { const el = document.activeElement; if (el && typeof el.blur === 'function') el.blur(); }); } catch (_) {}
  };

  const handlePaymentInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePaymentDateChange = (date) => {
    setPaymentForm(prev => ({ ...prev, paymentDate: date }));
  };

  // Inline payment handlers
  const handleInlinePaymentChange = (e) => {
    const { name, value } = e.target;
    setInlinePayment(prev => ({ ...prev, [name]: value }));
  };
  const handleInlinePaymentDateChange = (date) => {
    setInlinePayment(prev => ({ ...prev, paymentDate: date }));
  };

  const submitInlinePayment = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!selectedLedgerStudentId) { setSnackbar({ open: true, message: 'শিক্ষার্থী নির্বাচন করুন', severity: 'warning' }); return; }
    if (!inlinePayment.amount || Number(inlinePayment.amount) <= 0) { setSnackbar({ open: true, message: 'বৈধ পরিমাণ লিখুন', severity: 'error' }); return; }
    try {
      setIsSubmittingPayment(true);
      const methodLower = String(inlinePayment.method || '').toLowerCase();
      const base = {
        student_id: selectedLedgerStudentId,
        amount: parseFloat(inlinePayment.amount),
        payment_date: inlinePayment.paymentDate ? new Date(inlinePayment.paymentDate).toISOString().split('T')[0] : undefined,
        method: inlinePayment.method || undefined,
        payment_method: inlinePayment.method || undefined,
        reference: inlinePayment.reference || undefined,
        note: inlinePayment.note || undefined,
        school: schoolId || undefined,
        school_id: schoolId || undefined,
      };
      const extras = methodLower === 'bkash' ? { bkash_to: inlinePayment.bkash_to || undefined, bkash_from: inlinePayment.bkash_from || undefined } : {};
      const payloads = [
        { url: '/api/fees/payments/', data: { ...base, ...extras } },
        { url: '/api/fees/collections/', data: { ...base, ...extras } },
      ];
      let ok = false; let lastErr = null;
      for (const p of payloads) {
        try { await api.post(p.url, p.data); ok = true; break; } catch (e) { lastErr = e; continue; }
      }
      if (!ok) throw lastErr || new Error('Failed');
      setSnackbar({ open: true, message: 'পেমেন্ট সংরক্ষিত হয়েছে', severity: 'success' });
      setInlinePayment({ amount: '', paymentDate: new Date(), method: '', reference: '', note: '', bkash_to: '', bkash_from: '' });
      await fetchStudentLedger(String(selectedLedgerStudentId));
      await fetchPaymentHistory(String(selectedLedgerStudentId));
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'পেমেন্ট সংরক্ষণে সমস্যা হয়েছে';
      setSnackbar({ open: true, message: typeof msg === 'string' ? msg : 'পেমেন্ট সংরক্ষণে সমস্যা হয়েছে', severity: 'error' });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const submitPayment = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!selectedAssignment) return;
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      setSnackbar({ open: true, message: 'বৈধ পরিমাণ লিখুন', severity: 'error' });
      return;
    }
    try {
      setIsSubmittingPayment(true);
      // Flexible payload to accommodate backend naming
      const common = {
        amount: parseFloat(paymentForm.amount),
        payment_date: paymentForm.paymentDate ? new Date(paymentForm.paymentDate).toISOString().split('T')[0] : undefined,
        method: paymentForm.method || undefined,
        payment_method: paymentForm.method || undefined,
        reference: paymentForm.reference || undefined,
        note: paymentForm.note || undefined,
      };
      // Include bKash meta when applicable
      const methodLower = String(paymentForm.method || '').toLowerCase();
      const methodExtras = methodLower === 'bkash' ? {
        bkash_to: paymentForm.bkash_to || undefined,
        bkash_from: paymentForm.bkash_from || undefined,
      } : {};
      const assignmentId = selectedAssignment.id || selectedAssignment._id || selectedAssignment.assignment || selectedAssignment.assignment_id;
      const payloadCandidates = [
        { assignment: assignmentId, ...common, ...methodExtras },
        { assignment_id: assignmentId, ...common, ...methodExtras },
        { fee_assignment: assignmentId, ...common, ...methodExtras },
        { student_fee_assignment: assignmentId, ...common, ...methodExtras }
      ];
      let resp;
      let lastErr;
      for (const payload of payloadCandidates) {
        try {
          resp = await api.post('/api/fees/payments/', payload);
          if (resp?.data) break;
        } catch (e) {
          lastErr = e;
          continue;
        }
      }
      if (!resp) throw lastErr || new Error('Payment create failed');
      setSnackbar({ open: true, message: 'পেমেন্ট সংরক্ষণ করা হয়েছে', severity: 'success' });
      handleClosePaymentDialog();
      await fetchFees();
    } catch (e) {
      console.error('Payment create error:', e.response?.data || e.message);
      const msg = e.response?.data?.detail || e.response?.data || 'পেমেন্ট সংরক্ষণ করতে সমস্যা হয়েছে';
      setSnackbar({ open: true, message: typeof msg === 'string' ? msg : 'পেমেন্ট সংরক্ষণ করতে সমস্যা হয়েছে', severity: 'error' });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Fetch classes when component mounts
  useEffect(() => {
    const initialize = async () => {
      try {
        await fetchClasses();
        await fetchFees();
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    initialize();
  }, []);

  // Fetch fee structures (fee_structure) list, optionally scoped to a class
  const fetchFeeStructures = async (classIdParam) => {
    try {
      setIsLoadingFeeStructures(true);
      const cls = classIdParam != null && String(classIdParam) !== ''
        ? String(classIdParam)
        : (selectedClass ? String(selectedClass) : '');
      const endpoints = cls
        ? [
            `/api/fees/fees/?school=${schoolId}&classroom=${encodeURIComponent(cls)}`,
            `/api/fees/fees/?school=${schoolId}&classroom_id=${encodeURIComponent(cls)}`,
            `/api/fees/fees/?school=${schoolId}&class_id=${encodeURIComponent(cls)}`,
            `/api/fees/fees/?school=${schoolId}`,
            '/api/fees/fees/'
          ]
        : [
            `/api/fees/fees/?school=${schoolId}`,
            '/api/fees/fees/'
          ];
      let response;
      let lastError;
      for (const ep of endpoints) {
        try {
          response = await api.get(ep);
          if (response?.data) break;
        } catch (err) {
          lastError = err;
          continue;
        }
      }
      if (!response) throw lastError || new Error('Failed to load fee structures');

      let list = [];
      if (Array.isArray(response.data)) list = response.data;
      else if (response.data?.results) list = response.data.results;
      else if (response.data?.data) list = response.data.data;

      const formatted = list.map(item => ({
        id: String(item.id || item._id),
        name: item.name || item.title || item.label || `Structure ${item.id || ''}`,
        amount: item.amount || item.default_amount || null,
        ...item
      }));
      setFeeStructures(formatted);
      return formatted;
    } catch (e) {
      console.error('Error fetching fee structures', e);
      setSnackbar({ open: true, message: 'ফি স্ট্রাকচার লোড করতে সমস্যা হয়েছে', severity: 'error' });
      setFeeStructures([]);
      return [];
    } finally {
      setIsLoadingFeeStructures(false);
    }
  };

  const fetchFees = async () => {
    try {
      setLoading(true);
      let response = await api.get(`/api/fees/assignments/`);
      let data = [];
      if (Array.isArray(response.data)) {
        data = response.data;
      } else if (response.data && Array.isArray(response.data.results)) {
        data = response.data.results;
      } else if (response.data && Array.isArray(response.data.data)) {
        data = response.data.data;
      }
      setFees(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load fees');
      setFees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar(prev => ({
      ...prev,
      open: false
    }));
  };

  const handleClassChange = async (event) => {
    const classId = event.target.value;
    setSelectedClass(String(classId));
    // Reset dependent selections; debounced effect will load students
    setFeeForm(prev => ({ ...prev, studentId: '' }));
    setSelectedLedgerStudentId('');
    if (!classId) setStudents([]);
  };

  const handleOpenDialog = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setIsDialogOpen(true);

    try {
      // Reset form and states
      setFeeForm({
        studentId: '',
        feeStructureId: '',
        amount: '',
        dueDate: null,
        description: ''
      });
      setFormErrors({});
      // Keep selected class and loaded students intact so state doesn't reset

      // Fetch classes and fee structures when dialog opens
      const [fetchedClasses, fetchedStructures] = await Promise.all([
        fetchClasses(),
        fetchFeeStructures(selectedClass)
      ]);

      // If there's only one class, select it by default
      if (fetchedClasses.length === 1) {
        setSelectedClass(String(fetchedClasses[0].id));
        // Fetch students for the first class
        const students = await fetchStudents(String(fetchedClasses[0].id));
        if (students && students.length > 0) {
          setStudents(students);
        }
      }

      // If only one fee structure, preselect
      if (fetchedStructures.length === 1) {
        setFeeForm(prev => ({ ...prev, feeStructureId: fetchedStructures[0].id }));
      }
    } catch (error) {
      console.error('Error preparing fee form:', error);
      setSnackbar({
        open: true,
        message: 'ফর্ম প্রস্তুত করতে সমস্যা হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।',
        severity: 'error',
        autoHideDuration: 5000
      });
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    // Reset form fields only; keep class/student selection intact
    setFeeForm({
      studentId: '',
      feeStructureId: '',
      amount: '',
      dueDate: null,
      description: ''
    });
    setFormErrors({});
  };

  // Fetch students for a specific class
  const fetchStudents = async (classId) => {
    if (!classId) {
      setStudents([]);
      return [];
    }

    try {
      setIsLoadingStudents(true);
      setFormErrors(prev => ({ ...prev, studentId: '' }));

      // Use the modern endpoint with school + classroom filters
      const url = `/api/academics/students/?school=${schoolId}&classroom=${classId}`;
      const response = await api.get(url);
      console.log('Student response:', response.data);

      // Handle different response formats
      let studentsData = [];
      if (Array.isArray(response.data)) {
        studentsData = response.data;
      } else if (response.data && Array.isArray(response.data.results)) {
        studentsData = response.data.results;
      } else if (response.data && Array.isArray(response.data.data)) {
        studentsData = response.data.data;
      }

      console.log('Raw students data:', studentsData);

      // Strictly filter students by the selected class to avoid cross-class leakage
      if (studentsData.length > 0) {
        studentsData = studentsData.filter(student => {
          const sid = String(classId);
          const sClassId = student.class_id ?? student.classId ?? student.classroom?.id ?? student.class?.id ?? student.classroom;
          return sClassId != null && String(sClassId) === sid;
        });
      }

      const formattedStudents = studentsData.map(student => {
        const first = student.first_name ?? student.firstName ?? student.user?.first_name ?? student.user?.firstName ?? student.profile?.first_name ?? '';
        const last = student.last_name ?? student.lastName ?? student.user?.last_name ?? student.user?.lastName ?? student.profile?.last_name ?? '';
        const combined = `${(first || '').toString().trim()} ${(last || '').toString().trim()}`.trim();
        const dn = (
          student.display_name ||
          student.displayName ||
          student.full_name ||
          student.fullName ||
          student.name ||
          student.student_name ||
          student.profile?.full_name ||
          student.user?.full_name ||
          combined
        ) || 'নামহীন শিক্ষার্থী';

        return {
          id: String(student.id || student._id),
          display_name: dn,
          full_name: dn,
          name: dn,
          profile_picture: student.profile_picture || student.photo || student.avatar || null,
          roll_number: student.roll_number || student.rollNo || student.roll_no || '',
          ...student
        };
      });

      console.log('Formatted students:', formattedStudents);
      const sorted = [...formattedStudents].sort((a, b) => {
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
      
      if (formattedStudents.length === 0) {
        setSnackbar({
          open: true,
          message: 'এই শ্রেণিতে কোন শিক্ষার্থী পাওয়া যায়নি',
          severity: 'info',
          autoHideDuration: 5000
        });
      }
      
      return sorted;

    } catch (error) {
      console.error('Error fetching students:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      setSnackbar({
        open: true,
        message: 'শিক্ষার্থীদের লোড করতে সমস্যা হয়েছে',
        severity: 'error',
        autoHideDuration: 5000
      });
      
      setStudents([]);
      return [];
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFeeForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // When student changes, fetch assigned structures to filter options
    if (name === 'studentId' && value) {
      (async () => {
        try {
          const res = await api.get(`/api/fees/assignments/?student_id=${value}&school=${schoolId}`);
          let list = [];
          if (Array.isArray(res.data)) list = res.data;
          else if (res.data?.results) list = res.data.results;
          else if (res.data?.data) list = res.data.data;
          const ids = list
            .map(it => it.fee_structure_id || it.fee_structure?.id || it.fee_structure)
            .filter(Boolean)
            .map(id => String(id));
          setAssignedStructureIds(ids);

          // If the currently selected fee structure is already assigned, clear it
          setFeeForm(prev => ({
            ...prev,
            feeStructureId: ids.includes(String(prev.feeStructureId)) ? '' : prev.feeStructureId
          }));
        } catch (err) {
          console.warn('Failed to load assigned structures for student', err?.message);
          setAssignedStructureIds([]);
        }
      })();
    }

    // When fee structure changes, auto-fill amount if available
    if (name === 'feeStructureId' && value) {
      const fs = feeStructures.find(f => String(f.id) === String(value));
      if (fs) {
        const defaultAmt = fs.amount ?? fs.default_amount ?? null;
        if (defaultAmt && (!feeForm.amount || Number(feeForm.amount) <= 0)) {
          setFeeForm(prev => ({ ...prev, amount: String(defaultAmt) }));
        }
      }
    }
  };

  // Handle date change for date picker
  const handleDateChange = (date) => {
    setFeeForm(prev => ({
      ...prev,
      dueDate: date
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    const errors = {};
    if (!feeForm.studentId) errors.studentId = 'শিক্ষার্থী নির্বাচন করুন';
    if (!feeForm.feeStructureId) errors.feeStructureId = 'ফি স্ট্রাকচার নির্বাচন করুন';
    if (!feeForm.amount || isNaN(feeForm.amount) || parseFloat(feeForm.amount) <= 0) {
      errors.amount = 'বৈধ পরিমাণ লিখুন';
    }
    if (!feeForm.dueDate) errors.dueDate = 'শেষ তারিখ নির্বাচন করুন';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Prepare fee data
      const feeData = {
        student_id: feeForm.studentId,
        fee_structure_id: feeForm.feeStructureId,
        amount: parseFloat(feeForm.amount),
        due_date: feeForm.dueDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        description: feeForm.description || '',
        status: 'unpaid',
        school: schoolId,
        academic_year: new Date().getFullYear().toString()
      };

      console.log('Submitting fee data:', feeData);

      // Prevent duplicates: check if this student already has this fee structure assigned
      try {
        const existsResp = await api.get(
          `/api/fees/assignments/?student_id=${feeForm.studentId}&fee_structure_id=${feeForm.feeStructureId}&school=${schoolId}`
        );
        let existing = [];
        if (Array.isArray(existsResp.data)) existing = existsResp.data;
        else if (existsResp.data?.results) existing = existsResp.data.results;
        else if (existsResp.data?.data) existing = existsResp.data.data;
        if (existing.length > 0) {
          const msg = 'এই শিক্ষার্থীর জন্য এই ফি স্ট্রাকচারটি আগে থেকেই যোগ করা হয়েছে';
          setFormErrors(prev => ({ ...prev, feeStructureId: msg }));
          setSnackbar({ open: true, message: msg, severity: 'warning', autoHideDuration: 6000 });
          // Open Record Payment dialog on the first matched assignment
          handleOpenPaymentDialog(existing[0]);
          return;
        }
      } catch (checkErr) {
        console.warn('Duplicate check failed, continuing to submit:', checkErr?.message);
      }

      // Submit fee data to API using assignments endpoint per URLConf
      const response = await api.post('/api/fees/assignments/', feeData);

      console.log('Fee created successfully:', response.data);
      
      // Show success message
      setSnackbar({
        open: true,
        message: 'ফি সফলভাবে সংরক্ষণ করা হয়েছে',
        severity: 'success',
        autoHideDuration: 5000
      });
      
      // Close dialog and refresh fees list
      handleCloseDialog();
      await fetchFees();
      
    } catch (error) {
      console.error('Error creating fee:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'ফি সংরক্ষণ করতে সমস্যা হয়েছে';

      const data = error.response?.data;
      if (data) {
        // Map typical DRF field errors to form fields
        const newFormErrors = { ...formErrors };
        const mapField = (keys, targetKey) => {
          for (const k of keys) {
            if (data[k]) {
              const val = Array.isArray(data[k]) ? data[k].join(' ') : String(data[k]);
              newFormErrors[targetKey] = val;
              return true;
            }
          }
          return false;
        };

        mapField(['student', 'student_id', 'studentId'], 'studentId');
        mapField(['fee_structure_id', 'fee_structure', 'structure', 'category', 'fee'], 'feeStructureId');
        mapField(['amount', 'total_amount'], 'amount');
        mapField(['due_date', 'dueDate'], 'dueDate');
        mapField(['description'], 'description');

        // If we populated any field errors, set them
        if (Object.keys(newFormErrors).length > 0) {
          setFormErrors(newFormErrors);
        }

        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.non_field_errors) {
          errorMessage = Array.isArray(data.non_field_errors)
            ? data.non_field_errors.join(' ')
            : String(data.non_field_errors);
        } else {
          try {
            // Build a compact message from first errors
            const parts = [];
            for (const [k, v] of Object.entries(data)) {
              const msg = Array.isArray(v) ? v.join(' ') : String(v);
              parts.push(`${k}: ${msg}`);
            }
            if (parts.length) errorMessage = parts.slice(0, 3).join(' | ');
          } catch {}
        }
      }

      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
        autoHideDuration: 8000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStudentDropdown = () => {
  // If no class is selected, show disabled dropdown
  if (!selectedClass) {
    return (
      <FormControl fullWidth disabled>
        <InputLabel>প্রথমে একটি শ্রেণি নির্বাচন করুন</InputLabel>
        <Select value="" label="প্রথমে একটি শ্রেণি নির্বাচন করুন" />
      </FormControl>
    );
  }

  // If loading, show loading state
  if (isLoadingStudents) {
    return (
      <FormControl fullWidth>
        <InputLabel>শিক্ষার্থী লোড হচ্ছে...</InputLabel>
        <Select
          value=""
          label="শিক্ষার্থী লোড হচ্ছে..."
          startAdornment={
            <CircularProgress size={20} sx={{ mr: 1 }} />
          }
          disabled
        />
      </FormControl>
    );
  }

  // If no students found
  if (students.length === 0) {
    return (
      <FormControl fullWidth error={!!formErrors.studentId}>
        <InputLabel>কোন শিক্ষার্থী পাওয়া যায়নি</InputLabel>
        <Select
          value=""
          label="কোন শিক্ষার্থী পাওয়া যায়নি"
          disabled
        />
        <Typography variant="caption" color="error">
          {formErrors.studentId || 'এই শ্রেণিতে কোন নিবন্ধিত শিক্ষার্থী নেই'}
        </Typography>
      </FormControl>
    );
  }

  // Show the student dropdown with options
  return (
    <FormControl fullWidth error={!!formErrors.studentId}>
      <InputLabel id="student-select-label">শিক্ষার্থী নির্বাচন করুন *</InputLabel>
      <Select
        labelId="student-select-label"
        id="student-select"
        name="studentId"
        value={students.some((s) => String(s.id) === String(feeForm.studentId)) ? String(feeForm.studentId) : ''}
        onChange={handleInputChange}
        label="শিক্ষার্থী নির্বাচন করুন *"
        required
        renderValue={(selected) => {
          if (!selected) {
            return <em>শিক্ষার্থী নির্বাচন করুন</em>;
          }
          const selectedStudent = students.find(s => s.id === selected);
          return selectedStudent ? (
            <Box display="flex" alignItems="center" gap={1}>
              <StudentAvatar
                photo={selectedStudent.profile_picture}
                name={selectedStudent.display_name}
                size={24}
              />
              {selectedStudent.display_name || selectedStudent.full_name}
            </Box>
          ) : (
            <em>শিক্ষার্থী নির্বাচন করুন</em>
          );
        }}
      >
        <MenuItem value="">
          <em>শিক্ষার্থী নির্বাচন করুন</em>
        </MenuItem>
        {students.map((student) => (
          <MenuItem key={student.id} value={student.id}>
            <Box display="flex" alignItems="center" gap={1}>
              <StudentAvatar
                photo={student.profile_picture}
                name={student.display_name}
                size={24}
              />
              {student.display_name || student.full_name}
            </Box>
          </MenuItem>
        ))}
      </Select>
      {formErrors.studentId && (
        <Typography variant="caption" color="error">
          {formErrors.studentId}
        </Typography>
      )}
    </FormControl>
  );
};

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box p={2}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} sx={{ flexWrap: { xs: 'wrap', sm: 'nowrap' }, rowGap: 1, columnGap: 1 }}>
          <Typography variant="h5">ফি</Typography>
          <Box display="flex" gap={1} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
              ব্যাক
            </Button>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchFees} disabled={loading}>
              রিফ্রেশ
            </Button>
            <Button variant="outlined" onClick={handleOpenPlanDialog} disabled={!selectedClass}>
              মাসিক বেতন, পরীক্ষার ফি
            </Button>
            <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={setupClassWiseFees}>
              ক্লাস ভিত্তিক ফি সেট করুন
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
              ফি যোগ করুন
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>শিক্ষার্থীর লেজার</Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel id="ledger-class-label">শ্রেণি নির্বাচন করুন</InputLabel>
                    <Select
                      labelId="ledger-class-label"
                      value={classes.some((cls) => String(cls.id) === String(selectedClass)) ? String(selectedClass) : ''}
                      label="শ্রেণি নির্বাচন করুন"
                      onChange={handleLedgerClassChange}
                    >
                      <MenuItem value="">
                        <em>শ্রেণি নির্বাচন করুন</em>
                      </MenuItem>
                      {classes.map((cls) => (
                        <MenuItem key={cls.id} value={String(cls.id)}>
                          {cls.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth disabled={!selectedClass || isLoadingStudents}>
                    <InputLabel id="ledger-student-label">শিক্ষার্থী নির্বাচন করুন</InputLabel>
                    <Select
                      labelId="ledger-student-label"
                      value={students.some((st) => String(st.id) === String(selectedLedgerStudentId)) ? String(selectedLedgerStudentId) : ''}
                      label="শিক্ষার্থী নির্বাচন করুন"
                      onChange={handleLedgerStudentChange}
                    >
                      <MenuItem value="">
                        <em>শিক্ষার্থী নির্বাচন করুন</em>
                      </MenuItem>
                      {students.map((st) => (
                        <MenuItem key={st.id} value={String(st.id)}>
                          {st.display_name || st.full_name || st.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box display="flex" gap={1} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      onClick={handleOpenDueSlip}
                      disabled={!selectedLedgerStudentId || !selectedClass || isLoadingLedger}
                    >
                      শিক্ষার্থীর বকেয়া ফি
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => {
                        if (!selectedClass || !selectedLedgerStudentId) return;
                        const examType = 'annual'; // default exam type, can be changed by user on the next page
                        const url = `/school/${schoolId}/result-card?classroom=${encodeURIComponent(String(selectedClass))}&student=${encodeURIComponent(String(selectedLedgerStudentId))}&exam_type=${encodeURIComponent(examType)}&auto=1`;
                        window.location.assign(url);
                      }}
                      disabled={!selectedLedgerStudentId || !selectedClass}
                    >
                      রেজাল্ট কার্ড
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={replaceLegacyForStudent}
                      disabled={!selectedLedgerStudentId || !selectedClass || isLoadingLedger}
                    >
                      Replace Legacy Items
                    </Button>
                  </Box>
                </Grid>
              </Grid>
              <Box mt={2}>
                {isLoadingLedger ? (
                  <Box display="flex" justifyContent="center" my={2}><CircularProgress size={24} /></Box>
                ) : selectedLedgerStudentId && ledger.rows.length > 0 ? (
                  <>
                    {(() => {
                      // Merge planned payments from unsaved inputs and saved payment history
                      const plannedFromInputs = (pmInputs || [])
                        .filter(r => Number(r.amount) > 0)
                        .map(r => ({ assignmentId: r.assignmentId ? String(r.assignmentId) : undefined, date: r.date, amount: Number(r.amount), method: r.method, reference: r.docText }));
                      const plannedFromHistory = (paymentHistory || [])
                        .map(p => ({ assignmentId: p.assignmentId || undefined, date: p.date, amount: Number(p.amount||0), method: p.method, reference: p.reference }));
                      const planned = [...plannedFromHistory, ...plannedFromInputs];
                      const sumByAssignment = planned.reduce((acc, p) => {
                        if (!p.assignmentId) return acc;
                        acc[p.assignmentId] = (acc[p.assignmentId] || 0) + Number(p.amount || 0);
                        return acc;
                      }, {});
                      // Adjust only assigned payments per-row
                      const adjusted = (ledger.rows || []).map(r => {
                        const pay = Number(sumByAssignment[String(r.id)] || 0);
                        const baseDue = Number(r.due ?? r.amount ?? 0);
                        const newDue = Math.max(0, baseDue - pay);
                        return { ...r, amount: r.amount, paid: r.paid + Math.min(baseDue, pay), due: newDue, due_date: r.due_date };
                      });
                      // Do not distribute unassigned payments per structure; only reduce overall totals
                      const unassignedTotal = planned.filter(p => !p.assignmentId).reduce((s,p)=> s + Number(p.amount||0), 0);
                      const totalsBase = adjusted.reduce((acc, it) => ({ amount: acc.amount + Number(it.amount||0), paid: acc.paid + Number(it.paid||0), due: acc.due + Number(it.due||0) }), { amount: 0, paid: 0, due: 0 });
                      const totals = { amount: totalsBase.amount, paid: totalsBase.paid, due: Math.max(0, totalsBase.due - unassignedTotal) };
                      return (
                        <StudentFeeSlipCard
                          school={school}
                          student={students.find(s => String(s.id) === String(selectedLedgerStudentId))}
                          rows={ledger.rows}
                          totals={totals}
                          payments={planned}
                        />
                      );
                    })()}
                  </>
                ) : selectedLedgerStudentId ? (
                  <Typography variant="body2">এই শিক্ষার্থীর জন্য কোনো ফি আইটেম পাওয়া যায়নি।</Typography>
                ) : (
                  <Typography variant="body2">লেজার দেখতে শ্রেণি ও শিক্ষার্থী নির্বাচন করুন।</Typography>
                )}
              </Box>
            </Paper>

            {/* Payment Method Ledger */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>পেমেন্ট মেথড লেজার</Typography>
              <Box>
                {isLoadingPayments ? (
                  <Box display="flex" justifyContent="center" my={2}><CircularProgress size={24} /></Box>
                ) : selectedLedgerStudentId && paymentHistory.length > 0 ? (
                  <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>তারিখ</TableCell>
                          <TableCell>আইটেম</TableCell>
                          <TableCell align="right">পরিমাণ</TableCell>
                          <TableCell>পেমেন্ট মেথড</TableCell>
                          <TableCell>রেফারেন্স</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paymentHistory.map(p => (
                          <TableRow key={p.id}>
                            <TableCell>
                              {p.date ? new Date(p.date).toLocaleDateString('bn-BD') : '-'}
                            </TableCell>
                            <TableCell>{p.assignment_name}</TableCell>
                            <TableCell align="right">৳{p.amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <Chip 
                                size="small" 
                                label={
                                  p.method === 'cash' ? 'ক্যাশ' :
                                  p.method === 'bank_transfer' ? 'ব্যাংক' :
                                  p.method === 'mobile_banking' ? 'বিকাশ' :
                                  p.method || 'N/A'
                                }
                                color={
                                  p.method === 'cash' ? 'success' :
                                  p.method === 'bank_transfer' ? 'primary' :
                                  p.method === 'mobile_banking' ? 'secondary' :
                                  'default'
                                }
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>{p.reference || '-'}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={2} align="right"><strong>মোট</strong></TableCell>
                          <TableCell align="right"><strong>৳{paymentHistory.reduce((s,p)=>s+p.amount,0).toLocaleString()}</strong></TableCell>
                          <TableCell colSpan={2}></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Always allow adding new payments below history */}
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>নতুন পেমেন্ট যোগ করুন</Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>আইটেম</TableCell>
                          <TableCell>তারিখ</TableCell>
                          <TableCell>পরিমাণ</TableCell>
                          <TableCell>পদ্ধতি</TableCell>
                          <TableCell>ডকুমেন্টস</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pmInputs.map(row => (
                          <TableRow key={row.id}>
                            <TableCell sx={{ minWidth: 220 }}>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={row.assignmentId}
                                  displayEmpty
                                  onChange={(e) => updatePmRow(row.id, { assignmentId: e.target.value })}
                                >
                                  <MenuItem value=""><em>General / Other</em></MenuItem>
                                  {(ledger.rows || []).map(r => (
                                    <MenuItem key={r.id} value={String(r.id)}>
                                      {r.name} {Number(r.due)>0 ? `(বকেয়া ৳${Number(r.due).toLocaleString()})` : ''}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell>
                              <DatePicker
                                value={row.date}
                                onChange={(d) => updatePmRow(row.id, { date: d })}
                                slotProps={{ textField: { size: 'small' } }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="number"
                                value={row.amount}
                                onChange={(e) => updatePmRow(row.id, { amount: e.target.value })}
                                inputProps={{ min: 0, step: '0.01' }}
                              />
                            </TableCell>
                            <TableCell>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={row.method}
                                  onChange={(e) => updatePmRow(row.id, { method: e.target.value })}
                                >
                                  <MenuItem value="cash">ক্যাশ</MenuItem>
                                  <MenuItem value="bank_transfer">ব্যাংক</MenuItem>
                                  <MenuItem value="bkash">বিকাশ</MenuItem>
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <TextField
                                  size="small"
                                  placeholder="ডকুমেন্টস নোট"
                                  value={row.docText}
                                  onChange={(e) => updatePmRow(row.id, { docText: e.target.value })}
                                />
                                <Button variant="outlined" component="label" size="small">
                                  ছবি আপলোড
                                  <input type="file" hidden accept="image/*" onChange={(e) => updatePmRow(row.id, { docFile: e.target.files?.[0] || null })} />
                                </Button>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Button size="small" color="error" onClick={() => removePmRow(row.id)}>Remove</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={6}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Button size="small" onClick={addPmRow}>+ Add Row</Button>
                              <Typography variant="body2" sx={{ mr: 1 }}>
                                মোট ইনপুট: ৳{pmInputs.reduce((s, r) => s + (Number(r.amount)||0), 0).toLocaleString()}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                    <Button variant="contained" onClick={async () => {
                      try {
                        const rows = pmInputs.filter(r => Number(r.amount) > 0);
                        if (rows.length === 0) return setSnackbar({ open: true, message: 'কোন পরিমাণ প্রদান করা হয়নি', severity: 'warning' });
                        for (const r of rows) {
                          const baseAmount = Number(r.amount);
                          const payloadBase = {
                            student_id: selectedLedgerStudentId,
                            payment_date: r.date ? new Date(r.date).toISOString().split('T')[0] : undefined,
                            payment_method: r.method,
                            reference: r.docText || undefined,
                          };
                          const hasAssignment = r.assignmentId && String(r.assignmentId).length > 0;

                          const postPayment = async (body) => {
                            if (r.docFile) {
                              const form = new FormData();
                              Object.entries(body).forEach(([k, val]) => { if (val !== undefined && val !== null) form.append(k, val); });
                              form.append('amount', Number(body.amount));
                              form.append('student_id', selectedLedgerStudentId);
                              if (r.docFile) form.append('document', r.docFile);
                              try { await api.post('/api/fees/payments/', form, { headers: { 'Content-Type': 'multipart/form-data' } }); return true; } catch (_) {}
                            }
                            const candidates = [
                              body,
                              { ...body, fee_assignment: body.assignment_id, assignment_id: undefined },
                              { ...body, fee_assignment_id: body.assignment_id, assignment_id: undefined },
                            ];
                            for (const c of candidates) { try { await api.post('/api/fees/payments/', c); return true; } catch (_) {} }
                            return false;
                          };

                          if (hasAssignment) {
                            const ok = await postPayment({ ...payloadBase, amount: baseAmount, assignment_id: r.assignmentId });
                            if (!ok) throw new Error('Failed to save payment');
                          } else {
                            // Save as a single general payment (no splitting across structures)
                            const ok = await postPayment({ ...payloadBase, amount: baseAmount });
                            if (!ok) throw new Error('Failed to save general payment');
                          }
                        }
                        setSnackbar({ open: true, message: 'পেমেন্ট সংরক্ষিত হয়েছে', severity: 'success' });
                        await ensureStudentAssignments(String(selectedLedgerStudentId));
                        await fetchPaymentHistory(String(selectedLedgerStudentId));
                        await fetchStudentLedger(String(selectedLedgerStudentId));
                        setPmInputs([]);
                      } catch (e) {
                        const msg = e?.response?.data?.detail || e?.response?.data || e?.message || 'পেমেন্ট সংরক্ষণে সমস্যা হয়েছে';
                        setSnackbar({ open: true, message: typeof msg === 'string' ? msg : 'পেমেন্ট সংরক্ষণে সমস্যা হয়েছে', severity: 'error' });
                      }
                    }}>Save Payments</Button>
                  </Box>
                  </>
                ) : selectedLedgerStudentId ? (
                  <>
                    <Typography variant="body2" gutterBottom>এই শিক্ষার্থীর কোন পেমেন্ট রেকর্ড পাওয়া যায়নি। নিচে পেমেন্ট যোগ করুন:</Typography>
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>আইটেম</TableCell>
                            <TableCell>তারিখ</TableCell>
                            <TableCell>পরিমাণ</TableCell>
                            <TableCell>পদ্ধতি</TableCell>
                            <TableCell>ডকুমেন্টস</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {pmInputs.map(row => (
                            <TableRow key={row.id}>
                              <TableCell sx={{ minWidth: 220 }}>
                                <FormControl size="small" fullWidth>
                                  <InputLabel id={`assign-label-${row.id}`}>আইটেম</InputLabel>
                                  <Select
                                    labelId={`assign-label-${row.id}`}
                                    id={`assignment-${row.id}`}
                                    name={`assignment-${row.id}`}
                                    label="আইটেম"
                                    value={row.assignmentId}
                                    displayEmpty
                                    onChange={(e) => updatePmRow(row.id, { assignmentId: e.target.value })}
                                  >
                                    <MenuItem value=""><em>General / Other</em></MenuItem>
                                    {(ledger.rows || []).map(r => (
                                      <MenuItem key={r.id} value={String(r.id)}>
                                        {r.name} {Number(r.due)>0 ? `(বকেয়া ৳${Number(r.due).toLocaleString()})` : ''}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </TableCell>
                              <TableCell>
                                <DatePicker
                                  value={row.date}
                                  onChange={(d) => updatePmRow(row.id, { date: d })}
                                  slotProps={{ textField: { size: 'small', id: `date-${row.id}`, name: `date-${row.id}`, label: 'তারিখ' } }}
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  type="number"
                                  value={row.amount}
                                  onChange={(e) => updatePmRow(row.id, { amount: e.target.value })}
                                  id={`amount-${row.id}`}
                                  name={`amount-${row.id}`}
                                  label="পরিমাণ"
                                  inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
                                />
                              </TableCell>
                              <TableCell>
                                <FormControl size="small" fullWidth>
                                  <InputLabel id={`method-label-${row.id}`}>পদ্ধতি</InputLabel>
                                  <Select
                                    labelId={`method-label-${row.id}`}
                                    id={`method-${row.id}`}
                                    name={`method-${row.id}`}
                                    label="পদ্ধতি"
                                    value={row.method}
                                    onChange={(e) => updatePmRow(row.id, { method: e.target.value })}
                                  >
                                    <MenuItem value="cash">ক্যাশ</MenuItem>
                                    <MenuItem value="bank_transfer">ব্যাংক</MenuItem>
                                    <MenuItem value="bkash">বিকাশ</MenuItem>
                                  </Select>
                                </FormControl>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  <TextField
                                    size="small"
                                    placeholder="ডকুমেন্টস নোট"
                                    value={row.docText}
                                    onChange={(e) => updatePmRow(row.id, { docText: e.target.value })}
                                    id={`doc-${row.id}`}
                                    name={`doc-${row.id}`}
                                    label="ডকুমেন্টস নোট"
                                  />
                                  <Button variant="outlined" component="label" size="small" htmlFor={`docfile-${row.id}`}> 
                                    ছবি আপলোড
                                    <input id={`docfile-${row.id}`} type="file" hidden accept="image/*" onChange={(e) => updatePmRow(row.id, { docFile: e.target.files?.[0] || null })} />
                                  </Button>
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                <Button size="small" color="error" onClick={() => removePmRow(row.id)}>Remove</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={6}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Button size="small" onClick={addPmRow}>+ Add Row</Button>
                                <Typography variant="body2" sx={{ mr: 1 }}>
                                  মোট ইনপুট: ৳{pmInputs.reduce((s, r) => s + (Number(r.amount)||0), 0).toLocaleString()}
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                      <Button variant="contained" onClick={async () => {
                        try {
                          const rows = pmInputs.filter(r => Number(r.amount) > 0);
                          if (rows.length === 0) return setSnackbar({ open: true, message: 'কোন পরিমাণ প্রদান করা হয়নি', severity: 'warning' });
                          for (const r of rows) {
                            const baseAmount = Number(r.amount);
                            const payloadBase = {
                              student_id: selectedLedgerStudentId,
                              payment_date: r.date ? new Date(r.date).toISOString().split('T')[0] : undefined,
                              method: r.method || undefined,
                              payment_method: r.method || undefined,
                              reference: r.docText || undefined,
                            };
                            const hasAssignment = r.assignmentId && String(r.assignmentId).length > 0;

                            const postPayment = async (body) => {
                              const urls = ['/api/fees/payments/', '/api/payments/', '/api/fees/collections/'];
                              if (r.docFile) {
                                for (const url of urls) {
                                  const form = new FormData();
                                  Object.entries(body).forEach(([k, val]) => { if (val !== undefined && val !== null) form.append(k, val); });
                                  form.append('amount', Number(body.amount));
                                  form.append('student_id', selectedLedgerStudentId);
                                  if (r.docFile) form.append('document', r.docFile);
                                  try { await api.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } }); return true; } catch (_) { /* try next */ }
                                }
                              }
                              const candidates = [
                                body,
                                { ...body, student: body.student_id },
                                { ...body, date: body.payment_date },
                                { ...body, fee_assignment: body.assignment_id, assignment_id: undefined },
                                { ...body, fee_assignment_id: body.assignment_id, assignment_id: undefined },
                              ];
                              for (const url of urls) {
                                for (const c of candidates) {
                                  try { await api.post(url, c); return true; } catch (_) { /* try next */ }
                                }
                              }
                              return false;
                            };

                            if (hasAssignment) {
                              // Direct payment to selected assignment
                              const ok = await postPayment({ ...payloadBase, amount: baseAmount, assignment_id: r.assignmentId });
                              if (!ok) throw new Error('Failed to save payment');
                            } else {
                              // Option B: Auto-attach entire amount to the oldest outstanding assignment (single payment, no split)
                              const ledgerRows = (ledger?.rows || []).map(x => ({ id: x.id, due: Number(x.due || 0), due_date: x.due_date || null }));
                              const withDue = ledgerRows.filter(x => x.due > 0);
                              let target = null;
                              if (withDue.length > 0) {
                                target = withDue.slice().sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))[0];
                              } else if (ledgerRows.length > 0) {
                                target = ledgerRows[0];
                              }
                              if (target && target.id) {
                                const ok = await postPayment({ ...payloadBase, amount: baseAmount, assignment_id: target.id });
                                if (!ok) throw new Error('Failed to save payment');
                              } else {
                                // Fallback: general payment if no assignments exist at all
                                const ok = await postPayment({ ...payloadBase, amount: baseAmount });
                                if (!ok) throw new Error('Failed to save general payment');
                              }
                            }
                          }
                          setSnackbar({ open: true, message: 'পেমেন্ট সংরক্ষিত হয়েছে', severity: 'success' });
                          // Ensure salary card (assignments) exist for this student so dues reflect immediately
                          await ensureStudentAssignments(String(selectedLedgerStudentId));
                          await fetchPaymentHistory(String(selectedLedgerStudentId));
                          await fetchStudentLedger(String(selectedLedgerStudentId));
                          setPmInputs([]);
                        } catch (e) {
                          setSnackbar({ open: true, message: 'পেমেন্ট সংরক্ষণে সমস্যা হয়েছে', severity: 'error' });
                        }
                      }}>Save Payments</Button>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2">শিক্ষার্থী নির্বাচন করুন পেমেন্ট রেকর্ড দেখতে।</Typography>
                )}
              </Box>
            </Paper>

          </>
        )}

        <Dialog open={isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md" fullScreen={isSmallScreen}>
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">Add Fee</Typography>
              <IconButton onClick={handleCloseDialog} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth error={!!formErrors.classId}>
                    <InputLabel id="class-select-label">শ্রেণি নির্বাচন করুন *</InputLabel>
                    <Select
                      labelId="class-select-label"
                      id="class-select"
                      value={classes.some((cls) => String(cls.id) === String(selectedClass)) ? String(selectedClass) : ''}
                      label="শ্রেণী নির্বাচন করুন *"
                      onChange={handleClassChange}
                      required
                    >
                      <MenuItem value="">
                        <em>শ্রেণী নির্বাচন করুন</em>
                      </MenuItem>
                      {classes.map((cls) => (
                        <MenuItem key={cls.id} value={String(cls.id)}>
                          {cls.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {formErrors.classId && (
                      <Typography variant="caption" color="error">
                        {formErrors.classId}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  {renderStudentDropdown()}
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth error={!!formErrors.feeStructureId}>
                    <InputLabel id="fee-structure-label">Fee Structure *</InputLabel>
                    <Select
                      labelId="fee-structure-label"
                      id="feeStructureId"
                      name="feeStructureId"
                      value={feeForm.feeStructureId}
                      onChange={handleInputChange}
                      label="Fee Structure *"
                      disabled={
                        isLoadingFeeStructures ||
                        feeStructures.filter(fs => !assignedStructureIds.includes(String(fs.id))).length === 0
                      }
                    >
                      <MenuItem value="">
                        <em>Fee Structure</em>
                      </MenuItem>
                      {isLoadingFeeStructures ? (
                        <MenuItem value="" disabled>
                          Loading...
                        </MenuItem>
                      ) : (
                        (feeStructures.filter(fs => !assignedStructureIds.includes(String(fs.id)))).length > 0 ? (
                          feeStructures
                            .filter(fs => !assignedStructureIds.includes(String(fs.id)))
                            .map((fs) => (
                              <MenuItem key={fs.id} value={fs.id}>
                                {fs.name}{fs.amount ? ` (৳${fs.amount})` : ''}
                              </MenuItem>
                            ))
                        ) : (
                          <MenuItem value="" disabled>
                            এই শিক্ষার্থীর জন্য নতুন কোন ফি স্ট্রাকচার নেই
                          </MenuItem>
                        )
                      )}
                    </Select>
                    {formErrors.feeStructureId ? (
                      <Typography variant="caption" color="error">
                        {formErrors.feeStructureId}
                      </Typography>
                    ) : (
                      feeStructures.filter(fs => !assignedStructureIds.includes(String(fs.id))).length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                          এই শিক্ষার্থীর জন্য সব ফি স্ট্রাকচার আগে থেকেই অ্যাসাইন করা আছে। অন্য শিক্ষার্থী নির্বাচন করুন অথবা নতুন ফি স্ট্রাকচার তৈরি করুন।
                        </Typography>
                      )
                    )}
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="amount"
                    name="amount"
                    label="Amount *"
                    type="number"
                    value={feeForm.amount}
                    onChange={handleInputChange}
                    error={!!formErrors.amount}
                    helperText={formErrors.amount}
                    inputProps={{
                      min: 0,
                      step: '0.01',
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <DatePicker
                    label="Due Date *"
                    value={feeForm.dueDate}
                    onChange={handleDateChange}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!formErrors.dueDate,
                        helperText: formErrors.dueDate,
                        required: true
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    id="description"
                    name="description"
                    label="Description"
                    multiline
                    rows={3}
                    value={feeForm.description}
                    onChange={handleInputChange}
                  />
                </Grid>
              </Grid>
              <DialogActions sx={{ p: 2 }}>
                <Button onClick={handleCloseDialog} color="inherit">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting}
                  startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
                >
                  {isSubmitting ? 'Saving...' : 'Save Fee'}
                </Button>
              </DialogActions>
            </Box>
          </DialogContent>
        </Dialog>

        {/* Class Fee Plan Dialog */}
        <Dialog open={isPlanDialogOpen} onClose={handleClosePlanDialog} fullWidth maxWidth="sm" fullScreen={isSmallScreen}>
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">সকল ফি ক্যাটেগরি</Typography>
              <IconButton onClick={handleClosePlanDialog} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Alert severity={selectedClass ? 'info' : 'warning'}>
                    {selectedClass ? 'Selected Class ID: ' + selectedClass : 'শ্রেণি নির্বাচন করুন (উপরে Student Ledger সেকশনে)'}
                  </Alert>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="monthlyAmount"
                    name="monthlyAmount"
                    label="মাসিক বেতন"
                    type="number"
                    value={planForm.monthlyAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="halfYearlyAmount"
                    name="halfYearlyAmount"
                    label="অর্ধ-বার্ষিকী পরীক্ষার ফি"
                    type="number"
                    value={planForm.halfYearlyAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="annualAmount"
                    name="annualAmount"
                    label="বার্ষিক পরীক্ষার ফি"
                    type="number"
                    value={planForm.annualAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="sessionAmount"
                    name="sessionAmount"
                    label="সেশন ফি"
                    type="number"
                    value={planForm.sessionAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="registrationAmount"
                    name="registrationAmount"
                    label="রেজিস্ট্রেশন ফি"
                    type="number"
                    value={planForm.registrationAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="assessmentAmount"
                    name="assessmentAmount"
                    label="ষান্মাসিক/বাৎসরিক মূল্যায়ন ফি"
                    type="number"
                    value={planForm.assessmentAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="boardAmount"
                    name="boardAmount"
                    label="বোর্ড ফি"
                    type="number"
                    value={planForm.boardAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="examCenterAmount"
                    name="examCenterAmount"
                    label="পরীক্ষার কেন্দ্র ফি"
                    type="number"
                    value={planForm.examCenterAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="ictAmount"
                    name="ictAmount"
                    label="আইসিটি ফি"
                    type="number"
                    value={planForm.ictAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="sportsAmount"
                    name="sportsAmount"
                    label="ক্রীড়া ফি"
                    type="number"
                    value={planForm.sportsAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="developmentAmount"
                    name="developmentAmount"
                    label="উন্নয়ন ফি"
                    type="number"
                    value={planForm.developmentAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="electricityAmount"
                    name="electricityAmount"
                    label="বিদ্যুৎ/কল্যাণ ফি"
                    type="number"
                    value={planForm.electricityAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="tcAmount"
                    name="tcAmount"
                    label="টিসি/প্রশংসা পত্র ফি"
                    type="number"
                    value={planForm.tcAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="computerLabAmount"
                    name="computerLabAmount"
                    label="কম্পিউটার ল্যাব ফি"
                    type="number"
                    value={planForm.computerLabAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="scoutsAmount"
                    name="scoutsAmount"
                    label="স্কাউটস ফি"
                    type="number"
                    value={planForm.scoutsAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="admissionAmount"
                    name="admissionAmount"
                    label="ভর্তি ফি"
                    type="number"
                    value={planForm.admissionAmount}
                    onChange={handlePlanInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleClosePlanDialog} color="inherit">Cancel</Button>
            <Button onClick={saveClassPlan} variant="contained" disabled={isSavingPlan || !selectedClass} startIcon={isSavingPlan ? <CircularProgress size={20} /> : null}>
              {isSavingPlan ? 'Saving...' : 'Save Plan'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Record Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onClose={handleClosePaymentDialog} fullWidth maxWidth="sm" fullScreen={isSmallScreen}>
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">Record Payment</Typography>
              <IconButton onClick={handleClosePaymentDialog} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    id="paymentAmount"
                    name="amount"
                    label="Amount *"
                    type="number"
                    value={paymentForm.amount}
                    onChange={handlePaymentInputChange}
                    inputProps={{ min: 0, step: '0.01' }}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <DatePicker
                    label="Payment Date"
                    value={paymentForm.paymentDate}
                    onChange={handlePaymentDateChange}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id="method-label">Method</InputLabel>
                    <Select
                      labelId="method-label"
                      id="method"
                      name="method"
                      label="Method"
                      value={paymentForm.method}
                      onChange={handlePaymentInputChange}
                    >
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="bank">Bank</MenuItem>
                      <MenuItem value="bkash">bKash</MenuItem>
                      <MenuItem value="nagad">Nagad</MenuItem>
                      <MenuItem value="rocket">Rocket</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {String(paymentForm.method || '').toLowerCase() === 'bkash' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        id="bkash_to"
                        name="bkash_to"
                        label="যে নাম্বারে পাঠিয়েছেন"
                        placeholder="যে নাম্বারে পাঠিয়েছেন (01XXXXXXXXX)"
                        value={paymentForm.bkash_to}
                        onChange={handlePaymentInputChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        id="bkash_from"
                        name="bkash_from"
                        label="কোন নাম্বার থেকে টাকা পাঠিয়েছেন"
                        placeholder="কোন নাম্বার থেকে টাকা পাঠিয়েছেন (01XXXXXXXXX)"
                        value={paymentForm.bkash_from}
                        onChange={handlePaymentInputChange}
                      />
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="reference"
                    name="reference"
                    label="Reference"
                    value={paymentForm.reference}
                    onChange={handlePaymentInputChange}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    id="note"
                    name="note"
                    label="Note"
                    multiline
                    rows={2}
                    value={paymentForm.note}
                    onChange={handlePaymentInputChange}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleClosePaymentDialog} color="inherit">Cancel</Button>
            <Button onClick={submitPayment} variant="contained" disabled={isSubmittingPayment} startIcon={isSubmittingPayment ? <CircularProgress size={20} /> : null}>
              {isSubmittingPayment ? 'Saving...' : 'Save Payment'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Payment Method Ledger (Bottom Inline Section) */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>পেমেন্ট মেথড লেজার</Typography>
          {(!paymentHistory || paymentHistory.length === 0) && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              এই শিক্ষার্থীর কোন পেমেন্ট রেকর্ড পাওয়া যায়নি। নিচে পেমেন্ট যোগ করুন:
            </Typography>
          )}
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>আইটেম</TableCell>
                  <TableCell>তারিখ</TableCell>
                  <TableCell align="right">পরিমাণ</TableCell>
                  <TableCell>পদ্ধতি</TableCell>
                  <TableCell>ডকুমেন্টস</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Unassigned</TableCell>
                  <TableCell>
                    <DatePicker
                      value={inlinePayment.paymentDate}
                      onChange={handleInlinePaymentDateChange}
                      slotProps={{ textField: { size: 'small' } }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      name="amount"
                      value={inlinePayment.amount}
                      onChange={handleInlinePaymentChange}
                      inputProps={{ min: 0, step: '0.01' }}
                    />
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" fullWidth>
                      <Select name="method" value={inlinePayment.method} onChange={handleInlinePaymentChange}>
                        <MenuItem value="cash">ক্যাশ</MenuItem>
                        <MenuItem value="bank">ব্যাংক</MenuItem>
                        <MenuItem value="bkash">বিকাশ</MenuItem>
                        <MenuItem value="nagad">নগদ</MenuItem>
                        <MenuItem value="rocket">রকেট</MenuItem>
                        <MenuItem value="other">অন্যান্য</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {String(inlinePayment.method || '').toLowerCase() === 'bkash' ? (
                        <>
                          <TextField size="small" name="bkash_to" placeholder="যে নাম্বারে পাঠিয়েছেন (01XXXXXXXXX)" value={inlinePayment.bkash_to} onChange={handleInlinePaymentChange} />
                          <TextField size="small" name="bkash_from" placeholder="কোন নাম্বার থেকে টাকা পাঠিয়েছেন (01XXXXXXXXX)" value={inlinePayment.bkash_from} onChange={handleInlinePaymentChange} />
                        </>
                      ) : (
                        <TextField size="small" name="reference" placeholder="রেফারেন্স/নোট" value={inlinePayment.reference} onChange={handleInlinePaymentChange} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Button variant="contained" size="small" onClick={submitInlinePayment} disabled={isSubmittingPayment || !selectedLedgerStudentId}>
                      Save
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="body2" color="text.secondary">11/06/2025</Typography>
            <Typography variant="subtitle2">মোট ইনপুট: ৳{Number(inlinePayment.amount || 0).toLocaleString()}</Typography>
          </Box>
        </Box>

        {/* Due Slip Dialog */}
        <Dialog open={isDueSlipOpen} onClose={() => setIsDueSlipOpen(false)} fullWidth maxWidth="md" fullScreen={isSmallScreen}>
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">শিক্ষার্থীর বকেয়া ফি</Typography>
              <IconButton onClick={() => setIsDueSlipOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedLedgerStudentId ? (() => {
              const monthsBn = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
              const clsId = String(selectedClass || '');
              const cached = classPlans[clsId];
              const derived = deriveClassPlan(clsId);
              const plan = cached || derived || { monthlyAmount: 0, halfYearlyAmount: 0, annualAmount: 0 };
              const planRows = [];
              const mAmt = Number(plan.monthlyAmount || 0);
              const hAmt = Number(plan.halfYearlyAmount || 0);
              const aAmt = Number(plan.annualAmount || 0);
              const sAmt = Number(plan.sessionAmount || 0);
              if (mAmt > 0) {
                for (let m = 1; m <= 12; m++) {
                  planRows.push({ id: `plan-t-${m}`, name: `${monthsBn[m-1]} মাসের বেতন`, amount: mAmt, paid: 0, due: mAmt });
                }
              }
              if (hAmt > 0) planRows.push({ id: 'plan-e-half', name: 'অর্ধ-বার্ষিকী পরীক্ষার ফি', amount: hAmt, paid: 0, due: hAmt });
              if (aAmt > 0) planRows.push({ id: 'plan-e-annual', name: 'বার্ষিক পরীক্ষার ফি', amount: aAmt, paid: 0, due: aAmt });
              if (sAmt > 0) planRows.push({ id: 'plan-e-session', name: 'সেশন ফি', amount: sAmt, paid: 0, due: sAmt });
              // Prefer actual assignment dues when available; fallback to plan when ledger is empty
              const ledgerDue = (ledger.rows || []).filter(r => Number(r.due) > 0);
              const baseRows = ledgerDue.length > 0
                ? ledgerDue.map(r => ({ ...r, amount: Number(r.due)||0, paid: 0, due: Number(r.due)||0 }))
                : planRows;
              const totalAmount = baseRows.reduce((s, r) => s + Number(r.amount || 0), 0);
              const assignDue = ledgerDue;
              // Collect persisted history + staged payments (duePayments, pmInputs)
              const histArray = (paymentHistory || []).map(p => ({
                assignmentId: p.assignmentId ? String(p.assignmentId) : undefined,
                date: p.date,
                amount: Number(p.amount || 0),
                method: p.method,
                reference: p.reference
              }));
              const dpArray = Object.entries(duePayments)
                .filter(([,v]) => Number(v?.amount) > 0)
                .map(([rid,v]) => ({ assignmentId: String(rid), date: v.date, amount: Number(v.amount), method: v.method, reference: v.docText }));
              const pmArray = (pmInputs || [])
                .filter(r => Number(r.amount) > 0)
                .map(r => ({ assignmentId: r.assignmentId ? String(r.assignmentId) : undefined, date: r.date, amount: Number(r.amount), method: r.method, reference: r.docText }));
              const plannedPayments = [...histArray, ...dpArray, ...pmArray];
              const sumByAssignment = plannedPayments.reduce((acc, p) => {
                if (!p.assignmentId) return acc; // only assigned go to per-row deduction
                acc[p.assignmentId] = (acc[p.assignmentId] || 0) + Number(p.amount || 0);
                return acc;
              }, {});
              let adjustedRows = baseRows.map(r => {
                const rid = String(r.id || '');
                const pay = Number(sumByAssignment[rid] || 0);
                const base = Number(r.due ?? r.amount ?? 0);
                const newDue = Math.max(0, base - pay);
                return { ...r, amount: newDue, paid: 0, due: newDue };
              });
              // Distribute unassigned across rows and reflect as Paid
              const unassigned = plannedPayments.filter(p => !p.assignmentId).reduce((s,p)=> s + Number(p.amount||0), 0);
              if (unassigned > 0) {
                let remain = unassigned;
                adjustedRows = adjustedRows.map(row => ({ ...row }));
                for (let i = 0; i < adjustedRows.length && remain > 0; i++) {
                  const d = Number(adjustedRows[i].due || 0);
                  if (d <= 0) continue;
                  const take = Math.min(d, remain);
                  adjustedRows[i].amount = Math.max(0, Number(adjustedRows[i].amount||0) - take);
                  adjustedRows[i].paid = Number(adjustedRows[i].paid || 0) + take;
                  adjustedRows[i].due = d - take;
                  remain -= take;
                }
              }
              const adjustedTotal = adjustedRows.reduce((s, it) => s + Number(it.amount || 0), 0);
              return (
                <>
                  <StudentFeeSlipCard
                    title="শিক্ষার্থীর বকেয়া ফি"
                    school={school}
                    student={students.find(s => String(s.id) === String(selectedLedgerStudentId))}
                    rows={ledger.rows}
                    totals={{ amount: (ledger.rows||[]).reduce((s, it) => s + Number(it.amount||0), 0), paid: (ledger.rows||[]).reduce((s, it) => s + Number(it.paid||0), 0), due: (ledger.rows||[]).reduce((s, it) => s + Number(it.due||0), 0) }}
                    payments={plannedPayments}
                  />

                  <Box sx={{ mt: 2, display: 'none' }}>
                    <Typography variant="subtitle2" gutterBottom>বকেয়া বেতনের পেমেন্ট</Typography>
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>আইটেম</TableCell>
                            <TableCell align="right">বকেয়া</TableCell>
                            <TableCell>পরিশোধের তারিখ</TableCell>
                            <TableCell>পরিশোধিত টাকার পরিমাণ</TableCell>
                            <TableCell>পদ্ধতি</TableCell>
                            <TableCell>ডকুমেন্টস</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {assignDue.map(r => {
                            const v = duePayments[r.id] || { amount: '', date: new Date(), method: 'cash', docText: '', docFile: null };
                            return (
                              <TableRow key={`pay-${r.id}`}>
                                <TableCell>{r.name}</TableCell>
                                <TableCell align="right">{r.due}</TableCell>
                                <TableCell>
                                  <DatePicker
                                    value={v.date}
                                    onChange={(d) => setDuePayments(prev => ({ ...prev, [r.id]: { ...v, date: d } }))}
                                    slotProps={{ textField: { size: 'small' } }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={v.amount}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setDuePayments(prev => ({ ...prev, [r.id]: { ...v, amount: val } }));
                                    }}
                                    inputProps={{ min: 0, max: Number(r.due), step: '0.01' }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <FormControl size="small" fullWidth>
                                    <Select
                                      value={v.method}
                                      onChange={(e) => setDuePayments(prev => ({ ...prev, [r.id]: { ...v, method: e.target.value } }))}
                                    >
                                      <MenuItem value="cash">ক্যাশ</MenuItem>
                                      <MenuItem value="bank_transfer">ব্যাংক</MenuItem>
                                      <MenuItem value="bkash">বিকাশ</MenuItem>
                                    </Select>
                                  </FormControl>
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    <TextField
                                      size="small"
                                      placeholder="ডকুমেন্টস নোট"
                                      value={v.docText}
                                      onChange={(e) => setDuePayments(prev => ({ ...prev, [r.id]: { ...v, docText: e.target.value } }))}
                                    />
                                    <Button variant="outlined" component="label" size="small">
                                      ছবি আপলোড করুন
                                      <input type="file" hidden accept="image/*" onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setDuePayments(prev => ({ ...prev, [r.id]: { ...v, docFile: file } }));
                                      }} />
                                    </Button>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                      <Typography color="text.secondary">এই ইনপুট অনুযায়ী নতুন মোট বকেয়া</Typography>
                      <Typography fontWeight={700}>
                        {(() => {
                          const unassigned = (plannedPayments || []).filter(p => !p.assignmentId).reduce((s,p)=> s + Number(p.amount||0), 0);
                          const preview = Math.max(0, adjustedTotal - unassigned);
                          return `৳${preview.toLocaleString()}`;
                        })()}
                      </Typography>
                    </Box>
                  </Box>
                </>
              );
            })() : (
              <Typography variant="body2">শিক্ষার্থী নির্বাচন করুন</Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setIsDueSlipOpen(false)} color="inherit">Close</Button>
            <Button sx={{ display: 'none' }} variant="contained" onClick={async () => {
              try {
                const entries = Object.entries(duePayments).filter(([,v]) => Number(v.amount) > 0);
                if (entries.length === 0) return setSnackbar({ open: true, message: 'কোন পরিমাণ প্রদান করা হয়নি', severity: 'warning' });
                // Save payments one by one
                for (const [assignId, v] of entries) {
                  const payloadBase = {
                    student_id: selectedLedgerStudentId,
                    amount: Number(v.amount),
                    payment_date: v.date ? new Date(v.date).toISOString().split('T')[0] : undefined,
                    payment_method: v.method,
                    reference: v.docText || undefined,
                  };
                  const form = new FormData();
                  Object.entries({ ...payloadBase, assignment_id: assignId }).forEach(([k, val]) => { if (val !== undefined && val !== null) form.append(k, val); });
                  if (v.docFile) form.append('document', v.docFile);

                  let ok = false;
                  // Try /payments/ first
                  try {
                    await api.post('/api/fees/payments/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
                    ok = true;
                  } catch (_) {
                    // Try JSON variations
                    const candidates = [
                      { fee_assignment: assignId, ...payloadBase },
                      { fee_assignment_id: assignId, ...payloadBase },
                    ];
                    for (const c of candidates) {
                      try { await api.post('/api/fees/payments/', c); ok = true; break; } catch (e) { /* try next */ }
                    }
                  }
                }
                setSnackbar({ open: true, message: 'পেমেন্ট সংরক্ষিত হয়েছে', severity: 'success' });
                // Refresh ledger and payment history, clear inputs
                await fetchStudentLedger(String(selectedLedgerStudentId));
                await fetchPaymentHistory(String(selectedLedgerStudentId));
                setDuePayments({});
              } catch (e) {
                setSnackbar({ open: true, message: 'পেমেন্ট সংরক্ষণে সমস্যা হয়েছে', severity: 'error' });
              }
            }}>Save Payments</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default FeesPage;
