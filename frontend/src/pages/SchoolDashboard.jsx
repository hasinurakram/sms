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
} from "@mui/material";
import MenuIcon from '@mui/icons-material/Menu';
import { useTheme } from '@mui/material/styles';



// Build absolute media URL from relative path
const getMediaUrl = (path) => {
  if (!path) return null;
  if (typeof path !== 'string') return null;
  if (path.startsWith('http')) return path;
  try {
    const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/,'');
    return `${base}/media/${path.replace(/\\/g, '/')}`;
  } catch (_) {
    return null;
  }
};

// Dashboard components


// Drawer width constant
const drawerWidth = 260;

// Menu items in exact order: School → Class → Section → Teacher → Student → Group → Subject → Attendance → Examination → Result → Fees → Users
const menuItems = [
  { label: 'ড্যাশবোর্ড', icon: <AssessmentIcon />, key: '' },
  { label: 'শ্রেণি', icon: <ClassIcon />, key: 'classes' },
  { label: 'শিক্ষক', icon: <PersonIcon />, key: 'teacher' },
  { label: 'ছাত্র-ছাত্রী', icon: <SchoolIcon />, key: 'student' },
  { label: 'বিষয়/সাবজেক্ট', icon: <BookIcon />, key: 'subjects' },
  { label: 'হাজিরা', icon: <CheckCircleIcon />, key: 'attendance' },
  { label: 'রেজাল্ট', icon: <AssessmentIcon />, key: 'results' },
  { label: 'রেজাল্ট কার্ড', icon: <CardMembershipIcon />, key: 'result-card' },
  { label: 'Rank List', icon: <CardMembershipIcon />, key: 'rank-list' },
  { label: 'আইডি কার্ড', icon: <CardMembershipIcon />, key: 'id-card' },
  { label: 'সার্টিফিকেট', icon: <CardMembershipIcon />, key: 'certificate' },
  { label: 'প্রবেশপত্র', icon: <CardMembershipIcon />, key: 'admission-cards' },
  { label: 'পরীক্ষা', icon: <AssessmentIcon />, key: 'examinations' },
  { label: 'ফি', icon: <PaymentIcon />, key: 'fees' },
  { label: 'ফি পরিশোধ', icon: <ReceiptIcon />, key: 'fee-receipt' },
  { label: 'রিসিট বই', icon: <ReceiptIcon />, key: 'receipt-book' },
  { label: 'সফটওয়ার এ্যাসিসটেন্ট', icon: <SupportAgentIcon />, key: 'assistant' },
  { label: 'এসএমএস', icon: <SmsIcon />, key: 'sms' },
  { label: 'অভিভাবক', icon: <PeopleIcon />, key: 'parent' },
  { label: 'কমিটি', icon: <GroupIcon />, key: 'committee' },
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
  
  // Reset state when school ID changes to show loading screen immediately
  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setLoading(true);
    setStats(null);
    setSchoolData(null);
  }

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
  
  // Check if we're on the main dashboard page with no sub-route
  const isMainDashboard = location.pathname === `/school/${id}` || location.pathname === `/school/${id}/`;
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
  }, [id, summaryExamType, summaryYear]);

  useEffect(() => {
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
      getDashboardStats(id)
        .then(async data => {
          console.log('Dashboard stats received:', data);
          // Fallback enrichment if some fields are missing
          const enriched = { ...(data || {}) };
          try {
            const needsCounts = !('students_count' in enriched) || !('teachers_count' in enriched) || !('parents_count' in enriched) || !('classes_count' in enriched) || !('subjects_count' in enriched);
            const needsClassDist = !Array.isArray(enriched.class_distribution);
            const needsFee = !Array.isArray(enriched.fee_collection);
            const needsAttendance = !Array.isArray(enriched.attendance_data);
            const needsFeeDues = !enriched.fee_dues_summary || !Array.isArray(enriched.fee_dues_by_class);
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
                const students = studentsRes.status === 'fulfilled' ? (studentsRes.value.data || []) : [];
                const teachers = teachersRes.status === 'fulfilled' ? (teachersRes.value.data || []) : [];
                const parents = parentsRes.status === 'fulfilled' ? (parentsRes.value.data || []) : [];
                const classes = classesRes.status === 'fulfilled' ? (classesRes.value.data || []) : [];
                const subjects = subjectsRes.status === 'fulfilled' ? (subjectsRes.value.data || []) : [];
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
                      const schoolIdNum = Number(id || 0);
                      if (schoolIdNum === 19) {
                        if (rtype === 'tuition') {
                          if (monthNo && monthNo > currentMonthNo) continue;
                          gross = monthlyFixed || gross;
                          due = Math.max(0, gross - paid);
                          if (due <= 0) continue;
                        } else if (rtype === 'exam') {
                          if (currentMonthNo <= 6 && !isHalf) continue;
                          if (currentMonthNo > 6 && !isAnnual) continue;
                          gross = 500;
                          due = Math.max(0, gross - paid);
                          if (due <= 0) continue;
                        }
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
                      // treat other as tuition for summary neutrality
                      entry.tuition_due += due;
                      tuition_due_total += due;
                    }
                    entry.total_due += due;
                    classMap.set(className, entry);
                  }

                  enriched.fee_dues_summary = {
                    tuition_due_total,
                    exam_due_total,
                    total_due: tuition_due_total + exam_due_total
                  };
                  enriched.fee_dues_by_class = Array.from(classMap.entries()).map(([class_name, v]) => ({ class_name, ...v }))
                    .sort((a,b) => a.class_name.localeCompare(b.class_name));
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
          setStats(enriched);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching dashboard stats:", err);
          setError("Failed to load dashboard statistics");
          setLoading(false);
        });
    } else {
      console.log('SchoolDashboard useEffect: no id provided');
    }
  }, [id]);

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
            {schoolData?.logo && (
              <Avatar
                src={getMediaUrl(schoolData.logo)}
                alt={schoolData?.name}
                sx={{ width: 64, height: 64, border: '2px solid #fff', boxShadow: 2 }}
              />
            )}
          </Box>
        </Paper>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ছাত্র-ছাত্রী" 
              value={stats?.students_count || 0} 
              icon={<PersonIcon fontSize="large" />} 
              color="#9c27b0"
              onClick={() => navigate(`/school/${id}/student`)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard 
              title="শিক্ষক" 
              value={stats?.teachers_count || 0} 
              icon={<SchoolIcon fontSize="large" />} 
              color="#2e7d32"
              onClick={() => navigate(`/school/${id}/teacher`)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard 
              title="অভিভাবক" 
              value={stats?.parents_count || 0} 
              icon={<PeopleIcon fontSize="large" />} 
              color="#6a1b9a"
              onClick={() => navigate(`/school/${id}/parent`)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="শ্রেণি" 
              value={stats?.classes_count || 0} 
              icon={<ClassIcon fontSize="large" />} 
              color="#ed6c02"
              onClick={() => navigate(`/school/${id}/classes`)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="বিষয়/সাবজেক্ট" 
              value={stats?.subjects_count || 0} 
              icon={<BookIcon fontSize="large" />} 
              color="#0288d1"
              onClick={() => navigate(`/school/${id}/subjects`)}
            />
          </Grid>
        </Grid>
        <Grid item xs={12}>
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
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardHeader title="শ্রেণি বণ্টন" />
              <CardContent sx={{ height: 300 }}>
                <ClassDistributionChart classDistribution={stats?.class_distribution || []} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
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
          <Grid item xs={12}>
            <Card>
              <CardHeader title="ফি সংগ্রহের অবস্থা" />
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
            <Avatar alt="User" sx={{ bgcolor: '#1565c0' }} />
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
        <Divider />
        <List sx={{ px: 1 }}>
          {menuItems.map((item, i) => (
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
          {menuItems.map((item, i) => (
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
    </Box>
  );
};

export default SchoolDashboard;
