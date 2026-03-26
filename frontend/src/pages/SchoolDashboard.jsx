import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams, useLocation } from "react-router-dom";
import PersonIcon from "@mui/icons-material/Person";
import EmptyState from '../components/EmptyState';
import SchoolIcon from "@mui/icons-material/School";
import GroupIcon from "@mui/icons-material/Group";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AssessmentIcon from "@mui/icons-material/Assessment";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import SmsIcon from "@mui/icons-material/Sms";
import BookIcon from "@mui/icons-material/Book";
import ClassIcon from "@mui/icons-material/Class";
import CategoryIcon from "@mui/icons-material/Category";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptIcon from "@mui/icons-material/Receipt";
import PeopleIcon from "@mui/icons-material/People";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import { setCurrentSchoolId, getDashboardStats } from '../services/dashboardService';
import api from '../utils/api';
import StatCard from '../components/dashboard/StatCard';
import AttendanceChart from '../components/dashboard/AttendanceChart';
import ClassDistributionChart from '../components/dashboard/ClassDistributionChart';
import FeeCollectionChart from '../components/dashboard/FeeCollectionChart';

import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  CssBaseline,
  Divider,
  Grid,
  Paper,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Stack,
  IconButton,
  useMediaQuery,
  Autocomplete,
  TextField,
  Chip,
  Button,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import MenuIcon from '@mui/icons-material/Menu';
import LockIcon from '@mui/icons-material/Lock';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../context/AuthContext';



const getMediaUrl = (path) => {
  if (!path) return null;
  if (typeof path !== 'string') return null;
  const val = path.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(val)) return val;
  try {
    const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/,'');
    if (/^\/?media\//i.test(val)) {
      const rel = val.startsWith('/') ? val : `/${val}`;
      return `${base}${rel}`;
    }
    return `${base}/media/${val.replace(/^\/+/, '')}`;
  } catch (_) {
    return null;
  }
};

// Dashboard components


// Drawer width constant
const drawerWidth = 260;

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
  'দ্বাদশ': 12,
  'ছয়': 6,
  'ছয়': 6
};
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

const menuItems = [
  { label: 'ড্যাশবোর্ড', icon: <AssessmentIcon />, key: '' },
  { label: 'শ্রেণি', icon: <ClassIcon />, key: 'classes' },
  { label: 'শিক্ষক', icon: <PersonIcon />, key: 'teacher' },
  { label: 'ছাত্র-ছাত্রী', icon: <SchoolIcon />, key: 'student' },
  { label: 'বিষয়/সাবজেক্ট', icon: <BookIcon />, key: 'subjects' },
  { label: 'হাজিরা', icon: <CheckCircleIcon />, key: 'attendance' },
  { label: 'রেজাল্ট', icon: <AssessmentIcon />, key: 'results' },
  { label: 'ক্লাস রেজাল্টস', icon: <AssessmentIcon />, key: 'class-results' },
  { label: 'রেজাল্ট কার্ড', icon: <CardMembershipIcon />, key: 'result-card' },
  { label: 'Rank List', icon: <CardMembershipIcon />, key: 'rank-list' },
  { label: 'আইডি কার্ড', icon: <CardMembershipIcon />, key: 'id-card' },
  { label: 'সার্টিফিকেট', icon: <CardMembershipIcon />, key: 'certificate' },
  { label: 'প্রবেশপত্র', icon: <CardMembershipIcon />, key: 'admission-cards' },
  { label: 'প্রমোশন', icon: <AssessmentIcon />, key: 'promotion' },
  { label: 'বছরভিত্তিক রিপোর্ট', icon: <AssessmentIcon />, key: 'year-report' },
  { label: 'পরীক্ষা', icon: <AssessmentIcon />, key: 'examinations' },
  { label: 'ফি', icon: <PaymentIcon />, key: 'fees' },
  { label: 'ফি পরিশোধ', icon: <ReceiptIcon />, key: 'fee-receipt' },
  { label: 'রিসিট বই', icon: <ReceiptIcon />, key: 'receipt-book' },
  { label: 'সফটওয়ার এ্যাসিসটেন্ট', icon: <SupportAgentIcon />, key: 'assistant' },
  { label: 'এসএমএস', icon: <SmsIcon />, key: 'sms' },
  { label: 'অভিভাবক', icon: <PeopleIcon />, key: 'parent' },
  { label: 'কমিটি', icon: <GroupIcon />, key: 'committee' },
  { label: 'আইডি লিস্ট', icon: <LockIcon />, key: 'credentials' },
  { label: 'এডমিন', icon: <AccountBalanceIcon />, key: 'admin' },
  { label: 'প্রোফাইল', icon: <AccountCircleIcon />, key: 'profile' },
];

const SchoolDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [schoolData, setSchoolData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    setStats(null);
    setSchoolData(null);
    setError(null);
    const cached = adsCacheRef.current.get(String(id));
    if (Array.isArray(cached)) { setAdsSlots(cached); return; }
    try {
      const raw = localStorage.getItem(`schoolAds:${id}`);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr) && arr.length) {
        setAdsSlots(arr);
        adsCacheRef.current.set(String(id), arr);
        return;
      }
    } catch (_) {}
    setAdsSlots([]);
  }, [id]);

  const [error, setError] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [schoolsList, setSchoolsList] = useState([]);
  const [schoolSearchInput, setSchoolSearchInput] = useState('');
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [summaryExamType, setSummaryExamType] = useState('annual');
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryFailBuckets, setSummaryFailBuckets] = useState(Array.from({ length: 10 }, (_, i) => i + 1));
  const [feeYear, setFeeYear] = useState(new Date().getFullYear());
  const [adsOpen, setAdsOpen] = useState(false);
  const [adsSlots, setAdsSlots] = useState([]);
  const [adText, setAdText] = useState('');
  const [adLink, setAdLink] = useState('');
  const [adMediaType, setAdMediaType] = useState('image');
  const [adMediaDataUrl, setAdMediaDataUrl] = useState('');
  const [adMediaFile, setAdMediaFile] = useState(null);
  
  // Check if we're on the main dashboard page with no sub-route
  const isMainDashboard = location.pathname === `/school/${id}` || location.pathname === `/school/${id}/`;
  const { user, logout } = useAuth();
  
  // Get role and permissions
  const role = ((user && (user.profile?.role || user.role)) || '').trim().toLowerCase();
  const isSuperUser = !!(user?.is_superuser || user?.user?.is_superuser || user?.profile?.is_superuser || user?.is_staff || role === 'admin' || role === 'super_admin' || role === 'superadmin');
  const isTeacher = role === 'teacher';

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item => {
    // Admin and Superuser see everything
    if (isSuperUser) return true;

    // Allowed for everyone (Teacher, Student, Parent, Committee)
    // ড্যাশবোর্ড, শ্রেণি, শিক্ষক, ছাত্র-ছাত্রী, বিষয়, সফটওয়ার এসিসটেন্ট, প্রোফাইল
    const commonKeys = ['', 'classes', 'teacher', 'student', 'subjects', 'assistant', 'profile'];
    if (commonKeys.includes(item.key)) return true;

    // Allowed for Teachers
    // হাজিরা, রেজাল্ট সংশ্লিষ্ট পেজগুলো (results, class-results, result-card, rank-list, examinations)
    if (isTeacher) {
      const teacherKeys = ['attendance', 'results', 'class-results', 'result-card', 'rank-list', 'examinations'];
      if (teacherKeys.includes(item.key)) return true;
    }

    // Default: hide everything else
    return false;
  });

  const currentSchoolIdRef = React.useRef(id);
  useEffect(() => { currentSchoolIdRef.current = id; }, [id]);
  const adsCacheRef = React.useRef(new Map());
  const isBanglaFirst = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    // Must contain 'bangla' or 'বাংলা' AND ('1st', 'first', '১ম', etc.)
    const hasBangla = n.includes('bangla') || n.includes('বাংলা');
    const hasFirst = n.includes('first') || n.includes('1st') || n.includes('১ম') || n.includes('প্রথম');
    return hasBangla && hasFirst;
  };
  const isBanglaSecond = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    const hasBangla = n.includes('bangla') || n.includes('বাংলা');
    const hasSecond = n.includes('second') || n.includes('2nd') || n.includes('২য়') || n.includes('দ্বিত');
    return hasBangla && hasSecond;
  };
  const isBanglaPaper = (name) => isBanglaFirst(name) || isBanglaSecond(name);
  const isClassNineOrTenName = (className) => {
    const lower = String(className || '').toLowerCase();
    return /নবম|দশম|\b9\b|\b10\b/.test(lower);
  };
  const computeBanglaCombinedPass = (resultsForStudent, passMarks) => {
    const banglaList = resultsForStudent.filter(r => isBanglaPaper(r.subject?.name || r.subject_name));
    if (!banglaList.length) return false;
    const sumCQ = banglaList.reduce((s, r) => s + (parseFloat(r.written_marks) || 0), 0);
    const sumMCQ = banglaList.reduce((s, r) => s + (parseFloat(r.mcq_marks) || 0), 0);
    return (sumCQ >= passMarks) && (sumMCQ >= passMarks);
  };
  const toBn = (val) => {
    const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(val).replace(/\d/g, d => bn[d] ?? d);
  };
  
  const normalizeExamType = (type, name) => {
    const s = String(type || '').toLowerCase();
    const rn = String(name || '').toLowerCase();
    const hasAny = (str, keys) => keys.some(k => str.includes(k));
    if (s) {
      if (hasAny(s, ['final','annual','yearly','বার্ষিক'])) return 'annual';
      if (hasAny(s, ['half','half_yearly','mid','half-yearly','অর্ধ'])) return 'half_yearly';
      if (hasAny(s, ['terminal','term','টার্মিনাল'])) return 'terminal';
      if (hasAny(s, ['model','model_test','model-test','মডেল'])) return 'model';
      if (hasAny(s, ['test','monthly','টেস্ট','মাসিক'])) return 'test';
      if (hasAny(s, ['first_term','first','first-term','প্রথম'])) return 'first_term';
      return s;
    }
    if (hasAny(rn, ['final','annual','yearly','বার্ষিক'])) return 'annual';
    if (hasAny(rn, ['half','half_yearly','mid','half-yearly','অর্ধ'])) return 'half_yearly';
    if (hasAny(rn, ['terminal','term','টার্মিনাল'])) return 'terminal';
    if (hasAny(rn, ['model','model_test','model-test','মডেল'])) return 'model';
    if (hasAny(rn, ['test','monthly','টেস্ট','মাসিক'])) return 'test';
    if (hasAny(rn, ['first_term','first','first-term','প্রথম'])) return 'first_term';
    return 'annual';
  };

  const generateSummary = async () => {
    if (!id) return;
    setSummaryLoading(true);
    try {
      // Use the optimized backend endpoint
      const res = await api.get(`/api/results/overall/dashboard_result_summary/`, {
        params: {
          school: id,
          exam_type: normalizeExamType(summaryExamType),
          year: summaryYear
        }
      });
      setSummaryRows(res.data || []);
    } catch (e) {
      console.error("Error generating summary:", e);
      setSummaryRows([]);
    } finally {
      setSummaryLoading(false);
    }
  };
  useEffect(() => {
    generateSummary();
  }, [id, summaryExamType, summaryYear, feeYear]);

  useEffect(() => {
    const computeSchoolStatsFallback = async (schoolId, targetYear) => {
      const enriched = {};
      const requests = [
        api.get(`/api/academics/students/?school=${schoolId}`),
        api.get(`/api/users/teachers/?school=${schoolId}`),
        api.get(`/api/users/parents/?school=${schoolId}`),
        api.get(`/api/academics/classrooms/?school=${schoolId}`),
        api.get(`/api/academics/subjects/?school=${schoolId}`),
        api.get(`/api/fees/payments/?school=${schoolId}`),
        api.get(`/api/fees/assignments/?school=${schoolId}`),
        api.get(`/api/fees/fees/?school=${schoolId}`),
        api.get(`/api/attendance/records/?school=${schoolId}`)
      ];
      const results = await Promise.allSettled(requests);
      const studentsRes = results[0];
      const teachersRes = results[1];
      const parentsRes = results[2];
      const classesRes = results[3];
      const subjectsRes = results[4];
      const feeRes = results[5];
      const assignRes = results[6];
      const feeStructRes = results[7];
      const attRes = results[8];
      const students = studentsRes.status === 'fulfilled' ? (studentsRes.value.data?.results || studentsRes.value.data || []) : [];
      const teachers = teachersRes.status === 'fulfilled' ? (teachersRes.value.data?.results || teachersRes.value.data || []) : [];
      const parents = parentsRes.status === 'fulfilled' ? (parentsRes.value.data?.results || parentsRes.value.data || []) : [];
      const classrooms = classesRes.status === 'fulfilled' ? (classesRes.value.data?.results || classesRes.value.data || []) : [];
      const subjects = subjectsRes.status === 'fulfilled' ? (subjectsRes.value.data?.results || subjectsRes.value.data || []) : [];
      enriched.students_count = students.length;
      enriched.teachers_count = teachers.length;
      enriched.parents_count = parents.length;
      enriched.classes_count = classrooms.length;
      enriched.subjects_count = subjects.length;
      const map = new Map();
      for (const s of students) { const cname = s.classroom?.name || s.classroom_name || s.classroom || 'Unknown'; map.set(cname, (map.get(cname) || 0) + 1); }
      enriched.class_distribution = Array.from(map.entries()).map(([classroom__name, count]) => ({ classroom__name, count }));
      const payments = feeRes?.status === 'fulfilled' ? (feeRes.value.data?.results || feeRes.value.data || []) : [];
      const byDate = new Map(); const now = new Date(); const cutoff = new Date(now.getTime() - 30*24*60*60*1000);
      for (const p of payments) { const ds = new Date(p.payment_date || p.date || p.created_at || now); if (isNaN(ds) || ds < cutoff) continue; const key = ds.toISOString().slice(0,10); byDate.set(key, (byDate.get(key) || 0) + Number(p.amount || p.paid_amount || 0)); }
      enriched.fee_collection = Array.from(byDate.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));
      const assignments = assignRes?.status === 'fulfilled' ? (assignRes.value.data?.results || assignRes.value.data || []) : [];
      const feeStructs = feeStructRes?.status === 'fulfilled' ? (feeStructRes.value.data?.results || feeStructRes.value.data || []) : [];
      const structMap = {}; for (const s of (feeStructs || [])) { structMap[String(s.id)] = s; }
      const studentMap = new Map(); for (const s of (students || [])) { studentMap.set(String(s.id), s); }
      const paidByAssign = new Map(); for (const pay of (payments || [])) { const aidRaw = pay.assignment_id || pay.assignment || pay.fee_assignment || pay.student_fee_assignment || pay.assignment?.id; const aid = aidRaw != null ? String(aidRaw) : ''; if (!aid) continue; const amount = Number(pay.amount || pay.paid_amount || 0) || 0; paidByAssign.set(aid, (paidByAssign.get(aid) || 0) + amount); }
      const classMap = new Map(); let tuition_due_total = 0; let exam_due_total = 0; const seenMonthlyByStudentMonth = new Set(); const currentMonthNo = new Date().getMonth() + 1;
      for (const a of (assignments || [])) {
        const aid = String(a.id || a._id || a.assignment_id || a.assignment || ''); if (!aid) continue;
        const feeObj = a.fee_structure || a.fee || {}; const sid = String(a.fee_structure_id || a.fee_id || feeObj.id || a.fee_structure || a.fee || ''); const sObj = (typeof feeObj === 'object' && feeObj) ? feeObj : (structMap[sid] || {});
        const baseCandidates = [a.custom_amount, a.amount, a.total_amount, a.payable_amount, a.original_amount, sObj.amount, sObj.default_amount]; let base = baseCandidates.find(x => x !== undefined && x !== null && Number(x) >= 0); base = Number(base || 0);
        const discountAmt = Number(a.discount_amount || 0) || 0; const discountPct = Number(a.discount_percentage ?? a.discount_percent ?? a.discount ?? 0) || 0;
        let gross = Math.max(0, base - discountAmt - (base * discountPct / 100)); const paid = Number(paidByAssign.get(aid) || 0); let due = Math.max(0, gross - paid); if (due <= 0) continue;
        const stuId = String(a.student_id || a.student || a.studentId || ''); const stu = studentMap.get(stuId); const classId = stu?.classroom?.id ?? stu?.classroom ?? null; const classObj = (classrooms || []).find(c => String(c.id) === String(classId)); const className = classObj?.name || (typeof classId === 'string' || typeof classId === 'number' ? String(classId) : 'Unknown');
        const freq = String((sObj && sObj.frequency) || a.frequency || a.fee_frequency || '').toLowerCase(); const rtype = freq === 'monthly' ? 'tuition' : (freq === 'one_time' ? 'exam' : 'other');
        try {
          const bnMap = { 'প্রথম': 1, 'দ্বিতীয়': 2, 'দ্বিতীয়': 2, 'তৃতীয়': 3, 'তৃতীয়': 3, 'চতুর্থ': 4, 'পঞ্চম': 5, 'ষষ্ঠ': 6, 'সপ্তম': 7, 'অষ্টম': 8, 'নবম': 9, 'দশম': 10, 'এসএসসি': 10, 'এসএসসি পরীক্ষার্থী': 10 };
          let classOrder = 0; for (const k in bnMap) { if (String(className).includes(k)) { classOrder = bnMap[k]; break; } } if (!classOrder) { const m = String(className).match(/\d+/); if (m) classOrder = parseInt(m[0], 10); }
          const monthlyFixed = classOrder >= 1 && classOrder <= 5 ? 250 : (classOrder >= 6 && classOrder <= 10 ? 150 : 0);
          const monthNo = Number(sObj.month || sObj.month_no || sObj.month_number || a.month || 0) || 0; const nameStr = String(sObj.name || sObj.title || sObj.label || '').toLowerCase(); const isHalf = /half|mid|অর্ধ/.test(nameStr); const isAnnual = /annual|final|বার্ষিক/.test(nameStr);
          if (rtype === 'tuition') { const effectiveMonth = monthNo || currentMonthNo; if (monthNo && monthNo > currentMonthNo) continue; const seenKey = `${stuId}:${effectiveMonth}`; if (seenMonthlyByStudentMonth.has(seenKey)) continue; seenMonthlyByStudentMonth.add(seenKey); gross = monthlyFixed || gross; due = Math.max(0, gross - paid); if (due <= 0) continue; }
          else if (rtype === 'exam') {
            const targetYearNum = Number(targetYear); const currentYear = new Date().getFullYear(); const ddSrc = sObj.due_date || a.due_date || null; let allow = false;
            if (targetYearNum < currentYear) { allow = true; } else if (targetYearNum > currentYear) { allow = false; }
            else { const allowHalf = isHalf && currentMonthNo >= 5; const allowAnnual = isAnnual && currentMonthNo >= 9; let allowOther = false; if (!isHalf && !isAnnual && ddSrc) { const ddObj = new Date(ddSrc); if (!isNaN(ddObj) && ddObj.getFullYear() === targetYearNum) { allowOther = ddObj.getMonth() + 1 <= currentMonthNo; } } allow = allowHalf || allowAnnual || allowOther; }
            if (!allow) continue; gross = Number(sObj.amount || a.amount || gross || 0); due = Math.max(0, gross - paid); if (due <= 0) continue;
          }
        } catch (_) {}
        const entry = classMap.get(className) || { tuition_due: 0, exam_due: 0, total_due: 0 };
        if (rtype === 'tuition') { entry.tuition_due += due; tuition_due_total += due; }
        else if (rtype === 'exam') { entry.exam_due += due; exam_due_total += due; }
        entry.total_due += due; classMap.set(className, entry);
      }
      try {
        const monthlyRateByClass = new Map();
        for (const s of (feeStructs || [])) { const freq = String(s.frequency || '').toLowerCase(); const cidRaw = s.classroom?.id ?? s.classroom_id ?? s.classroomId ?? s.classroom ?? s.class?.id ?? s.class; const cid = cidRaw != null ? String(cidRaw) : ''; if (freq === 'monthly' && cid) { const amt = Number(s.amount ?? s.default_amount ?? 0) || 0; if (amt > 0 && !monthlyRateByClass.has(cid)) monthlyRateByClass.set(cid, amt); } }
        for (const cls of (classrooms || [])) {
          const cname = cls?.name || String(cls?.id || ''); let entry = classMap.get(cname); if (!entry) { entry = { tuition_due: 0, exam_due: 0, total_due: 0 }; classMap.set(cname, entry); }
          const cidStr = String(cls.id); let monthlyRate = Number(monthlyRateByClass.get(cidStr) || 0) || 0;
          if (monthlyRate <= 0) { let order = 0; const m = String(cname).match(/\d+/); if (m) order = parseInt(m[0], 10); monthlyRate = order >= 1 && order <= 5 ? 250 : (order >= 6 && order <= 10 ? 150 : 0); }
          if (monthlyRate > 0) {
            let classStudents = (students || []).filter(s => { const cidRaw = s?.classroom?.id ?? s?.classroom_id ?? s?.classroomId ?? s?.classroom ?? s?.class?.id ?? s?.class ?? null; const cid = cidRaw != null ? String(cidRaw) : ''; return cid && cid === cidStr; });
            if ((classStudents || []).length < 30) {
              const endpoints = [`/api/academics/students/?school=${schoolId}&classroom=${cidStr}`, `/api/academics/students/?classroom=${cidStr}`];
              for (const ep of endpoints) { try { const r = await api.get(ep); const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []); if (Array.isArray(arr) && arr.length) { classStudents = arr; break; } } catch (_) {} }
            }
            for (const stu of classStudents) { const sid = String(stu.id); for (let m = 1; m <= currentMonthNo; m++) { const seenKey = `${sid}:${m}`; if (!seenMonthlyByStudentMonth.has(seenKey)) { entry.tuition_due += monthlyRate; entry.total_due += monthlyRate; tuition_due_total += monthlyRate; seenMonthlyByStudentMonth.add(seenKey); } } }
          }
        }
      } catch (_) {}
      enriched.fee_dues_summary = { tuition_due_total, exam_due_total, total_due: tuition_due_total + exam_due_total };
      enriched.fee_dues_by_class = Array.from(classMap.entries()).map(([class_name, v]) => ({ class_name, ...v }))
        .sort((a, b) => { const ao = String(a.class_name).localeCompare(String(b.class_name)); return ao; });
      const records = attRes?.status === 'fulfilled' ? (attRes.value.data?.results || attRes.value.data || []) : [];
      const attMap = new Map(); const now2 = new Date(); const cutoff2 = new Date(now2.getTime() - 7*24*60*60*1000);
      for (const r of records) { const ds = new Date(r.date || now2); if (isNaN(ds) || ds < cutoff2) continue; const key = ds.toISOString().slice(0,10); const entry = attMap.get(key) || { date: key, present: 0, absent: 0 }; if (r.present === true) entry.present += 1; else entry.absent += 1; attMap.set(key, entry); }
      enriched.attendance_data = Array.from(attMap.values()).sort((a,b) => a.date.localeCompare(b.date));
      return enriched;
    };
    if (id) {
      console.log('SchoolDashboard useEffect triggered with id:', id);
      setCurrentSchoolId(id);
      
      // Fetch school data
      console.log('Fetching school data from /api/schools/' + id + '/');
      api.get(`/api/schools/${id}/`)
        .then(res => {
          console.log('School data received:', res.data);
          setSchoolData(res.data);
        })
        .catch(err => {
          console.error("Error fetching school data:", err);
          console.error('School data error details:', err.response?.data);
        });
      
      // Fetch dashboard stats
      console.log('Starting to fetch dashboard stats...');
      setLoading(true);
      getDashboardStats(id, feeYear)
        .then(async data => {
          console.log('Dashboard stats received:', data);
          // Fallback enrichment if some fields are missing
          const enriched = { ...(data || {}) };
          try {
            const needsCounts = !('students_count' in enriched) || !('teachers_count' in enriched) || !('parents_count' in enriched) || !('classes_count' in enriched) || !('subjects_count' in enriched);
            const needsClassDist = !Array.isArray(enriched.class_distribution);
            const needsFee = !Array.isArray(enriched.fee_collection);
            const needsAttendance = !Array.isArray(enriched.attendance_data);
            const needsFeeDues = !('fee_dues_summary' in enriched) || !Array.isArray(enriched.fee_dues_by_class);
            const requests = [];
            if (needsCounts || needsClassDist) {
              requests.push(api.get(`/api/academics/students/?school=${id}`));
              requests.push(api.get(`/api/users/teachers/?school=${id}`));
              requests.push(api.get(`/api/users/parents/?school=${id}`));
              requests.push(api.get(`/api/academics/classrooms/?school=${id}`));
              requests.push(api.get(`/api/academics/subjects/?school=${id}`));
            }
            if (needsFee || needsFeeDues) {
              requests.push(api.get(`/api/fees/payments/?school=${id}`));
            }
            if (needsFeeDues) {
              // Assignments and fee structures used to compute dues
              requests.push(api.get(`/api/fees/assignments/?school=${id}`));
              requests.push(api.get(`/api/fees/fees/?school=${id}`));
              // Students to map assignments to classroom
              requests.push(api.get(`/api/academics/students/?school=${id}`));
              // Classrooms for name lookup (optional but helpful)
              requests.push(api.get(`/api/academics/classrooms/?school=${id}`));
            }
            // Try a lightweight attendance fetch (optional)
            if (needsAttendance) {
              requests.push(api.get(`/api/attendance/records/?school=${id}`));
            }
            if (requests.length > 0) {
              const results = await Promise.allSettled(requests);
              let idx = 0;
              if (needsCounts || needsClassDist) {
                const studentsRes = results[idx++];
                const teachersRes = results[idx++];
                const parentsRes = results[idx++];
                const classesRes = results[idx++];
                const subjectsRes = results[idx++];
                const students = studentsRes.status === 'fulfilled'
                  ? (Array.isArray(studentsRes.value.data) ? studentsRes.value.data : (studentsRes.value.data?.results || studentsRes.value.data?.data || []))
                  : [];
                const teachers = teachersRes.status === 'fulfilled'
                  ? (Array.isArray(teachersRes.value.data) ? teachersRes.value.data : (teachersRes.value.data?.results || teachersRes.value.data?.data || []))
                  : [];
                const parents = parentsRes.status === 'fulfilled'
                  ? (Array.isArray(parentsRes.value.data) ? parentsRes.value.data : (parentsRes.value.data?.results || parentsRes.value.data?.data || []))
                  : [];
                const classes = classesRes.status === 'fulfilled'
                  ? (Array.isArray(classesRes.value.data) ? classesRes.value.data : (classesRes.value.data?.results || classesRes.value.data?.data || []))
                  : [];
                const subjects = subjectsRes.status === 'fulfilled'
                  ? (Array.isArray(subjectsRes.value.data) ? subjectsRes.value.data : (subjectsRes.value.data?.results || subjectsRes.value.data?.data || []))
                  : [];
                if (needsCounts) {
                  enriched.students_count = enriched.students_count ?? students.length;
                  enriched.teachers_count = enriched.teachers_count ?? teachers.length;
                  enriched.parents_count = enriched.parents_count ?? parents.length;
                  enriched.classes_count = enriched.classes_count ?? classes.length;
                  enriched.subjects_count = enriched.subjects_count ?? subjects.length;
                }
                if (needsClassDist) {
                  // Build distribution: count students by classroom name/id
                  const map = new Map();
                  for (const s of students) {
                    const cname = s.classroom?.name || s.classroom_name || s.classroom || 'Unknown';
                    map.set(cname, (map.get(cname) || 0) + 1);
                  }
                  enriched.class_distribution = Array.from(map.entries()).map(([classroom__name, count]) => ({ classroom__name, count }));
                }
              }
              if (needsFee || needsFeeDues) {
                const feeRes = results[idx++];
                const payments = feeRes?.status === 'fulfilled' ? (feeRes.value.data || []) : [];
                // Aggregate last 30 days by date
                const byDate = new Map();
                const now = new Date();
                const cutoff = new Date(now.getTime() - 30*24*60*60*1000);
                for (const p of payments) {
                  const ds = new Date(p.payment_date || p.date || p.created_at || now);
                  if (isNaN(ds) || ds < cutoff) continue;
                  const key = ds.toISOString().slice(0,10);
                  byDate.set(key, (byDate.get(key) || 0) + Number(p.amount || p.paid_amount || 0));
                }
                enriched.fee_collection = Array.from(byDate.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));

                // Compute dues summary and class-wise dues if requested
                if (needsFeeDues) {
                  const assignRes = results[idx++];
                  const feeStructRes = results[idx++];
                  const studentsRes2 = results[idx++];
                  const classesRes2 = results[idx++];

                  const assignments = assignRes?.status === 'fulfilled' ? (assignRes.value.data?.results || assignRes.value.data || []) : [];
                  const feeStructs = feeStructRes?.status === 'fulfilled' ? (feeStructRes.value.data?.results || feeStructRes.value.data || []) : [];
                  const students = studentsRes2?.status === 'fulfilled' ? (studentsRes2.value.data?.results || studentsRes2.value.data || []) : [];
                  const classrooms = classesRes2?.status === 'fulfilled' ? (classesRes2.value.data?.results || classesRes2.value.data || []) : [];

                  const structMap = {};
                  for (const s of (feeStructs || [])) {
                    structMap[String(s.id)] = s;
                  }
                  const studentMap = new Map();
                  for (const s of (students || [])) {
                    studentMap.set(String(s.id), s);
                  }

                  // Sum payments by assignment
                  const paidByAssign = new Map();
                  for (const pay of (payments || [])) {
                    const aidRaw = pay.assignment_id || pay.assignment || pay.fee_assignment || pay.student_fee_assignment || pay.assignment?.id;
                    if (!aidRaw && pay.assignment) {
                      // keep
                    }
                    const aid = aidRaw != null ? String(aidRaw) : '';
                    if (!aid) continue;
                    const amount = Number(pay.amount || pay.paid_amount || 0) || 0;
                    paidByAssign.set(aid, (paidByAssign.get(aid) || 0) + amount);
                  }

                  const classMap = new Map(); // key: classroom name, value: { tuition_due, exam_due, total_due }
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

                    // Resolve class
                    const stuId = String(a.student_id || a.student || a.studentId || '');
                    const stu = studentMap.get(stuId);
                    const classId = stu?.classroom?.id ?? stu?.classroom ?? null;
                    const classObj = (classrooms || []).find(c => String(c.id) === String(classId));
                    const className = classObj?.name || (typeof classId === 'string' || typeof classId === 'number' ? String(classId) : 'Unknown');

                    // Resolve type by frequency
                    const freq = String((sObj && sObj.frequency) || a.frequency || a.fee_frequency || '').toLowerCase();
                    const rtype = freq === 'monthly' ? 'tuition' : (freq === 'one_time' ? 'exam' : 'other');

                    try {
                      const bnMap = { 'প্রথম': 1, 'দ্বিতীয়': 2, 'দ্বিতীয়': 2, 'তৃতীয়': 3, 'তৃতীয়': 3, 'চতুর্থ': 4, 'পঞ্চম': 5, 'ষষ্ঠ': 6, 'সপ্তম': 7, 'অষ্টম': 8, 'নবম': 9, 'দশম': 10 };
                      let classOrder = 0;
                      for (const k in bnMap) { if (String(className).includes(k)) { classOrder = bnMap[k]; break; } }
                      if (!classOrder) {
                        const m = String(className).match(/\d+/); if (m) classOrder = parseInt(m[0], 10);
                      }
                      const monthlyFixed = classOrder >= 1 && classOrder <= 5 ? 250 : (classOrder >= 6 && classOrder <= 10 ? 150 : 0);
                      const monthNo = Number(sObj.month || sObj.month_no || sObj.month_number || a.month || 0) || 0;
                      const nameStr = String(sObj.name || sObj.title || sObj.label || '').toLowerCase();
                      const isHalf = /half|mid|অর্ধ/.test(nameStr);
                      const isAnnual = /annual|final|বার্ষিক/.test(nameStr);
                      // Gating aligned with backend:
                      // monthly accumulates up to current month;
                      // exam: half-yearly only from May (>=5), annual only from September (>=9),
                      // other exam only if due_date month reached in target year
                      if (rtype === 'tuition') {
                        const effectiveMonth = monthNo || currentMonthNo;
                        if (monthNo && monthNo > currentMonthNo) continue;
                        const seenKey = `${stuId}:${effectiveMonth}`;
                        if (seenMonthlyByStudentMonth.has(seenKey)) continue;
                        seenMonthlyByStudentMonth.add(seenKey);
                        gross = monthlyFixed || gross;
                        due = Math.max(0, gross - paid);
                        if (due <= 0) continue;
                      } else if (rtype === 'exam') {
                        const targetYear = Number(feeYear);
                        const currentYear = new Date().getFullYear();
                        const ddSrc = sObj.due_date || a.due_date || null;
                        let allow = false;
                        if (targetYear < currentYear) {
                          allow = true;
                        } else if (targetYear > currentYear) {
                          allow = false;
                        } else {
                          const allowHalf = isHalf && currentMonthNo >= 5;
                          const allowAnnual = isAnnual && currentMonthNo >= 9;
                          let allowOther = false;
                          if (!isHalf && !isAnnual && ddSrc) {
                            try {
                              const ddObj = new Date(ddSrc);
                              if (!isNaN(ddObj) && ddObj.getFullYear() === targetYear) {
                                allowOther = ddObj.getMonth() + 1 <= currentMonthNo;
                              }
                            } catch (_) {}
                          }
                          allow = allowHalf || allowAnnual || allowOther;
                        }
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
                    } else {
                      // ignore other fees in the summary to keep tuition/exam accurate
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
                    // Only run class-level fallback when there are no assignment records
                    if ((assignments || []).length === 0) {
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
                              `/api/academics/students/?school=${id}&classroom=${cidStr}`,
                              `/api/academics/students/?classroom=${cidStr}`
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
                    }
                  } catch (_) {}

                  enriched.fee_dues_summary = {
                    tuition_due_total,
                    exam_due_total,
                    total_due: tuition_due_total + exam_due_total
                  };
                  enriched.fee_dues_by_class = Array.from(classMap.entries()).map(([class_name, v]) => ({ class_name, ...v }))
                    .sort((a, b) => {
                      const ao = getClassOrder(a.class_name);
                      const bo = getClassOrder(b.class_name);
                      if (ao !== bo) return ao - bo;
                      return String(a.class_name).localeCompare(String(b.class_name));
                    });
                }
              }
              if (needsAttendance) {
                const attRes = results[idx++];
                const records = attRes?.status === 'fulfilled' ? (attRes.value.data || []) : [];
                const byDate = new Map();
                const now = new Date();
                const cutoff = new Date(now.getTime() - 7*24*60*60*1000);
                for (const r of records) {
                  const ds = new Date(r.date || now);
                  if (isNaN(ds) || ds < cutoff) continue;
                  const key = ds.toISOString().slice(0,10);
                  const entry = byDate.get(key) || { date: key, present: 0, absent: 0 };
                  if (r.present === true) entry.present += 1; else entry.absent += 1;
                  byDate.set(key, entry);
                }
                enriched.attendance_data = Array.from(byDate.values()).sort((a,b) => a.date.localeCompare(b.date));

                try {
                  // Use the same latest date used in attendance_data so counts match the chart
                  let latestKey = null;
                  if (Array.isArray(enriched.attendance_data) && enriched.attendance_data.length > 0) {
                    latestKey = enriched.attendance_data[enriched.attendance_data.length - 1].date;
                  } else {
                    // Fallback: scan records for max date
                    for (const r of (records || [])) {
                      const dsrc = r.date || r.attendance_date || r.created_at || now;
                      const ds = new Date(dsrc);
                      if (isNaN(ds)) continue;
                      const key = ds.toISOString().slice(0,10);
                      if (!latestKey || key > latestKey) latestKey = key;
                    }
                  }
                  const todays = (records || []).filter(r => {
                    const dsrc = r.date || r.attendance_date || r.created_at || now;
                    const ds = new Date(dsrc);
                    if (isNaN(ds)) return false;
                    const isLatest = ds.toISOString().slice(0,10) === latestKey;
                    const isAbsent = (r.present !== true); // align with top summary logic
                    return isLatest && isAbsent;
                  });
                  let studentsForAtt = [];
                  let classesForAtt = [];
                  try {
                    const resS = await api.get(`/api/academics/students/?school=${id}`);
                    studentsForAtt = Array.isArray(resS.data) ? resS.data : (resS.data?.results || []);
                  } catch (_) { studentsForAtt = []; }
                  try {
                    const resC = await api.get(`/api/academics/classrooms/?school=${id}`);
                    classesForAtt = Array.isArray(resC.data) ? resC.data : (resC.data?.results || []);
                  } catch (_) { classesForAtt = []; }
                  const stuMap = new Map();
                  for (const s of studentsForAtt) { stuMap.set(String(s.id), s); }
                  const clsMap = new Map();
                  for (const c of classesForAtt) { clsMap.set(String(c.id), c); }
                  const classCounts = new Map();
                  for (const r of todays) {
                    const sid = String(r.student || r.student_id || r.studentId || '');
                    const stu = stuMap.get(sid);
                    const cid = stu?.classroom?.id ?? stu?.classroom ?? null;
                    const cname = clsMap.get(String(cid))?.name || (cid != null ? String(cid) : 'Unknown');
                    classCounts.set(cname, (classCounts.get(cname) || 0) + 1);
                  }
                  enriched.attendance_absent_by_class_today = Array.from(classCounts.entries()).map(([class_name, absent]) => ({ class_name, absent }))
                    .sort((a,b) => a.class_name.localeCompare(b.class_name));
                  enriched.attendance_absent_ref_date = latestKey || null;
                } catch (_) {
                  enriched.attendance_absent_by_class_today = [];
                  enriched.attendance_absent_ref_date = null;
                }
              }
            }
          } catch (e) {
            console.warn('Dashboard fallback enrichment failed:', e);
          }
          try {} catch (_) {}
          // Optional: override dues using simple class count × rate × months (when enabled)
          try {
            const simpleFlag = String(localStorage.getItem(`dashboardSimpleDue:${String(id)}`) || '').trim().toLowerCase();
            if (simpleFlag !== '0' && simpleFlag !== 'off') {
              const now = new Date();
              const currentMonthNo = now.getMonth() + 1;
              // Load rate map from localStorage or defaults
              let rateMap = {
                6: 150,
                7: 180,
                8: 200,
                9: 250,
                10: 250
              };
              try {
                const raw = localStorage.getItem(`classRateMap:${String(id)}`);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed && typeof parsed === 'object') {
                    rateMap = { ...rateMap, ...parsed };
                  }
                }
              } catch (_) {}
              const bnToOrder = (name) => {
                const map = { 'ষষ্ঠ': 6, 'সপ্তম': 7, 'অষ্টম': 8, 'নবম': 9, 'দশম': 10, 'এসএসসি': 10, 'এসএসসি পরীক্ষার্থী': 10 };
                for (const k in map) { if (String(name).includes(k)) return map[k]; }
                const m = String(name).match(/\d+/); return m ? parseInt(m[0], 10) : 0;
              };
              const dist = Array.isArray(enriched?.class_distribution) ? enriched.class_distribution : [];
              const monthsOverrideRaw = localStorage.getItem(`dashboardSimpleMonths:${String(id)}`);
              const monthsBase = parseInt(monthsOverrideRaw || '', 10);
              const months = Number.isFinite(monthsBase) && monthsBase > 0 ? monthsBase : currentMonthNo;
              const computedRows = dist.map(row => {
                const cname = row.classroom__name || row.class_name || row.name || 'Unknown';
                const count = Number(row.count || 0);
                const order = bnToOrder(cname);
                const rate = Number(rateMap[order] || 0);
                const tuitionDue = Math.round(count * rate * months);
                return { class_name: cname, tuition_due: tuitionDue, exam_due: 0, total_due: tuitionDue };
              });
              const sumTuition = computedRows.reduce((s, r) => s + Number(r.tuition_due || 0), 0);
              const sumExam = 0;
              enriched.fee_dues_by_class = computedRows;
              enriched.fee_dues_summary = {
                tuition_due_total: sumTuition,
                exam_due_total: sumExam,
                total_due: sumTuition + sumExam
              };
            }
          } catch (_) {}
          try {
            if (Array.isArray(enriched?.fee_dues_by_class)) {
              enriched.fee_dues_by_class = enriched.fee_dues_by_class.map((c) => ({
                ...c,
                tuition_due: Math.round(Number(c.tuition_due || 0)),
                exam_due: Math.round(Number(c.exam_due || 0)),
                total_due: Math.round(Number(c.total_due || (Number(c.tuition_due||0)+Number(c.exam_due||0)) )),
              }));
              const sumTuitionRounded = enriched.fee_dues_by_class.reduce((s, c) => s + (Number(c.tuition_due || 0) || 0), 0);
              const sumExamRounded = enriched.fee_dues_by_class.reduce((s, c) => s + (Number(c.exam_due || 0) || 0), 0);
              enriched.fee_dues_summary = {
                tuition_due_total: sumTuitionRounded,
                exam_due_total: sumExamRounded,
                total_due: sumTuitionRounded + sumExamRounded
              };
            }
          } catch (_) {}
          try {
            const toAscii = (s) => {
              const map = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };
              return String(s || '').split('').map(ch => map[ch] ?? ch).join('');
            };
            const parseAdj = (key) => {
              const raw = localStorage.getItem(key);
              const ascii = toAscii(raw || '');
              const n = Number(ascii || 0);
              return Number.isFinite(n) ? n : 0;
            };
            const adjEnabledRaw = localStorage.getItem(`adminDuesAdjustmentEnabled:${String(id)}`);
            const adjEnabled = String(adjEnabledRaw || '').trim().toLowerCase();
            const adjPersist = parseAdj(`adminDuesAdjustment:${String(id)}`);
            const adjOnce = parseAdj(`adminDuesAdjustmentOnce:${String(id)}`);
            const adj = Math.max(0, (adjEnabled === 'on' ? (adjPersist + adjOnce) : adjOnce));
            if (adjOnce > 0 && adjEnabled !== 'on') {
              try { localStorage.removeItem(`adminDuesAdjustmentOnce:${String(id)}`); } catch (_) {}
            }
            if (adj > 0 && enriched?.fee_dues_summary && Array.isArray(enriched?.fee_dues_by_class)) {
              const tuitionTotal = Number(enriched.fee_dues_summary.tuition_due_total || 0) || 0;
              const examTotal = Number(enriched.fee_dues_summary.exam_due_total || 0) || 0;
              const reduceTuition = Math.min(adj, tuitionTotal);
              const reduceExam = Math.max(0, adj - reduceTuition);
              const targetTuition = Math.max(0, tuitionTotal - reduceTuition);
              const targetExam = Math.max(0, examTotal - reduceExam);
              const distribute = (arr, getVal, setVal, target) => {
                const base = arr.map((c) => {
                  const v = Number(getVal(c) || 0) || 0;
                  return v;
                });
                const sumBase = base.reduce((s, v) => s + v, 0);
                const scaled = base.map(v => sumBase > 0 ? v * target / sumBase : 0);
                const floors = scaled.map(v => Math.floor(v));
                const sumFloors = floors.reduce((s, v) => s + v, 0);
                const remainders = scaled.map((v, i) => ({ i, frac: v - floors[i] }));
                remainders.sort((a, b) => b.frac - a.frac);
                const need = Math.max(0, Math.round(target) - sumFloors);
                for (let k = 0; k < need && k < remainders.length; k++) {
                  floors[remainders[k].i] += 1;
                }
                return arr.map((c, i) => setVal(c, floors[i]));
              };
              let rows = enriched.fee_dues_by_class.slice();
              rows = distribute(rows, (c) => c.tuition_due, (c, v) => ({ ...c, tuition_due: v }), targetTuition);
              rows = distribute(rows, (c) => c.exam_due, (c, v) => ({ ...c, exam_due: v }), targetExam);
              enriched.fee_dues_by_class = rows.map((c) => ({
                ...c,
                total_due: Math.max(0, (Number(c.tuition_due || 0) || 0) + (Number(c.exam_due || 0) || 0))
              }));
              const finalTuition = enriched.fee_dues_by_class.reduce((s, c) => s + (Number(c.tuition_due || 0) || 0), 0);
              const finalExam = enriched.fee_dues_by_class.reduce((s, c) => s + (Number(c.exam_due || 0) || 0), 0);
              const expectedTotal = Math.max(0, (tuitionTotal + examTotal) - adj);
              const actualTotal = finalTuition + finalExam;
              const delta = Math.round(expectedTotal - actualTotal);
              if (delta !== 0 && enriched.fee_dues_by_class.length > 0) {
                const idx = 0;
                const row = enriched.fee_dues_by_class[idx];
                const canAdjustTuition = delta >= 0 || (delta < 0 && (Number(row.tuition_due || 0) || 0) >= Math.abs(delta));
                if (canAdjustTuition) {
                  const newT = Math.max(0, (Number(row.tuition_due || 0) || 0) + delta);
                  enriched.fee_dues_by_class[idx] = { ...row, tuition_due: newT, total_due: newT + (Number(row.exam_due || 0) || 0) };
                } else {
                  const newE = Math.max(0, (Number(row.exam_due || 0) || 0) + delta);
                  enriched.fee_dues_by_class[idx] = { ...row, exam_due: newE, total_due: newE + (Number(row.tuition_due || 0) || 0) };
                }
              }
              const adjTuition = enriched.fee_dues_by_class.reduce((s, c) => s + (Number(c.tuition_due || 0) || 0), 0);
              const adjExam = enriched.fee_dues_by_class.reduce((s, c) => s + (Number(c.exam_due || 0) || 0), 0);
              enriched.fee_dues_summary = {
                tuition_due_total: adjTuition,
                exam_due_total: adjExam,
                total_due: adjTuition + adjExam
              };
            }
          } catch (_) {}
          setStats(enriched);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching dashboard stats:", err);
          (async () => {
            try {
              const enriched = await computeSchoolStatsFallback(id, feeYear);
              setStats(enriched);
              setError(null);
            } catch (_) {
              setError("Failed to load dashboard statistics");
            } finally {
              setLoading(false);
            }
          })();
        });
    } else {
      console.log('SchoolDashboard useEffect: no id provided');
    }
  }, [id, feeYear]);

  // Load all schools for the top-right search (once)
  useEffect(() => {
    let mounted = true;
    api.get('/api/schools/')
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        if (mounted) setSchoolsList(data);
      })
      .catch(() => { if (mounted) setSchoolsList([]); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`schoolAds:${id}`);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) setAdsSlots(arr);
    } catch (_) {
      setAdsSlots([]);
    }
  }, [id]);

  const loadAdsFromApi = async (schoolId) => {
    const candidates = [
      `/api/schools/${schoolId}/ads/`,
      `/api/ads/?school=${schoolId}`,
    ];
    for (const url of candidates) {
      try {
        const resp = await api.get(url, { params: { _t: Date.now() } });
        const data = Array.isArray(resp.data) ? resp.data : (resp.data?.results || resp.data?.data || []);
        if (Array.isArray(data) && data.length) {
          const normalized = data.map(item => ({
            id: item.id,
            text: item.text || item.title || '',
            link: item.link || item.url || '',
            type: (item.type || 'image').toLowerCase(),
            src: item.media_url || item.media || item.image_url || item.video_url || ''
          })).filter(a => a.src);
          if (normalized.length) {
            if (String(currentSchoolIdRef.current) !== String(schoolId)) return false;
            setAdsSlots(normalized);
            localStorage.setItem(`schoolAds:${schoolId}`, JSON.stringify(normalized));
            adsCacheRef.current.set(String(schoolId), normalized);
            return true;
          }
        }
      } catch (_) { continue; }
    }
    return false;
  };
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Do NOT clear immediately; show cached/local first to avoid blank on reload
      try {
        const cached = adsCacheRef.current.get(String(id));
        if (mounted && Array.isArray(cached) && cached.length) {
          setAdsSlots(cached);
        } else {
          const raw = localStorage.getItem(`schoolAds:${id}`);
          const arr = raw ? JSON.parse(raw) : [];
          if (mounted && Array.isArray(arr) && arr.length) {
            setAdsSlots(arr);
            adsCacheRef.current.set(String(id), arr);
          }
        }
      } catch (_) {}
      const ok = await loadAdsFromApi(id);
      if (!ok) {
        try {
          const raw = localStorage.getItem(`schoolAds:${id}`);
          const arr = raw ? JSON.parse(raw) : [];
          if (!mounted) return;
          if (Array.isArray(arr)) {
            setAdsSlots(arr);
            adsCacheRef.current.set(String(id), arr);
            // Attempt one-time migration of local ads to backend for persistence
            (async () => {
              try {
                const payload = (arr || []).filter(a => typeof a?.src === 'string' && a.src.startsWith('data:')).map(a => ({
                  school: id,
                  text: a.text || '',
                  link: a.link || '',
                  type: (a.type || 'image').toLowerCase(),
                  media_data_url: a.src
                }));
                if (payload.length > 0) {
                  await api.put(`/api/ads/bulk/`, { ads: payload });
                  if (String(currentSchoolIdRef.current) === String(id)) {
                    await loadAdsFromApi(id);
                  }
                }
              } catch (_) {}
            })();
          } else {
            setAdsSlots([]);
          }
        } catch (_) { if (mounted) setAdsSlots([]); }
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const handleAdsFile = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      setAdMediaFile(file);
      try {
        const previewUrl = URL.createObjectURL(file);
        setAdMediaDataUrl(previewUrl || '');
      } catch (_) {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          setAdMediaDataUrl(typeof result === 'string' ? result : '');
        };
        reader.readAsDataURL(file);
      }
    } catch (_) {}
  };
  const saveAds = async () => {
    try {
      if (adMediaFile && String(adMediaType).toLowerCase() === 'video') {
        const fieldNames = ['media', 'file', 'video', 'image', 'upload'];
        const endpoints = [`/api/schools/${id}/ads/`, `/api/ads/`];
        let uploaded = false;
        for (const ep of endpoints) {
          for (const field of fieldNames) {
            try {
              const form = new FormData();
              form.append('school', id);
              form.append('text', adText || '');
              form.append('link', adLink || '');
              form.append('type', 'video');
              form.append(field, adMediaFile);
              await api.post(ep, form, { headers: { 'Content-Type': 'multipart/form-data' } });
              uploaded = true;
              break;
            } catch (_) { /* try next */ }
          }
          if (uploaded) break;
        }
        if (uploaded) {
          if (String(currentSchoolIdRef.current) === String(id)) {
            await loadAdsFromApi(id);
          }
        } else {
          try {
            await api.post(`/api/schools/${id}/ads/`, {
              school: id,
              text: adText || '',
              link: adLink || '',
              type: 'video',
              media_data_url: adMediaDataUrl || '',
            });
            if (String(currentSchoolIdRef.current) === String(id)) {
              await loadAdsFromApi(id);
            }
          } catch (_) {}
        }
      } else {
        const nextAd = { text: adText, link: adLink, type: adMediaType, src: adMediaDataUrl };
        const next = [nextAd, ...adsSlots].filter(a => a.src);
        setAdsSlots(next);
        try { localStorage.setItem(`schoolAds:${id}`, JSON.stringify(next)); } catch (_) {}
        adsCacheRef.current.set(String(id), next);
        (async () => {
          try {
            await api.post(`/api/schools/${id}/ads/`, {
              school: id,
              text: nextAd.text || '',
              link: nextAd.link || '',
              type: nextAd.type || 'image',
              media_data_url: nextAd.src || '',
            });
            if (String(currentSchoolIdRef.current) === String(id)) {
              await loadAdsFromApi(id);
            }
          } catch (_) {}
        })();
      }
      setAdText('');
      setAdLink('');
      setAdMediaType('image');
      setAdMediaDataUrl('');
      setAdMediaFile(null);
      setAdsOpen(false);
    } catch (_) {}
  };
  const removeAd = async (idx) => {
    try {
      const ad = adsSlots[idx];
      if (ad && ad.id) {
        try {
          await api.delete(`/api/ads/${ad.id}/`);
          await loadAdsFromApi(id);
        } catch (_) {
          const next = adsSlots.filter((_, i) => i !== idx);
          setAdsSlots(next);
          localStorage.setItem(`schoolAds:${id}`, JSON.stringify(next));
          adsCacheRef.current.set(String(id), next);
        }
      } else {
        const next = adsSlots.filter((_, i) => i !== idx);
        setAdsSlots(next);
        localStorage.setItem(`schoolAds:${id}`, JSON.stringify(next));
        adsCacheRef.current.set(String(id), next);
      }
    } catch (_) {}
  };

  const manualResyncAds = async () => {
    try {
      const raw = localStorage.getItem(`schoolAds:${id}`);
      const arr = raw ? JSON.parse(raw) : [];
      const payload = (arr || []).filter(a => typeof a?.src === 'string' && a.src.startsWith('data:')).map(a => ({
        school: id,
        text: a.text || '',
        link: a.link || '',
        type: (a.type || 'image').toLowerCase(),
        media_data_url: a.src
      }));
      if (payload.length > 0) {
        await api.put(`/api/ads/bulk/`, { ads: payload });
      }
      await loadAdsFromApi(id);
    } catch (_) {
      try {
        await loadAdsFromApi(id);
      } catch (__) {}
    }
  };
  // Dashboard content to show when no specific section is selected
  const renderDashboardContent = () => {
    if (loading) {
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '80vh',
          textAlign: 'center',
          p: 3
        }}>
          <CircularProgress size={60} sx={{ mb: 4 }} />
          <Typography variant="h5" color="primary" gutterBottom sx={{ fontWeight: 'bold' }}>
            অনুগ্রহ করে অপেক্ষা করুন...
          </Typography>
          <Typography variant="body1" sx={{ maxWidth: 600, mt: 2, fontSize: '1.2rem', lineHeight: 1.6 }}>
            আপনার নির্ধারিত স্কুলের সকল স্টুডেন্টের এ্যাটেন্ডেন্স, পাস-ফেল, বকেয়া বেতনসহ শিক্ষক ও অভিভাবকসহ বিদ্যালয়ের সর্বশেষ সকল তথ্য এখনই আপনার সামনে তুলে ধরা হচ্ছে, দয়া করে 5 সেকেন্ড সময় দিন আমাদের।
          </Typography>
        </Box>
      );
    }

    if (error) {
      return (
        <Paper sx={{ p: 3, textAlign: 'center', color: 'error.main' }}>
          <Typography variant="h6">{error}</Typography>
        </Paper>
      );
    }

    return (
      <Box>
        <Paper 
          elevation={3} 
          sx={{ 
            p: 3, 
            mb: 4, 
            borderRadius: 2,
            background: 'linear-gradient(135deg, #1976d2 0%, #64b5f6 100%)',
            color: 'white'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                {schoolData?.name || 'স্কুল ড্যাশবোর্ড'}
              </Typography>
              <Typography variant="subtitle1">
                {schoolData?.address || 'Welcome to your school management dashboard'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, maxWidth: { xs: '50%', md: '60%' } }}>
            <Stack key={`ads-${id}`} direction="row" alignItems="center" sx={{ overflowX: 'auto', m: 0, p: 0, gap: '20px' }}>
              {(() => {
                const all = Array.isArray(adsSlots) ? adsSlots : [];
            const seen = new Set();
            const base = all.filter(ad => {
              const key = `${ad?.type || ''}:${ad?.src || ''}`;
              if (!ad?.src || seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            const NUM_SLOTS = 3;
            const makeGroup = (slotIndex) => base.filter((_, idx) => (idx % NUM_SLOTS) === slotIndex);
                const W = { xs: 200, sm: 240, md: 280 };
                const H = { xs: 120, sm: 120, md: 120 };
            return Array.from({ length: NUM_SLOTS }, (_, i) => (
              <AdSlot key={i} slotIndex={i} items={makeGroup(i)} width={W} height={H} />
            ));
              })()}
              {(!adsSlots || adsSlots.length === 0) && schoolData?.logo && (
                <Avatar
                  src={getMediaUrl(schoolData.logo)}
                  alt={schoolData?.name}
                  sx={{ width: 64, height: 64, border: '2px solid #fff', boxShadow: 2 }}
                />
              )}
            </Stack>
            <Button variant="outlined" size="small" onClick={manualResyncAds}>ম্যানুয়াল রি-সিঙ্ক</Button>
            </Box>
          </Box>
        </Paper>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="ছাত্র-ছাত্রী" 
              value={stats?.students_count || 0} 
              icon={<PersonIcon fontSize="large" />} 
              color="#9c27b0"
              onClick={() => navigate(`/school/${id}/student`)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard 
              title="শিক্ষক" 
              value={stats?.teachers_count || 0} 
              icon={<SchoolIcon fontSize="large" />} 
              color="#2e7d32"
              onClick={() => navigate(`/school/${id}/teacher`)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard 
              title="অভিভাবক" 
              value={stats?.parents_count || 0} 
              icon={<PeopleIcon fontSize="large" />} 
              color="#6a1b9a"
              onClick={() => navigate(`/school/${id}/parent`)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="শ্রেণি" 
              value={stats?.classes_count || 0} 
              icon={<ClassIcon fontSize="large" />} 
              color="#ed6c02"
              onClick={() => navigate(`/school/${id}/classes`)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="বিষয়/সাবজেক্ট" 
              value={stats?.subjects_count || 0} 
              icon={<BookIcon fontSize="large" />} 
              color="#0288d1"
              onClick={() => navigate(`/school/${id}/subjects`)}
            />
          </Grid>
        </Grid>
        <Grid size={12}>
          <Card>
            <CardHeader title="রেজাল্ট সামারি (পাস-ফেল)" />
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
                <TextField
                  select
                  label="পরীক্ষা"
                  value={summaryExamType}
                  onChange={(e) => setSummaryExamType(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="test">বিশেষ মূল্যায়ন</MenuItem>
                  <MenuItem value="half_yearly">অর্ধবার্ষিক</MenuItem>
                  <MenuItem value="annual">বার্ষিক</MenuItem>
                  <MenuItem value="terminal">টার্মিনাল</MenuItem>
                  <MenuItem value="model">মডেল টেস্ট</MenuItem>
                </TextField>
                <TextField
                  label="বর্ষ"
                  value={summaryYear}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setSummaryYear(Number.isNaN(v) ? '' : v);
                  }}
                  type="number"
                  sx={{ width: 140 }}
                />
                <Button variant="contained" onClick={generateSummary} disabled={summaryLoading}>
                  {summaryLoading ? 'লোড হচ্ছে…' : 'Generate'}
                </Button>
              </Stack>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ক্লাস</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">টোটাল স্টুডেন্ট</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">অনুপস্থিত স্টুডেন্ট</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">সব সাবজেক্টে পাশ করেছে</TableCell>
                      {summaryFailBuckets.map((n) => (
                        <TableCell key={n} sx={{ color: 'white', fontWeight: 'bold' }} align="center">{toBn(n)} বিষয়ে ফেল</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summaryRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{row.classLabel}</TableCell>
                        <TableCell align="center">{row.total}</TableCell>
                        <TableCell align="center">{row.absent}</TableCell>
                        <TableCell align="center">{row.allPassed}</TableCell>
                        {summaryFailBuckets.map((n) => (
                          <TableCell key={n} align="center">{row.failBuckets[n] || 0}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {summaryRows.length > 0 && (
                      <TableRow sx={{ bgcolor: 'primary.light' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>মোট</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                          {summaryRows.reduce((s, r) => s + r.total, 0)}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                          {summaryRows.reduce((s, r) => s + r.absent, 0)}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                          {summaryRows.reduce((s, r) => s + r.allPassed, 0)}
                        </TableCell>
                        {summaryFailBuckets.map((n) => (
                          <TableCell key={n} align="center" sx={{ fontWeight: 'bold' }}>
                            {summaryRows.reduce((s, r) => s + (r.failBuckets[n] || 0), 0)}
                          </TableCell>
                        ))}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardHeader title="শ্রেণি বণ্টন" />
              <CardContent sx={{ height: 300 }}>
                <ClassDistributionChart classDistribution={stats?.class_distribution || []} />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardHeader title="হাজিরা সংক্ষিপ্তসার" />
              <CardContent>
                <AttendanceChart attendanceData={stats?.attendance_data || []} />
                <Box sx={{ mt: 2 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: 'white',
                      border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                      {(() => {
                        const key = stats?.attendance_absent_ref_date;
                        let disp = '-';
                        try {
                          if (key) {
                            const d = new Date(key);
                            if (!isNaN(d)) {
                              disp = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            }
                          }
                        } catch (_) {}
                        return `সর্বশেষ দিনের (${disp}) ক্লাস-ওয়ারী অনুপস্থিতি`;
                      })()}
                    </Typography>
                    {Array.isArray(stats?.attendance_absent_by_class_today) && stats.attendance_absent_by_class_today.length > 0 ? (
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {stats.attendance_absent_by_class_today.map((row, i) => (
                          <Chip key={i} label={`${row.class_name} অনুপস্থিত: ${row.absent}`} />
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">এই দিনের কোনো অনুপস্থিতির তথ্য নেই</Typography>
                    )}
                  </Paper>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={12}>
            <Card>
              <CardHeader 
                title="ফি সংগ্রহের অবস্থা"
                action={
                  <Stack direction="row" spacing={1} alignItems="center">
                    {Number(feeYear) === new Date().getFullYear() ? (
                      <Chip label="চলতি বছর" color="primary" size="small" />
                    ) : null}
                    <TextField
                      select
                      size="small"
                      label="সাল"
                      value={feeYear}
                      onChange={(e) => setFeeYear(parseInt(e.target.value, 10))}
                      sx={{ minWidth: 110 }}
                    >
                      {Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
                        <MenuItem key={y} value={parseInt(y, 10)}>{y}</MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                }
                subheader={stats?.dues_year ? `দেখানো সাল: ${stats.dues_year}` : undefined}
              />
              <CardContent>
                <FeeCollectionChart 
                  feeData={stats?.fee_collection || []}
                  feeDuesSummary={stats?.fee_dues_summary}
                  feeDuesByClass={stats?.fee_dues_by_class}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  const AdSlot = ({ items, width, height, slotIndex }) => {
    const [idx, setIdx] = useState(0);
    const timerRef = React.useRef(null);
    useEffect(() => { setIdx(0); }, [items?.length]);
    useEffect(() => {
      if (!items || items.length <= 1) return;
      const current = items[Math.min(idx, items.length - 1)];
      if (current?.type === 'video') {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        return;
      }
      timerRef.current = setInterval(() => setIdx((i) => (i + 1) % items.length), 5000);
      return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
    }, [items, idx]);
    if (!items || items.length === 0) return null;
    const ad = items[Math.min(idx, items.length - 1)];
    return (
      <Box
        sx={{
          position: 'relative',
          width,
          height,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'rgba(255,255,255,0.2)',
          cursor: ad.link ? 'pointer' : 'default',
          m: 0,
          p: 0
        }}
        onClick={() => { if (ad.link) window.open(ad.link, '_blank'); }}
      >
        {ad.type === 'video' ? (
          <Box component="video" src={(typeof ad.src === 'string' && ad.src.startsWith('data:')) ? ad.src : getMediaUrl(ad.src)} autoPlay muted playsInline onEnded={() => setIdx((i) => (i + 1) % items.length)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Box component="img" src={(typeof ad.src === 'string' && ad.src.startsWith('data:')) ? ad.src : getMediaUrl(ad.src)} alt={ad.text || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.35)', color: '#fff', px: 0, py: 0, fontSize: 12 }}>
          <Typography variant="caption" noWrap>{ad.text || ''}</Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)`, xs: '100%' },
          ml: { md: `${drawerWidth}px`, xs: 0 },
          background: 'linear-gradient(90deg, #1976d2 0%, #64b5f6 100%)',
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {!isMdUp && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={() => setMobileOpen(true)}
                sx={{ mr: 1, display: { md: 'none' } }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Stack direction="row" spacing={1} alignItems="center">
              {schoolData?.logo && (
                <Avatar
                  src={getMediaUrl(schoolData.logo)}
                  alt={schoolData?.name}
                  sx={{ width: 36, height: 36, boxShadow: 1 }}
                />
              )}
              <Typography variant="h6">
                {schoolData?.name || `স্কুল ড্যাশবোর্ড - ${id}`}
              </Typography>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ minWidth: { xs: 160, sm: 260 }, display: 'block' }}>
              <Autocomplete
                size="small"
                options={schoolsList}
                getOptionLabel={(o) => o?.name || ''}
                value={schoolsList.find(s => String(s.id) === String(id)) || null}
                onChange={(_, val) => { if (val?.id) navigate(`/school/${val.id}`); }}
                sx={{ width: { xs: 160, sm: 260 } }}
                renderInput={(params) => (
                  <TextField {...params} label="স্কুল নির্বাচন করুন" variant="outlined" />
                )}
              />
            </Box>
            {!user && (
              <Stack direction="row" spacing={1}>
                <Button color="inherit" variant="outlined" onClick={() => navigate('/login')}>লগইন</Button>
                <Button color="inherit" variant="contained" onClick={() => navigate('/signup')}>সাইনআপ</Button>
              </Stack>
            )}
            {user && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Avatar alt={user?.username || 'User'} sx={{ bgcolor: '#1565c0' }} />
                <Typography variant="body1">{user?.first_name || user?.username || 'User'}</Typography>
                <Button color="inherit" variant="outlined" onClick={() => navigate(`/school/${id}/results`)}>রেজাল্ট ইনপুট</Button>
                <Button color="inherit" variant="text" onClick={() => navigate('/change-password')}>পাসওয়ার্ড পরিবর্তন</Button>
                <Button color="inherit" variant="contained" onClick={logout}>লগআউট</Button>
                {isSuperUser && (
                  <Button color="inherit" variant="contained" onClick={() => setAdsOpen(true)}>বিজ্ঞাপন যোগ করুন</Button>
                )}
              </Stack>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Temporary drawer on mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            স্কুল মেনু
          </Typography>
        </Toolbar>
        <Box sx={{ px: 2, pb: 1 }}>
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto' }}>
            {(adsSlots || []).map((ad, idx) => (
              <Box
                key={idx}
                sx={{ position: 'relative', width: 200, height: 56, borderRadius: 1, overflow: 'hidden', bgcolor: 'primary.light', cursor: ad.link ? 'pointer' : 'default' }}
                onClick={() => { if (ad.link) window.open(ad.link, '_blank'); }}
              >
                {ad.type === 'video' ? (
                  <Box component="video" src={(typeof ad.src === 'string' && ad.src.startsWith('data:')) ? ad.src : getMediaUrl(ad.src)} autoPlay muted loop sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Box component="img" src={(typeof ad.src === 'string' && ad.src.startsWith('data:')) ? ad.src : getMediaUrl(ad.src)} alt={ad.text || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.35)', color: '#fff', px: 1, py: 0.5, fontSize: 12 }}>
                  <Typography variant="caption" noWrap>{ad.text || ''}</Typography>
                </Box>
              </Box>
            ))}
            {Array.isArray(adsSlots) && adsSlots.length === 0 && (
              <Typography variant="body2" sx={{ color: 'primary.main', alignSelf: 'center' }}>
                এখানে বিজ্ঞাপন দেখা যাবে
              </Typography>
            )}
          </Stack>
        </Box>
        <Divider />
        <List sx={{ px: 1 }}>
          {filteredMenuItems.map((item, i) => (
            <React.Fragment key={i}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => { navigate(`/school/${id}/${item.key}`); setMobileOpen(false); }}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    bgcolor: location.pathname === `/school/${id}/${item.key}` ? 'primary.light' : 'transparent',
                    color: location.pathname === `/school/${id}/${item.key}` ? 'primary.contrastText' : 'inherit',
                    "&:hover": {
                      bgcolor: "primary.light",
                      color: "primary.contrastText",
                      "& .MuiListItemIcon-root": { color: "primary.contrastText" }
                    },
                    "& .MuiListItemIcon-root": {
                      color: location.pathname === `/school/${id}/${item.key}` ? 'primary.contrastText' : 'primary.main'
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.label}
                    primaryTypographyProps={{ fontSize: '0.95rem', fontWeight: 500 }}
                  />
                </ListItemButton>
              </ListItem>
              {item.divider && <Divider sx={{ my: 1 }} />}
            </React.Fragment>
          ))}
        </List>
      </Drawer>

      {/* Permanent drawer on md and up */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            boxShadow: '0px 3px 10px rgba(0, 0, 0, 0.1)',
          },
        }}
        open
      >
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            স্কুল মেনু
          </Typography>
        </Toolbar>
        <Divider />
        <List sx={{ px: 1 }}>
          {filteredMenuItems.map((item, i) => (
            <React.Fragment key={i}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => navigate(`/school/${id}/${item.key}`)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    bgcolor: location.pathname === `/school/${id}/${item.key}` ? 'primary.light' : 'transparent',
                    color: location.pathname === `/school/${id}/${item.key}` ? 'primary.contrastText' : 'inherit',
                    "&:hover": {
                      bgcolor: "primary.light",
                      color: "primary.contrastText",
                      "& .MuiListItemIcon-root": { color: "primary.contrastText" }
                    },
                    "& .MuiListItemIcon-root": {
                      color: location.pathname === `/school/${id}/${item.key}` ? 'primary.contrastText' : 'primary.main'
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.label}
                    primaryTypographyProps={{ fontSize: '0.95rem', fontWeight: 500 }}
                  />
                </ListItemButton>
              </ListItem>
              {item.divider && <Divider sx={{ my: 1 }} />}
            </React.Fragment>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: "#f5f5f5",
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)`, xs: '100%' },
          mt: { xs: 7, sm: 8 },
          minHeight: "100vh",
        }}
      >
        {isMainDashboard ? renderDashboardContent() : <Outlet />}
      </Box>
      <Dialog open={adsOpen} onClose={() => setAdsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>বিজ্ঞাপন ইনপুট</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField label="টেক্সট" value={adText} onChange={(e) => setAdText(e.target.value)} />
            <TextField label="লিংক (optional)" value={adLink} onChange={(e) => setAdLink(e.target.value)} />
            <TextField
              label="মিডিয়া টাইপ"
              select
              value={adMediaType}
              onChange={(e) => setAdMediaType(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="image">Image</MenuItem>
              <MenuItem value="video">Video</MenuItem>
            </TextField>
            <Button variant="outlined" component="label">
              ফাইল নির্বাচন করুন
              <input hidden type="file" accept={adMediaType === 'video' ? 'video/*' : 'image/*'} onChange={handleAdsFile} />
            </Button>
            {adMediaDataUrl && (
              adMediaType === 'video' ? (
                <Box component="video" src={adMediaDataUrl} controls sx={{ width: '100%', borderRadius: 1 }} />
              ) : (
                <Box component="img" src={adMediaDataUrl} alt="" sx={{ width: '100%', borderRadius: 1 }} />
              )
            )}
            {adsSlots.length > 0 && (
              <Stack spacing={1}>
                {adsSlots.map((ad, idx) => (
                  <Stack key={idx} direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ flex: 1 }}>{ad.text || 'বিজ্ঞাপন'} ({ad.type})</Typography>
                    <Button size="small" color="error" onClick={() => removeAd(idx)}>রিমুভ</Button>
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdsOpen(false)}>বাতিল</Button>
          <Button variant="contained" onClick={saveAds} disabled={!adMediaDataUrl}>সংরক্ষণ</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SchoolDashboard;
