import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Paper,
  TextField,
  MenuItem,
  Stack,
  Grid,
  Divider,
  IconButton,
  Tooltip as MuiTooltip
} from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from 'recharts';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckIcon from '@mui/icons-material/Check';
import { isAuthenticated, login } from '../utils/auth';
import SchoolIcon from '@mui/icons-material/School';
import GroupIcon from '@mui/icons-material/Group';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ClassIcon from '@mui/icons-material/Class';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useToast } from '../components/Toast';
import { useNotifications } from '../context/NotificationContext';

// Swiper imports (12+ compatible)
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';  // <-- 'swiper/modules' ব্যবহার করুন
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

// Dashboard components and service for Admin role
import StatCard from '../components/dashboard/StatCard';
import AttendanceChart from '../components/dashboard/AttendanceChart';
import ClassDistributionChart from '../components/dashboard/ClassDistributionChart';
import FeeCollectionChart from '../components/dashboard/FeeCollectionChart';
import { getDashboardStats } from '../services/dashboardService';

const banglaNumberMap = { 'প্রথম': 1, 'দ্বিতীয়': 2, 'দ্বিতীয়': 2, 'তৃতীয়': 3, 'তৃতীয়': 3, 'চতুর্থ': 4, 'পঞ্চম': 5, 'ষষ্ঠ': 6, 'সপ্তম': 7, 'অষ্টম': 8, 'নবম': 9, 'দশম': 10, 'একাদশ': 11, 'দ্বাদশ': 12, 'ছয়': 6, 'ছয়': 6 };
const bnDigitMap = { '০': 0, '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5, '৬': 6, '৭': 7, '৮': 8, '৯': 9 };
const normalizeBnDigits = (s) => String(s || '').split('').map(ch => (ch in bnDigitMap ? String(bnDigitMap[ch]) : ch)).join('');
const getClassOrder = (name) => {
  const str = normalizeBnDigits(String(name || '')).trim();
  for (const [bangla, num] of Object.entries(banglaNumberMap)) {
    if (str.includes(bangla)) return num;
  }
  const match = str.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  return 999;
};
const computeAdminStatsFallback = async (schoolId) => {
  const results = await Promise.allSettled([
    api.get(`/api/fees/payments/?school=${schoolId}`),
    api.get(`/api/fees/assignments/?school=${schoolId}`),
    api.get(`/api/fees/fees/?school=${schoolId}`),
    api.get(`/api/academics/students/?school=${schoolId}`),
    api.get(`/api/academics/classrooms/?school=${schoolId}`)
  ]);
  const payments = results[0].status === 'fulfilled' ? (results[0].value.data?.results || results[0].value.data || []) : [];
  const assignments = results[1].status === 'fulfilled' ? (results[1].value.data?.results || results[1].value.data || []) : [];
  const feeStructs = results[2].status === 'fulfilled' ? (results[2].value.data?.results || results[2].value.data || []) : [];
  const students = results[3].status === 'fulfilled' ? (results[3].value.data?.results || results[3].value.data || []) : [];
  const classrooms = results[4].status === 'fulfilled' ? (results[4].value.data?.results || results[4].value.data || []) : [];
  let teachers = [];
  try {
    const eps = [
      `/api/academics/teachers/?school=${schoolId}`,
      `/api/academics/teachers/`,
      `/api/users/teachers/?school=${schoolId}`,
      `/api/users/teachers/`,
      `/api/teachers/?school=${schoolId}`,
      `/api/teachers/`
    ];
    for (const ep of eps) {
      try {
        const r = await api.get(ep);
        const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
        if (Array.isArray(arr) && arr.length) { teachers = arr; break; }
      } catch (_) {}
    }
  } catch (_) {}
  const byDate = new Map();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30*24*60*60*1000);
  for (const p of payments) {
    const ds = new Date(p.payment_date || p.date || p.created_at || now);
    if (isNaN(ds) || ds < cutoff) continue;
    const key = ds.toISOString().slice(0,10);
    byDate.set(key, (byDate.get(key) || 0) + Number(p.amount || p.paid_amount || 0));
  }
  const fee_collection = Array.from(byDate.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));
  const structMap = {};
  for (const s of (feeStructs || [])) { structMap[String(s.id)] = s; }
  const studentMap = new Map();
  for (const s of (students || [])) { studentMap.set(String(s.id), s); }
  const paidByAssign = new Map();
  for (const pay of (payments || [])) {
    const aidRaw = pay.assignment_id || pay.assignment || pay.fee_assignment || pay.student_fee_assignment || pay.assignment?.id;
    const aid = aidRaw != null ? String(aidRaw) : '';
    if (!aid) continue;
    const amount = Number(pay.amount || pay.paid_amount || 0) || 0;
    paidByAssign.set(aid, (paidByAssign.get(aid) || 0) + amount);
  }
  const classMap = new Map();
  let tuition_due_total = 0;
  let exam_due_total = 0;
  const seenMonthlyByStudentMonth = new Set();
  for (const a of (assignments || [])) {
    const currentMonthNo = new Date().getMonth() + 1;
    const aid = String(a.id || a._id || a.assignment_id || a.assignment || '');
    if (!aid) continue;
    const feeObj = a.fee_structure || a.fee || {};
    const sid = String(a.fee_structure_id || a.fee_id || feeObj.id || a.fee_structure || a.fee || '');
    const sObj = (typeof feeObj === 'object' && feeObj) ? feeObj : (structMap[sid] || {});
    const baseCandidates = [a.custom_amount, a.amount, a.total_amount, a.payable_amount, a.original_amount, sObj.amount, sObj.default_amount];
    let base = baseCandidates.find(x => x !== undefined && x !== null && Number(x) >= 0);
    base = Number(base || 0);
    const discountAmt = Number(a.discount_amount || 0) || 0;
    const discountPct = Number(a.discount_percentage ?? a.discount_percent ?? a.discount ?? 0) || 0;
    let gross = Math.max(0, base - discountAmt - (base * discountPct / 100));
    const paid = Number(paidByAssign.get(aid) || 0);
    let due = Math.max(0, gross - paid);
    if (due <= 0) continue;
    const stuId = String(a.student_id || a.student || a.studentId || '');
    const stu = studentMap.get(stuId);
    const classId = stu?.classroom?.id ?? stu?.classroom ?? null;
    const classObj = (classrooms || []).find(c => String(c.id) === String(classId));
    const className = classObj?.name || (typeof classId === 'string' || typeof classId === 'number' ? String(classId) : 'Unknown');
    const freq = String((sObj && sObj.frequency) || a.frequency || a.fee_frequency || '').toLowerCase();
    const rtype = freq === 'monthly' ? 'tuition' : (freq === 'one_time' ? 'exam' : 'other');
    try {
      const monthNo = Number(sObj.month || sObj.month_no || sObj.month_number || a.month || 0) || 0;
      const nameStr = String(sObj.name || sObj.title || sObj.label || '').toLowerCase();
      const isHalf = /half|mid|অর্ধ/.test(nameStr);
      const isAnnual = /annual|final|বার্ষিক/.test(nameStr);
      if (rtype === 'tuition') {
        const effectiveMonth = monthNo || currentMonthNo;
        if (monthNo && monthNo > currentMonthNo) continue;
        const seenKey = `${stuId}:${effectiveMonth}`;
        if (seenMonthlyByStudentMonth.has(seenKey)) continue;
        seenMonthlyByStudentMonth.add(seenKey);
        due = Math.max(0, gross - paid);
        if (due <= 0) continue;
      } else if (rtype === 'exam') {
        const targetYear = new Date().getFullYear();
        const ddSrc = sObj.due_date || a.due_date || null;
        let allow = false;
        const currentMonthNo2 = currentMonthNo;
        const allowHalf = isHalf && currentMonthNo2 >= 5;
        const allowAnnual = isAnnual && currentMonthNo2 >= 9;
        let allowOther = false;
        if (!isHalf && !isAnnual && ddSrc) {
          try {
            const ddObj = new Date(ddSrc);
            if (!isNaN(ddObj) && ddObj.getFullYear() === targetYear) {
              allowOther = ddObj.getMonth() + 1 <= currentMonthNo2;
            }
          } catch (_) {}
        }
        allow = allowHalf || allowAnnual || allowOther;
        if (!allow) continue;
        gross = Number(sObj.amount || a.amount || gross || 0);
        due = Math.max(0, gross - paid);
        if (due <= 0) continue;
      }
    } catch (_) {}
    const entry = classMap.get(className) || { tuition_due: 0, exam_due: 0, total_due: 0 };
    if (rtype === 'tuition') {
      entry.tuition_due += due;
      tuition_due_total += due;
    } else if (rtype === 'exam') {
      entry.exam_due += due;
      exam_due_total += due;
    }
    entry.total_due += due;
    classMap.set(className, entry);
  }
  try {
    const currentMonthNo = new Date().getMonth() + 1;
    const monthlyRateByClass = new Map();
    for (const s of (feeStructs || [])) {
      const freq = String(s.frequency || '').toLowerCase();
      const cidRaw = s.classroom?.id ?? s.classroom_id ?? s.classroomId ?? s.classroom ?? s.class?.id ?? s.class;
      const cid = cidRaw != null ? String(cidRaw) : '';
      if (freq === 'monthly' && cid) {
        const amt = Number(s.amount ?? s.default_amount ?? 0) || 0;
        if (amt > 0 && !monthlyRateByClass.has(cid)) {
          monthlyRateByClass.set(cid, amt);
        }
      }
    }
    for (const cls of (classrooms || [])) {
      const cname = cls?.name || String(cls?.id || '');
      let entry = classMap.get(cname);
      if (!entry) {
        entry = { tuition_due: 0, exam_due: 0, total_due: 0 };
        classMap.set(cname, entry);
      }
      const cidStr = String(cls.id);
      let monthlyRate = Number(monthlyRateByClass.get(cidStr) || 0) || 0;
      if (monthlyRate <= 0) {
        const order = getClassOrder(cname);
        monthlyRate = order >= 1 && order <= 5 ? 250 : (order >= 6 && order <= 10 ? 150 : 0);
      }
      if (monthlyRate > 0) {
        let classStudents = (students || []).filter(s => {
          const cidRaw = s?.classroom?.id ?? s?.classroom_id ?? s?.classroomId ?? s?.classroom ?? s?.class?.id ?? s?.class ?? null;
          const cid = cidRaw != null ? String(cidRaw) : '';
          return cid && cid === cidStr;
        });
        if ((classStudents || []).length < 30) {
          try {
            const endpoints = [
              `/api/academics/students/?school=${schoolId}&classroom=${cidStr}`,
              `/api/academics/students/?classroom=${cidStr}`,
              `/api/students/?school=${schoolId}&classroom=${cidStr}`,
              `/api/students/?classroom=${cidStr}`
            ];
            for (const ep of endpoints) {
              try {
                const r = await api.get(ep);
                const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
                if (Array.isArray(arr) && arr.length) {
                  classStudents = arr;
                  break;
                }
              } catch (_) {}
            }
          } catch (_) {}
        }
        for (const stu of classStudents) {
          const sid = String(stu.id);
          for (let m = 1; m <= currentMonthNo; m++) {
            const seenKey = `${sid}:${m}`;
            if (!seenMonthlyByStudentMonth.has(seenKey)) {
              entry.tuition_due += monthlyRate;
              entry.total_due += monthlyRate;
              tuition_due_total += monthlyRate;
              seenMonthlyByStudentMonth.add(seenKey);
            }
          }
        }
      }
    }
  } catch (_) {}
  const fee_dues_summary = { tuition_due_total, exam_due_total, total_due: tuition_due_total + exam_due_total };
  const fee_dues_by_class = Array.from(classMap.entries()).map(([class_name, v]) => ({ class_name, ...v }))
    .sort((a, b) => {
      const ao = getClassOrder(a.class_name);
      const bo = getClassOrder(b.class_name);
      if (ao !== bo) return ao - bo;
      return String(a.class_name).localeCompare(String(b.class_name));
    });
  const class_distribution = ((students || []).reduce((map, s) => {
    const cname = s.classroom?.name || s.classroom_name || s.classroom || 'Unknown';
    map.set(cname, (map.get(cname) || 0) + 1);
    return map;
  }, new Map()));
  const class_distribution_list = Array.from(class_distribution.entries()).map(([classroom__name, count]) => ({ classroom__name, count }));
  return {
    fee_collection,
    fee_dues_summary,
    fee_dues_by_class,
    class_distribution: class_distribution_list,
    students_count: (students || []).length,
    teachers_count: (teachers || []).length,
    classes_count: (classrooms || []).length
  };
};

// Enhanced chart color palette with better contrast and visual appeal
const COLORS = ['#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0', '#3F51B5', '#009688', '#FFC107'];

// ... existing imports ...

const RoleDashboard = ({ role: roleProp }) => {
  const { id, role: roleParam } = useParams();

  const handleOpenAddCommittee = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    navigate(`/school/${id}/committee/add`);
  };

  // ... existing code ...

  const navigate = useNavigate();
  const toast = useToast();
  const { notifications, markAsRead } = useNotifications();
  const role = roleProp || roleParam || '';
  const [data, setData] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState(null);
  // Re-auth state for admin
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  // Committee add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', first_name: '', last_name: '', email: '', phone_number: '' });
  // Admin payment notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [studentEnrichCache, setStudentEnrichCache] = useState({});
  const [duesAdjustment, setDuesAdjustment] = useState(0);
  const [ccResource, setCcResource] = useState('students');
  const [ccList, setCcList] = useState([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [ccLoading, setCcLoading] = useState(false);
  const [ccError, setCcError] = useState(null);
  const [ccQuery, setCcQuery] = useState('');
  const [ccEditorOpen, setCcEditorOpen] = useState(false);
  const [ccSelected, setCcSelected] = useState(null);
  const [ccEditorJson, setCcEditorJson] = useState('');
  const [actionType, setActionType] = useState('bulk_promote');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsClassroom, setSmsClassroom] = useState('');
  const [actionRunning, setActionRunning] = useState(false);
  const [classroomOptions, setClassroomOptions] = useState([]);
  const [feeWaiverPct, setFeeWaiverPct] = useState(0);
  const [feeWaiverClassroom, setFeeWaiverClassroom] = useState('');
  const [resultExamId, setResultExamId] = useState('');
  const [attendanceResetClassroom, setAttendanceResetClassroom] = useState('');
  const [attendanceResetDate, setAttendanceResetDate] = useState('');
  const [feeAssignClassroom, setFeeAssignClassroom] = useState('');
  const [feeAssignMonth, setFeeAssignMonth] = useState('');
  const [feeAssignDueDate, setFeeAssignDueDate] = useState('');
  const [examScheduleId, setExamScheduleId] = useState('');
  const [parentTemplate, setParentTemplate] = useState('dues_reminder');
  const [parentFilterClassroom, setParentFilterClassroom] = useState('');
  const [parentTemplateText, setParentTemplateText] = useState('');
  const [schedClassroom, setSchedClassroom] = useState('');
  const [schedStartMonth, setSchedStartMonth] = useState('');
  const [schedEndMonth, setSchedEndMonth] = useState('');
  const [schedDueDay, setSchedDueDay] = useState('');
  const [schedYear, setSchedYear] = useState(String(new Date().getFullYear()));
  const loadAdjustment = (_sid) => 0;
  const saveAdjustment = (sid, v) => {
    try {
      localStorage.setItem(`adminDuesAdjustmentOnce:${sid}`, String(v || 0));
      localStorage.removeItem(`adminDuesAdjustment:${sid}`);
    } catch (_) {}
  };

  const enrichAdminStats = async (incoming, schoolId) => {
    try {
      const needsCounts = !incoming || !('students_count' in incoming) || !('teachers_count' in incoming) || !('classes_count' in incoming);
      const needsCharts = !incoming || !Array.isArray(incoming.class_distribution) || !Array.isArray(incoming.fee_collection);
      const needsFees = !incoming || !incoming.fee_dues_summary || !Array.isArray(incoming.fee_dues_by_class);
      if (!(needsCounts || needsCharts || needsFees)) return incoming;
      const fallback = await computeAdminStatsFallback(schoolId);
      return { ...(incoming || {}), ...fallback };
    } catch (_) {
      return incoming || {};
    }
  };
  const safeLoadAdminStats = async (schoolId, timeoutMs = 45000) => {
    try {
      setAdminLoading(true);
      setAdminError(null);
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs));
      const year = new Date().getFullYear();
      const stats = await Promise.race([getDashboardStats(schoolId, year), timeout]);
      const enriched = await enrichAdminStats(stats, schoolId);
      setAdminStats(enriched);
    } catch (err) {
      try {
        const fallback = await computeAdminStatsFallback(schoolId);
        setAdminStats((prev) => ({ ...(prev || {}), ...fallback }));
        setAdminError(null);
      } catch (_) {
        setAdminStats((prev) => prev || {});
        setAdminError('Failed to load admin dashboard stats.');
      }
    } finally {
      setAdminLoading(false);
    }
  };

  // Helpers: Bangla numerals and date formatting (e.g., ৬ নভেম্বর)
  const engToBnDigits = (s) => String(s ?? '')
    .replace(/0/g, '০').replace(/1/g, '১').replace(/2/g, '২')
    .replace(/3/g, '৩').replace(/4/g, '৪').replace(/5/g, '৫')
    .replace(/6/g, '৬').replace(/7/g, '৭').replace(/8/g, '৮').replace(/9/g, '৯');
  const bnMonth = (m) => ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'][m] || '';
  const formatBnDateShort = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const day = engToBnDigits(d.getDate());
    return `${day} ${bnMonth(d.getMonth())}`;
  };
  const shortClass = (name) => {
    if (!name) return '';
    return String(name).replace(/\s*(?:শ্রেণি|শ্রেণী)?\s*$/,'');
  };
  const ccEndpoints = (resource) => {
    const sidQ = id ? `?school=${id}` : '';
    switch (resource) {
      case 'students': return { list: [`/api/academics/students/${sidQ}`, `/api/academics/students/`], item: (rid) => [`/api/academics/students/${rid}/`] };
      case 'teachers': return { list: [`/api/academics/teachers/${sidQ}`, `/api/users/teachers/${sidQ}`, `/api/teachers/${sidQ}`], item: (rid) => [`/api/academics/teachers/${rid}/`, `/api/users/teachers/${rid}/`, `/api/teachers/${rid}/`] };
      case 'classrooms': return { list: [`/api/academics/classrooms/${sidQ}`, `/api/academics/classrooms/`], item: (rid) => [`/api/academics/classrooms/${rid}/`] };
      case 'subjects': return { list: [`/api/academics/subjects/${sidQ}`, `/api/academics/subjects/`], item: (rid) => [`/api/academics/subjects/${rid}/`] };
      case 'fees': return { list: [`/api/fees/fees/${sidQ}`, `/api/fees/fee_structures/${sidQ}`, `/api/fees/fees/`], item: (rid) => [`/api/fees/fees/${rid}/`, `/api/fees/fee_structures/${rid}/`] };
      case 'assignments': return { list: [`/api/fees/assignments/${sidQ}`, `/api/fees/assignments/`], item: (rid) => [`/api/fees/assignments/${rid}/`] };
      case 'payments': return { list: [`/api/fees/payments/${sidQ}`, `/api/fees/collections/${sidQ}`, `/api/fees/payment/${sidQ}`], item: (rid) => [`/api/fees/payments/${rid}/`, `/api/fees/collections/${rid}/`, `/api/fees/payment/${rid}/`] };
      case 'exams': return { list: [`/api/academics/examinations/${sidQ}`, `/api/academics/exams/${sidQ}`], item: (rid) => [`/api/academics/examinations/${rid}/`, `/api/academics/exams/${rid}/`] };
      case 'results': return { list: [`/api/academics/results/${sidQ}`, `/api/academics/result/${sidQ}`], item: (rid) => [`/api/academics/results/${rid}/`, `/api/academics/result/${rid}/`] };
      case 'attendance': return { list: [`/api/academics/attendance/${sidQ}`, `/api/academics/attendances/${sidQ}`], item: (rid) => [`/api/academics/attendance/${rid}/`, `/api/academics/attendances/${rid}/`] };
      case 'sms': return { list: [`/api/sms/messages/${sidQ}`, `/api/sms/messages/`], item: (rid) => [`/api/sms/messages/${rid}/`] };
      default: return { list: [], item: (rid) => [] };
    }
  };
  const fetchCcList = async () => {
    try {
      setCcLoading(true);
      setCcError(null);
      const eps = ccEndpoints(ccResource).list.filter(Boolean);
      let list = [];
      for (const ep of eps) {
        try {
          const r = await api.get(ep);
          const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
          if (Array.isArray(arr) && arr.length) { list = arr; break; }
          if (!arr || arr.length === 0) { list = arr || []; }
        } catch (e) { continue; }
      }
      const q = String(ccQuery || '').toLowerCase();
      if (q) {
        list = (list || []).filter(it => {
          const s = JSON.stringify(it || {}).toLowerCase();
          return s.includes(q);
        });
      }
      setCcList(list || []);
    } catch (e) {
      setCcError('লিস্ট লোড করতে সমস্যা হয়েছে');
      setCcList([]);
    } finally {
      setCcLoading(false);
    }
  };
  const openCcEditor = (item) => {
    setCcSelected(item);
    setCcEditorJson(JSON.stringify(item || {}, null, 2));
    setCcEditorOpen(true);
  };
  const saveCcEditor = async () => {
    try {
      const parsed = JSON.parse(ccEditorJson || '{}');
      const rid = parsed.id || ccSelected?.id;
      const eps = ccEndpoints(ccResource).item(rid);
      let ok = false;
      for (const ep of eps) {
        try {
          await api.put(ep, parsed);
          ok = true;
          break;
        } catch (_) { continue; }
      }
      if (ok) {
        toast.success('আপডেট সম্পন্ন');
        setCcEditorOpen(false);
        fetchCcList();
      } else {
        toast.error('আপডেট ব্যর্থ');
      }
    } catch (e) {
      toast.error('অবৈধ JSON');
    }
  };
  const deleteCcItem = async (item) => {
    try {
      const rid = item?.id;
      const eps = ccEndpoints(ccResource).item(rid);
      let ok = false;
      for (const ep of eps) {
        try {
          await api.delete(ep);
          ok = true;
          break;
        } catch (_) { continue; }
      }
      if (ok) {
        toast.success('ডিলিট সম্পন্ন');
        fetchCcList();
      } else {
        toast.error('ডিলিট ব্যর্থ');
      }
    } catch (e) {
      toast.error('ডিলিট করতে সমস্যা হয়েছে');
    }
  };
  const loadClassroomOptions = async () => {
    try {
      const eps = [`/api/academics/classrooms/?school=${id}`, `/api/academics/classrooms/`];
      for (const ep of eps) {
        try {
          const r = await api.get(ep);
          const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
          if (Array.isArray(arr)) { setClassroomOptions(arr); break; }
        } catch (_) { continue; }
      }
    } catch (_) {}
  };
  const bulkPromote = async (dryRun = false) => {
    try {
      setActionRunning(true);
      const sRes = await api.get(`/api/academics/students/?school=${id}`);
      const studentsArr = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.results || sRes.data?.data || []);
      if (!classroomOptions.length) await loadClassroomOptions();
      const classByOrder = new Map();
      classroomOptions.forEach(c => {
        const o = getClassOrder(c.name || c.id);
        if (!classByOrder.has(o)) classByOrder.set(o, c);
      });
      let candidates = [];
      studentsArr.forEach(st => {
        const cid = st?.classroom?.id ?? st?.classroom;
        const cls = classroomOptions.find(c => String(c.id) === String(cid));
        const o = getClassOrder(cls?.name || cid);
        const next = classByOrder.get(o + 1);
        if (next) candidates.push({ id: st.id, nextId: next.id });
      });
      if (dryRun) {
        toast.success(`Promote preview: ${candidates.length} students`);
      } else {
        let ok = 0;
        for (const it of candidates) {
          const eps = [`/api/academics/students/${it.id}/`];
          let done = false;
          for (const ep of eps) {
            try {
              await api.put(ep, { classroom: it.nextId });
              done = true;
              break;
            } catch (_) { continue; }
          }
          if (done) ok++;
        }
        toast.success(`Promoted ${ok} students`);
      }
    } catch (_) {
      toast.error('Promote ব্যর্থ');
    } finally {
      setActionRunning(false);
    }
  };
  const feePlanGenerate = async () => {
    try {
      setActionRunning(true);
      if (!classroomOptions.length) await loadClassroomOptions();
      const fsRes = await api.get(`/api/fees/fees/?school=${id}`);
      const structArr = Array.isArray(fsRes.data) ? fsRes.data : (fsRes.data?.results || fsRes.data?.data || []);
      const existingByClass = new Set();
      structArr.forEach(s => {
        const freq = String(s.frequency || '').toLowerCase();
        const cidRaw = s.classroom?.id ?? s.classroom_id ?? s.classroomId ?? s.classroom ?? s.class?.id ?? s.class;
        const cid = cidRaw != null ? String(cidRaw) : '';
        if (freq === 'monthly' && cid) existingByClass.add(cid);
      });
      let created = 0;
      for (const cls of classroomOptions) {
        const cidStr = String(cls.id);
        if (existingByClass.has(cidStr)) continue;
        const order = getClassOrder(cls.name || cidStr);
        const amount = order >= 1 && order <= 5 ? 250 : (order >= 6 && order <= 10 ? 150 : 0);
        if (amount <= 0) continue;
        const payload = { name: 'Monthly Tuition', amount, frequency: 'monthly', classroom: cls.id, school: id };
        const eps = [`/api/fees/fees/`, `/api/fees/fee_structures/`];
        let ok = false;
        for (const ep of eps) {
          try {
            await api.post(ep, payload);
            ok = true;
            break;
          } catch (_) { continue; }
        }
        if (ok) created++;
      }
      toast.success(`Generated ${created} fee plans`);
    } catch (_) {
      toast.error('Fee plan তৈরি ব্যর্থ');
    } finally {
      setActionRunning(false);
    }
  };
  const smsBroadcast = async () => {
    try {
      setActionRunning(true);
      if (!smsMessage.trim()) { toast.error('বার্তা লিখুন'); setActionRunning(false); return; }
      let recipients = [];
      if (smsClassroom) {
        const r = await api.get(`/api/academics/students/?school=${id}&classroom=${smsClassroom}`);
        recipients = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
      } else {
        const r = await api.get(`/api/academics/students/?school=${id}`);
        recipients = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
      }
      const payload = { school: id, message: smsMessage, audience: 'students', classroom: smsClassroom || null };
      const eps = [`/api/sms/messages/`];
      let sent = false;
      for (const ep of eps) {
        try {
          await api.post(ep, payload);
          sent = true;
          break;
        } catch (_) { continue; }
      }
      if (!sent) {
        let ok = 0;
        for (const s of recipients) {
          try {
            await api.post(`/api/sms/messages/`, { school: id, message: smsMessage, student: s.id });
            ok++;
          } catch (_) { continue; }
        }
        toast.success(`SMS পাঠানো হয়েছে: ${ok}`);
      } else {
        toast.success('SMS ব্রডকাস্ট সম্পন্ন');
      }
    } catch (_) {
      toast.error('SMS পাঠানো ব্যর্থ');
    } finally {
      setActionRunning(false);
    }
  };
  const bulkFeeWaiver = async () => {
    try {
      setActionRunning(true);
      const aRes = await api.get(`/api/fees/assignments/?school=${id}`);
      const assignmentsArr = Array.isArray(aRes.data) ? aRes.data : (aRes.data?.results || aRes.data?.data || []);
      let studentsMap = new Map();
      try {
        const sRes = await api.get(`/api/academics/students/?school=${id}`);
        const sArr = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.results || sRes.data?.data || []);
        sArr.forEach(st => {
          studentsMap.set(String(st.id), String(st?.classroom?.id ?? st?.classroom ?? ''));
        });
      } catch (_) {}
      const pct = Math.max(0, Math.min(100, Number(feeWaiverPct || 0) || 0));
      let ok = 0;
      for (const a of assignmentsArr) {
        const stuId = String(a.student_id || a.student || a.studentId || '');
        const cid = studentsMap.get(stuId) || '';
        if (feeWaiverClassroom && String(feeWaiverClassroom) !== cid) continue;
        const aid = String(a.id || a.assignment_id || a._id || a.assignment || '');
        if (!aid) continue;
        const payload = { discount_percentage: pct, discount_percent: pct, discount: pct };
        const eps = [`/api/fees/assignments/${aid}/`];
        let done = false;
        for (const ep of eps) {
          try {
            await api.put(ep, payload);
            done = true;
            break;
          } catch (_) { continue; }
        }
        if (done) ok++;
      }
      toast.success(`Fee waiver প্রয়োগ হয়েছে: ${ok}`);
    } catch (_) {
      toast.error('Fee waiver ব্যর্থ');
    } finally {
      setActionRunning(false);
    }
  };
  const resultPublish = async () => {
    try {
      setActionRunning(true);
      const rRes = await api.get(`/api/academics/results/?school=${id}`);
      const resultsArr = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.results || rRes.data?.data || []);
      let ok = 0;
      for (const r of resultsArr) {
        const rid = String(r.id || r.result_id || '');
        if (!rid) continue;
        const examId = String(r.exam?.id ?? r.examination?.id ?? r.exam_id ?? r.examination_id ?? '');
        if (resultExamId && String(resultExamId) !== examId) continue;
        const payload = { published: true, status: 'published' };
        const eps = [`/api/academics/results/${rid}/`];
        let done = false;
        for (const ep of eps) {
          try {
            await api.put(ep, payload);
            done = true;
            break;
          } catch (_) { continue; }
        }
        if (done) ok++;
      }
      toast.success(`Published results: ${ok}`);
    } catch (_) {
      toast.error('Result publish ব্যর্থ');
    } finally {
      setActionRunning(false);
    }
  };
  const attendanceReset = async () => {
    try {
      setActionRunning(true);
      if (!attendanceResetClassroom) { toast.error('শ্রেণি নির্বাচন করুন'); setActionRunning(false); return; }
      const dQ = attendanceResetDate ? `&date=${attendanceResetDate}` : '';
      const aRes = await api.get(`/api/academics/attendance/?school=${id}&classroom=${attendanceResetClassroom}${dQ}`);
      const attArr = Array.isArray(aRes.data) ? aRes.data : (aRes.data?.results || aRes.data?.data || []);
      let ok = 0;
      for (const a of attArr) {
        const aid = String(a.id || a.attendance_id || '');
        if (!aid) continue;
        try {
          await api.delete(`/api/academics/attendance/${aid}/`);
          ok++;
        } catch (_) { continue; }
      }
      toast.success(`Attendance reset: ${ok}`);
    } catch (_) {
      toast.error('Attendance reset ব্যর্থ');
    } finally {
      setActionRunning(false);
    }
  };
  const bulkFeeAssignment = async () => {
    try {
      setActionRunning(true);
      if (!classroomOptions.length) await loadClassroomOptions();
      const sEp = feeAssignClassroom ? `/api/academics/students/?school=${id}&classroom=${feeAssignClassroom}` : `/api/academics/students/?school=${id}`;
      const sRes = await api.get(sEp);
      const studentsArr = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.results || sRes.data?.data || []);
      const fsRes = await api.get(`/api/fees/fees/?school=${id}`);
      const structArr = Array.isArray(fsRes.data) ? fsRes.data : (fsRes.data?.results || fsRes.data?.data || []);
      const monthlyByClass = new Map();
      structArr.forEach(s => {
        const freq = String(s.frequency || '').toLowerCase();
        const cidRaw = s.classroom?.id ?? s.classroom_id ?? s.classroomId ?? s.classroom ?? s.class?.id ?? s.class;
        const cid = cidRaw != null ? String(cidRaw) : '';
        if (freq === 'monthly' && cid && !monthlyByClass.has(cid)) monthlyByClass.set(cid, s);
      });
      let ok = 0;
      for (const st of studentsArr) {
        const cidRaw = st?.classroom?.id ?? st?.classroom;
        const cid = cidRaw != null ? String(cidRaw) : '';
        if (!cid) continue;
        const mStruct = monthlyByClass.get(cid);
        if (!mStruct) continue;
        const payload = {
          student: st.id,
          student_id: st.id,
          fee_structure: mStruct.id,
          fee_structure_id: mStruct.id,
          amount: Number(mStruct.amount ?? mStruct.default_amount ?? 0) || undefined,
          month: feeAssignMonth ? Number(feeAssignMonth) : undefined,
          due_date: feeAssignDueDate || undefined,
          school: id
        };
        try {
          await api.post(`/api/fees/assignments/`, payload);
          ok++;
        } catch (_) { continue; }
      }
      toast.success(`Fee assignments created: ${ok}`);
    } catch (_) {
      toast.error('Fee assignment তৈরি ব্যর্থ');
    } finally {
      setActionRunning(false);
    }
  };
  const examSchedulePublish = async () => {
    try {
      setActionRunning(true);
      const eRes = await api.get(`/api/academics/examinations/?school=${id}`);
      const examsArr = Array.isArray(eRes.data) ? eRes.data : (eRes.data?.results || eRes.data?.data || []);
      let ok = 0;
      for (const ex of examsArr) {
        const eid = String(ex.id || ex.exam_id || '');
        if (!eid) continue;
        if (examScheduleId && String(examScheduleId) !== eid) continue;
        const payload = { published: true, status: 'published' };
        const eps = [`/api/academics/examinations/${eid}/`, `/api/academics/exams/${eid}/`];
        let done = false;
        for (const ep of eps) {
          try {
            await api.put(ep, payload);
            done = true;
            break;
          } catch (_) { continue; }
        }
        if (done) ok++;
      }
      toast.success(`Exam schedules published: ${ok}`);
    } catch (_) {
      toast.error('Exam schedule publish ব্যর্থ');
    } finally {
      setActionRunning(false);
    }
  };
  const parentSmsTemplates = async () => {
    try {
      setActionRunning(true);
      if (!classroomOptions.length) await loadClassroomOptions();
      const classNameById = new Map(classroomOptions.map(c => [String(c.id), c.name || String(c.id)]));
      const defaultMessage = parentTemplate === 'dues_reminder'
        ? 'আপনার সন্তানের বকেয়া ফি দ্রুত পরিশোধ করুন। ধন্যবাদ।'
        : parentTemplate === 'attendance_alert'
          ? 'আপনার সন্তানের আজকের হাজিরা সম্পর্কে জানতে স্কুলে যোগাযোগ করুন।'
          : parentTemplate === 'result_published'
            ? 'রেজাল্ট প্রকাশ হয়েছে। স্কুলের ওয়েব অথবা অফিসে দেখুন।'
            : parentTemplate === 'custom'
              ? String(parentTemplateText || 'বিদ্যালয় থেকে বার্তা')
              : 'বিদ্যালয় থেকে বার্তা';
      const formatMsg = (tpl, ctx) => {
        const map = {
          '{student_name}': ctx.student_name || '',
          '{class_name}': ctx.class_name || '',
          '{due_amount}': ctx.due_amount != null ? String(ctx.due_amount) : ''
        };
        let out = String(tpl || '');
        Object.entries(map).forEach(([k, v]) => { out = out.split(k).join(String(v)); });
        return out;
      };
      const calcDue = async (sid) => {
        try {
          let gross = 0;
          let paid = 0;
          const aRes = await api.get(`/api/fees/assignments/?student=${sid}`);
          const assignmentsArr = Array.isArray(aRes.data) ? aRes.data : (aRes.data?.results || aRes.data?.data || []);
          for (const a of (assignmentsArr || [])) {
            const feeObj = a.fee_structure || a.fee || {};
            const baseCandidates = [a.custom_amount, a.amount, a.total_amount, a.payable_amount, a.original_amount, feeObj.amount, feeObj.default_amount];
            let base = baseCandidates.find(x => x !== undefined && x !== null && Number(x) >= 0);
            base = Number(base || 0);
            const discountAmt = Number(a.discount_amount || 0) || 0;
            const discountPct = Number(a.discount_percentage ?? a.discount_percent ?? a.discount ?? 0) || 0;
            gross += Math.max(0, base - discountAmt - (base * discountPct / 100));
          }
          const pEndpoints = [
            `/api/fees/payments/?student=${sid}`,
            `/api/fees/collections/?student=${sid}`,
            `/api/fees/payment/?student=${sid}`
          ];
          for (const ep of pEndpoints) {
            try {
              const pRes = await api.get(ep);
              const paymentsArr = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.results || pRes.data?.data || []);
              if (Array.isArray(paymentsArr) && paymentsArr.length) {
                paid += paymentsArr.reduce((sum, p) => sum + (Number(p.amount || p.paid_amount || 0) || 0), 0);
                break;
              }
            } catch (_) { continue; }
          }
          return Math.max(0, gross - paid);
        } catch (_) {
          return null;
        }
      };
      let ok = 0;
      if (parentFilterClassroom) {
        const sRes = await api.get(`/api/academics/students/?school=${id}&classroom=${parentFilterClassroom}`);
        const sArr = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.results || sRes.data?.data || []);
        for (const st of (sArr || [])) {
          const pid = st.parent?.id ?? st.parent_id ?? st.guardian?.id ?? st.guardian_id ?? st.father?.id ?? st.mother?.id ?? null;
          if (!pid) continue;
          const student_name = st.user?.first_name || st.name || st.user?.username || '';
          const cidRaw = st?.classroom?.id ?? st?.classroom;
          const class_name = classNameById.get(String(cidRaw)) || '';
          const due_amount = await calcDue(st.id);
          const msg = formatMsg(defaultMessage, { student_name, class_name, due_amount });
          try {
            await api.post(`/api/sms/messages/`, { school: id, message: msg, audience: 'parents', parent: pid });
            ok++;
          } catch (_) { continue; }
        }
      } else {
        const pRes = await api.get(`/api/users/parents/?school=${id}`);
        const pAll = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.results || pRes.data?.data || []);
        const childrenResults = await Promise.allSettled((pAll || []).map(p => api.get(`/api/users/parents/${p.id}/children/`)));
        for (let i = 0; i < (pAll || []).length; i++) {
          const p = pAll[i];
          let child = null;
          const res = childrenResults[i];
          if (res.status === 'fulfilled') {
            const arr = Array.isArray(res.value.data) ? res.value.data : (res.value.data?.results || res.value.data?.data || []);
            child = Array.isArray(arr) && arr.length ? arr[0] : null;
          }
          let student_name = '';
          let class_name = '';
          let due_amount = null;
          if (child) {
            student_name = child.user?.first_name || child.name || child.user?.username || '';
            const cidRaw = child?.classroom?.id ?? child?.classroom;
            class_name = classNameById.get(String(cidRaw)) || '';
            due_amount = await calcDue(child.id);
          }
          const msg = formatMsg(defaultMessage, { student_name, class_name, due_amount });
          try {
            await api.post(`/api/sms/messages/`, { school: id, message: msg, audience: 'parents', parent: p.id });
            ok++;
          } catch (_) { continue; }
        }
      }
      toast.success(`Parent SMS পাঠানো হয়েছে: ${ok}`);
    } catch (_) {
      toast.error('Parent SMS পাঠানো ব্যর্থ');
    } finally {
      setActionRunning(false);
    }
  };
  const monthlyAssignmentSchedule = async () => {
    try {
      setActionRunning(true);
      if (!classroomOptions.length) await loadClassroomOptions();
      const sEp = schedClassroom ? `/api/academics/students/?school=${id}&classroom=${schedClassroom}` : `/api/academics/students/?school=${id}`;
      const sRes = await api.get(sEp);
      const studentsArr = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.results || sRes.data?.data || []);
      const fsRes = await api.get(`/api/fees/fees/?school=${id}`);
      const structArr = Array.isArray(fsRes.data) ? fsRes.data : (fsRes.data?.results || fsRes.data?.data || []);
      const monthlyByClass = new Map();
      structArr.forEach(s => {
        const freq = String(s.frequency || '').toLowerCase();
        const cidRaw = s.classroom?.id ?? s.classroom_id ?? s.classroomId ?? s.classroom ?? s.class?.id ?? s.class;
        const cid = cidRaw != null ? String(cidRaw) : '';
        if (freq === 'monthly' && cid && !monthlyByClass.has(cid)) monthlyByClass.set(cid, s);
      });
      const year = Number(schedYear || new Date().getFullYear());
      const startM = Math.max(1, Math.min(12, Number(schedStartMonth || 0) || 1));
      const endM = Math.max(startM, Math.min(12, Number(schedEndMonth || 0) || startM));
      const dueDay = Math.max(1, Math.min(28, Number(schedDueDay || 0) || 10));
      let ok = 0;
      for (const st of studentsArr) {
        const cidRaw = st?.classroom?.id ?? st?.classroom;
        const cid = cidRaw != null ? String(cidRaw) : '';
        if (!cid) continue;
        const mStruct = monthlyByClass.get(cid);
        if (!mStruct) continue;
        for (let m = startM; m <= endM; m++) {
          const dueDate = `${year}-${String(m).padStart(2,'0')}-${String(dueDay).padStart(2,'0')}`;
          const payload = {
            student: st.id,
            student_id: st.id,
            fee_structure: mStruct.id,
            fee_structure_id: mStruct.id,
            amount: Number(mStruct.amount ?? mStruct.default_amount ?? 0) || undefined,
            month: m,
            due_date: dueDate,
            school: id
          };
          try {
            await api.post(`/api/fees/assignments/`, payload);
            ok++;
          } catch (_) { continue; }
        }
      }
      toast.success(`Scheduled assignments created: ${ok}`);
    } catch (_) {
      toast.error('Assignment শিডিউল তৈরি ব্যর্থ');
    } finally {
      setActionRunning(false);
    }
  };

  // Load pending payments for this school (flexible to backend variations)
  const fetchPendingPayments = async () => {
    try {
      setNotifLoading(true);
      const schoolQ = id ? `&school=${encodeURIComponent(id)}` : '';
      const endpoints = [
        `/api/fees/payments/?status=pending${schoolQ}`,
        `/api/fees/payments/?status=Pending${schoolQ}`,
        `/api/fees/payments/?payment_status=pending${schoolQ}`,
        `/api/fees/payments/?payment_status=Pending${schoolQ}`,
        `/api/fees/payments/?approved=false${schoolQ}`,
        `/api/fees/payment/?status=pending${schoolQ}`,
        `/api/fees/payment/?status=Pending${schoolQ}`,
        `/api/fees/payment/?payment_status=pending${schoolQ}`,
        `/api/fees/payment/?payment_status=Pending${schoolQ}`,
        `/api/fees/collections/?status=pending${schoolQ}`,
        `/api/fees/collections/?status=Pending${schoolQ}`,
        `/api/fees/collections/?payment_status=pending${schoolQ}`,
        `/api/fees/collections/?payment_status=Pending${schoolQ}`,
        `/api/fees/collections/?approved=false${schoolQ}`
      ];
      let list = [];
      let lastErr = null;
      for (const ep of endpoints) {
        try {
          const resp = await api.get(ep);
          const data = Array.isArray(resp.data) ? resp.data : (resp.data?.results || resp.data?.data || []);
          if (data && data.length) { list = data; break; }
          if (list.length === 0 && (resp.data?.results || resp.data?.data)) { list = data; }
        } catch (e) {
          lastErr = e;
          continue;
        }
      }
      // Fallback: fetch by school without status filter and filter client-side
      if (!Array.isArray(list) || list.length === 0) {
        const schoolWide = [
          `/api/fees/payments/?ordering=-updated_at${schoolQ}`,
          `/api/fees/payment/?ordering=-updated_at${schoolQ}`,
          `/api/fees/collections/?ordering=-updated_at${schoolQ}`
        ];
        for (const ep of schoolWide) {
          try {
            const resp = await api.get(ep);
            const data = Array.isArray(resp.data) ? resp.data : (resp.data?.results || resp.data?.data || []);
            if (Array.isArray(data) && data.length) { list = data; break; }
          } catch (_) {}
        }
      }
      // Normalize minimal fields for UI with method and sender heuristics
      const normalizedRaw = (list || []).map(p => {
        const rawMethod = String(p.method || p.payment_method || p.channel || '').toLowerCase();
        const ref = p.reference || p.note || p.notes || p.description || '';
        const meta = p.meta || p.metadata || {};
        const sender = p.bkash_from || p.nagad_from || p.rocket_from || p.mobile_from || p.mobile_banking_from || p.from || meta.from || meta.sender || p.sender || p.source_number || '';
        let method = rawMethod;
        if (!method || method === 'cash') {
          const txt = `${ref} ${JSON.stringify(meta)}`.toLowerCase();
          if (sender || txt.includes('bkash') || txt.includes('বিকাশ')) method = 'bkash';
          else if (txt.includes('nagad') || txt.includes('নগদ')) method = 'nagad';
          else if (txt.includes('rocket') || txt.includes('রকেট')) method = 'rocket';
        }
        return {
          id: p.id || p._id,
          amount: Number(p.amount || p.paid_amount || 0),
          method,
          sender_from: sender,
          date: p.payment_date || p.date || p.created_at || '',
          student: p.student || p.student_id || p.studentId || p.assignment?.student || p.assignment?.student_id,
          approved_flags: {
            approved: p.approved,
            is_approved: p.is_approved,
            approved_by_admin: p.approved_by_admin,
            status: p.status || p.approval_status || p.state || p.result || p.decision
          },
          payment_status: String(p.payment_status || '').toLowerCase(),
          student_name: p.student_name || p.student?.name || p.student?.user?.first_name || '',
          class_name: p.class_name || p.class?.name || p.classroom?.name || p.student?.class?.name || p.student?.classroom?.name || p.assignment?.class?.name || p.assignment?.classroom?.name || '',
          roll: p.roll || p.roll_number || p.student?.roll || p.student?.roll_number || p.student?.rollNo || p.assignment?.student?.roll || '',
        };
      });
      const isApproved = (pp) => {
        const f = pp.approved_flags || {};
        if (typeof f.approved === 'boolean' && f.approved) return true;
        if (typeof f.is_approved === 'boolean' && f.is_approved) return true;
        if (typeof f.approved_by_admin === 'boolean' && f.approved_by_admin) return true;
        const s = String(f.status || '').toLowerCase();
        if (['approved','ok','okay','okayed','complete','completed','success','accepted','verified'].includes(s)) return true;
        if (s === '1' || s === 'true' || s === 'yes') return true;
        if (Number(f.status) === 1) return true;
        // Treat payment_status completed as approved
        if (pp.payment_status === 'completed' || pp.payment_status === 'complete' || pp.payment_status === 'success') return true;
        return false;
      };
      // Filter to only pending-like items
      const normalized = normalizedRaw.filter(pp => !isApproved(pp) && pp.payment_status !== 'completed' && pp.payment_status !== 'complete' && pp.payment_status !== 'success');
      setPendingPayments(normalized);
    } catch (e) {
      console.error('Failed to load pending payments:', e?.response?.data || e.message);
      setPendingPayments([]);
    } finally {
      setNotifLoading(false);
    }
  };

  // Keep admin badge fresh: poll and refresh on focus
  useEffect(() => {
    if (role !== 'admin' || !id) return;
    const onFocus = () => { fetchPendingPayments(); };
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => { fetchPendingPayments(); }, 10000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [role, id]);

  // Enrich pending payments with student name/class/roll if missing
  useEffect(() => {
    (async () => {
      try {
        const need = (pendingPayments || []).filter(p => (
          (!p.student_name || !p.class_name || !p.roll) && p.student
        ));
        if (need.length === 0) return;
        const uniqueIds = Array.from(new Set(need.map(p => String(p.student))));
        const toFetch = uniqueIds.filter(sid => !studentEnrichCache[sid]);
        if (toFetch.length > 0) {
          const results = await Promise.allSettled(toFetch.map(sid => api.get(`/api/academics/students/${sid}/`)));
          const cacheUpdate = {};
          results.forEach((res, idx) => {
            const sid = toFetch[idx];
            if (res.status === 'fulfilled') {
              const st = res.value?.data || {};
              cacheUpdate[sid] = {
                student_name: st.user?.first_name || st.user?.username || st.name || '',
                class_name: st.classroom?.name || '',
                roll: st.roll_number || st.roll || ''
              };
            } else {
              cacheUpdate[sid] = { student_name: '', class_name: '', roll: '' };
            }
          });
          if (Object.keys(cacheUpdate).length > 0) {
            setStudentEnrichCache(prev => ({ ...prev, ...cacheUpdate }));
          }
        }
        // Apply cache to payments
        setPendingPayments(prev => prev.map(p => {
          const sid = p.student ? String(p.student) : null;
          if (!sid) return p;
          const e = studentEnrichCache[sid];
          if (!e) return p;
          return {
            ...p,
            student_name: p.student_name || e.student_name || p.student_name,
            class_name: p.class_name || e.class_name || p.class_name,
            roll: p.roll || e.roll || p.roll
          };
        }));
      } catch (_) { /* ignore enrichment errors */ }
    })();
  }, [pendingPayments, studentEnrichCache]);

  const approvePayment = async (payment) => {
    if (!payment || !payment.id) return;
    try {
      const pid = String(payment.id);
      const payloads = [
        { url: `/api/fees/payments/${pid}/`, method: 'patch', data: { payment_status: 'completed' } },
        { url: `/api/payments/${pid}/`, method: 'patch', data: { payment_status: 'completed' } },
        { url: `/api/fees/collections/${pid}/`, method: 'patch', data: { payment_status: 'completed' } },
      ];
      let success = false;
      let lastErr = null;
      for (const p of payloads) {
        try {
          if (p.method === 'patch') await api.patch(p.url, p.data);
          else await api.post(p.url, p.data);
          success = true;
          break;
        } catch (e) {
          lastErr = e;
          continue;
        }
      }
      if (!success) throw lastErr || new Error('Approve failed');
      toast.success('Payment approved');
      // Optimistically remove from badge list
      setPendingPayments(prev => prev.filter(p => String(p.id || p._id) !== String(payment.id)));
      // Emit cross-tab signal so ParentDashboard can refresh immediately
      try {
        const stamp = Date.now();
        const sid = payment.student || payment.student_id || payment.assignment?.student || '';
        window.dispatchEvent(new CustomEvent('paymentApproved', { detail: { student: sid, ts: stamp } }));
        window.localStorage.setItem('paymentApprovedSignal', JSON.stringify({ student: sid, ts: stamp }));
        try {
          const sidStr = String(sid || '');
          (notifications || [])
            .filter(n => String(n?.type || '') === 'payment' && String(n?.data?.studentId || '') === sidStr)
            .forEach(n => markAsRead(n.id));
        } catch (_) {}
      } catch (_) {}
      // Refresh server list in background
      await fetchPendingPayments();
    } catch (e) {
      console.error('Payment approve error:', e?.response?.data || e.message);
      toast.error('Failed to approve payment');
    }
  };

  // Require fresh credentials when opening Admin dashboard
  useEffect(() => {
    try {
      if (role !== 'admin') { setReauthOpen(false); return; }
      const key = `adminReauth:${id}`;
      const ts = Number(sessionStorage.getItem(key) || 0);
      const now = Date.now();
      const ttlMs = 10 * 60 * 1000; // 10 minutes
      const fresh = ts && (now - ts) < ttlMs;
      if (!fresh) {
        setReauthOpen(true);
        setReauthError('');
        setReauthPassword('');
      }
    } catch (_) {
      setReauthOpen(true);
    }
  }, [role, id]);

  const handleReauth = async () => {
    try {
      setReauthLoading(true);
      setReauthError('');
      if (!reauthPassword) {
        setReauthError('পাসওয়ার্ড দিন');
        setReauthLoading(false);
        return;
      }
      await api.post('/api/users/password/verify/', { password: reauthPassword });
      sessionStorage.setItem(`adminReauth:${id}`, String(Date.now()));
      setReauthOpen(false);
      toast.success('অ্যাডমিন যাচাইকরণ সম্পন্ন');
      // Refresh admin data immediately after reauth
      if (role === 'admin' && id) {
        await safeLoadAdminStats(id);
        fetchPendingPayments();
      }
    } catch (e) {
      setReauthError(e?.response?.data?.error || 'পাসওয়ার্ড সঠিক নয়');
    } finally {
      setReauthLoading(false);
    }
  };

  useEffect(() => {
    if (!id || !role) return;

    if (role === 'admin') {
      setDuesAdjustment(loadAdjustment(id));
      safeLoadAdminStats(id);
      // Load pending payments for notifications
      fetchPendingPayments();
      return;
    }

    // Non-admin roles: fetch from real endpoints and map to display shape
    const fetchRoleData = async () => {
      try {
        let url = '';
        if (role === 'teacher') {
          // Teachers are profiles with role=teacher
          url = `/api/users/admins/`; // placeholder if teacher endpoint not yet present
        } else if (role === 'student') {
          // Students list endpoint not defined here; keep placeholder for now
          url = `/api/academics/students/?school=${id}`;
        } else if (role === 'parent') {
          url = `/api/users/parents/?school=${id}`;
        } else if (role === 'committee') {
          url = `/api/users/committees/?school=${id}`;
        }

        if (!url) return;
        const res = await api.get(url);
        const items = Array.isArray(res.data) ? res.data : res.data.results || [];
        // Normalize to { name, ... } for UI
        const normalized = items.map((it) => {
          const user = it.user || {};
          const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
          const name = fullName || user.username || 'Unnamed';
          return { name, ...it };
        });
        setData(normalized);
      } catch (err) {
        console.error(`Error fetching ${role} data:`, err?.response?.status, err?.message);
        setData([]);
      }
    };
    fetchRoleData();
  }, [id, role]);

  const roleIcon = () => {
    switch (role) {
      case 'admin': return <PersonIcon />;
      case 'teacher': return <SchoolIcon />;
      case 'student': return <PersonIcon />;
      case 'parent': return <GroupIcon />;
      case 'committee': return <AccountBalanceIcon />;
      default: return null;
    }
  };

  const handleCardClick = (item) => {
    setSelectedItem(item);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedItem(null);
  };

  const renderHeader = () => {
    const roleSafe = typeof role === 'string' ? role : '';
    const roleTitle = roleSafe ? (roleSafe.charAt(0).toUpperCase() + roleSafe.slice(1)) : 'Role';
    
    // Enhanced modern gradient backgrounds for each role
    let gradient = "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)";
    if (roleSafe === "teacher") gradient = "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)";
    if (roleSafe === "student") gradient = "linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)";
    if (roleSafe === "parent") gradient = "linear-gradient(135deg, #FF9800 0%, #F57C00 100%)";
    if (roleSafe === "committee") gradient = "linear-gradient(135deg, #795548 0%, #5D4037 100%)";
    if (roleSafe === "admin") gradient = "linear-gradient(135deg, #2196F3 0%, #1565C0 100%)";

    // Role-specific icons
    const getRoleIcon = () => {
      switch(roleSafe) {
        case 'admin': return <PersonIcon fontSize="large" />;
        case 'teacher': return <SchoolIcon fontSize="large" />;
        case 'student': return <PersonIcon fontSize="large" />;
        case 'parent': return <GroupIcon fontSize="large" />;
        case 'committee': return <AccountBalanceIcon fontSize="large" />;
        default: return <PersonIcon fontSize="large" />;
      }
    };

    return (
      <Paper
        elevation={4}
        sx={{
          p: { xs: 2, sm: 3 },
          mb: 4,
          background: gradient,
          color: 'white',
          borderRadius: 3,
          boxShadow: '0 8px 24px 0 rgba(0,0,0,0.15)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 12px 28px 0 rgba(0,0,0,0.2)'
          }
        }}
      >
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          alignItems={{ xs: 'flex-start', sm: 'center' }} 
          justifyContent="space-between" 
          spacing={{ xs: 2, sm: 3 }}
        >
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
            <Avatar 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                width: { xs: 48, sm: 56 }, 
                height: { xs: 48, sm: 56 },
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
              }}
            >
              {getRoleIcon()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 'bold', 
                  mb: 0.5,
                  fontSize: { xs: '1.5rem', sm: '2rem' },
                  lineHeight: 1.2
                }}
              >
                {roleTitle} Dashboard
              </Typography>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  opacity: 0.9,
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  lineHeight: 1.4
                }}
              >
                School ID: {id ?? 'N/A'} • Manage {roleSafe} information
              </Typography>
            </Box>
          </Stack>
          {roleSafe === 'committee' && (
            <Button 
              variant="contained" 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                px: { xs: 2, sm: 3 },
                py: 1,
                borderRadius: 2,
                fontSize: { xs: '0.875rem', sm: '1rem' },
                whiteSpace: 'nowrap',
                minWidth: 'fit-content'
              }} 
              onClick={handleOpenAddCommittee}
            >
              Add Committee Member
            </Button>
          )}
          {roleSafe === 'admin' && (
            <Stack direction="row" spacing={1} alignItems="center">
              <MuiTooltip title={notifLoading ? 'Loading...' : 'Pending Payments'}>
                <span>
                  <IconButton
                    onClick={() => setNotifOpen(true)}
                    color="inherit"
                    disabled={notifLoading}
                    sx={{ bgcolor: 'rgba(255,255,255,0.18)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                  >
                    <Badge color="error" badgeContent={pendingPayments.length || 0} max={99} overlap="circular">
                      <NotificationsIcon htmlColor="#fff" />
                    </Badge>
                  </IconButton>
                </span>
              </MuiTooltip>
              <Button 
                variant="contained" 
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  px: { xs: 2, sm: 3 },
                  py: 1,
                  borderRadius: 2,
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  whiteSpace: 'nowrap',
                  minWidth: 'fit-content'
                }} 
                onClick={() => setHelpOpen(true)}
              >
                ব্যবহারবিধি
              </Button>
              <Button 
                variant="contained" 
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  px: { xs: 2, sm: 3 },
                  py: 1,
                  borderRadius: 2,
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  whiteSpace: 'nowrap',
                  minWidth: 'fit-content'
                }} 
                onClick={() => navigate(`/school/${id}/settings`)}
              >
                School Settings
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
    );
  };

  const renderCards = () => (
    role === 'admin' ? (
      <Box>
        {adminLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: { xs: 2, sm: 4 } }}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: { xs: 2, sm: 3 }, 
                borderRadius: 2, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                bgcolor: 'rgba(25, 118, 210, 0.05)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              <Box sx={{ 
                width: 24, 
                height: 24, 
                borderRadius: '50%', 
                border: '3px solid #bbdefb', 
                borderTop: '3px solid #1976d2',
                animation: 'spin 1s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }} />
              <Typography>Loading dashboard data...</Typography>
            </Paper>
          </Box>
        )}
        {adminError && (
          <Paper 
            elevation={1} 
            sx={{ 
              p: 3, 
              borderRadius: 2, 
              bgcolor: '#ffebee', 
              color: '#d32f2f',
              mb: 3
            }}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ fontSize: '1.5rem' }}>⚠️</Box>
              Error Loading Dashboard
            </Typography>
            <Typography>{adminError}</Typography>
          </Paper>
        )}
        {adminStats && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper 
                elevation={3} 
                sx={{ 
                  p: 3, 
                  borderRadius: 3, 
                  background: 'linear-gradient(135deg, #bbdefb 0%, #e3f2fd 100%)',
                  height: '100%',
                  minHeight: 140,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.3s ease',
                  '&:hover': { 
                    transform: 'translateY(-5px)',
                    boxShadow: '0 12px 20px rgba(0,0,0,0.1)'
                  },
                  cursor: 'pointer'
                }}
                onClick={() => navigate(`/school/${id}/student`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/school/${id}/student`); } }}
              >
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                  <Avatar sx={{ bgcolor: '#1976d2', width: 64, height: 64 }}>
                    <PersonIcon fontSize="large" />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                      Total Students
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#0d47a1', lineHeight: 1 }}>
                      {adminStats.students_count || 0}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper 
                elevation={3} 
                sx={{ 
                  p: 3, 
                  borderRadius: 3, 
                  background: 'linear-gradient(135deg, #c8e6c9 0%, #e8f5e9 100%)',
                  height: '100%',
                  minHeight: 140,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.3s ease',
                  '&:hover': { 
                    transform: 'translateY(-5px)',
                    boxShadow: '0 12px 20px rgba(0,0,0,0.1)'
                  },
                  cursor: 'pointer'
                }}
                onClick={() => navigate(`/school/${id}/teacher`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/school/${id}/teacher`); } }}
              >
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                  <Avatar sx={{ bgcolor: '#2e7d32', width: 64, height: 64 }}>
                    <SchoolIcon fontSize="large" />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                      Total Teachers
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#1b5e20', lineHeight: 1 }}>
                      {adminStats.teachers_count || 0}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper 
                elevation={3} 
                sx={{ 
                  p: 3, 
                  borderRadius: 3, 
                  background: 'linear-gradient(135deg, #d1c4e9 0%, #ede7f6 100%)',
                  height: '100%',
                  minHeight: 140,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.3s ease',
                  '&:hover': { 
                    transform: 'translateY(-5px)',
                    boxShadow: '0 12px 20px rgba(0,0,0,0.1)'
                  },
                  cursor: 'pointer'
                }}
                onClick={() => navigate(`/school/${id}/classes`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/school/${id}/classes`); } }}
              >
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                  <Avatar sx={{ bgcolor: '#673ab7', width: 64, height: 64 }}>
                    <ClassIcon fontSize="large" />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                      Total Classes
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#4527a0', lineHeight: 1 }}>
                      {adminStats.classes_count || 0}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Box>
    ) : (
    <Swiper
      spaceBetween={20}
      slidesPerView={1}
      navigation
      pagination={{ clickable: true }}
      breakpoints={{
        640: { slidesPerView: 1 },
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 },
        1280: { slidesPerView: 4 }
      }}
      modules={[Navigation, Pagination]}
    >
      {data.length > 0 ? data.map((item, i) => (
        <SwiperSlide key={i}>
          <Card
            sx={{
              borderRadius: 2,
              boxShadow: 3,
              transition: '0.3s',
              '&:hover': { transform: 'translateY(-5px)', boxShadow: 6, cursor: 'pointer' }
            }}
            onClick={() => handleCardClick(item)}
          >
            <CardHeader
              avatar={(
                role === 'parent' || role === 'committee'
                  ? <Avatar src={item.user?.photo_url || undefined}>{!(item.user?.photo_url) ? '🧑' : null}</Avatar>
                  : <Avatar>{roleIcon()}</Avatar>
              )}
              title={item.name}
              titleTypographyProps={{ variant: 'h6', textAlign: 'center' }}
            />
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                Click to view details
              </Typography>
            </CardContent>
          </Card>
        </SwiperSlide>
      )) : (
        <SwiperSlide>
          <Typography>No {role} data found.</Typography>
        </SwiperSlide>
      )}
    </Swiper>
  ));

  const handleRefreshDashboard = () => {
    safeLoadAdminStats(id).then(() => {
      toast.success('Dashboard data refreshed');
    }).catch(() => {
      toast.error('Failed to refresh dashboard data');
    });
  };
  const handleSaveAdjustment = () => {
    const v = Number(duesAdjustment || 0) || 0;
    try {
      localStorage.setItem(`adminDuesAdjustment:${id}`, String(v || 0));
      localStorage.removeItem(`adminDuesAdjustmentOnce:${id}`);
    } catch (_) {}
    toast.success('Adjustment saved');
    setDuesAdjustment(0);
  };

  const renderCharts = () => {
    if (role === 'admin') {
      if (!adminStats) return null;
      let adj = 0;
      const inputAdj = Number(duesAdjustment || 0) || 0;
      let persisted = 0;
      try {
        const persistedRaw = localStorage.getItem(`adminDuesAdjustment:${id}`);
        persisted = Number(persistedRaw || 0) || 0;
      } catch (_) {}
      adj = inputAdj > 0 ? inputAdj : persisted;
      const rawSummary = adminStats.fee_dues_summary || {};
      const rawByClass = adminStats.fee_dues_by_class || [];
      const tuitionTotal = Number(rawSummary.tuition_due_total || 0);
      const examTotal = Number(rawSummary.exam_due_total || 0);
      let reduceTuition = Math.min(adj, tuitionTotal);
      let reduceExam = Math.max(0, adj - reduceTuition);
      const feeSummaryAdj = {
        tuition_due_total: Math.max(0, tuitionTotal - reduceTuition),
        exam_due_total: Math.max(0, examTotal - reduceExam),
        total_due: Math.max(0, (tuitionTotal + examTotal) - (reduceTuition + reduceExam))
      };
      let adjustedByClass = rawByClass;
      try {
        const tuitionSum = rawByClass.reduce((sum, c) => sum + (Number(c.tuition_due || 0) || 0), 0);
        const examSum = rawByClass.reduce((sum, c) => sum + (Number(c.exam_due || 0) || 0), 0);
        if ((tuitionSum > 0 && reduceTuition > 0) || (examSum > 0 && reduceExam > 0)) {
          adjustedByClass = rawByClass.map((c, idx) => {
            const t = Number(c.tuition_due || 0) || 0;
            const e = Number(c.exam_due || 0) || 0;
            const tReduce = tuitionSum > 0 ? (reduceTuition * t) / tuitionSum : 0;
            const eReduce = examSum > 0 ? (reduceExam * e) / examSum : 0;
            const tAdj = Math.max(0, t - tReduce);
            const eAdj = Math.max(0, e - eReduce);
            return {
              ...c,
              tuition_due: tAdj,
              exam_due: eAdj,
              total_due: Math.max(0, tAdj + eAdj)
            };
          });
        }
      } catch (_) {}
      return (
        <>
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 3,
              flexWrap: 'wrap',
              gap: 2
            }}
          >
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 'medium',
                fontSize: { xs: '1.25rem', sm: '1.5rem' }
              }}
            >
              Dashboard Analytics
            </Typography>
            <MuiTooltip title="Refresh Dashboard Data">
              <IconButton 
                onClick={handleRefreshDashboard} 
                color="primary"
                disabled={adminLoading}
                sx={{
                  bgcolor: 'rgba(25, 118, 210, 0.08)',
                  '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.15)' }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </MuiTooltip>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="বকেয়া এডজাস্ট"
                type="number"
                value={duesAdjustment}
                onChange={(e) => setDuesAdjustment(e.target.value)}
                size="small"
              />
              <Button variant="contained" onClick={handleSaveAdjustment}>সংরক্ষণ</Button>
            </Stack>
          </Box>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, lg: 6 }}>
              <Paper 
                elevation={2} 
                sx={{ 
                  p: 3, 
                  borderRadius: 2, 
                  height: '100%',
                  minHeight: 400,
                  background: 'linear-gradient(to bottom, #ffffff, #f5f5f5)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 2, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    color: '#1976d2',
                    flexShrink: 0
                  }}
                >
                  <PersonIcon /> Attendance Overview
                </Typography>
                <Divider sx={{ mb: 2, flexShrink: 0 }} />
                <Box sx={{ height: 300, flex: 1, minHeight: 0 }}>
                  <AttendanceChart attendanceData={adminStats.attendance_data || []} />
                </Box>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <Paper 
                elevation={2} 
                sx={{ 
                  p: 3, 
                  borderRadius: 2, 
                  height: '100%',
                  minHeight: 400,
                  background: 'linear-gradient(to bottom, #ffffff, #f5f5f5)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 2, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    color: '#2e7d32',
                    flexShrink: 0
                  }}
                >
                  <AccountBalanceIcon /> Fee Collection Overview
                </Typography>
                <Divider sx={{ mb: 2, flexShrink: 0 }} />
                <Box sx={{ height: 300, flex: 1, minHeight: 0 }}>
                  <FeeCollectionChart 
                    feeData={adminStats.fee_collection || adminStats.fee_data || []}
                    feeDuesSummary={feeSummaryAdj}
                    feeDuesByClass={adjustedByClass}
                  />
                </Box>
              </Paper>
            </Grid>
          </Grid>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 3, 
              borderRadius: 2, 
              mb: 4,
              background: 'linear-gradient(to bottom, #ffffff, #f5f5f5)'
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalanceIcon /> Admin Control Center
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="রিসোর্স"
                select
                value={ccResource}
                onChange={(e) => setCcResource(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                {['students','teachers','classrooms','subjects','fees','assignments','payments','exams','results','attendance','sms'].map(r => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="সার্চ"
                value={ccQuery}
                onChange={(e) => setCcQuery(e.target.value)}
              />
              <Button variant="contained" onClick={fetchCcList} disabled={ccLoading}>লোড</Button>
            </Stack>
            {ccError ? <Typography color="error" sx={{ mb: 2 }}>{ccError}</Typography> : null}
            <Box sx={{ overflowX: 'auto' }}>
              <Grid container spacing={2}>
                {(ccList || []).slice(0, 20).map((item) => (
                  <Grid size={{ xs: 12, md: 6 }} key={item.id || JSON.stringify(item)}>
                    <Paper sx={{ p: 2, borderRadius: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box sx={{ mr: 2, minWidth: 0 }}>
                          <Typography variant="subtitle2">ID: {item.id ?? 'N/A'}</Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {item.name || item.title || item.user?.username || item.user?.first_name || item.classroom?.name || 'Item'}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" onClick={() => openCcEditor(item)}>এডিট</Button>
                          <Button size="small" color="error" onClick={() => deleteCcItem(item)}>ডিলিট</Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
            <Dialog open={ccEditorOpen} onClose={() => setCcEditorOpen(false)} fullWidth maxWidth="md">
              <DialogTitle>এডিট</DialogTitle>
              <DialogContent dividers>
                <TextField
                  multiline
                  minRows={12}
                  fullWidth
                  value={ccEditorJson}
                  onChange={(e) => setCcEditorJson(e.target.value)}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setCcEditorOpen(false)}>বাতিল</Button>
                <Button variant="contained" onClick={saveCcEditor}>সংরক্ষণ</Button>
              </DialogActions>
            </Dialog>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              স্পেশাল অ্যাকশন
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="অ্যাকশন"
                select
                value={actionType}
                onChange={(e) => { 
                  setActionType(e.target.value); 
                  if (e.target.value === 'sms_broadcast' || e.target.value === 'bulk_fee_waiver' || e.target.value === 'attendance_reset' || e.target.value === 'bulk_fee_assignment' || e.target.value === 'parent_sms_templates' || e.target.value === 'monthly_assignment_schedule') loadClassroomOptions(); 
                }}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="bulk_promote">Bulk Promote</MenuItem>
                <MenuItem value="fee_plan_generator">Fee Plan Generator</MenuItem>
                <MenuItem value="sms_broadcast">SMS Broadcast</MenuItem>
                <MenuItem value="bulk_fee_waiver">Bulk Fee Waiver</MenuItem>
                <MenuItem value="result_publish">Result Publish</MenuItem>
                <MenuItem value="attendance_reset">Attendance Reset</MenuItem>
                <MenuItem value="bulk_fee_assignment">Bulk Fee Assignment Create</MenuItem>
                <MenuItem value="exam_schedule_publish">Exam Schedule Publish</MenuItem>
                <MenuItem value="parent_sms_templates">Parent SMS Templates</MenuItem>
                <MenuItem value="monthly_assignment_schedule">Monthly Assignment Scheduler</MenuItem>
              </TextField>
              {actionType === 'sms_broadcast' && (
                <>
                  <TextField
                    label="শ্রেণি"
                    select
                    value={smsClassroom}
                    onChange={(e) => setSmsClassroom(e.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {classroomOptions.map(c => (
                      <MenuItem key={c.id} value={String(c.id)}>{c.name || c.id}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="বার্তা"
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    sx={{ minWidth: 300 }}
                  />
                </>
              )}
              {actionType === 'bulk_fee_waiver' && (
                <>
                  <TextField
                    label="শ্রেণি"
                    select
                    value={feeWaiverClassroom}
                    onChange={(e) => setFeeWaiverClassroom(e.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {classroomOptions.map(c => (
                      <MenuItem key={c.id} value={String(c.id)}>{c.name || c.id}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="ডিসকাউন্ট (%)"
                    type="number"
                    value={feeWaiverPct}
                    onChange={(e) => setFeeWaiverPct(e.target.value)}
                    sx={{ minWidth: 150 }}
                  />
                </>
              )}
              {actionType === 'result_publish' && (
                <TextField
                  label="Exam ID (optional)"
                  value={resultExamId}
                  onChange={(e) => setResultExamId(e.target.value)}
                  sx={{ minWidth: 220 }}
                />
              )}
              {actionType === 'attendance_reset' && (
                <>
                  <TextField
                    label="শ্রেণি"
                    select
                    value={attendanceResetClassroom}
                    onChange={(e) => setAttendanceResetClassroom(e.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    {classroomOptions.map(c => (
                      <MenuItem key={c.id} value={String(c.id)}>{c.name || c.id}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="তারিখ (YYYY-MM-DD)"
                    value={attendanceResetDate}
                    onChange={(e) => setAttendanceResetDate(e.target.value)}
                    sx={{ minWidth: 200 }}
                  />
                </>
              )}
              {actionType === 'bulk_fee_assignment' && (
                <>
                  <TextField
                    label="শ্রেণি"
                    select
                    value={feeAssignClassroom}
                    onChange={(e) => setFeeAssignClassroom(e.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {classroomOptions.map(c => (
                      <MenuItem key={c.id} value={String(c.id)}>{c.name || c.id}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="মাস (১-১২)"
                    type="number"
                    value={feeAssignMonth}
                    onChange={(e) => setFeeAssignMonth(e.target.value)}
                    sx={{ minWidth: 150 }}
                  />
                  <TextField
                    label="Due Date (YYYY-MM-DD)"
                    value={feeAssignDueDate}
                    onChange={(e) => setFeeAssignDueDate(e.target.value)}
                    sx={{ minWidth: 220 }}
                  />
                </>
              )}
              {actionType === 'exam_schedule_publish' && (
                <TextField
                  label="Exam Schedule ID (optional)"
                  value={examScheduleId}
                  onChange={(e) => setExamScheduleId(e.target.value)}
                  sx={{ minWidth: 260 }}
                />
              )}
              {actionType === 'parent_sms_templates' && (
                <>
                  <TextField
                    label="শ্রেণি"
                    select
                    value={parentFilterClassroom}
                    onChange={(e) => setParentFilterClassroom(e.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {classroomOptions.map(c => (
                      <MenuItem key={c.id} value={String(c.id)}>{c.name || c.id}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Template"
                    select
                    value={parentTemplate}
                    onChange={(e) => setParentTemplate(e.target.value)}
                    sx={{ minWidth: 220 }}
                  >
                    <MenuItem value="dues_reminder">Dues Reminder</MenuItem>
                    <MenuItem value="attendance_alert">Attendance Alert</MenuItem>
                    <MenuItem value="result_published">Result Published</MenuItem>
                    <MenuItem value="custom">Custom</MenuItem>
                  </TextField>
                  {parentTemplate === 'custom' && (
                    <TextField
                      label="Message"
                      value={parentTemplateText}
                      onChange={(e) => setParentTemplateText(e.target.value)}
                      sx={{ minWidth: 320 }}
                    />
                  )}
                </>
              )}
              {actionType === 'monthly_assignment_schedule' && (
                <>
                  <TextField
                    label="শ্রেণি"
                    select
                    value={schedClassroom}
                    onChange={(e) => setSchedClassroom(e.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {classroomOptions.map(c => (
                      <MenuItem key={c.id} value={String(c.id)}>{c.name || c.id}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="বছর (YYYY)"
                    value={schedYear}
                    onChange={(e) => setSchedYear(e.target.value)}
                    sx={{ minWidth: 140 }}
                  />
                  <TextField
                    label="শুরু মাস (১-১২)"
                    type="number"
                    value={schedStartMonth}
                    onChange={(e) => setSchedStartMonth(e.target.value)}
                    sx={{ minWidth: 160 }}
                  />
                  <TextField
                    label="শেষ মাস (১-১২)"
                    type="number"
                    value={schedEndMonth}
                    onChange={(e) => setSchedEndMonth(e.target.value)}
                    sx={{ minWidth: 160 }}
                  />
                  <TextField
                    label="Due Day (১-২৮)"
                    type="number"
                    value={schedDueDay}
                    onChange={(e) => setSchedDueDay(e.target.value)}
                    sx={{ minWidth: 160 }}
                  />
                </>
              )}
            </Stack>
            <Stack direction="row" spacing={2}>
              {actionType === 'bulk_promote' && (
                <>
                  <Button variant="outlined" disabled={actionRunning} onClick={() => bulkPromote(true)}>Preview</Button>
                  <Button variant="contained" disabled={actionRunning} onClick={() => bulkPromote(false)}>Execute</Button>
                </>
              )}
              {actionType === 'fee_plan_generator' && (
                <Button variant="contained" disabled={actionRunning} onClick={feePlanGenerate}>Execute</Button>
              )}
              {actionType === 'sms_broadcast' && (
                <Button variant="contained" disabled={actionRunning} onClick={smsBroadcast}>Send</Button>
              )}
              {actionType === 'bulk_fee_waiver' && (
                <Button variant="contained" disabled={actionRunning} onClick={bulkFeeWaiver}>Execute</Button>
              )}
              {actionType === 'result_publish' && (
                <Button variant="contained" disabled={actionRunning} onClick={resultPublish}>Publish</Button>
              )}
              {actionType === 'attendance_reset' && (
                <Button variant="contained" disabled={actionRunning} onClick={attendanceReset}>Reset</Button>
              )}
              {actionType === 'bulk_fee_assignment' && (
                <Button variant="contained" disabled={actionRunning} onClick={bulkFeeAssignment}>Execute</Button>
              )}
              {actionType === 'exam_schedule_publish' && (
                <Button variant="contained" disabled={actionRunning} onClick={examSchedulePublish}>Publish</Button>
              )}
              {actionType === 'parent_sms_templates' && (
                <Button variant="contained" disabled={actionRunning} onClick={parentSmsTemplates}>Send</Button>
              )}
              {actionType === 'monthly_assignment_schedule' && (
                <Button variant="contained" disabled={actionRunning} onClick={monthlyAssignmentSchedule}>Execute</Button>
              )}
            </Stack>
          </Paper>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 3, 
              borderRadius: 2, 
              mb: 4,
              minHeight: 400,
              background: 'linear-gradient(to bottom, #ffffff, #f5f5f5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 2, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: '#673ab7',
                flexShrink: 0
              }}
            >
              <ClassIcon /> Class Distribution
            </Typography>
            <Divider sx={{ mb: 2, flexShrink: 0 }} />
            <Box sx={{ height: 300, flex: 1, minHeight: 0 }}>
              <ClassDistributionChart classDistribution={adminStats.class_distribution || []} />
            </Box>
          </Paper>
        </>
      );
    }

    if (!data.length) return null;

    switch(role) {
      case 'admin': {
        const chartData = [
          { name: 'Students', value: data.filter(d => d.class).length },
          { name: 'Teachers', value: data.filter(d => d.subjects).length },
          { name: 'Parents', value: Math.floor(Math.random() * 20 + 10) },
          { name: 'Committee', value: Math.floor(Math.random() * 5 + 1) },
        ];
        return (
          <Box mt={4} sx={{ width: '100%', height: { xs: 250, sm: 300, md: 350 } }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <Pie 
                  data={chartData} 
                  dataKey="value" 
                  nameKey="name" 
                  outerRadius="80%" 
                  label
                  labelLine={false}
                  animationDuration={1000}
                  animationBegin={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}`, 'Count']} />
                <Legend verticalAlign="bottom" height={36} iconSize={10} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        );
      }
      case 'teacher': {
        const attendanceData = data.map(s => ({
          name: s.name,
          attendance: s.attendance ?? Math.floor(Math.random()*30 + 70)
        }));
        return (
          <Box mt={4} sx={{ width: '100%', height: { xs: 250, sm: 300, md: 350 } }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickMargin={10} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: 8, 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    border: 'none'
                  }} 
                />
                <Legend wrapperStyle={{ paddingTop: 10 }} />
                <Bar 
                  dataKey="attendance" 
                  fill="#4CAF50" 
                  name="Attendance %" 
                  radius={[4, 4, 0, 0]}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        );
      }
      case 'student': {
        const classWise = {};
        data.forEach(s => {
          if(!classWise[s.class]) classWise[s.class] = 0;
          classWise[s.class] += s.marks ?? Math.floor(Math.random()*30 + 70);
        });
        const progressData = Object.keys(classWise).map(cls => ({
          class: cls,
          average: classWise[cls]/data.filter(s => s.class === cls).length
        }));
        return (
          <Box mt={4} sx={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="average" stroke="#9c27b0" />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        );
      }
      case 'parent': {
        const childrenData = data.map(p => ({
          name: p.name,
          childrenCount: p.children?.length ?? 0
        }));
        return (
          <Box mt={4} sx={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <BarChart data={childrenData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="childrenCount" fill="#f57c00" name="Number of Children" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        );
      }
      case 'committee': {
        const tasksData = data.map(c => ({
          name: c.name,
          tasksCount: c.tasks_count ?? 0
        }));
        return (
          <Box mt={4} sx={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <BarChart data={tasksData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="tasksCount" fill="#6d4c41" name="Number of Tasks" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        );
      }
      default: return null;
    }
  };

  const handleAddCommittee = async () => {
    if (!form.username && !form.first_name) return;
    setSaving(true);
    try {
      await api.post('/api/users/committees/', {
        school_id: id,
        username: form.username || undefined,
        password: form.password || undefined,
        first_name: form.first_name || '',
        last_name: form.last_name || '',
        email: form.email || '',
        phone_number: form.phone_number || ''
      });
      setAddOpen(false);
      setForm({ username: '', password: '', first_name: '', last_name: '', email: '', phone_number: '' });
      // Refresh list
      const res = await api.get(`/api/users/committees/?school=${id}`);
      const items = Array.isArray(res.data) ? res.data : res.data.results || [];
      const normalized = items.map((it) => {
        const user = it.user || {};
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
        const name = fullName || user.username || 'Unnamed';
        return { name, ...it };
      });
      setData(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {renderHeader()}
      {renderCards()}
      {renderCharts()}

      {/* Admin Re-Authentication Dialog */}
      <Dialog open={reauthOpen} disableEscapeKeyDown aria-labelledby="admin-reauth-title" fullWidth maxWidth="xs">
        <DialogTitle id="admin-reauth-title">অ্যাডমিন যাচাইকরণ</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            অ্যাডমিন ড্যাশবোর্ডে প্রবেশ করতে আপনার পাসওয়ার্ড দিন।
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="পাসওয়ার্ড"
              type="password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              fullWidth
              autoFocus
            />
            {reauthError ? (
              <Typography variant="body2" color="error">
                {reauthError}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setReauthOpen(false); navigate(`/school/${id}`); }} disabled={reauthLoading}>বাতিল</Button>
          <Button variant="contained" onClick={handleReauth} disabled={reauthLoading}>
            {reauthLoading ? 'যাচাই হচ্ছে...' : 'যাচাই করুন'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>এডমিন পেজ ব্যবহারের নির্দেশনা</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            এই এডমিন পেজ থেকে আপনার স্কুলের সকল তথ্য এক জায়গা থেকে নিয়ন্ত্রণ করা যায়।
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>কি কি করতে পারবেন</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            • Admin Control Center থেকে Students, Teachers, Classrooms, Subjects, Fees, Assignments, Payments, Exams, Results, Attendance, SMS—সব রিসোর্স লোড, এডিট, ডিলিট করতে পারবেন।
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            • Special Actions থেকে Bulk Promote, Fee Plan Generator, SMS Broadcast, Parent SMS Templates (প্লেসহোল্ডারসহ), Bulk Fee Waiver, Result Publish, Attendance Reset, Bulk Fee Assignment Create, Monthly Assignment Scheduler (বছরভিত্তিক), Exam Schedule Publish করতে পারবেন।
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            • বকেয়ার সমন্বয় করতে Dues Adjustment ইনপুটে পরিমাণ দিয়ে সংরক্ষণ করুন; মোট বকেয়া, বেতন এবং পরীক্ষার ফি উপযুক্তভাবে অ্যাডজাস্ট হবে।
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            • Pending Payments আইকনে ক্লিক করে অপেক্ষমাণ পেমেন্টগুলো দেখুন।
          </Typography>
          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>কিভাবে ব্যবহার করবেন</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            ১) Admin Control Center-এ রিসোর্স নির্বাচন করুন, সার্চ দিলে ফিল্টার হবে, তারপর লোড চাপুন। তালিকা থেকে এডিট বা ডিলিট করুন।
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            ২) Special Actions-এ অ্যাকশন নির্বাচন করুন। প্রয়োজনীয় ইনপুট (শ্রেণি, মাস/বছর, ডিউ ডে, টেমপ্লেট) দিন, তারপর Execute/Publish/Send চাপুন।
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            ৩) SMS টেমপ্লেটে {`{student_name}`}, {`{class_name}`}, {`{due_amount}`} প্লেসহোল্ডার ব্যবহার করলে বার্তায় স্বয়ংক্রিয়ভাবে শিক্ষার্থীর নাম, শ্রেণি ও বকেয়া বসে যাবে।
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            ৪) চার্ট সেকশনে Attendance, Fee Collection, Class Distribution থেকে সার্বিক অবস্থা দেখুন।
          </Typography>
          <Typography variant="body2">
            কোনো সমস্যায় পড়লে School Settings বা সংশ্লিষ্ট রিসোর্সে গিয়ে তথ্য ঠিক করে নিন।
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)}>বন্ধ করুন</Button>
        </DialogActions>
      </Dialog>

      {/* Selected Item Details Dialog */}
      <Dialog open={openModal} onClose={handleCloseModal} fullWidth maxWidth="sm">
        <DialogTitle>Details</DialogTitle>
        <DialogContent dividers>
          {selectedItem && (
            <>
              {selectedItem.subjects && <Typography>Subjects: {selectedItem.subjects.join(', ')}</Typography>}
              {selectedItem.attendance !== undefined && <Typography>Attendance: {selectedItem.attendance}%</Typography>}
              {selectedItem.children && <Typography>Children: {selectedItem.children.map(c => c.name).join(', ')}</Typography>}
              {selectedItem.tasks && <Typography>Tasks: {selectedItem.tasks.join(', ')}</Typography>}
            </>
          )}
          <Box sx={{ my: 2 }}>
            <Divider />
          </Box>
          <Typography variant="h6" sx={{ mb: 1 }}>Recent Payment Notifications</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {(notifications || []).filter(n => String(n.type || '') === 'payment').map(n => (
              <Paper key={String(n.id)} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {n.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {n.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(n.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Committee Member Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Committee Member</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField label="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} helperText="Optional — will auto-generate if blank" />
            <TextField label="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} helperText="Optional — generated if blank" />
            <TextField label="First Name" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} helperText="Provide either a username or first name" />
            <TextField label="Last Name" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            <TextField label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <TextField label="Phone Number" value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} placeholder="+8801712345678" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddCommittee} disabled={saving}>{saving ? 'Adding...' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      {/* Admin: Pending Payments Notification Dialog */}
      <Dialog open={notifOpen} onClose={() => setNotifOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Pending Payment Approvals</DialogTitle>
        <DialogContent dividers>
          {notifLoading && (
            <Typography>Loading pending items...</Typography>
          )}
          {!notifLoading && pendingPayments.length === 0 && (
            <Typography>No pending payments found.</Typography>
          )}
          {!notifLoading && pendingPayments.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {pendingPayments.map((p) => (
                <Paper key={String(p.id || p._id)} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {(() => {
                          const amt = Number(p.amount || p.paid_amount || 0).toLocaleString();
                          const fullName = p.student_name || p.student?.name || p.student?.user?.first_name || '';
                          const firstName = String(fullName).trim().split(/\s+/)[0] || '';
                          const rollBn = p.roll ? engToBnDigits(p.roll) : '';
                          const clsRaw = p.class_name || '';
                          const clsPart = clsRaw ? (/(শ্রেণী|শ্রেণি)/.test(clsRaw) ? clsRaw : `${clsRaw} শ্রেণি`) : '';
                          // Line 1: amount + first name + roll
                          return `${amt}টাকা ${firstName}${rollBn ? ` ${rollBn}` : ''}${clsPart ? ` ${clsPart}` : ''}`;
                        })()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {(() => {
                          const dt = formatBnDateShort(p.payment_date || p.date || '');
                          const m = String(p.method || p.payment_method || '').toLowerCase();
                          const isBkash = m.includes('bkash') || m === 'mobile_banking';
                          const methodBn = isBkash ? 'বিকাশ' : m === 'nagad' ? 'নগদ' : m === 'rocket' ? 'রকেট' : m === 'cash' ? 'ক্যাশ' : m.includes('bank') ? 'ব্যাংক' : (p.method || p.payment_method || '');
                          const senderFull = (p.sender_from || '').replace(/\s+/g, '');
                          // Line 2: date + method + '=' + full sender
                          const right = senderFull ? `${methodBn}=${senderFull}` : methodBn;
                          return [dt, right].filter(Boolean).join(' ');
                        })()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button size="small" variant="contained" color="success" startIcon={<CheckIcon />} onClick={() => approvePayment(p)}>
                        OK
                      </Button>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotifOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoleDashboard;
