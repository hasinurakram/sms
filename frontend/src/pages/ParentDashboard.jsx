import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAuthenticated } from '../utils/auth';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Stack,
  Divider,
  Chip,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Alert,
  Avatar,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem
} from '@mui/material';
import {
  Person as PersonIcon,
  School as SchoolIcon,
  Assessment as AssessmentIcon,
  CalendarMonth as CalendarIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  EmojiEvents as TrophyIcon,
  ReceiptLong as ReceiptLongIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { useNotifications } from '../context/NotificationContext';
import dayjs from 'dayjs';
import 'dayjs/locale/bn';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { styled } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import StudentFeeSlipCard from '../components/StudentFeeSlipCard';

const ParentDashboard = () => {
  const { id, parentId } = useParams(); // id = school, parentId = parent
  const navigate = useNavigate();
  const toast = useToast();
  const { addNotification } = useNotifications();
  const reportRef = useRef();
  const reportsRef = useRef(null);

  // State
  const [parentInfo, setParentInfo] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0); // 0 = Attendance, 1 = Result, 2 = Fees
  const [loading, setLoading] = useState(true);
  const [resultData, setResultData] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [absentDates, setAbsentDates] = useState([]);
  const [absentLoading, setAbsentLoading] = useState(false);
  const [feesData, setFeesData] = useState(null);
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feeRows, setFeeRows] = useState([]);
  const [feeTotals, setFeeTotals] = useState({ amount: 0, paid: 0, due: 0 });
  const [feePayments, setFeePayments] = useState([]);
  const [bkashForm, setBkashForm] = useState({ date: '', amount: '', from: '', method: 'BKASH', note: '' });
  const [bkashSubmitting, setBkashSubmitting] = useState(false);
  const [bkashSubmitted, setBkashSubmitted] = useState(false);
  const [extraApproved, setExtraApproved] = useState(0);
  const bkashPollRef = useRef(null);
  const [bkashPendingAmount, setBkashPendingAmount] = useState(0);
  const [optimisticApproved, setOptimisticApproved] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState(null);
  const { user, isAuthenticated } = useAuth();

  // Open edit dialog
  const handleOpenEditDialog = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setEditDialogOpen(true);
  };

  // Close edit dialog
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setRemovingStudentId(null);
  };

  // Remove a student from parent
  const handleRemoveStudent = async (studentId) => {
    if (!studentId || !user?.id) return;
    
    try {
      setRemovingStudentId(studentId);
      await api.delete(`/api/academics/students/${studentId}/remove_guardian/`, {
        data: { guardian_id: user.id }
      });
      
      // Update local state
      setChildren(prev => prev.filter(child => child.id !== studentId));
      if (selectedChild?.id === studentId) {
        setSelectedChild(children[0] || null);
      }
      
      toast.success('শিক্ষার্থী সফলভাবে অপসারণ করা হয়েছে');
    } catch (error) {
      console.error('Error removing student:', error);
      toast.error('শিক্ষার্থী অপসারণ করতে ব্যর্থ হয়েছে');
    } finally {
      setRemovingStudentId(null);
    }
  };

  useEffect(() => {
    loadParentData();
    loadSchoolInfo();
  }, [parentId, id]);

  useEffect(() => {
    if (selectedChild) {
      loadChildData();
    }
  }, [selectedChild, selectedTab]);

  const loadSchoolInfo = async () => {
    try {
      const res = await api.get(`/api/schools/${id}/`);
      setSchoolInfo(res.data);
    } catch (error) {
      console.error('Failed to load school info:', error);
    }
  };

  const processPaymentAttempts = async (attempts) => {
    let lastError = null;
    
    for (const attempt of attempts) {
      try {
        const response = await api({
          method: attempt.method || 'POST',
          url: attempt.url,
          data: attempt.data,
          headers: attempt.headers
        });
        
        if (response.status >= 200 && response.status < 300) {
          console.log('Payment successful:', response.data);
          return response.data;
        }
      } catch (error) {
        console.error('Payment attempt failed:', error);
        lastError = error;
        // Continue to next attempt
      }
    }
    
    // If we get here, all attempts failed
    throw lastError || new Error('All payment attempts failed');
  };

  const submitBkashPayment = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    try {
      // Input validation
      if (!selectedChild) return;
      if (!bkashForm.amount || Number(bkashForm.amount) <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }
      if (!bkashForm.from) {
        toast.error('Please enter the mobile number used for payment');
        return;
      }
      
      // State setup
      setBkashSubmitting(true);
      setBkashSubmitted(false);
      
      // Initialize variables
      const studentId = selectedChild.id;
      const payment_date = bkashForm.date ? dayjs(bkashForm.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      const amountNum = parseFloat(bkashForm.amount);
      const now = dayjs();
      const currentMonth = now.month() + 1; // 1-12 for January-December
      const currentYear = now.year();
      const classroomId = selectedChild?.classroom?.id || selectedChild?.classroom_id;
      
      setBkashPendingAmount(amountNum || 0);
      
      if (!classroomId) {
        toast.error('Student class not found');
        return;
      }
      
      // The actual student ID value - ensure it's a number if required by the API
      const studentIdValue = Number(studentId);
      
      if (!studentIdValue) {
        throw new Error('Student ID is required');
      }
      
      // Check for existing payment first
      let existingPayment = null;
      try {
        const checkRes = await api.get(`/api/fees/payments/?student_id=${studentId}&month=${currentMonth}&year=${currentYear}`);
        existingPayment = Array.isArray(checkRes.data) && checkRes.data.length > 0 ? checkRes.data[0] : null;
      } catch (checkError) {
        console.warn('Error checking for existing payment:', checkError);
      }
      let targetAssignmentId = null;
      try {
        const aRes = await api.get(`/api/fees/assignments/?student_id=${studentId}`);
        const aData = Array.isArray(aRes.data) ? aRes.data : (aRes.data?.results || aRes.data?.data || []);
        if (aData && aData.length > 0) {
          const first = aData[0] || {};
          targetAssignmentId = first.id || first._id || first.assignment || first.assignment_id || null;
        }
      } catch (_) {}
      
      const endpoints = [
        '/api/fees/payments/'
      ];
      
      const methodRaw = String(bkashForm.method || 'bkash').toLowerCase();
      const paymentMethod = (
        methodRaw === 'cash' ? 'cash' :
        methodRaw === 'bank' ? 'bank_transfer' :
        methodRaw === 'cheque' ? 'cheque' :
        methodRaw === 'online' ? 'online' :
        methodRaw === 'card' ? 'card' :
        'mobile_banking' // bkash/nagad/rocket/default
      );
      const basePaymentData = {
        amount: amountNum,
        payment_date,
        payment_method: paymentMethod,
        payment_status: 'pending',
        reference: bkashForm.note || bkashForm.from || `PARENT-${Date.now()}`
      };
      
      const payload = {
        ...basePaymentData,
        student_id: studentIdValue,
        ...(targetAssignmentId ? { fee_assignment_id: targetAssignmentId } : {})
      };

      const payloads = [];
      if (targetAssignmentId) {
        payloads.push({ url: '/api/fees/payments/', method: 'POST', data: payload });
      }
      // Full general payload
      payloads.push({ url: '/api/fees/payments/', method: 'POST', data: { ...basePaymentData, student_id: studentIdValue } });
      // Minimal fallback: rely on server defaults for date/status/method
      payloads.push({ url: '/api/fees/payments/', method: 'POST', data: { student_id: studentIdValue, amount: amountNum } });
      // Minimal JSON with string types
      payloads.push({ url: '/api/fees/payments/', method: 'POST', data: { student_id: String(studentIdValue), amount: String(amountNum) } });
      // Final fallback: explicit allowed method/status
      payloads.push({ url: '/api/fees/payments/', method: 'POST', data: { student_id: String(studentIdValue), amount: String(amountNum), payment_method: 'cash', payment_status: 'completed' } });
      // Full multipart payload with allowed fields
      const fullForm = new FormData();
      fullForm.append('student_id', String(studentIdValue));
      fullForm.append('amount', String(amountNum));
      fullForm.append('payment_date', payment_date);
      fullForm.append('payment_method', paymentMethod);
      fullForm.append('payment_status', 'pending');
      fullForm.append('reference', bkashForm.note || bkashForm.from || `PARENT-${Date.now()}`);
      if (targetAssignmentId) fullForm.append('fee_assignment_id', String(targetAssignmentId));
      payloads.push({ url: '/api/fees/payments/', method: 'POST', data: fullForm });
      // Try variants using 'student' instead of 'student_id'
      payloads.push({ url: '/api/fees/payments/', method: 'POST', data: { student: studentIdValue, amount: amountNum, payment_method: paymentMethod } });
      payloads.push({ url: '/api/fees/payments/', method: 'POST', data: { student: String(studentIdValue), amount: String(amountNum) } });
      const formStudent = new FormData();
      formStudent.append('student', String(studentIdValue));
      formStudent.append('amount', String(amountNum));
      payloads.push({ url: '/api/fees/payments/', method: 'POST', data: formStudent });
      const form = new FormData();
      form.append('student_id', String(studentIdValue));
      form.append('amount', String(amountNum));
      payloads.push({ url: '/api/fees/payments/', method: 'POST', data: form, headers: { 'Content-Type': 'multipart/form-data' } });
      
      // Process the payment attempts
      const result = await processPaymentAttempts(payloads);
      
      // If we get here, payment was successful
      setBkashSubmitted(true);
      setBkashForm({ date: '', amount: '', from: '' });
      
      // Start polling to refresh fees until approved payment reflects
      if (bkashPollRef.current) clearInterval(bkashPollRef.current);
      bkashPollRef.current = setInterval(() => {
        loadFeesData();
      }, 10000);
      
      // Create notification for admin
      try {
        const studentName = selectedChild?.user?.first_name || selectedChild?.name || 'Student';
        const className = selectedChild?.classroom?.name || selectedChild?.classroom_name || 'Class';
        const amountFormatted = amountNum.toLocaleString('en-US');
        
        addNotification({
          title: 'New Payment Request',
          message: `${studentName} (${className}) - ${amountFormatted} BDT`,
          type: 'payment',
          data: {
            studentId: selectedChild.id,
            studentName,
            className,
            amount: amountNum,
            paymentDate: payment_date,
            senderNumber: bkashForm.from,
            status: 'pending'
          },
          priority: 'high'
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
        // Don't fail the payment if notification fails
      }
      
      return result;
      
    } catch (error) {
      console.error('Payment attempt failed:', error);
      let errorMessage = 'Failed to submit payment';
      
      if (error?.response?.data) {
        errorMessage = typeof error.response.data === 'string' 
          ? error.response.data 
          : JSON.stringify(error.response.data, null, 2);
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(`Payment failed: ${errorMessage}`);
      throw error;
    } finally {
      setBkashSubmitting(false);
    }
  };

  const loadParentData = async () => {
    console.log('Starting to load parent data...');
    setLoading(true);
    let parentRes = null;
    let parentUserId = null;
    let parentProfileId = null;
    let parentUsername = '';
    
    try {
      // Try to load parent PROFILE first
      try {
        console.log(`Fetching parent data for ID: ${parentId}`);
        parentRes = await api.get(`/api/users/parents/${parentId}/`);
        console.log('Parent API response:', parentRes);
        
        if (parentRes && parentRes.data) {
          setParentInfo(parentRes.data);
          console.log('Parent data loaded:', parentRes.data);
          parentUserId = parentRes.data.user?.id ?? null;
          parentProfileId = parentRes.data.id ?? null;
          parentUsername = String(parentRes.data.user?.username || '').trim();
          console.log('Parent user ID:', parentUserId, 'Profile ID:', parentProfileId);
        } else {
          console.error('Invalid parent data received:', parentRes);
          throw new Error('Invalid parent data received');
        }
      } catch (e) {
        console.warn('Failed to load parent profile; falling back to treat parentId as user id', e);
        // Fallback: treat URL parentId as a user id
        const asNum = Number(parentId);
        parentUserId = Number.isFinite(asNum) ? asNum : null;
        parentProfileId = null;
        parentRes = null;
      }

      if (!parentUserId) {
        const errorMsg = 'Parent user ID not found';
        console.error(errorMsg);
        toast.error('Parent user information not found');
        console.log('Current state:', { parentId, parentUserId, parentProfileId, parentUsername });
        setLoading(false);
        return;
      }
      
      // If we have parent info but no children, try to load children directly
      if (parentRes?.data?.children?.length === 0) {
        try {
          const childrenRes = await api.get(`/api/users/parents/${parentId}/children/`);
          if (childrenRes?.data?.length > 0) {
            setChildren(childrenRes.data);
            setSelectedChild(childrenRes.data[0]);
            setSelectedTab(0);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.warn('Failed to load children from parent endpoint:', error);
          // Continue with other methods
        }
      }

      // Prefer children provided by parent profile serializer (authoritative and immediate)
      let childrenData = [];
      const profileChildren = Array.isArray(parentRes?.data?.children) ? parentRes.data.children : [];
      if (profileChildren.length) {
        try {
          // Hydrate each child to full student objects to keep downstream UI working
          const detailed = await Promise.all(profileChildren.map(async (c) => {
            try {
              const r = await api.get(`/api/academics/students/${c.id}/`);
              return r.data || null;
            } catch (_) {
              return null;
            }
          }));
          const filtered = detailed.filter(Boolean);
          if (filtered.length) {
            childrenData = filtered;
            setChildren(childrenData);
            setSelectedChild(childrenData[0]);
            setSelectedTab(0);
            setLoading(false);
            return; // Done
          }
        } catch (_) {
          // Ignore and continue with guardian-based discovery
        }
      }

      // Get children (students linked to this parent's user ID)
      console.log('Fetching children for guardian user ID:', parentUserId);
      const isLinkedToParent = (sp) => {
        try {
          const g = sp.guardian;
          // Collect possible guardian IDs from various shapes
          const idCandidates = [
            sp.guardian_id,
            sp.guardian_user,
            sp.guardian_profile,
            sp.parent,
            sp.parent_id,
            (typeof g === 'object' ? g?.id : undefined),
            (typeof g === 'object' ? g?.user?.id : undefined),
            (typeof g === 'number' || typeof g === 'string' ? g : undefined)
          ].filter(v => v !== undefined && v !== null).map(v => String(v));

          const usernameCandidates = [
            sp.guardian_username,
            (typeof g === 'object' ? (g?.username || g?.user?.username) : undefined),
            (typeof g === 'string' ? g : undefined)
          ].filter(v => !!v).map(v => String(v));

          const parentUserIdStr = parentUserId != null ? String(parentUserId) : null;
          const parentProfileIdStr = parentProfileId != null ? String(parentProfileId) : null;

          const byId = idCandidates.some(x => (parentUserIdStr && x === parentUserIdStr) || (parentProfileIdStr && x === parentProfileIdStr));
          const byUsername = usernameCandidates.some(u => u === parentUsername);
          return byId || byUsername;
        } catch (_) {
          return false;
        }
      };
      // Attempt 1: guardian + school
      try {
        const r1 = await api.get(`/api/academics/students/?guardian=${parentUserId}&school=${id}`);
        if (r1 && r1.data) {
          const raw = r1.data;
          const arr = Array.isArray(raw) ? raw : (raw?.results || raw?.data || []);
          childrenData = (arr || []).filter(isLinkedToParent);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (e) {
        console.warn('Primary children fetch by guardian+school failed:', e);
      }
      // Attempt 2: guardian only
      if (!Array.isArray(childrenData) || childrenData.length === 0) {
        try {
          const r2 = await api.get(`/api/academics/students/?guardian=${parentUserId}`);
          const raw2 = r2.data;
          const arr2 = Array.isArray(raw2) ? raw2 : (raw2?.results || raw2?.data || []);
          childrenData = (arr2 || []).filter(isLinkedToParent);
        } catch (e2) {
          console.warn('Secondary children fetch by guardian failed:', e2);
        }
      }
      // Attempt 3: guardian_id + school
      if (!Array.isArray(childrenData) || childrenData.length === 0) {
        try {
          console.log('Guardian filter returned empty. Falling back to school filter and local match...');
          // Try school direct
          const res2 = await api.get(`/api/academics/students/?school=${id}`);
          const all = Array.isArray(res2.data) ? res2.data : (res2.data?.results || res2.data?.data || []);
          const parentUser = parentRes?.data?.user || {};
          const pFullName = `${parentUser.first_name || ''} ${parentUser.last_name || ''}`.trim();
          const pFirst = (parentUser.first_name || '').trim();
          const pLast = (parentUser.last_name || '').trim();
          const pUsername = (parentUser.username || parentUsername || '').trim();

          const normalize = (s) => (s || '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
            .replace(/[\s\-_.]+/g, ' ') // collapse separators
            .trim()
            .toLowerCase();

          const nFull = normalize(pFullName);
          const nFirst = normalize(pFirst);
          const nLast = normalize(pLast);
          const nUser = normalize(pUsername);

          childrenData = all.filter(sp => {
            const g = sp.guardian;
            const gidRaw = sp.guardian_id ?? (typeof g === 'object' ? g?.id : g);
            const gidStr = gidRaw != null ? String(gidRaw) : null;
            const parentUserIdStr = parentUserId != null ? String(parentUserId) : null;
            const parentProfileIdStr = parentProfileId != null ? String(parentProfileId) : null;

            const byId = (gidStr && parentUserIdStr && gidStr === parentUserIdStr) || (gidStr && parentProfileIdStr && gidStr === parentProfileIdStr);
            const byGuardianUsernameObj = (typeof g === 'object') && (String(g?.username || '') === pUsername);
            const byGuardianUsernameStr = (typeof g === 'string') && (String(g) === pUsername);
            return byId || byGuardianUsernameObj || byGuardianUsernameStr;
          });
          // If still empty, try classroom__school filter on server (alternative backend filter)
          if (!childrenData.length) {
            const res3 = await api.get(`/api/academics/students/?classroom__school=${id}&guardian=${parentUserId}`);
            const raw3 = res3.data;
            const arr3 = Array.isArray(raw3) ? raw3 : (raw3?.results || raw3?.data || []);
            if (Array.isArray(arr3) && arr3.length) childrenData = arr3;
          }
        } catch (e2) {
          console.warn('Fallback children fetch by school failed:', e2);
        }
      }

      console.log('Children data (final):', childrenData);
      setChildren(childrenData || []);

      // Auto-select first child and default to Attendance
      if (Array.isArray(childrenData) && childrenData.length > 0) {
        setSelectedChild(childrenData[0]);
        setSelectedTab(0);
      } else {
        setSelectedChild(null);
      }
    } catch (error) {
      console.error('Error loading parent data:', error);
      toast.error('Failed to load parent data');
    } finally {
      setLoading(false);
    }
  };

  const loadChildData = async () => {
    if (!selectedChild) return;

    try {
      if (selectedTab === 0) {
        // Attendance first
        await loadAttendanceData();
      } else if (selectedTab === 1) {
        // Result second
        await loadLatestResult();
      } else if (selectedTab === 2) {
        // Load fees/ledger
        await loadFeesData();
      }
    } catch (error) {
      console.error('Failed to load child data:', error);
    }
  };

  const loadLatestResult = async () => {
    try {
      // Get latest exam results for the student
      const res = await api.get(
        `/api/results/results/?student=${selectedChild.id}`
      );
      
      if (res.data && res.data.length > 0) {
        // Group by exam
        const examMap = {};
        res.data.forEach(result => {
          const examId = result.examination?.id;
          if (!examMap[examId]) {
            examMap[examId] = {
              examination: result.examination,
              results: []
            };
          }
          examMap[examId].results.push(result);
        });

        // Get the latest exam
        const examsArr = Object.values(examMap);
        const latestExam = examsArr.sort((a, b) => new Date(b.examination?.exam_date || 0) - new Date(a.examination?.exam_date || 0))[0] || examsArr[0];
        setResultData(latestExam);
      } else {
        setResultData(null);
      }
    } catch (error) {
      console.error('Failed to load results:', error);
      setResultData(null);
    }
  };

  const loadAttendanceData = async () => {
    try {
      // Get current month attendance
      const currentMonth = dayjs().format('YYYY-MM');
      const res = await api.get(
        `/api/attendance/records/monthly_report/?school=${id}&month=${currentMonth}&classroom=${selectedChild.classroom?.id}`
      );

      // Find this student's data
      const studentData = res.data?.find(r => r.student_id === selectedChild.id);
      setAttendanceData(studentData || null);

      // Build date-wise absent list for current month
      await loadAbsentDatesForMonth(currentMonth);
    } catch (error) {
      console.error('Failed to load attendance:', error);
      setAttendanceData(null);
      setAbsentDates([]);
    }
  };

  const loadAbsentDatesForMonth = async (monthStr) => {
    try {
      setAbsentLoading(true);
      const [year, month] = monthStr.split('-').map(n => parseInt(n, 10));
      const daysInMonth = dayjs(`${monthStr}-01`).daysInMonth();
      const dates = Array.from({ length: daysInMonth }, (_, i) => dayjs(new Date(year, month - 1, i + 1)).format('YYYY-MM-DD'));

      const sid = selectedChild.id;
      const requests = dates.map(d => api.get(`/api/attendance/records/?school=${id}&student=${sid}&date=${d}`)
        .then(r => ({ date: d, records: Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []) }))
        .catch(() => ({ date: d, records: [] }))
      );

      const results = await Promise.allSettled(requests);
      const absents = [];
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { date, records } = r.value;
        // Only count explicit records marked absent; missing records are ignored
        const rec = records[0];
        if (rec && rec.present === false) absents.push(date);
      }
      setAbsentDates(absents);
    } finally {
      setAbsentLoading(false);
    }
  };

  // Constants for Bengali month names
  const MONTHS_BN = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

  // Helper function to get fee structure label in Bengali
  const getStructureLabel = (s, fallback) => {
    if (!s) return fallback;
    const { frequency, academic_year, category, name, title, label, month, type, month_no, month_number, exam_code, exam_type, exam, _month_inferred } = s;
    const freq = String(frequency || '').toLowerCase();
    const catName = (category && (category.name || category.title)) || type || '';
    const m = Number(month || month_no || month_number || _month_inferred || 0);
    const rawName = String(name || title || label || '').toLowerCase();
    let examStr = String(exam_code || exam_type || exam || '').toLowerCase();
    if (!examStr) {
      if (/annual|final|বার্ষিক/.test(rawName)) examStr = 'annual';
      else if (/half|half_yearly|mid|অর্ধ/.test(rawName)) examStr = 'half';
      else if (/session|সেশন/.test(rawName)) examStr = 'session';
      else if (/monthly|মাসিক/.test(rawName)) examStr = 'monthly';
      else if (/exam|পরীক্ষা/.test(rawName)) examStr = 'exam';
    }

    // Monthly tuition: show Bengali month name only
    const isTuition = String(catName || '').toLowerCase().includes('tuition') || freq === 'monthly';
    if (isTuition) {
      if (m >= 1 && m <= 12) return `মাসিক বেতন(${MONTHS_BN[m - 1]})`;
      return 'মাসিক বেতন';
    }

    // One-time exams: map to Bengali labels
    if (freq === 'one_time' || String(catName).toLowerCase().includes('exam')) {
      let typeBn = 'পরীক্ষা';
      if (['half','half_yearly','mid'].includes(examStr)) typeBn = 'অর্ধ-বার্ষিকী';
      else if (['annual','final'].includes(examStr)) typeBn = 'বার্ষিক';
      else if (['session'].includes(examStr)) typeBn = 'সেশন';
      else if (['test','monthly'].includes(examStr)) typeBn = 'মাসিক';
      return `পরীক্ষার ফি(${typeBn})`;
    }

    // Fallbacks
    if (catName) return catName;
    return fallback || 'ফি';
  };

  const loadFeesData = async () => {
    if (!selectedChild) {
      console.log('No selected child, skipping fee data load');
      return;
    }

    try {
      setFeesLoading(true);
      console.log('Loading fee data for student:', selectedChild.id);

      // Initialize default values
      let feeSummary = {
        total_amount: 0,
        paid_amount: 0,
        due_amount: 0,
        monthly_fee: 0
      };

      // 1. Fetch fee assignments and payments in parallel
      const [assignmentsRes, paymentsRes, feeStructuresRes] = await Promise.allSettled([
        api.get(`/api/fees/assignments/?student_id=${selectedChild.id}`),
        api.get(`/api/fees/payments/?student=${selectedChild.id}`),
        api.get(`/api/fees/fees/?classroom=${selectedChild.classroom?.id || ''}`)
      ]);

      // Process fee structures with robust fallbacks
      let feeStructures = [];
      if (feeStructuresRes.status === 'fulfilled' && feeStructuresRes.value?.data) {
        const data = feeStructuresRes.value.data;
        feeStructures = Array.isArray(data) ? data : (data.results || data.data || []);
      }
      if (!feeStructures || feeStructures.length === 0) {
        const clsId = selectedChild.classroom?.id || '';
        const endpoints = [
          `/api/fees/fees/?classroom=${clsId}`,
          `/api/fees/fee-structures/?classroom=${clsId}`,
          `/api/fees/structures/?classroom=${clsId}`,
          `/api/fees/fees/?classroom_id=${clsId}`,
          `/api/fees/fee-structures/?classroom_id=${clsId}`,
          `/api/fees/structures/?classroom_id=${clsId}`,
          `/api/fees/fees/?class_id=${clsId}`,
          `/api/fees/fee-structures/?class_id=${clsId}`,
          `/api/fees/structures/?class_id=${clsId}`
        ];
        for (const ep of endpoints) {
          try {
            const r = await api.get(ep);
            const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
            if (Array.isArray(arr) && arr.length) { feeStructures = arr; break; }
          } catch (_) { /* try next */ }
        }
      }

      // Process assignments
      let assignments = [];
      if (assignmentsRes.status === 'fulfilled' && assignmentsRes.value?.data) {
        const data = assignmentsRes.value.data;
        assignments = Array.isArray(data) ? data : (data.results || data.data || []);
      }

      // If no assignments, try to create from fee structures
      if (assignments.length === 0 && feeStructures.length > 0) {
        assignments = feeStructures.map(struct => ({
          id: `struct-${struct.id || Math.random().toString(36).substr(2, 9)}`,
          fee_structure: struct,
          amount: struct.amount || struct.default_amount || 0,
          custom_amount: null,
          discount_amount: 0,
          discount_percentage: 0,
          due_date: null
        }));
      }

      // Process payments
      let payments = [];
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value?.data) {
        const data = paymentsRes.value.data;
        payments = Array.isArray(data) ? data : (data.results || data.data || []);
      }
      const sidStr = String(selectedChild.id);
      payments = (payments || []).filter(p => {
        const sid = p.student_id ?? p.studentId ?? (p.student?.id || p.student);
        return sid ? String(sid) === sidStr : false;
      });

      // Calculate payment totals by assignment (only approved/completed payments)
      const sumByAssign = {};
      for (const pay of payments) {
        const statusRaw = String(pay.payment_status || pay.status || '').toLowerCase();
        const isCompleted = statusRaw === 'completed' || statusRaw === 'success';
        if (!isCompleted) continue;
        const aid = String(pay.assignment_id || pay.assignment || pay.fee_assignment || '');
        if (!aid) continue;
        sumByAssign[aid] = (sumByAssign[aid] || 0) + Number(pay.amount || pay.paid_amount || 0);
      }

      // Create fee rows from assignments
      let feeRows = assignments.map(assignment => {
        const feeStruct = assignment.fee_structure || {};
        const amount = parseFloat(assignment.custom_amount ?? assignment.amount ?? feeStruct.amount ?? 0);
        const paid = parseFloat(sumByAssign[String(assignment.id)] || 0);
        const due = Math.max(0, amount - paid);
        
        // Get fee name with proper Bengali formatting
        let name = getStructureLabel(feeStruct, feeStruct.name || 'ফি');
        
        // If it's a monthly fee without month in name, try to infer it
        if ((feeStruct.frequency === 'monthly' || feeStruct.type === 'monthly') && !name.includes('(')) {
          const monthMatch = feeStruct.name?.match(/(\d+)/);
          const monthNum = monthMatch ? parseInt(monthMatch[1]) : 0;
          if (monthNum >= 1 && monthNum <= 12) {
            name = `মাসিক বেতন(${MONTHS_BN[monthNum - 1]})`;
          }
        }
        
        return {
          id: assignment.id,
          name,
          amount,
          paid,
          due,
          due_date: assignment.due_date
        };
      });
      
      // Sort fee rows: monthly fees first (in month order), then others
      const monthsBn = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
      feeRows.sort((a, b) => {
        // Try to extract month from name
        const getMonthIndex = (name) => {
          const match = name.match(/\(([^)]+)\)/);
          if (!match) return -1;
          const monthName = match[1];
          return monthsBn.indexOf(monthName);
        };
        
        const aMonth = getMonthIndex(a.name);
        const bMonth = getMonthIndex(b.name);
        
        // Both have months, sort by month
        if (aMonth >= 0 && bMonth >= 0) return aMonth - bMonth;
        // Only a has month, a comes first
        if (aMonth >= 0) return -1;
        // Only b has month, b comes first
        if (bMonth >= 0) return 1;
        // Neither has month, sort by name
        return a.name.localeCompare(b.name);
      });
      
      // Calculate totals
      const totalFees = feeRows.reduce((sum, row) => sum + (row.amount || 0), 0);
      const totalPaid = feeRows.reduce((sum, row) => sum + (row.paid || 0), 0);
      
      // Get current month data
      const currentMonth = dayjs().format('M');
      const currentMonthName = monthsBn[parseInt(currentMonth) - 1];
      const currentMonthFee = feeRows.find(row => row.name.includes(currentMonthName)) || { amount: 0, paid: 0, due: 0 };
      
      // Format payments for display
      const formattedPayments = payments.map(payment => ({
        id: payment.id || Math.random().toString(36).substr(2, 9),
        date: payment.payment_date || payment.date || dayjs().format('YYYY-MM-DD'),
        formattedDate: dayjs(payment.payment_date || payment.date).isValid() 
          ? dayjs(payment.payment_date || payment.date).format('D/M/YYYY')
          : 'তারিখ অজানা',
        amount: parseFloat(payment.amount || 0),
        description: payment.purpose || payment.note || 'ফি পরিশোধ',
        payment_method: payment.payment_method || 'নগদ',
        status: (payment.status || 'completed').toLowerCase() === 'completed' ? 'completed' : 'pending',
        reference: payment.reference || ''
      }));
      
      // Group fees by type (monthly vs exam)
      const monthlyFees = feeRows.filter(row => row.name.includes('মাসিক বেতন'));
      let examFees = feeRows.filter(row => !row.name.includes('মাসিক বেতন'));
      try {
        const today = new Date();
        examFees = examFees.filter(r => {
          try {
            const dd = r.due_date ? new Date(r.due_date) : null;
            return !!dd && dd <= today;
          } catch (_) { return true; }
        });
      } catch (_) {}
      
      // Calculate totals (limit monthly to running month)
      const currentMonthNoCalc = Number(dayjs().format('M'));
      const getMonthIdx = (row) => {
        const nm = String(row.name || '');
        const paren = nm.match(/\(([^)]+)\)/);
        if (paren && paren[1]) {
          const idx = monthsBn.indexOf(paren[1]);
          if (idx >= 0) return idx + 1;
        }
        for (let i = 0; i < monthsBn.length; i++) {
          if (nm.includes(monthsBn[i])) return i + 1;
        }
        const numMatch = nm.match(/(\d{1,2})/);
        if (numMatch) {
          const n = parseInt(numMatch[1], 10);
          if (n >= 1 && n <= 12) return n;
        }
        return null;
      };
      const withInfo = monthlyFees.map(r => ({ r, m: getMonthIdx(r) })).filter(x => x.m != null);
      let monthlyTotal = 0;
      let monthlyPaid = 0;
      if (withInfo.length > 0) {
        const filtered = withInfo.filter(x => Number(x.m) <= currentMonthNoCalc).map(x => x.r);
        monthlyTotal = filtered.reduce((sum, row) => sum + (row.amount || 0), 0);
        monthlyPaid = filtered.reduce((sum, row) => sum + (row.paid || 0), 0);
      } else if (monthlyFees.length === 1) {
        monthlyTotal = Number(monthlyFees[0].amount || 0) * currentMonthNoCalc;
        monthlyPaid = Number(monthlyFees[0].paid || 0);
      } else {
        const ordered = monthlyFees.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        const sliced = ordered.slice(0, currentMonthNoCalc);
        monthlyTotal = sliced.reduce((sum, row) => sum + (row.amount || 0), 0);
        monthlyPaid = sliced.reduce((sum, row) => sum + (row.paid || 0), 0);
      }
      const examTotal = examFees.reduce((sum, row) => sum + (row.amount || 0), 0);
      const examPaid = examFees.reduce((sum, row) => sum + (row.paid || 0), 0);
      
      // Current month data
      const currentMonthNum = dayjs().format('M');
      const currentMonthNameBn = MONTHS_BN[parseInt(currentMonthNum) - 1];
      const currentMonthFeeData = monthlyFees.find(row => row.name.includes(currentMonthNameBn)) || { amount: 0, paid: 0 };
      
      // Calculate overall totals
      const totalFeesAmount = monthlyTotal + examTotal;
      const totalPaidAmount = monthlyPaid + examPaid;
      
      // Build final fees data
      let feesData = {
        monthly_fees: monthlyFees,
        exam_fees: examFees,
        current_month: {
          name: currentMonthNameBn,
          total_amount: currentMonthFeeData.amount || 0,
          paid_amount: currentMonthFeeData.paid || 0,
          due_amount: Math.max(0, (currentMonthFeeData.amount || 0) - (currentMonthFeeData.paid || 0)),
          status: ((currentMonthFeeData.amount || 0) > 0 && (currentMonthFeeData.paid || 0) >= (currentMonthFeeData.amount || 0)) ? 'paid' : 'unpaid'
        },
        totals: {
          monthly: monthlyTotal,
          monthly_paid: monthlyPaid,
          exam: examTotal,
          exam_paid: examPaid,
          total: totalFeesAmount,
          total_paid: totalPaidAmount,
          total_due: Math.max(0, totalFeesAmount - totalPaidAmount),
        },
        payments: formattedPayments
      };
      
      console.log('Fees data loaded:', feesData);
      
      // If no fee data is found but we have payments, update the status
      if (feesData.totals.total === 0 && formattedPayments.length > 0) {
        console.log('No fee data found, but payment history exists');
        
        // Update payments in feesData
        feesData = {
          ...feesData,
          payments: formattedPayments,
          totals: {
            ...feesData.totals,
            total_paid: formattedPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
          }
        };
      }

      // Ensure we have valid numbers (handle any NaN cases)
      const safeFeesData = {
        ...feesData,
        totals: {
          monthly: parseFloat(feesData.totals?.monthly) || 0,
          monthly_paid: parseFloat(feesData.totals?.monthly_paid) || 0,
          exam: parseFloat(feesData.totals?.exam) || 0,
          exam_paid: parseFloat(feesData.totals?.exam_paid) || 0,
          total: parseFloat(feesData.totals?.total) || 0,
          total_paid: parseFloat(feesData.totals?.total_paid) || 0,
          total_due: parseFloat(feesData.totals?.total_due) || 0,
        },
        current_month: {
          total_amount: parseFloat(feesData.current_month?.total_amount) || 0,
          paid_amount: parseFloat(feesData.current_month?.paid_amount) || 0,
          due_amount: parseFloat(feesData.current_month?.due_amount) || 0,
          status: feesData.current_month?.status || 'unpaid'
        }
      };

      console.log('Final fees data:', safeFeesData);

      // Update all fee-related states
      const newFeeTotals = { 
        amount: safeFeesData.totals.total,
        paid: safeFeesData.totals.total_paid,
        due: safeFeesData.totals.total_due
      };
      
      console.log('Setting fee totals:', newFeeTotals);
      setFeeTotals(newFeeTotals);
      
      console.log('Setting fees data:', safeFeesData);
      setFeesData(safeFeesData);
      
      console.log('Setting fee payments:', formattedPayments);
      setFeePayments(formattedPayments);
      
      // Create fee rows for display
      const newFeeRows = [
        {
          id: 'current_month',
          name: 'বর্তমান মাসের ফি',
          amount: safeFeesData.current_month.total_amount,
          paid: safeFeesData.current_month.paid_amount,
          due: safeFeesData.current_month.due_amount,
          status: safeFeesData.current_month.status
        }
      ];
      
      console.log('Setting fee rows:', newFeeRows);
      setFeeRows(newFeeRows);
    } catch (error) {
      console.error('Error in loadFeesData:', error);
      // Set default values on error
      const defaultFeesData = {
        current_month: {
          total_amount: 0,
          paid_amount: 0,
          due_amount: 0,
          status: 'unpaid'
        },
        total_fees: 0,
        total_paid: 0,
        total_due: 0,
        average_monthly_fee: 0,
        payments: []
      };
      
      console.log('Setting default fees data due to error');
      setFeesData(defaultFeesData);
      setFeeTotals({ amount: 0, paid: 0, due: 0 });
      setFeeRows([]);
      setFeePayments([]);
    } finally {
      console.log('Finished loading fee data');
      setFeesLoading(false);
    }
  };

  // Load fees data when the component mounts, when tab changes, or when selected child changes
  useEffect(() => {
    // Load fees data when the fees tab is selected and we have a selected child
    if (selectedTab === 2 && selectedChild) {
      console.log('Fees tab selected with child:', selectedChild.id);
      
      // Force reload data
      setFeesData(null);
      setFeeTotals({ amount: 0, paid: 0, due: 0 });
      loadFeesData();
      
      // Also try to load after a short delay in case of race conditions
      const timeoutId = setTimeout(() => {
        console.log('Delayed fee data refresh');
        loadFeesData();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
    
    // Set up focus and interval for auto-refresh
    const onFocus = () => {
      if (document.visibilityState === 'visible' && selectedTab === 2 && selectedChild) {
        console.log('Tab refocused, refreshing fee data');
        loadFeesData();
      }
    };
    
    // Add focus event listener
    window.addEventListener('focus', onFocus);
    
    // Set up auto-refresh interval (every 15 seconds)
    const interval = setInterval(() => {
      if (selectedTab === 2 && selectedChild) {
        console.log('Auto-refreshing fee data');
        loadFeesData();
      }
    }, 15000);
    
    // Cleanup function
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [selectedTab, selectedChild]);

  useEffect(() => {
    if (!bkashSubmitted) return;

    const onApproved = (e) => {
      if (e.detail && e.detail.amount) {
        setBkashPendingAmount(prev => prev - e.detail.amount);
        setOptimisticApproved(prev => prev + e.detail.amount);
        setBkashSubmitted(false);
        setBkashSubmitting(false);
      }
    };
    const onStorage = (e) => {
      if (e.key !== 'paymentApprovedSignal') return;
      try {
        const val = JSON.parse(e.newValue || '{}');
        const sid = val?.student;
        if (!selectedChild || (sid && String(sid) !== String(selectedChild.id))) {
          // Different student; ignore or still refresh
        }
      } catch (_) {}
      loadFeesData();
      setBkashSubmitted(false);
    };
    window.addEventListener('paymentApproved', onApproved);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('paymentApproved', onApproved);
      window.removeEventListener('storage', onStorage);
    };
  }, [selectedChild?.id]);

  const downloadPDF = async (type) => {
    if (!reportRef.current) return;

    toast.info('Generating PDF... Please wait');

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      const fileName = `${selectedChild.user?.first_name}_${type}_${dayjs().format('YYYY-MM-DD')}.pdf`;
      pdf.save(fileName);
      
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // Helper functions
  const getGradeColor = (marks, total) => {
    if (!marks && marks !== 0) return 'text.secondary';
    const percentage = (marks / total) * 100;
    if (percentage >= 80) return 'success.main';
    if (percentage >= 60) return 'warning.main';
    return 'error.main';
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 90) return 'success';
    if (percentage >= 75) return 'primary';
    if (percentage >= 60) return 'warning';
    return 'error';
  };

  // Define parentName
  const parentName = parentInfo?.user 
    ? `${parentInfo.user.first_name || ''} ${parentInfo.user.last_name || ''}`.trim() || parentInfo.user.username
    : 'Parent';

  // Main component return
  return loading ? (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress size={60} />
    </Box>
  ) : (
    <Box sx={{ p: 3 }}>
      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid #eee', py: 2 }}>
          প্রোফাইল এডিট করুন
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
              লিঙ্ক করা শিক্ষার্থীরা
            </Typography>
            {children.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                কোনো লিঙ্ক করা শিক্ষার্থী পাওয়া যায়নি
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {children.map((child) => {
                  // Safely extract the necessary values
                  const childId = child?.id || 'unknown';
                  const firstName = child?.user?.first_name || '';
                  const lastName = child?.user?.last_name || '';
                  const className = typeof child?.classroom === 'object' 
                    ? child.classroom?.name || 'নির্ধারিত হয়নি'
                    : child?.classroom || 'নির্ধারিত হয়নি';
                  const rollNumber = child?.roll_number || 'নির্ধারিত হয়নি';
                  
                  return (
                    <Box 
                      key={childId}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        mb: 1,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        '&:hover': {
                          bgcolor: 'action.hover'
                        }
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2">
                          {firstName} {lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          শ্রেণি: {className} | 
                          রোল: {rollNumber}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        disabled={removingStudentId === childId}
                        onClick={() => {
                          if (!isAuthenticated()) {
                            navigate('/login');
                            return;
                          }
                          handleRemoveStudent(childId);
                        }}
                        startIcon={removingStudentId === childId ? <CircularProgress size={16} /> : <DeleteIcon />}
                      >
                        {removingStudentId === childId ? 'অপসারণ হচ্ছে...' : 'অপসারণ'}
                      </Button>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #eee' }}>
          <Button onClick={handleCloseEditDialog} variant="outlined" color="primary">
            বন্ধ করুন
          </Button>
        </DialogActions>
      </Dialog>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 3,
          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          color: 'white',
          borderRadius: 3
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar
              sx={{
                width: 60,
                height: 60,
                bgcolor: 'white',
                color: 'primary.main',
                fontSize: '2rem'
              }}
            >
              {parentName.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                অভিভাবক ড্যাশবোর্ড
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                আপনার সন্তানের হাজিরা, রেজাল্ট ও ফি দেখুন
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{
              bgcolor: 'white',
              color: 'primary.main',
              '&:hover': { bgcolor: 'grey.100' }
            }}
          >
            অভিভাবক তালিকা
          </Button>
        </Stack>
      </Paper>

      {/* Children Selection */}
      {children.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          এই অভিভাবকের সাথে কোনো ছাত্র/ছাত্রী যুক্ত নেই। দয়া করে সংশ্লিষ্ট ছাত্র-ছাত্রী লিঙ্ক করুন।
        </Alert>
      ) : (
        <>
          {/* Warning if students have incomplete profiles */}
          {children.some(child => !child.classroom || !child.section) && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                ⚠️ কিছু শিক্ষার্থীর প্রোফাইল অসম্পূর্ণ
              </Typography>
              <Typography variant="body2">
                "অসম্পূর্ণ প্রোফাইল" চিহ্নিত শিক্ষার্থীদের শ্রেণি ও শাখা নির্ধারণ করা প্রয়োজন। ছাত্র-ছাত্রী পেজ থেকে তথ্য আপডেট করুন।
              </Typography>
            </Alert>
          )}

          <Paper sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'primary.50' }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <PersonIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  সন্তানের তালিকা ({children.length})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  সন্তানের কার্ডে ক্লিক করলে হাজিরা, রেজাল্ট ও ফি দেখা যাবে
                </Typography>
              </Box>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              {children.map((child) => (
                <Grid item xs={12} sm={6} md={4} key={child.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: selectedChild?.id === child.id ? '3px solid' : '2px solid',
                      borderColor: selectedChild?.id === child.id ? 'primary.main' : 'transparent',
                      bgcolor: selectedChild?.id === child.id ? 'primary.50' : 'white',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6,
                        borderColor: 'primary.light'
                      }
                    }}
                    onClick={() => {
                      setSelectedChild(child);
                      toast.success(`Selected ${child.user?.first_name} ${child.user?.last_name}`);
                      // Scroll to reports section after a short delay
                      setTimeout(() => {
                        reportsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 300);
                    }}
                  >
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar 
                          sx={{ 
                            bgcolor: selectedChild?.id === child.id ? 'primary.main' : 'secondary.main',
                            width: 56,
                            height: 56,
                            fontSize: '1.5rem'
                          }}
                        >
                          {child.user?.first_name?.charAt(0) || 'S'}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            {child.user?.first_name} {child.user?.last_name}
                          </Typography>
                          <Stack spacing={0.5}>
                            <Typography variant="body2" color={child.classroom ? 'text.secondary' : 'warning.main'}>
                              📚 শ্রেণি: {child.classroom?.name || 'নির্ধারিত নয়'}
                            </Typography>
                            <Typography variant="body2" color={child.section ? 'text.secondary' : 'warning.main'}>
                              📖 শাখা: {child.section?.name || 'নির্ধারিত নয়'}
                            </Typography>
                            <Typography variant="body2" color={child.roll_number ? 'text.secondary' : 'warning.main'}>
                              🔢 রোল: {child.roll_number || 'নির্ধারিত নয়'}
                            </Typography>
                          </Stack>
                          {(!child.classroom || !child.section) && (
                            <Chip 
                              label="অসম্পূর্ণ প্রোফাইল" 
                              size="small" 
                              color="warning" 
                              sx={{ mt: 1 }}
                            />
                          )}
                        </Box>
                        {selectedChild?.id === child.id && (
                          <CheckCircleIcon sx={{ color: 'primary.main', fontSize: 32 }} />
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Instruction Message when no child selected */}
          {!selectedChild && (
            <Alert 
              severity="info" 
              icon={<PersonIcon />}
              sx={{ 
                mb: 3,
                fontSize: '1.1rem',
                '& .MuiAlert-message': {
                  width: '100%',
                  textAlign: 'center'
                }
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                👆 রিপোর্ট দেখতে একটি সন্তান নির্বাচন করুন
              </Typography>
              <Typography variant="body2">
                উপরের কার্ড থেকে যেকোনো সন্তান নির্বাচন করুন
              </Typography>
            </Alert>
          )}

          {selectedChild && (
            <HeaderCard elevation={3}>
              <Grid container alignItems="center" spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
                <Grid item>
                  <StyledAvatar
                    src={resolveStudentPhoto(selectedChild)}
                    alt={selectedChild.user?.first_name || 'Student'}
                  />
                </Grid>
                <Grid item xs>
                  <Typography variant="h4" component="h1" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
                    {`${selectedChild.user?.first_name || ''} ${selectedChild.user?.last_name || ''}`.trim() || selectedChild.user?.username}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                    {selectedChild.roll_number && (
                      <Chip 
                        label={`রোল: ${selectedChild.roll_number}`} 
                        color="primary" 
                        variant="outlined" 
                        sx={{ 
                          bgcolor: 'rgba(255,255,255,0.15)', 
                          color: 'white',
                          borderColor: 'rgba(255,255,255,0.3)'
                        }} 
                      />
                    )}
                    {selectedChild.classroom?.name && (
                      <Chip 
                        label={`শ্রেণী: ${selectedChild.classroom.name}`} 
                        color="primary" 
                        variant="outlined" 
                        sx={{ 
                          bgcolor: 'rgba(255,255,255,0.15)', 
                          color: 'white',
                          borderColor: 'rgba(255,255,255,0.3)'
                        }} 
                      />
                    )}
                  </Box>
                </Grid>
                {schoolInfo?.logo && (
                  <Grid item sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: { xs: 'center', sm: 'flex-end' },
                    mt: { xs: 2, sm: 0 },
                    width: { xs: '100%', sm: 'auto' },
                    textAlign: { xs: 'center', sm: 'inherit' }
                  }}>
                    <SchoolLogo 
                      src={getMediaUrl(schoolInfo.logo)} 
                      alt={schoolInfo.name || 'School Logo'}
                    />
                    {schoolInfo.name && (
                      <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 1 }}>
                        {schoolInfo.name}
                      </Typography>
                    )}
                  </Grid>
                )}
              </Grid>
            </HeaderCard>
          )}

          {/* Tabs for Results and Attendance */}
          {selectedChild && (
            <Box ref={reportsRef}>
              <Paper sx={{ mb: 3, borderRadius: 2 }}>
                <Tabs
                  value={selectedTab}
                  onChange={(e, newValue) => setSelectedTab(newValue)}
                  sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                  <Tab
                    icon={<CalendarIcon />}
                    label="হাজিরা"
                    iconPosition="start"
                  />
                  <Tab
                    icon={<AssessmentIcon />}
                    label="রেজাল্ট কার্ড"
                    iconPosition="start"
                  />
                  <Tab
                    icon={<ReceiptLongIcon />}
                    label="ফি"
                    iconPosition="start"
                  />
                </Tabs>
              </Paper>

              {/* Action Buttons */}
              <Stack direction="row" spacing={2} sx={{ mb: 3 }} justifyContent="center">
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={() => downloadPDF(selectedTab === 1 ? 'Result' : selectedTab === 0 ? 'Attendance' : 'Fees')}
                >
                  ডাউনলোড PDF
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={() => window.print()}
                >
                  প্রিন্ট
                </Button>
              </Stack>

              {/* Attendance Tab */}
              {selectedTab === 0 && (
                <Paper ref={reportRef} sx={{ p: 4, borderRadius: 2 }}>
                  {/* Attendance summary card styling same container */}
                  {attendanceData ? (
                    <>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>হাজিরা সংক্ষিপ্তসার</Typography>
                        <Typography variant="subtitle2" color="text.secondary">{monthYearBn}</Typography>
                      </Stack>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6} sm={3}><Chip label={`মোট দিন: ${attendanceData.total_days || 0}`} color="primary"/></Grid>
                        <Grid item xs={6} sm={3}><Chip label={`উপস্থিত: ${attendanceData.present_days || 0}`} color="success"/></Grid>
                        <Grid item xs={6} sm={3}><Chip label={`অনুপস্থিত: ${attendanceData.absent_days || 0}`} color="error"/></Grid>
                        <Grid item xs={6} sm={3}><Chip label={`শতকরা: ${(attendanceData.attendance_percentage || 0)}%`} color={getAttendanceColor(attendanceData.attendance_percentage || 0)} /></Grid>
                      </Grid>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>বর্তমান মাসের ক্লাসের হাজিরার সারাংশ</Typography>

                      <Divider sx={{ my: 2 }} />
                      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>তারিখ অনুযায়ী অনুপস্থিতি</Typography>
                      {absentLoading ? (
                        <Stack direction="row" alignItems="center" spacing={1}><CircularProgress size={20} /><Typography variant="body2">লোড হচ্ছে...</Typography></Stack>
                      ) : absentDates.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">এই মাসে কোনো অনুপস্থিতির রেকর্ড নেই</Typography>
                      ) : (
                        <Grid container spacing={1}>
                          {absentDates.map(d => (
                            <Grid item key={d}><Chip label={dayjs(d).format('DD MMM YYYY')} color="error" variant="outlined"/></Grid>
                          ))}
                        </Grid>
                      )}
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">কোনো হাজিরার তথ্য পাওয়া যায়নি</Typography>
                  )}
                </Paper>
              )}

              {/* Result Card Tab */}
              {selectedTab === 1 && (
                <Paper ref={reportRef} sx={{ p: 4, borderRadius: 2 }}>
                  {resultData ? (
                    <>
                      {/* Result Card Header */}
                      <Box sx={{ position: 'relative', textAlign: 'center', mb: 4, borderBottom: '3px solid', borderColor: 'primary.main', pb: 2 }}>
                        {/* School Logo - Top Left */}
                        {schoolInfo?.logo && (
                          <Box
                            component="img"
                            src={schoolInfo.logo.startsWith('http') ? schoolInfo.logo : getMediaUrl(schoolInfo.logo)}
                            alt={schoolInfo?.name || 'School Logo'}
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '80px',
                              height: '80px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '2px solid',
                              borderColor: 'primary.main',
                              boxShadow: 2
                            }}
                          />
                        )}
                        
                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                          {schoolInfo?.name || 'School Name'}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                          {schoolInfo?.address || 'School Address'}
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 2, fontWeight: 'bold', color: '#424242' }}>
                          পরীক্ষার ফলাফল কার্ড
                        </Typography>
                        <Typography variant="subtitle2" color="text.secondary">
                          {resultData.exam?.name || 'পরীক্ষা'} - {new Date().getFullYear()}
                        </Typography>
                      </Box>

                      {/* Student Info */}
                      <Grid container spacing={2} sx={{ mb: 3, bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">শিক্ষার্থীর নাম:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {selectedChild.user?.first_name} {selectedChild.user?.last_name}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">রোল নম্বর:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {selectedChild.roll_number || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">শ্রেণি:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {selectedChild.classroom?.name || 'N/A'} {selectedChild.section?.name ? `(${selectedChild.section.name})` : ''}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">অভিভাবক:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {parentName}
                          </Typography>
                        </Grid>
                      </Grid>

                      {/* Marks Table */}
                      <Table sx={{ border: '2px solid #000', mb: 3 }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'primary.main' }}>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff' }}>বিষয়</TableCell>
                            <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff' }}>লিখিত</TableCell>
                            <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff' }}>এমসিকিউ</TableCell>
                            <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff' }}>ব্যবহারিক</TableCell>
                            <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff' }}>মোট</TableCell>
                            <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff' }}>গ্রেড</TableCell>
                            <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff' }}>GPA</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {resultData.results.map((result, index) => (
                            <TableRow key={index}>
                              <TableCell sx={{ fontWeight: 500, border: '1px solid #ddd' }}>
                                {result.subject?.name || 'N/A'}
                              </TableCell>
                              <TableCell align="center" sx={{ border: '1px solid #ddd' }}>
                                {result.written_marks || 0}
                              </TableCell>
                              <TableCell align="center" sx={{ border: '1px solid #ddd' }}>
                                {result.mcq_marks || 0}
                              </TableCell>
                              <TableCell align="center" sx={{ border: '1px solid #ddd' }}>
                                {result.practical_marks || 0}
                              </TableCell>
                              <TableCell align="center" sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                {result.total_obtained || 0}
                              </TableCell>
                              <TableCell align="center" sx={{ border: '1px solid #ddd' }}>
                                <Chip
                                  label={result.grade || 'N/A'}
                                  color={getGradeColor(result.total_obtained, result.examination?.total_marks || 100)}
                                  size="small"
                                  sx={{ fontWeight: 'bold' }}
                                />
                              </TableCell>
                              <TableCell align="center" sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                {result.gpa || '0.00'}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell colSpan={4} sx={{ fontWeight: 'bold', fontSize: '1.1rem', border: '2px solid #000' }}>
                              মোট
                            </TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '1.1rem', border: '2px solid #000' }}>
                              {resultData.results.reduce((sum, r) => sum + (parseFloat(r.total_obtained) || 0), 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="center" sx={{ border: '2px solid #000' }}>
                              <Chip
                                label={resultData.results[0]?.grade || 'N/A'}
                                color="primary"
                                sx={{ fontWeight: 'bold' }}
                              />
                            </TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'primary.main', border: '2px solid #000' }}>
                              {(resultData.results.reduce((sum, r) => sum + (parseFloat(r.gpa) || 0), 0) / resultData.results.length).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>

                      {/* Grading Scale */}
                      <Box sx={{ mb: 3, p: 2, bgcolor: '#fafafa', borderRadius: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>গ্রেডিং স্কেল:</Typography>
                        <Grid container spacing={1}>
                          {[
                            { grade: 'A+', range: '80-100', gpa: '5.00' },
                            { grade: 'A', range: '70-79', gpa: '4.00' },
                            { grade: 'A-', range: '60-69', gpa: '3.50' },
                            { grade: 'B', range: '50-59', gpa: '3.00' },
                            { grade: 'C', range: '40-49', gpa: '2.00' },
                            { grade: 'D', range: '33-39', gpa: '1.00' },
                            { grade: 'F', range: '0-32', gpa: '0.00' }
                          ].map((item) => (
                            <Grid item xs={6} sm={4} md={3} key={item.grade}>
                              <Typography variant="caption">
                                <strong>{item.grade}</strong>: {item.range} ({item.gpa})
                              </Typography>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>

                      {/* Footer */}
                      <Box sx={{ mt: 4, pt: 3, borderTop: '2px solid #e0e0e0' }}>
                        <Grid container spacing={4}>
                          <Grid item xs={4} sx={{ textAlign: 'center' }}>
                            <Divider sx={{ mb: 1, borderColor: '#000', width: '80%', mx: 'auto' }} />
                            <Typography variant="caption">Class Teacher</Typography>
                          </Grid>
                          <Grid item xs={4} sx={{ textAlign: 'center' }}>
                            <Divider sx={{ mb: 1, borderColor: '#000', width: '80%', mx: 'auto' }} />
                            <Typography variant="caption">Principal</Typography>
                          </Grid>
                          <Grid item xs={4} sx={{ textAlign: 'center' }}>
                            <Divider sx={{ mb: 1, borderColor: '#000', width: '80%', mx: 'auto' }} />
                            <Typography variant="caption">Guardian's Signature</Typography>
                          </Grid>
                        </Grid>
                        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 3, color: 'text.secondary' }}>
                          Date of Issue: {new Date().toLocaleDateString('en-GB')}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Alert severity="info">
                      No exam results available for this student yet.
                    </Alert>
                  )}
                </Paper>
              )}

              {/* Fees Tab */}
              {selectedTab === 2 && (
                <Paper ref={reportRef} sx={{ p: 4, borderRadius: 2 }}>
                  {feesLoading ? (
                    <Box display="flex" justifyContent="center" p={4}>
                      <CircularProgress />
                      <Typography variant="body2" sx={{ ml: 2, alignSelf: 'center' }}>
                        ফির তথ্য লোড হচ্ছে...
                      </Typography>
                    </Box>
                  ) : feesData ? (
                    <>
                      <Box sx={{ position: 'relative', textAlign: 'center', mb: 4 }}>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>ফি বিবরণ</Typography>
                        <Divider sx={{ my: 2 }} />
                      </Box>
                      
                      <Grid container spacing={3}>
                        {/* Current Month Fee section removed as per requirement */}

                        {/* Overall Fee Summary */}
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                              সামগ্রিক ফি সারাংশ
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={2}>
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">মোট ফি:</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                  ৳{feeTotals.amount || '0.00'}
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">মোট পরিশোধিত:</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                  ৳{feeTotals.paid || '0.00'}
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">মোট বাকি:</Typography>
                                <Typography variant="h6" sx={{ 
                                  fontWeight: 'bold', 
                                  color: (feeTotals.due || 0) > 0 ? 'error.main' : 'success.main'
                                }}>
                                  ৳{feeTotals.due || '0.00'}
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">মাসিক গড় ফি:</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                  {(() => {
                                    const currentMonthNum = parseInt(dayjs().format('M'), 10);
                                    const currentMonthNameBn = MONTHS_BN[currentMonthNum - 1];
                                    const monthlyFees = feesData?.monthly_fees || [];
                                    const currentItem = monthlyFees.find(row => String(row.name || '').includes(currentMonthNameBn));
                                    const unit = currentItem ? Number(currentItem.amount || 0) :
                                      (monthlyFees.length > 0 ? Number(monthlyFees[0].amount || 0) : 0);
                                    return `৳${unit.toFixed(2)}`;
                                  })()}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Paper>
                        </Grid>

                        {/* Payment Input */}
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                              বকেয়া ফি পরিশোধ করুন
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                  <DatePicker
                                    label="পেমেন্ট তারিখ"
                                    value={bkashForm.date || null}
                                    onChange={(v) => setBkashForm(prev => ({ ...prev, date: v }))}
                                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                                  />
                                </LocalizationProvider>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  label="কত টাকা"
                                  value={bkashForm.amount}
                                  onChange={(e) => setBkashForm(prev => ({ ...prev, amount: e.target.value }))}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="কিভাবে দিয়েছে"
                                  select
                                  value={bkashForm.method}
                                  onChange={(e) => setBkashForm(prev => ({ ...prev, method: e.target.value }))}
                                >
                                  <MenuItem value="BKASH">বিকাশ</MenuItem>
                                  <MenuItem value="CASH">নগদ</MenuItem>
                                  <MenuItem value="BANK">ব্যাংক</MenuItem>
                                </TextField>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="কোন নাম্বার থেকে"
                                  value={bkashForm.from}
                                  onChange={(e) => setBkashForm(prev => ({ ...prev, from: e.target.value }))}
                                />
                              </Grid>
                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="নোট"
                                  value={bkashForm.note}
                                  onChange={(e) => setBkashForm(prev => ({ ...prev, note: e.target.value }))}
                                />
                              </Grid>
                              <Grid item xs={12}>
                                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                  <Button
                                    variant="contained"
                                    startIcon={<SaveIcon />}
                                    disabled={bkashSubmitting}
                                    onClick={submitBkashPayment}
                                  >
                                    জমা দিন
                                  </Button>
                                </Box>
                              </Grid>
                              {bkashSubmitted && (
                                <Grid item xs={12}>
                                  <Alert severity="success">
                                    বকেয়া পরিশোধের জন্য ধন্যবাদ। দয়া করে অপেক্ষা করুন এডমিন অনুমোদন দিলে বকেয়া ফিতে এটা সমন্বয় করা হবে।
                                  </Alert>
                                </Grid>
                              )}
                            </Grid>
                          </Paper>
                        </Grid>

                        {/* Payment History */}
                        <Grid item xs={12}>
                          <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                              পেমেন্টের ইতিহাস
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            {feesData.payments?.length > 0 ? (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>তারিখ</TableCell>
                                    <TableCell>বিবরণ</TableCell>
                                    <TableCell align="right">পরিমাণ</TableCell>
                                    <TableCell>পেমেন্ট পদ্ধতি</TableCell>
                                    <TableCell>স্ট্যাটাস</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {feesData.payments.map((payment, index) => (
                                    <TableRow key={index}>
                                      <TableCell>{new Date(payment.date).toLocaleDateString('bn-BD')}</TableCell>
                                      <TableCell>{payment.description || 'ফি পরিশোধ'}</TableCell>
                                      <TableCell align="right">৳{payment.amount.toFixed(2)}</TableCell>
                                      <TableCell>{payment.payment_method || 'নগদ'}</TableCell>
                                      <TableCell>
                                        <Chip 
                                          label={payment.status === 'completed' ? 'সম্পন্ন' : 'মূল্যায়নাধীন'}
                                          color={payment.status === 'completed' ? 'success' : 'warning'}
                                          size="small"
                                        />
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                                কোনো পেমেন্টের তথ্য পাওয়া যায়নি
                              </Typography>
                            )}
                          </Paper>
                        </Grid>
                      </Grid>
                    </>
                  ) : (
                    <Alert severity="info">
                      কোনো ফির তথ্য পাওয়া যায়নি
                    </Alert>
                  )}
                </Paper>
              )}

              {/* Attendance Card Tab */}
              {selectedTab === 0 && (
                <Paper ref={reportRef} sx={{ p: 4, borderRadius: 2 }}>
                  {attendanceData ? (
                    <>
                      {/* Attendance Card Header */}
                      <Box sx={{ position: 'relative', textAlign: 'center', mb: 4 }}>
                        {/* School Logo - Top Left */}
                        {schoolInfo?.logo && (
                          <Box
                            component="img"
                            src={schoolInfo.logo.startsWith('http') ? schoolInfo.logo : getMediaUrl(schoolInfo.logo)}
                            alt={schoolInfo?.name || 'School Logo'}
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '80px',
                              height: '80px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '2px solid',
                              borderColor: 'primary.main',
                              boxShadow: 2
                            }}
                          />
                        )}
                        
                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                          {schoolInfo?.name || 'School Name'}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                          {schoolInfo?.address || 'School Address'}
                        </Typography>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
                          📅 Attendance Report
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {dayjs().format('MMMM YYYY')}
                        </Typography>
                      </Box>

                      {/* Student Cards */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>সন্তানদের তালিকা</Typography>
                        <Button 
                          variant="outlined" 
                          startIcon={<EditIcon />}
                          onClick={handleOpenEditDialog}
                          size="small"
                        >
                          এডিট প্রোফাইল
                        </Button>
                      </Box>
                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} md={6}>
                          <Stack spacing={1}>
                            <Typography><strong>Student Name:</strong> {attendanceData.student_name}</Typography>
                            <Typography><strong>Class:</strong> {attendanceData.classroom}</Typography>
                            <Typography><strong>Section:</strong> {attendanceData.section}</Typography>
                          </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Stack spacing={1}>
                            <Typography><strong>Roll Number:</strong> {selectedChild.roll_number || 'N/A'}</Typography>
                            <Typography><strong>Month:</strong> {dayjs().format('MMMM YYYY')}</Typography>
                            <Typography><strong>Parent:</strong> {parentName}</Typography>
                          </Stack>
                        </Grid>
                      </Grid>
                    </>
                  ) : (
                    <Alert severity="info">
                      No attendance data available for this student yet.
                    </Alert>
                  )}
                </Paper>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default ParentDashboard;
  const toBnDigits = (s) => String(s).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
  const monthYearBn = `${dayjs().locale('bn').format('MMMM')} ${toBnDigits(dayjs().format('YYYY'))} ইং`;
  const getMediaUrl = (path) => {
    if (!path) return null;
    const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
    const val = String(path);
    if (/^https?:\/\//i.test(val)) return val;
    const normalized = val.replace(/\\/g, '/');
    if (normalized.startsWith('/media/')) return `${base}${normalized}`;
    if (normalized.startsWith('media/')) return `${base}/${normalized}`;
    const clean = normalized.startsWith('/') ? normalized : `/media/${normalized}`;
    return `${base}${clean}`;
  };

  const resolveStudentPhoto = (student) => {
    if (!student) return null;
    const vals = [
      student.photo_url,
      student.profile_picture,
      student.photo,
      student.user?.photo_url,
      student.user?.photo
    ];
    for (const v of vals) {
      if (!v) continue;
      const url = getMediaUrl(v);
      if (url) return url;
    }
    return null;
  };

  const HeaderCard = styled(Paper)(({ theme }) => ({
    background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
    color: 'white',
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
    borderRadius: theme.shape.borderRadius * 2,
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '" "',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(255,255,255,0.1) 0%, transparent 20%)',
      pointerEvents: 'none',
    },
  }));

  const StyledAvatar = styled(Avatar)(({ theme }) => ({
    width: 100,
    height: 100,
    border: '4px solid white',
    boxShadow: theme.shadows[4],
    marginRight: theme.spacing(3),
    [theme.breakpoints.down('sm')]: {
      width: 80,
      height: 80,
      marginRight: 0,
      marginBottom: theme.spacing(2),
    },
  }));

  const SchoolLogo = styled('img')(({ theme }) => ({
    maxHeight: 80,
    maxWidth: 200,
    objectFit: 'contain',
    [theme.breakpoints.down('sm')]: {
      maxHeight: 60,
    },
  }));
