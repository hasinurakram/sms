import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { isAuthenticated } from '../utils/auth';
import { useAcademics } from '../context/AcademicsContext';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  IconButton,
  Paper,
  Chip,
  Divider,
  Tab,
  Tabs,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SchoolIcon from '@mui/icons-material/School';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HomeIcon from '@mui/icons-material/Home';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import StudentCard from '../components/StudentCard';
import ImportDialog from '../components/ImportDialog';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import PhotoUpload from '../components/PhotoUpload';
import { scopedGet } from '../utils/schoolApi';
import { useAuth } from '../context/AuthContext';

export default function StudentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { 
    students: contextStudents, 
    classrooms: contextClassrooms,
    sections: contextSections,
    refreshStudents,
    refreshClassrooms,
    refreshSections,
    refreshAll,
    refreshSubjects,
    setStudents,
    fetchStudentsScoped
  } = useAcademics();
  
  const [q, setQ] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [classSummary, setClassSummary] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [studentDetailOpen, setStudentDetailOpen] = useState(false);
  const [studentDetail, setStudentDetail] = useState(null);
  const [studentAttendance, setStudentAttendance] = useState([]);
  const [studentResults, setStudentResults] = useState([]);
  const [sliceStudents, setSliceStudents] = useState(null);
  const [sliceLoading, setSliceLoading] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { user: authUser } = useAuth();
  const currentRole = String(authUser?.profile?.role || authUser?.role || '').toLowerCase();
  const canAdminEdit = !!(authUser?.is_superuser || authUser?.is_staff || currentRole === 'admin' || currentRole === 'superadmin');
  const denyMsg = 'আপনি  এই কাজটি করার জন্য অনুমোদিত ব্যাক্তি নন, দয়া করে এডমিন অথবা প্রধান শিক্ষকের সাথে যোগাযোগ করুন, ধন্যবাদ।';
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    phone_number: '',
    classroom_id: '',
    section_id: '',
    group: '',
    roll_number: '',
    blood_group: '',
    guardian_id: '',
    profile_picture: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [promoteFromClassId, setPromoteFromClassId] = useState('');
  const [promoteToClassId, setPromoteToClassId] = useState('');
  const [promoteSectionMode, setPromoteSectionMode] = useState('preserve'); // 'preserve' | 'single'
  const [promoteSingleSectionName, setPromoteSingleSectionName] = useState('ক');
  const [promoteExamType, setPromoteExamType] = useState('annual');
  const [promoteYear, setPromoteYear] = useState(new Date().getFullYear());
  const [promoting, setPromoting] = useState(false);
  const [promotePreview, setPromotePreview] = useState({ total: 0, eligible: 0, missing: 0, examLabel: '' });
  const [promoteExamId, setPromoteExamId] = useState(null);
  const location = useLocation();
  const [editFormSectionsList, setEditFormSectionsList] = useState([]);
  const [editFormSectionsLoading, setEditFormSectionsLoading] = useState(false);
  useEffect(() => {
    try {
      const path = String(location.pathname || '');
      if (path.endsWith('/promotion')) {
        setPromoteDialogOpen(true);
      }
    } catch (_) {}
  }, [location.pathname]);

  useEffect(() => {
    const normalizeExamType = (t, name = '') => {
      const s = String(t || '').toLowerCase();
      const n = String(name || '').toLowerCase();
      if (s) return s;
      if (/বার্ষিক|annual/.test(n)) return 'annual';
      if (/ফাইনাল|final/.test(n)) return 'final';
      if (/অর্ধ.?বার্ষিক|half/.test(n)) return 'half_yearly';
      if (/টার্মিনাল|terminal|term/.test(n)) return 'terminal';
      if (/মডেল|model/.test(n)) return 'model';
      if (/প্রথম.?টার্ম|first.?term/.test(n)) return 'first_term';
      if (/পরীক্ষা|test/.test(n)) return 'test';
      return 'all';
    };
    const extractYear = (ex) => {
      try {
        const nameStr = String(ex?.name || '').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
        const m = nameStr.match(/(20\d{2})/);
        if (m) return parseInt(m[1], 10);
        const dt = ex?.exam_date || ex?.date || ex?.created_at;
        if (dt) {
          const d = new Date(dt);
          if (!Number.isNaN(d.getTime())) return d.getFullYear();
        }
      } catch (_) {}
      return null;
    };
    (async () => {
      if (!id || !promoteFromClassId) return;
      try {
        const res = await scopedGet('/api/results/examinations/', id, { classroom: promoteFromClassId, page_size: 2000 }, { timeout: 30000 });
        const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const list = (arr || []).filter(e => {
          const et = normalizeExamType(e.exam_type, e.name);
          return promoteExamType === 'all' ? true : (et === promoteExamType);
        });
        let bestYear = null;
        let bestTime = -1;
        for (const ex of list) {
          const y = extractYear(ex);
          const dt = ex?.exam_date || ex?.date || ex?.created_at;
          const t = dt ? new Date(dt).getTime() : 0;
          if (y != null) {
            if (bestYear == null || Number(y) > Number(bestYear) || t > bestTime) {
              bestYear = Number(y);
              bestTime = t;
            }
          } else if (t > bestTime) {
            bestTime = t;
            bestYear = new Date(t).getFullYear();
          }
        }
        if (bestYear != null && Number.isFinite(bestYear)) {
          setPromoteYear(bestYear);
        }
      } catch (_) {}
    })();
  }, [id, promoteFromClassId, promoteExamType]);

  useEffect(() => {
    (async () => {
      try {
        if (!id || !promoteFromClassId || !promoteExamType || !promoteYear) {
          setPromotePreview({ total: 0, eligible: 0, missing: 0, examLabel: '' });
          return;
        }
        const classList = await fetchStudentsScoped(id, { classroom: promoteFromClassId });
        const total = Array.isArray(classList) ? classList.length : 0;
        let examsResp = await scopedGet('/api/results/examinations/', id, { classroom: promoteFromClassId, page_size: 2000, year: promoteYear }, { timeout: 30000 });
        let examsArr = Array.isArray(examsResp.data) ? examsResp.data : (examsResp.data?.results || []);
        const normalizeExamType = (t, name = '') => {
          const s = String(t || '').toLowerCase();
          const n = String(name || '').toLowerCase();
          if (s) return s;
          if (/বার্ষিক|annual/.test(n)) return 'annual';
          if (/ফাইনাল|final/.test(n)) return 'final';
          if (/অর্ধ.?বার্ষিক|half/.test(n)) return 'half_yearly';
          if (/টার্মিনাল|terminal|term/.test(n)) return 'terminal';
          if (/মডেল|model/.test(n)) return 'model';
          if (/পরীক্ষা|test/.test(n)) return 'test';
          return 'all';
        };
        const filteredExams = (Array.isArray(examsArr) ? examsArr : []).filter(e => {
          const et = normalizeExamType(e.exam_type, e.name);
          return promoteExamType === 'all' ? true : (et === promoteExamType);
        });
        let ex = null;
        if ((filteredExams || []).length > 0) {
          const counts = await Promise.allSettled(
            filteredExams.map(e => scopedGet('/api/results/overall/', id, { examination: e.id, year: promoteYear, page_size: 2000 }, { timeout: 20000 }))
          );
          let bestIdx = -1;
          let bestCount = -1;
          filteredExams.forEach((e, idx) => {
            const res = counts[idx];
            if (res.status === 'fulfilled') {
              const data = res.value?.data;
              const arr = Array.isArray(data) ? data : (data?.results || []);
              const c = Array.isArray(arr) ? arr.length : 0;
              if (c > bestCount) { bestCount = c; bestIdx = idx; }
            }
          });
          if (bestIdx !== -1) ex = filteredExams[bestIdx];
          if (!ex) {
            const preferred = filteredExams.filter(e => e && e.pass_marks != null);
            const sorted = (preferred.length ? preferred : filteredExams).slice().sort((a, b) => {
              const ad = a.exam_date ? new Date(a.exam_date).getTime() : 0;
              const bd = b.exam_date ? new Date(b.exam_date).getTime() : 0;
              if (bd !== ad) return bd - ad;
              return (b.id || 0) - (a.id || 0);
            });
            ex = sorted[0];
          }
        }
        if (!ex) {
          setPromotePreview({ total, eligible: 0, missing: total, examLabel: '' });
          setPromoteExamId(null);
          return;
        }
        const exId = typeof ex.id === 'number' ? ex.id : parseInt(String(ex.id || 0), 10);
        const exLabel = `${ex.name || ''}`.trim();
        const resResp = await scopedGet('/api/results/overall/', id, { examination: exId, year: promoteYear, page_size: 5000 }, { timeout: 30000 });
        const arr = Array.isArray(resResp.data) ? resResp.data : (resResp.data?.results || []);
        const bySid = new Map();
        for (const r of arr || []) {
          const sid = typeof r.student === 'object' ? (r.student?.id ?? r.student?.student_id) : r.student;
          if (!sid) continue;
          const grade = r.grade || '';
          const isPassed = (r.is_passed != null) ? Boolean(r.is_passed) : (String(grade).toUpperCase() !== 'F');
          if (isPassed) bySid.set(String(sid), true);
        }
        const eligible = Array.from(new Set(classList.map(s => String(s.id)))).filter(sid => bySid.has(String(sid))).length;
        const missing = Math.max(0, total - eligible);
        setPromotePreview({ total, eligible, missing, examLabel: exLabel });
        setPromoteExamId(exId);
      } catch (_) {
        setPromotePreview({ total: 0, eligible: 0, missing: 0, examLabel: '' });
        setPromoteExamId(null);
      }
    })();
  }, [id, promoteFromClassId, promoteExamType, promoteYear, fetchStudentsScoped]);

  const banglaNumberMap = {
    'প্লে': -3,
    'play': -3,
    'নার্সারি': -2,
    'nursery': -2,
    'কেজি': -1,
    'kg': -1,
    'কে.জি': -1,
    'কে.জি.': -1,
    '১ম': 1,
    '২য়': 2,
    '২য়': 2,
    '৩য়': 3,
    '৩য়': 3,
    '৪র্থ': 4,
    '৫ম': 5,
    '৬ষ্ঠ': 6,
    '৭ম': 7,
    '৮ম': 8,
    '৯ম': 9,
    '১০ম': 10,
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
    'এসএসসি': 10.5,
    'এস.এস.সি': 10.5,
    'একাদশ': 11,
    'দ্বাদশ': 12
  };
  const getClassOrder = (className) => {
    const s = String(className || '').toLowerCase();
    if (s.includes('play') || s.includes('প্লে')) return -3;
    if (s.includes('nursery') || s.includes('নার্সারি') || s.includes('শিশু')) return -2;
    if (s.includes('kg') || s.includes('কেজি') || s.includes('কে.জি')) return -1;
    for (const [k, v] of Object.entries(banglaNumberMap)) {
      if (String(className || '').includes(k)) return v;
    }
    const m = String(className || '').match(/\d+/);
    if (m) return parseInt(m[0], 10);
    return 999;
  };
  const sortedClasses = useMemo(() => {
    const arr = Array.isArray(contextClassrooms) ? contextClassrooms.slice() : [];
    arr.sort((a, b) => {
      const oa = getClassOrder(a?.name);
      const ob = getClassOrder(b?.name);
      if (oa !== ob) return oa - ob;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
    return arr;
  }, [contextClassrooms]);

  // Resolve various possible user photo fields to an absolute URL
  const resolvePhotoUrl = (raw) => {
    try {
      const val = typeof raw === 'string' ? raw : (raw || '');
      if (!val) return null;
      if (/^https?:\/\//i.test(val)) return val;
      const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
      const normalized = val.replace(/\\/g, '/');
      if (!normalized || normalized === '/' || normalized === 'media' || normalized === '/media' || normalized === '/media/') return null;
      if (normalized.startsWith('/')) return `${base}${normalized}`;
      return `${base}/media/${normalized}`;
    } catch (_) {
      return raw || null;
    }
  };

  // Build a robust key set for the currently linked guardian (for Edit dialog),
  // considering varying backend shapes: guardian may be profile id, user id, or username
  const currentGuardianKeySet = useMemo(() => {
    try {
      const set = new Set();
      const g = selectedStudent?.guardian;
      const gidCandidates = [
        selectedStudent?.guardian_id,
        editFormData?.guardian_id,
        (typeof g === 'object' ? g?.id : undefined),
        (typeof g === 'number' || typeof g === 'string' ? g : undefined),
        (typeof g === 'object' ? g?.user?.id : undefined)
      ].filter(v => v !== undefined && v !== null).map(v => String(v));
      gidCandidates.forEach(x => set.add(x));
      const gUsernames = [
        (typeof g === 'object' ? (g?.user?.username || g?.username) : undefined),
        (typeof g === 'string' ? g : undefined)
      ].filter(Boolean).map(u => `u:${String(u)}`);
      gUsernames.forEach(u => set.add(u));
      return set;
    } catch (_) {
      return new Set();
    }
  }, [selectedStudent, editFormData?.guardian_id]);

  // Initialize data when component mounts or school ID changes
  useEffect(() => {
    if (id) {
      loadStudents();
    }
  }, [id]);

  // Update class summary when students or classrooms change
  useEffect(() => {
    if (contextStudents && contextClassrooms) {
      const classIdToCount = contextStudents.reduce((acc, s) => {
        const cidRaw = s.classroom?.id ?? s.classroom;
        const cid = cidRaw != null ? Number(cidRaw) : null;
        if (Number.isFinite(cid)) acc[cid] = (acc[cid] || 0) + 1;
        return acc;
      }, {});

      // Helper: get numeric grade if present (supports Bengali digits/names and English)
      const bnDigits = { '০':0,'১':1,'২':2,'৩':3,'৪':4,'৫':5,'৬':6,'৭':7,'৮':8,'৯':9 };
      const parseBnNumber = (str) => {
        try {
          if (!str) return NaN;
          const norm = String(str).replace(/[০-৯]/g, d => bnDigits[d] ?? d);
          const n = parseInt(norm, 10);
          return Number.isNaN(n) ? NaN : n;
        } catch (_) { return NaN; }
      };
      const gradeFromName = (name) => {
        const n = String(name || '').trim();
        const lower = n.toLowerCase();
        if (/\b6\b/.test(lower)) return 6;
        if (/\b7\b/.test(lower)) return 7;
        if (/\b8\b/.test(lower)) return 8;
        if (/\b9\b/.test(lower)) return 9;
        if (/\b10\b/.test(lower)) return 10;
        // Bengali numerals
        const num = parseBnNumber(n);
        if ([6,7,8,9,10].includes(num)) return num;
        // Bengali words
        if (lower.includes('ষষ্ঠ')) return 6;
        if (lower.includes('সপ্তম')) return 7;
        if (lower.includes('অষ্টম')) return 8;
        if (lower.includes('নবম')) return 9;
        if (lower.includes('দশম')) return 10;
        return null;
      };
      const orderKey = (c) => {
        const g = gradeFromName(c.name);
        // Place 6-10 first in natural order; others go after (1000 offset keeps original relative order by name)
        return g ? g : 1000;
      };
      const sortedClassrooms = [...contextClassrooms].sort((a, b) => {
        const oa = getClassOrder(a?.name);
        const ob = getClassOrder(b?.name);
        if (oa !== ob) return oa - ob;
        return String(a?.name || '').localeCompare(String(b?.name || ''));
      });

      const summary = sortedClassrooms.map(c => ({
        id: c.id,
        name: c.name,
        count: classIdToCount[c.id] || 0
      }));

      setClassSummary(summary);
      setInitialLoad(false);
    }
  }, [contextStudents, contextClassrooms]);
  
  useEffect(() => {
    try {
      if (!id || !selectedClass) {
        setSliceStudents(null);
        setSliceLoading(false);
        return;
      }
      const clsObj = (contextClassrooms || []).find(c => Number(c.id) === Number(selectedClass));
      const name = String(clsObj?.name || '').toLowerCase();
      const req = /ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b/.test(name);
      if (req && !selectedSection) {
        setSliceStudents(null);
        setSliceLoading(false);
        return;
      }
      setSliceLoading(true);
      const filters = selectedSection ? { classroom: selectedClass, section: selectedSection } : { classroom: selectedClass };
      fetchStudentsScoped(id, filters)
        .then(list => {
          setSliceStudents(Array.isArray(list) ? list : []);
          try {
            const count = Array.isArray(list) ? list.length : 0;
            if (count > 0) {
              const clsName = clsObj?.name || '';
              const secName = selectedSection ? ((contextSections || []).find(s => String(s.id) === String(selectedSection))?.name || '') : '';
              const scope = secName ? `${clsName} - ${secName}` : clsName;
              if (scope) toast.success(`Loaded ${count} students (${scope})`);
            }
          } catch (_) {}
        })
        .catch(() => {
          setSliceStudents([]);
        })
        .finally(() => setSliceLoading(false));
    } catch (_) {
      setSliceStudents(null);
      setSliceLoading(false);
    }
  }, [id, selectedClass, selectedSection, contextClassrooms, fetchStudentsScoped]);
  
  // Add Student Dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parents, setParents] = useState([]);
  
  const [newStudent, setNewStudent] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    classroom_id: '',
    section_id: '',
    roll_number: '',
    blood_group: '',
    guardian_id: '',
    guardian_name: ''
  });
  const [newStudentErrors, setNewStudentErrors] = useState({});
  const [addFormSections, setAddFormSections] = useState([]);
  const [addFormSectionsLoading, setAddFormSectionsLoading] = useState(false);

  // Determine if the selected classroom requires sections (only for class 6–10)
  const requiresSection = useMemo(() => {
    try {
      const clsId = newStudent.classroom_id ? Number(newStudent.classroom_id) : null;
      if (!clsId) return false;
      const clsObj = (contextClassrooms || []).find(c => Number(c.id) === clsId);
      const name = String(clsObj?.name || '').toLowerCase();
      return /ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b/.test(name);
    } catch (_) { return false; }
  }, [newStudent.classroom_id, contextClassrooms]);

  // Determine if the currently selected class (in the main page) requires sections (only for class 6–10)
  const requiresSectionForSelectedClass = useMemo(() => {
    try {
      if (!selectedClass) return false;
      const clsObj = (contextClassrooms || []).find(c => Number(c.id) === Number(selectedClass));
      const name = String(clsObj?.name || '').toLowerCase();
      return /ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b/.test(name);
    } catch (_) { return false; }
  }, [selectedClass, contextClassrooms]);

  // Load sections for the selected classroom specifically for the Add Student form
  useEffect(() => {
    const cls = newStudent.classroom_id ? Number(newStudent.classroom_id) : null;
    if (!id || !cls || !requiresSection) {
      setAddFormSections([]);
      return;
    }
    let cancelled = false;
    setAddFormSectionsLoading(true);
    scopedGet('/api/academics/sections/', id, { classroom: cls }, { timeout: 15000 })
      .then(res => {
        if (cancelled) return;
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setAddFormSections(data);
      })
      .catch(() => {
        if (cancelled) return;
        setAddFormSections([]);
      })
      .finally(() => {
        if (!cancelled) setAddFormSectionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, newStudent.classroom_id]);
  
  useEffect(() => {
    const cls = editFormData.classroom_id ? Number(editFormData.classroom_id) : null;
    if (!id || !cls) return;
    try {
      const clsObj = (contextClassrooms || []).find(c => Number(c.id) === cls);
      const name = String(clsObj?.name || '').toLowerCase();
      const requires = /ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b/.test(name);
      if (!requires) { setEditFormSectionsList([]); return; }
      (async () => {
        try {
          setEditFormSectionsLoading(true);
          const res = await scopedGet('/api/academics/sections/', id, { classroom: cls }, { timeout: 15000 });
          const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
          setEditFormSectionsList(data);
        } catch {
          setEditFormSectionsList([]);
        } finally {
          setEditFormSectionsLoading(false);
        }
      })();
    } catch (_) {}
  }, [id, editFormData.classroom_id, contextSections, contextClassrooms, refreshSections]);

  const loadStudents = async (showToast = true) => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Refreshing academic shell (classes/sections/subjects)...');
      await Promise.allSettled([
        refreshClassrooms(id),
        refreshSections(id),
        refreshSubjects(id)
      ]);
      console.log('Academic shell refreshed. Loading students list...');
      // Try context-native refresh first for robustness
      let list = [];
      try {
        const refreshed = await refreshStudents(id);
        if (Array.isArray(refreshed) && refreshed.length) {
          list = refreshed;
        }
      } catch (_) { /* ignore and fall back */ }
      if (!Array.isArray(list) || list.length === 0) {
        list = await fetchStudentsScoped(id, {});
      }
      if (!Array.isArray(list) || list.length === 0) {
        try {
          const endpoints = [
            `/api/academics/students/?school=${id}`,
            `/api/academics/students/?classroom__school=${id}`,
            `/api/academics/students/`,
            `/api/students/?school=${id}`,
            `/api/students/`
          ];
          const seen = new Set();
          const agg = [];
          for (const ep of endpoints) {
            try {
              const r = await api.get(ep, { timeout: 30000 });
              const data = r.data;
              const arr = Array.isArray(data) ? data : (data?.results || data?.data || []);
              for (const s of (arr || [])) {
                const sid = String(s.id ?? s.student_id ?? '');
                if (!sid || seen.has(sid)) continue;
                seen.add(sid);
                agg.push(s);
              }
            } catch (_) {}
          }
          if (agg.length) {
            const sorted = [...agg].sort((a, b) => {
              const rA = String(a?.roll_number ?? '').trim();
              const rB = String(b?.roll_number ?? '').trim();
              const emptyA = !rA;
              const emptyB = !rB;
              if (emptyA && !emptyB) return 1;
              if (!emptyA && emptyB) return -1;
              if (emptyA && emptyB) return 0;
              const ar = parseInt(rA.replace(/\D/g, ''), 10);
              const br = parseInt(rB.replace(/\D/g, ''), 10);
              const aNum = Number.isNaN(ar) ? null : ar;
              const bNum = Number.isNaN(br) ? null : br;
              if (aNum !== null && bNum !== null && aNum !== bNum) return aNum - bNum;
              return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
            });
            list = sorted;
          }
        } catch (_) {}
      }
      setStudents(Array.isArray(list) ? list : []);
      if (showToast) {
        const studentCount = list.length;
        if (studentCount > 0) {
          toast.success(`Loaded ${studentCount} students (school-wide)`);
        }
      }
      console.log('Current student IDs:', list.map(s => s.id));
    } catch (err) {
      console.error('Students API Error:', err);
      setError('Failed to load students. Please try again.');
      toast.error('Failed to load students');
      // Do not re-throw to prevent uncaught runtime errors
    } finally {
      setLoading(false);
    }
  };

  // Helper: Bengali numerals
  const toBn = (val) => {
    const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(val).replace(/\d/g, d => bn[d] ?? d);
  };

  // Helper: count students for a given section in the selected class
  const getStudentCountForSection = (sectionId) => {
    try {
      const clsId = Number(selectedClass);
      if (!Number.isFinite(clsId)) return 0;
      if (sectionId === 'UNASSIGNED') {
        return (contextStudents || []).filter(s => {
          const sc = s.classroom?.id ?? s.classroom;
          return Number(sc) === clsId && !(s.section?.id ?? s.section);
        }).length;
      }
      const sid = Number(sectionId);
      return (contextStudents || []).filter(s => {
        const sc = s.classroom?.id ?? s.classroom;
        return Number(sc) === clsId && Number((s.section?.id ?? s.section)) === sid;
      }).length;
    } catch (_) { return 0; }
  };
  
  const handleClassSelect = (classId) => {
    setSelectedClass(classId);
    setSelectedSection(null);
    setSelectedGroup('');
    setQ(''); // Reset search when changing class
    // We don't need to filter students here as the filtered variable handles this
  };
  
  const handleStudentSelect = (student) => {
    setStudentDetail(student);
    setDetailTab(0);
    loadStudentDetails(student);
  };
  
  const handleEditStudent = async (student) => {
    if (!canAdminEdit) { toast.error(denyMsg); return; }
    // Verify student still exists before opening edit dialog
    try {
      const response = await api.get(`/api/academics/students/${student.id}/`);
      if (response.data) {
        // Student exists, use fresh data
        setSelectedStudent(response.data);
        setEditDialogOpen(true);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('This student no longer exists. Refreshing the list...');
        // Refresh the list to remove deleted students
        refreshAll(id);
      } else {
        console.error('Error fetching student:', error);
        toast.error('Failed to load student details');
      }
    }
  };
  
  const handleDeleteStudent = (student) => {
    if (!canAdminEdit) { toast.error(denyMsg); return; }
    setSelectedStudent(student);
    setDeleteDialogOpen(true);
  };
  
  // Populate edit form when a student is selected for editing
  useEffect(() => {
    if (selectedStudent && editDialogOpen) {
      setEditFormData({
        first_name: selectedStudent.user?.first_name || '',
        last_name: selectedStudent.user?.last_name || '',
        email: selectedStudent.user?.email || '',
        username: selectedStudent.user?.username || '',
        phone_number: selectedStudent.user?.phone_number || '',
        classroom_id: selectedStudent.classroom?.id || '',
        section_id: selectedStudent.section?.id || '',
        group: selectedStudent.group || '',
        roll_number: selectedStudent.roll_number || '',
        blood_group: selectedStudent.blood_group || '',
        guardian_id: selectedStudent.guardian?.id || '',
        profile_picture: selectedStudent.user?.photo_url || '',
        guardian_name: (selectedStudent.guardian_name || `${(selectedStudent.guardian?.user?.first_name||'').trim()} ${(selectedStudent.guardian?.user?.last_name||'').trim()}`.trim()).trim()
      });
      setEditPassword('');
      setEditPasswordConfirm('');
      setPhotoFile(null); // Reset photo file when dialog opens
    }
  }, [selectedStudent, editDialogOpen]);

  // Handle updating a student profile
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');

  const handleUpdateStudent = async () => {
    if (!canAdminEdit) { toast.error(denyMsg); return; }
    if (!selectedStudent?.id) {
      toast.error('No student selected');
      return;
    }
    
    try {
      setLoading(true);
      const allowedSectionNames = new Set(['ক','খ','গ']);
      let sectionIdForUpdate = editFormData.section_id || '';
      try {
        if (sectionIdForUpdate) {
          const secObj = (contextSections || []).find(s => String(s.id) === String(sectionIdForUpdate));
          if (secObj && !allowedSectionNames.has(String(secObj.name || ''))) {
            sectionIdForUpdate = '';
            toast.warning('সেকশন কেবল ক/খ/গ হতে পারে; সেকশন ফাঁকা রাখা হচ্ছে');
          }
        }
      } catch (_) {}
      // If class requires sections and none selected, try to auto-assign by group/name
      try {
        const clsIdNum = editFormData.classroom_id ? Number(editFormData.classroom_id) : null;
        if (clsIdNum && !sectionIdForUpdate) {
          const clsObj2 = (contextClassrooms || []).find(c => Number(c.id) === clsIdNum);
          const name2 = String(clsObj2?.name || '').toLowerCase();
          const requiresSec = /ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b/.test(name2);
          if (requiresSec) {
            const secList = (contextSections || []).filter(s => Number(s.classroom?.id ?? s.classroom) === clsIdNum);
            // If student has group and matching-named section exists, use it
            const stuGroup = String(selectedStudent?.group || '').toLowerCase();
            const grpToSec = stuGroup === 'science' ? 'বিজ্ঞান' : (stuGroup === 'arts' ? 'মানবিক' : (stuGroup === 'commerce' ? 'ব্যবসায়' : ''));
            if (grpToSec) {
              const match = secList.find(s => String(s.name || '').includes(grpToSec));
              if (match) {
                sectionIdForUpdate = match.id;
              }
            }
            // If still empty and exactly one section exists, use that
            if (!sectionIdForUpdate && secList.length === 1) {
              sectionIdForUpdate = secList[0].id;
            }
          }
        }
      } catch (_) {}
      let guardianIdToUse = editFormData.guardian_id || '';
      const typedGuardianName = String(editFormData.guardian_name || '').trim();
      if (!guardianIdToUse && typedGuardianName.length > 1) {
        try {
          const normalize = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const typedNorm = normalize(typedGuardianName);
          const matched = (parents || []).find(p => {
            const full = normalize(`${p?.user?.first_name || ''} ${p?.user?.last_name || ''}`.trim() || p?.user?.first_name || '');
            return full && full === typedNorm;
          });
          if (matched?.id) {
            guardianIdToUse = matched.id;
          } else {
            const parentBase = (typedGuardianName || editFormData.phone_number || 'parent').toLowerCase().replace(/[^a-z0-9]/g, '');
            const parentUsername = await ensureAvailableUsername(parentBase);
            const parentForm = new FormData();
            parentForm.append('school_id', id);
            parentForm.append('username', parentUsername);
            parentForm.append('password', '123456');
            parentForm.append('first_name', typedGuardianName);
            if (editFormData.phone_number) parentForm.append('phone_number', editFormData.phone_number);
            parentForm.append('role', 'parent');
            parentForm.append('is_active', 'true');
            const resp = await api.post('/api/users/parents/', parentForm, {
              headers: { 'Content-Type': 'multipart/form-data', 'X-Requested-With': 'XMLHttpRequest' }
            });
            guardianIdToUse = resp.data?.user?.id || '';
          }
        } catch (_) { /* ignore */ }
      }
      
      // Update student profile information (classroom, section, roll, guardian)
      // Send null for empty values instead of empty strings
      const studentData = {
        classroom_id: editFormData.classroom_id || null,
        section_id: sectionIdForUpdate || null,
        group: editFormData.group || '',
        roll_number: editFormData.roll_number || '',
        blood_group: editFormData.blood_group || '',
        guardian_id: guardianIdToUse || null,
        first_name: editFormData.first_name || '',
        last_name: editFormData.last_name || '',
        email: editFormData.email || '',
        phone_number: editFormData.phone_number || ''
      };
      
      // Use FormData for multipart/form-data content type
    const formData = new FormData();
      Object.keys(studentData).forEach(key => {
        if (studentData[key] !== null && studentData[key] !== undefined && studentData[key] !== '') {
          formData.append(key, studentData[key]);
        }
      });
    if (editFormData.username && editFormData.username !== (selectedStudent?.user?.username || '')) {
      formData.append('username', editFormData.username);
    }
    if (editPassword) {
      if (editPassword !== editPasswordConfirm) {
        toast.error('নতুন পাসওয়ার্ড নিশ্চিতকরণ মেলেনি');
        setLoading(false);
        return;
      }
      formData.append('password', editPassword);
    }
      if (typedGuardianName) {
        formData.append('guardian_name', typedGuardianName);
      }
      
      // If there's a photo file, add it to the form data
      if (photoFile) {
        formData.append('photo', photoFile);
      }
      
      // Update the student record
      const response = await api.patch(
        `/api/academics/students/${selectedStudent.id}/`, 
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.status === 200) {
        toast.success('Student profile updated successfully');
        setEditDialogOpen(false);
        refreshAll(id);
      }
    } catch (error) {
      console.error('Error updating student:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      toast.error(error.response?.data?.detail || 'Failed to update student. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle student deletion
  const confirmDeleteStudent = async () => {
    if (!canAdminEdit) { toast.error(denyMsg); return; }
    if (!selectedStudent?.id) {
      toast.error('No student selected');
      return;
    }

    try {
      setLoading(true);
      
      // Helper: try multiple endpoints; treat 404 as already-deleted success
      const deleteWithFallbacks = async (tries) => {
        let lastErr = null;
        let saw404 = false;
        for (const t of tries) {
          try {
            if (t.method === 'delete') await api.delete(t.url);
            else await api.post(t.url, t.data || {});
            return 'ok';
          } catch (e) {
            const status = e?.response?.status;
            if (status === 404) { saw404 = true; lastErr = e; continue; }
            lastErr = e; continue;
          }
        }
        if (saw404) return 'already';
        throw lastErr || new Error('Delete failed');
      };

      // First delete the student record (multiple backends supported)
      await deleteWithFallbacks([
        { method: 'delete', url: `/api/academics/students/${selectedStudent.id}/` },
        { method: 'post',   url: `/api/academics/students/${selectedStudent.id}/delete/`, data: {} },
        { method: 'delete', url: `/api/students/${selectedStudent.id}/` },
        { method: 'post',   url: `/api/students/${selectedStudent.id}/delete/`, data: {} },
      ]);
      
      // Then delete the associated user account
      if (selectedStudent.user?.id) {
        await deleteWithFallbacks([
          { method: 'delete', url: `/api/users/${selectedStudent.user.id}/` },
          { method: 'post',   url: `/api/users/${selectedStudent.user.id}/delete/`, data: {} },
        ]);
      }
      
      toast.success('Student deleted successfully');
      setDeleteDialogOpen(false);
      refreshAll(id); // Refresh the student list
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete student. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle photo change from PhotoUpload component
  const handlePhotoChange = (file) => {
    setPhotoFile(file);
  };

  const handleCloseDetail = () => {
    setStudentDetailOpen(false);
    setStudentDetail(null);
    setStudentAttendance([]);
    setStudentResults([]);
  };
  
  const handleBackToClasses = () => {
    setSelectedClass(null);
    loadStudents(); // Reload all students
  };

  useEffect(() => {
    loadStudents(false);
    loadFormData();
  }, [id]);

  // Pre-fill Add Student form with selected class/section so entry goes inside that section even without roll
  useEffect(() => {
    if (!addDialogOpen) return;
    const cls = selectedClass || newStudent.classroom_id || '';
    let sec = selectedSection || newStudent.section_id || '';
    // Only assign a section automatically for classes that require sections (6–10)
    const clsObj = (contextClassrooms || []).find(c => Number(c.id) === Number(cls));
    const name = String(clsObj?.name || '').toLowerCase();
    const req = /ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b/.test(name);
    if (req && cls && !sec) {
      const list = (contextSections || []).filter(s => (s.classroom?.id ?? s.classroom) === Number(cls));
      const order = ['ক','খ','গ'];
      const prioritized = order.map(nm => (list.find(s => s.name === nm) || null)?.id).find(Boolean);
      sec = prioritized || (list[0]?.id || '');
    } else if (!req) {
      sec = '';
    }
    setNewStudent(ns => ({
      ...ns,
      classroom_id: cls,
      section_id: sec
    }));
  }, [addDialogOpen, selectedClass, selectedSection, contextSections]);

  // Preselect class/section from URL query (?classroom=ID&section=ID)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cls = params.get('classroom');
      const sec = params.get('section');
      if (cls) {
        const clsNum = Number(cls);
        if (!Number.isNaN(clsNum)) {
          setSelectedClass(clsNum);
        }
      }
      if (sec) {
        const secNum = Number(sec);
        if (!Number.isNaN(secNum)) {
          setSelectedSection(secNum);
        }
      } else {
        // If no section provided, ensure section is cleared to show section grid
        setSelectedSection(null);
      }
    } catch (_) {}
  }, []);
  
  const loadStudentDetails = (student) => {
    setStudentDetailOpen(true);
    
    // Load student attendance
    api.get(`/api/attendance/records/?student=${student.id}`)
      .then(res => {
        setStudentAttendance(res.data);
      })
      .catch(err => {
        console.error('Failed to load attendance:', err);
        setStudentAttendance([]);
      });
      
    // Load student results
    api.get(`/api/results/student-results/?student=${student.id}`)
      .then(res => {
        setStudentResults(res.data);
      })
      .catch(err => {
        console.error('Failed to load results:', err);
        setStudentResults([]);
      });
  };
  
  const loadFormData = async () => {
    try {
      // Use classrooms from context and only load parents
      let url = `/api/users/parents/?school=${id}`;
      const all = [];
      // Follow pagination to fetch all parents
      while (url) {
        const res = await api.get(url);
        const data = res.data;
        const items = Array.isArray(data) ? data : (data?.results || []);
        all.push(...items);
        // If response is paginated, use 'next'; otherwise stop
        url = Array.isArray(data) ? null : (data?.next || null);
      }
      setParents(all);
      
      // Note: Do not show a toast here based on initial context state.
      // The AcademicsContext may still be loading on first render, which caused a false warning.
      // The UI already shows an EmptyState when there are truly no classes.
    } catch (err) {
      console.error('Error loading form data:', err);
      console.error('Error response:', err.response?.data);
      toast.error('Failed to load form data: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Do not auto-create sections; rely on existing sections for each class
  useEffect(() => {
    const ensureDefaultSections = async (classId) => {
      if (!classId) return;
      try {
        return;
      } catch (_) {}
    };
    ensureDefaultSections(newStudent.classroom_id);
  }, [newStudent.classroom_id, contextSections, refreshSections]);

  const handleAddStudent = async () => {
    // Validate required fields
    const errors = {};
    if (!newStudent.username && !newStudent.first_name) {
      errors.first_name = 'Provide at least a username or a first name';
      setNewStudentErrors(errors);
      toast.warning('Provide at least a username or a first name');
      return;
    }
    // Require section only for classes that have sections (6–10)
    if (newStudent.classroom_id) {
      try {
        const clsObj = (contextClassrooms || []).find(c => Number(c.id) === Number(newStudent.classroom_id));
        const name = String(clsObj?.name || '').toLowerCase();
        const requires = /ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b/.test(name);
        if (requires && !newStudent.section_id) {
          errors.section_id = 'Section is required';
          setNewStudentErrors(errors);
          toast.warning('সেকশন নির্বাচন করুন');
          return;
        }
      } catch (_) { /* ignore */ }
    }

    try {
      setSaving(true);
      
      // Auto-generate creds if missing to allow first-name-only creation
      const base = (newStudent.username || newStudent.first_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const genPassword = newStudent.password || '12345678';
      // Always ensure availability for the final username (even if user typed one)
      const finalUsername = await ensureAvailableUsername(base);

      // If a username is provided and taken, block submission and show suggestions
      if (newStudent.username && usernameCheck.available === false) {
        toast.error('This username is already taken. Please choose another.');
        setSaving(false);
        return;
      }
      let createdGuardianId = '';
      const typedGuardianName = String(newStudent.guardian_name || '').trim();
      if (!newStudent.guardian_id && typedGuardianName.length > 1) {
        const normalize = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const typedNorm = normalize(typedGuardianName);
        const matched = (parents || []).find(p => {
          const full = normalize(`${p?.user?.first_name || ''} ${p?.user?.last_name || ''}`.trim() || p?.user?.first_name || '');
          return full && full === typedNorm;
        });
        if (matched?.id) {
          createdGuardianId = matched.id;
        } else {
          try {
            const parentBase = (typedGuardianName || newStudent.phone_number || 'parent').toLowerCase().replace(/[^a-z0-9]/g, '');
            const parentUsername = await ensureAvailableUsername(parentBase);
            const parentForm = new FormData();
            parentForm.append('school_id', id);
            parentForm.append('username', parentUsername);
            parentForm.append('password', '123456');
            parentForm.append('first_name', typedGuardianName);
            if (newStudent.phone_number) parentForm.append('phone_number', newStudent.phone_number);
            parentForm.append('role', 'parent');
            parentForm.append('is_active', 'true');
            const resp = await api.post('/api/users/parents/', parentForm, {
              headers: {
                'Content-Type': 'multipart/form-data',
                'X-Requested-With': 'XMLHttpRequest'
              }
            });
            createdGuardianId = resp.data?.user?.id || '';
          } catch (pgErr) {
            const status = pgErr?.response?.status;
            // If not admin (403), silently continue; backend student serializer will auto-create parent
            if (status !== 403) {
              toast.warning('অভিভাবক তৈরি করতে সমস্যা হয়েছে');
            }
          }
        }
      }
      // Use multipart so we can include optional photo
      const form = new FormData();
      // Backend serializer expects school_id for writes
      form.append('school_id', id);
      form.append('username', finalUsername);
      form.append('password', genPassword);
      form.append('first_name', newStudent.first_name || '');
      form.append('last_name', newStudent.last_name || '');
      form.append('email', newStudent.email || '');
      form.append('phone_number', newStudent.phone_number || '');
      if (newStudent.classroom_id) form.append('classroom_id', newStudent.classroom_id);
      if (newStudent.section_id) form.append('section_id', newStudent.section_id);
      if (newStudent.group) form.append('group', newStudent.group);
      const guardianToLink = newStudent.guardian_id || createdGuardianId;
      if (guardianToLink) form.append('guardian_id', guardianToLink);
      if (typedGuardianName) form.append('guardian_name', typedGuardianName);
      form.append('roll_number', newStudent.roll_number || '');
      form.append('blood_group', newStudent.blood_group || '');
      if (newStudent._photoFile) {
        try {
          const src = newStudent._photoFile;
          const buf = await src.arrayBuffer();
          const cloned = new File([buf], src.name || 'photo.jpg', { type: src.type || 'application/octet-stream' });
          form.append('photo', cloned);
        } catch (_) {
          form.append('photo', newStudent._photoFile);
        }
      }

      let createdStudent = null;
      try {
        const res = await api.post('/api/academics/students/', form);
        createdStudent = res.data;
      } catch (postErr) {
        const b = postErr.response?.data || {};
        const usernameErr = Array.isArray(b?.username) && b.username.some(x => String(x).toLowerCase().includes('taken'));
        if (usernameErr) {
          // Retry once with a fresh available username
          const retryUsername = await ensureAvailableUsername(base);
          form.set('username', retryUsername);
          const res2 = await api.post('/api/academics/students/', form);
          createdStudent = res2.data;
        } else {
          throw postErr;
        }
      }

      // Fallback: if guardian not linked in create response, patch it explicitly
      try {
        const gId = guardianToLink;
        const sid = createdStudent?.id;
        const hasGuardian =
          createdStudent?.guardian?.id != null ||
          createdStudent?.guardian_id != null ||
          createdStudent?.guardian != null;
        if (sid && gId && !hasGuardian) {
          const patchForm = new FormData();
          patchForm.append('guardian_id', gId);
          await api.patch(`/api/academics/students/${sid}/`, patchForm);
        }
      } catch (_) { /* ignore patch failure */ }

      toast.success('Student added successfully!');
      setAddDialogOpen(false);
      setNewStudentErrors({});
      resetForm();
      // Refresh all data in the context to update class cards automatically
      refreshAll(id);
    } catch (err) {
      const backend = err.response?.data;
      const fieldErrors = typeof backend === 'object' ? backend : {};
      let msg = '';
      if (typeof backend === 'object') {
        if (Array.isArray(backend?.non_field_errors) && backend.non_field_errors.length) {
          msg = String(backend.non_field_errors[0] || '');
        } else if (typeof backend?.detail === 'string' && backend.detail) {
          msg = backend.detail;
        } else {
          const firstKey = Object.keys(backend || {}).find(k => Array.isArray(backend[k]) && backend[k].length);
          if (firstKey) msg = String(backend[firstKey][0] || '');
        }
      }
      if (!msg) msg = err.message || 'Failed to add student';
      setNewStudentErrors(fieldErrors || {});
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Live username availability check for Add Student dialog
  const [usernameCheck, setUsernameCheck] = useState({ loading: false, available: null, suggestions: [], msg: '' });

  // Ensure a unique username by checking availability and trying alternatives
  const ensureAvailableUsername = useCallback(async (desiredBase) => {
    const base = (desiredBase || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'student';
    const tryNames = new Set();
    // First try exact base if user explicitly typed it
    tryNames.add(base);
    // Then a few random suffix variants
    for (let i = 0; i < 8; i++) {
      const suffix = String(Math.floor(Math.random() * 9000) + 1000);
      tryNames.add(`${base}${suffix}`);
    }
    for (const candidate of tryNames) {
      try {
        const res = await api.get(`/api/users/username-availability/`, { params: { q: candidate } });
        if (res.data?.available === true) return candidate;
      } catch (_) { /* ignore and try next */ }
    }
    // Fallback: timestamped
    const ts = Date.now().toString().slice(-6);
    return `${base}${ts}`;
  }, []);
  useEffect(() => {
    const username = (newStudent.username || '').trim();
    if (!username) {
      setUsernameCheck({ loading: false, available: null, suggestions: [], msg: '' });
      return;
    }
    let cancelled = false;
    setUsernameCheck(prev => ({ ...prev, loading: true, msg: '' }));
    const h = setTimeout(async () => {
      try {
        const res = await api.get(`/api/users/username-availability/`, { params: { q: username } });
        if (cancelled) return;
        setUsernameCheck({ loading: false, available: res.data.available, suggestions: res.data.suggestions || [], msg: '' });
      } catch (e) {
        if (cancelled) return;
        setUsernameCheck({ loading: false, available: null, suggestions: [], msg: e?.response?.data?.error || 'Check failed' });
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(h); };
  }, [newStudent.username]);

  const resetForm = () => {
    setNewStudent({
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      email: '',
      phone_number: '',
      classroom_id: '',
      section_id: '',
      roll_number: '',
      blood_group: '',
      guardian_id: '',
      guardian_name: '',
      _photoFile: null
    });
  };

  // Filter parents by selected class/section for Add Student form
  const eligibleGuardianIdsForAdd = useMemo(() => {
    try {
      const cls = newStudent.classroom_id ? Number(newStudent.classroom_id) : null;
      const sec = newStudent.section_id ? Number(newStudent.section_id) : null;
      if (!cls && !sec) return new Set();
      const ids = new Set();
      (contextStudents || []).forEach(s => {
        const sCls = s.classroom?.id ?? s.classroom;
        const sSec = s.section?.id ?? s.section;
        if (cls && sCls !== cls) return;
        if (sec && sSec !== sec) return;
        const gid = s.guardian?.id ?? s.guardian;
        if (gid) ids.add(Number(gid));
      });
      return ids;
    } catch (_) { return new Set(); }
  }, [newStudent.classroom_id, newStudent.section_id, contextStudents]);

  const filteredParentsAdd = useMemo(() => {
    if (!parents || eligibleGuardianIdsForAdd.size === 0) return [];
    return parents.filter(p => p?.user?.id && eligibleGuardianIdsForAdd.has(Number(p.user.id)));
  }, [parents, eligibleGuardianIdsForAdd]);

  // Filter parents by selected class/section for Edit Student form
  const eligibleGuardianIdsForEdit = useMemo(() => {
    try {
      const cls = editFormData.classroom_id ? Number(editFormData.classroom_id) : null;
      const sec = editFormData.section_id ? Number(editFormData.section_id) : null;
      if (!cls && !sec) return new Set();
      const ids = new Set();
      (contextStudents || []).forEach(s => {
        const sCls = s.classroom?.id ?? s.classroom;
        const sSec = s.section?.id ?? s.section;
        if (cls && sCls !== cls) return;
        if (sec && sSec !== sec) return;
        const gid = s.guardian?.id ?? s.guardian;
        if (gid) ids.add(Number(gid));
      });
      return ids;
    } catch (_) { return new Set(); }
  }, [editFormData.classroom_id, editFormData.section_id, contextStudents]);

  const filteredParentsEdit = useMemo(() => {
    if (!parents || eligibleGuardianIdsForEdit.size === 0) return [];
    return parents.filter(p => p?.user?.id && eligibleGuardianIdsForEdit.has(Number(p.user.id)));
  }, [parents, eligibleGuardianIdsForEdit]);

  // ইউজার ফ্রেন্ডলি name ফিল্টার
  const normalizeGroup = (val) => {
    const s = String(val || '').trim().toLowerCase();
    if (!s) return '';
    if (s === 'science') return 'science';
    if (s === 'arts') return 'arts';
    if (s === 'commerce') return 'commerce';
    if (s.includes('বিজ্ঞান') || s.includes('science') || s.startsWith('sci')) return 'science';
    if (s.includes('মানবিক') || s.includes('arts')) return 'arts';
    if (s.includes('ব্যবসা') || s.includes('বাণিজ্য') || s.includes('commerce')) return 'commerce';
    return s;
  };
  const activeFast = Boolean(selectedClass && ((requiresSectionForSelectedClass && selectedSection) || (!requiresSectionForSelectedClass)));
  const baseStudents = activeFast && Array.isArray(sliceStudents) ? sliceStudents : (contextStudents || []);
  const filtered = baseStudents.filter(s => {
    // First filter by selected class if any
    if (selectedClass) {
      const sc = s.classroom?.id ?? s.classroom;
      if (Number(sc) !== Number(selectedClass)) return false;
    }
    // Optional: filter by group when selected
    if (selectedGroup) {
      const g = normalizeGroup(s.group);
      if (g !== String(selectedGroup).toLowerCase()) return false;
    }
    // Next, filter by selected section if any
    if (!selectedGroup && selectedSection) {
      if (selectedSection === 'UNASSIGNED') {
        const sid = s.section?.id ?? s.section;
        if (sid) return false;
      } else {
        const sidVal = s.section?.id ?? s.section;
        if (Number(sidVal) !== Number(selectedSection)) return false;
      }
    }
    // Then filter by search term
    if (!q) return true;
    const searchTerm = q.toLowerCase();
    const name = `${s.user?.first_name || s.user?.username || ''} ${s.user?.last_name || ''}`.toLowerCase();
    const username = (s.user?.username || '').toLowerCase();
    const rollNumber = (s.roll_number || '').toLowerCase();
    return name.includes(searchTerm) || username.includes(searchTerm) || rollNumber.includes(searchTerm);
  });

  return (
    <>
    <Box sx={{ p: 3 }}>
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
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              {selectedClass ? (
                <>
                  <Button 
                    variant="text" 
                    onClick={handleBackToClasses}
                    sx={{ mr: 2, color: 'white', fontWeight: 'bold' }}
                  >
                    ← শ্রেণি তালিকা
                  </Button>
                  {contextClassrooms.find(c => c.id === selectedClass)?.name || 'শ্রেণি'}
                </>
              ) : 'শিক্ষার্থী ব্যবস্থাপনা'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              নতুন শিক্ষার্থী যোগ করুন, ইমপোর্ট করুন এবং শিক্ষার্থীর রেকর্ড পরিচালনা করুন
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
              স্কুল আইডি: {id} | মোট শিক্ষার্থী: {contextStudents.length}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button 
              variant="contained" 
              onClick={() => {
                if (!isAuthenticated()) {
                  navigate('/login');
                  return;
                }
                setPromoteFromClassId(selectedClass || '');
                setPromoteToClassId('');
                setPromoteSectionMode('preserve');
                setPromoteSingleSectionName('ক');
                setPromoteDialogOpen(true);
              }}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
              }}
            >
              শ্রেণি প্রমোশন
            </Button>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => {
                if (!isAuthenticated()) {
                  navigate('/login');
                  return;
                }
                setAddDialogOpen(true);
              }}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
              }}
            >
              শিক্ষার্থী যোগ করুন
            </Button>
            <Button 
              variant="outlined" 
              onClick={() => {
                if (!isAuthenticated()) {
                  navigate('/login');
                  return;
                }
                setImportOpen(true);
              }}
              sx={{ 
                borderColor: 'rgba(255,255,255,0.5)', 
                color: 'white',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              ইমপোর্ট
            </Button>
            <Button 
              variant="outlined" 
              onClick={() => {
                if (!isAuthenticated()) {
                  navigate('/login');
                  return;
                }
                const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/,'');
                window.open(`${base}/api/academics/students/export_csv/?school=${id}`, '_blank');
              }}
              sx={{ 
                borderColor: 'rgba(255,255,255,0.5)', 
                color: 'white',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              এক্সপোর্ট
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />} 
              onClick={() => {
                console.log('Manual refresh triggered for school ID:', id);
                loadStudents();
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

      {!selectedClass && (
        <Box sx={{ mb: 4 }}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, bgcolor: '#f5f9ff' }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              শ্রেণি সারসংক্ষেপ
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
              শিক্ষার্থীদের দেখতে একটি শ্রেণি নির্বাচন করুন। মোট শ্রেণি: {classSummary.length}
            </Typography>
            
            <Grid container spacing={2}>
              {classSummary.map(classItem => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={classItem.id}>
                  <Paper 
                    elevation={2} 
                    sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6
                      },
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center'
                    }}
                    onClick={() => handleClassSelect(classItem.id)}
                  >
                    <SchoolIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {classItem.name}
                    </Typography>
                    <Chip 
                      label={`${classItem.count} জন শিক্ষার্থী`} 
                      color="primary" 
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Paper>
                </Grid>
              ))}
              
              {loading ? (
                <Grid size={{ xs: 12 }} sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Grid>
              ) : contextClassrooms?.length === 0 ? (
                <Grid size={{ xs: 12 }}>
                  <EmptyState
                    icon={<SchoolIcon fontSize="large" />}
                    title="কোনো শ্রেণি পাওয়া যায়নি"
                    message="শিক্ষার্থী যোগ করার আগে দয়া করে আপনার স্কুলে শ্রেণি যোগ করুন।"
                    action={
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => navigate(`/school/${id}/classes`)}
                        startIcon={<AddIcon />}
                      >
                        শ্রেণি যোগ করুন
                      </Button>
                    }
                  />
                </Grid>
              ) : classSummary.length === 0 ? (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="info">
                    কোনো শ্রেণি পাওয়া যায়নি। দয়া করে আপনার স্কুলে শ্রেণি ও শিক্ষার্থী যোগ করুন।
                  </Alert>
                </Grid>
              ) : null}
            </Grid>
          </Paper>
        </Box>
      )}

      {selectedClass && (
        <>
          {requiresSectionForSelectedClass && !selectedSection && !selectedGroup && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                সেকশন নির্বাচন করুন
              </Typography>
              <Grid container spacing={2}>
                {(contextSections || []).filter(sec => (sec.classroom?.id ?? sec.classroom) === selectedClass)
                  .map(sec => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={sec.id}>
                      <Paper
                        elevation={3}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedSection(sec.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedSection(sec.id); } }}
                        sx={{ 
                          p: 3, 
                          textAlign: 'center', 
                          cursor: 'pointer', 
                          borderRadius: 3, 
                          minHeight: 160,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
                          transition: 'all 0.25s ease',
                          outline: 'none',
                          '&:hover': { boxShadow: 8, transform: 'translateY(-4px)' },
                          '&:focus-visible': { boxShadow: 8, border: '2px solid', borderColor: 'primary.main' }
                        }}
                      >
                        <Stack alignItems="center" spacing={1.5}>
                          <Box sx={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            bgcolor: 'primary.light',
                            color: 'primary.contrastText',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <SchoolIcon />
                          </Box>
                          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            সেকশন {sec.name}
                          </Typography>
                          <Chip 
                            icon={<PersonIcon />}
                            label={`মোট ${toBn(getStudentCountForSection(sec.id))} জন শিক্ষার্থী`}
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 700 }}
                          />
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            দেখতে ট্যাপ করুন
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key="unassigned">
                    <Paper
                      elevation={3}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedSection('UNASSIGNED')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedSection('UNASSIGNED'); } }}
                      sx={{ 
                        p: 3, 
                        textAlign: 'center', 
                        cursor: 'pointer', 
                        borderRadius: 3, 
                        minHeight: 160,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
                        transition: 'all 0.25s ease',
                        outline: 'none',
                        '&:hover': { boxShadow: 8, transform: 'translateY(-4px)' },
                        '&:focus-visible': { boxShadow: 8, border: '2px solid', borderColor: 'primary.main' }
                      }}
                    >
                      <Stack alignItems="center" spacing={1.5}>
                        <Box sx={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          bgcolor: 'warning.light',
                          color: 'warning.contrastText',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <SchoolIcon />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                          সেকশন নেই
                        </Typography>
                        <Chip 
                          icon={<PersonIcon />}
                          label={`মোট ${toBn(getStudentCountForSection('UNASSIGNED'))} জন শিক্ষার্থী`}
                          color="warning"
                          variant="outlined"
                          sx={{ fontWeight: 700 }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          দেখতে ট্যাপ করুন
                        </Typography>
                      </Stack>
                    </Paper>
                  </Grid>
              </Grid>
            </Box>
          )}
          {requiresSectionForSelectedClass && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                select
                label="গ্রুপ"
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">সব গ্রুপ</MenuItem>
                <MenuItem value="science">বিজ্ঞান</MenuItem>
                <MenuItem value="arts">মানবিক</MenuItem>
                <MenuItem value="commerce">ব্যবসায় শিক্ষা</MenuItem>
              </TextField>
            </Stack>
          )}
        
          {((requiresSectionForSelectedClass && (selectedSection || selectedGroup)) || (!requiresSectionForSelectedClass)) && (
          <TextField
            placeholder="Search by name or username"
            value={q}
            onChange={e => setQ(e.target.value)}
            sx={{ mb: 2 }}
            fullWidth
            InputProps={{
              endAdornment: (
                <Tooltip title="Search by student name, username, or roll number">
                  <HelpOutlineIcon sx={{ color: 'text.secondary', cursor: 'help' }} />
                </Tooltip>
              )
            }}
          />
        )}
          {selectedClass && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 2 }}>
              {selectedSection && selectedSection !== 'UNASSIGNED' && (
                <Chip label={`সেকশন: ${(() => {
                  const sec = (contextSections || []).find(s => String(s.id) === String(selectedSection));
                  return sec?.name || selectedSection;
                })()}`} color="primary" />
              )}
              {selectedSection === 'UNASSIGNED' && (
                <Chip label="সেকশন: নেই" color="warning" />
              )}
              {!!selectedGroup && (
                <Chip label={`গ্রুপ: ${selectedGroup === 'science' ? 'বিজ্ঞান' : selectedGroup === 'arts' ? 'মানবিক' : 'ব্যবসায় শিক্ষা'}`} color="success" />
              )}
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {(() => {
                  const clsId = Number(selectedClass);
                  const totalInClass = (contextStudents || []).filter(s => Number(s.classroom?.id ?? s.classroom) === clsId).length;
                  const shown = filtered.length;
                  return `মোট ${toBn(totalInClass)} | প্রদর্শিত ${toBn(shown)}`;
                })()}
              </Typography>
              {(selectedSection || selectedGroup || q) && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => { setSelectedSection(null); setSelectedGroup(''); setQ(''); }}
                >
                  সব দেখুন
                </Button>
              )}
            </Stack>
          )}
          {((requiresSectionForSelectedClass && (selectedSection || selectedGroup)) || (!requiresSectionForSelectedClass)) && (activeFast ? sliceLoading : loading) && <CardSkeleton count={6} />}
          {((requiresSectionForSelectedClass && (selectedSection || selectedGroup)) || (!requiresSectionForSelectedClass)) && !(activeFast ? sliceLoading : loading) && (baseStudents || []).length === 0 && (
          <EmptyState
            icon={SchoolIcon}
            title="No students in this class"
            message="Start by adding students to this class"
            actionText="Add Student"
            onAction={() => setAddDialogOpen(true)}
          />
        )}
          {((requiresSectionForSelectedClass && (selectedSection || selectedGroup)) || (!requiresSectionForSelectedClass)) && !(activeFast ? sliceLoading : loading) && (baseStudents || []).length > 0 && filtered.length === 0 && (
          <EmptyState
            title="No matching students"
            message={`No students found matching "${q}". Try a different search term.`}
          />
        )}
          {((requiresSectionForSelectedClass && (selectedSection || selectedGroup)) || (!requiresSectionForSelectedClass)) && !(activeFast ? sliceLoading : loading) && filtered.length > 0 && (
          <Grid container spacing={3}>
            {filtered.map(s => (
              <Grid size={{ xs: 12, sm: 6, md: 6, lg: 4 }} key={s.id}>
                <StudentCard
                  student={{
                    ...s,
                    displayName: s.user?.first_name
                      ? `${s.user.first_name} ${s.user.last_name}`.trim()
                      : s.user?.username
                  }}
                  onUploaded={loadStudents}
                  onClick={() => navigate(`/school/${id}/student/${s.id}/dashboard`)}
                  onEdit={() => handleEditStudent(s)}
                  onDelete={() => handleDeleteStudent(s)}
                />
              </Grid>
            ))}
          </Grid>
        )}
        </>
      )}

      <Dialog open={promoteDialogOpen} onClose={() => setPromoteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>শ্রেণিওয়াইজ প্রমোশন</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Autocomplete
              options={contextClassrooms || []}
              getOptionLabel={(opt) => opt.name || ''}
              value={(contextClassrooms || []).find(c => c.id === promoteFromClassId) || null}
              onChange={(_, v) => setPromoteFromClassId(v ? v.id : '')}
              renderInput={(params) => <TextField {...params} label="যে শ্রেণি থেকে প্রমোশন দেবেন" />}
            />
            <Autocomplete
              options={contextClassrooms || []}
              getOptionLabel={(opt) => opt.name || ''}
              value={(contextClassrooms || []).find(c => c.id === promoteToClassId) || null}
              onChange={(_, v) => setPromoteToClassId(v ? v.id : '')}
              renderInput={(params) => <TextField {...params} label="যে শ্রেণিতে প্রমোশন দেবেন" />}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="পরীক্ষার ধরন"
                value={promoteExamType}
                onChange={(e) => setPromoteExamType(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="annual">বার্ষিক</MenuItem>
                <MenuItem value="final">ফাইনাল</MenuItem>
                <MenuItem value="half_yearly">অর্ধবার্ষিক</MenuItem>
                <MenuItem value="terminal">টার্মিনাল</MenuItem>
                <MenuItem value="test">বিশেষ মূল্যায়ন</MenuItem>
              </TextField>
              <TextField
                select
                label="সাল"
                value={promoteYear}
                onChange={(e) => setPromoteYear(parseInt(e.target.value, 10))}
                sx={{ minWidth: 140 }}
              >
                {Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
                  <MenuItem key={y} value={parseInt(y, 10)}>{y}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button 
                variant={promoteSectionMode === 'preserve' ? 'contained' : 'outlined'}
                onClick={() => setPromoteSectionMode('preserve')}
              >
                পূর্বের শাখা বজায়
              </Button>
              <Button 
                variant={promoteSectionMode === 'single' ? 'contained' : 'outlined'}
                onClick={() => setPromoteSectionMode('single')}
              >
                সবার জন্য এক শাখা
              </Button>
              {promoteSectionMode === 'single' && (
                <TextField
                  label="শাখার নাম"
                  value={promoteSingleSectionName}
                  onChange={(e) => setPromoteSingleSectionName(e.target.value || 'ক')}
                  sx={{ minWidth: 120 }}
                />
              )}
            </Stack>
            <Alert severity="info">
              পছন্দকৃত শ্রেণির সব শিক্ষার্থী নতুন শ্রেণিতে স্থানান্তর হবে। প্রয়োজন হলে নতুন শাখা অটো-ক্রিয়েট হবে।
            </Alert>
            <Alert severity="warning">
              {promotePreview.examLabel
                ? `পরীক্ষা: ${promotePreview.examLabel} — মোট: ${promotePreview.total}, পাশ: ${promotePreview.eligible}, ডেটা নেই/নাপাস: ${promotePreview.missing}`
                : `নির্বাচিত ক্লাস/পরীক্ষার ধরন/সালের জন্য কোনো পরীক্ষার ডেটা পাওয়া যায়নি`}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromoteDialogOpen(false)} disabled={promoting}>বাতিল</Button>
          <Button 
            variant="contained" 
            onClick={async () => {
              if (!promoteFromClassId || !promoteToClassId) {
                toast.error('উভয় শ্রেণি নির্বাচন করুন');
                return;
              }
              try {
                setPromoting(true);
                let promoteExpectedRoll = new Map();
                const fromClassStudents = await fetchStudentsScoped(id, { classroom: promoteFromClassId });
                const sectionMap = {};
                for (const s of fromClassStudents || []) {
                  const sid = typeof s?.section === 'object' ? (s.section?.id ?? s.section?.section_id ?? null) : (s?.section_id ?? null);
                  if (sid != null) sectionMap[String(s.id ?? s.student_id)] = parseInt(String(sid), 10);
                }
                const payload = {
                  school: id,
                  from_class_id: promoteFromClassId,
                  to_class_id: promoteToClassId,
                  section_mode: promoteSectionMode,
                  single_section_name: promoteSingleSectionName,
                  exam_type: promoteExamType,
                  year: promoteYear,
                  retain_sections: promoteSectionMode === 'preserve',
                  section_map: sectionMap,
                  examination: promoteExamId || undefined
                };
                const res = await api.post('/api/academics/students/promote_class/', payload);
                const d = res.data || {};
                if (d.exam_found === false) {
                  toast.error('বার্ষিক/ফাইনাল পরীক্ষা পাওয়া যায়নি—কেউ প্রমোশন হয়নি');
                } else {
                  const moved = d.moved || 0;
                  const skipped = d.skipped_not_passed ?? 0;
                  const total = d.total_candidates ?? (moved + skipped);
                  toast.success(`বার্ষিক ফলাফলের ভিত্তিতে ${moved} জন প্রমোশন হয়েছে (মোট ${total}, নাপাস/ডেটা নেই: ${skipped})`);
                }
                try {
                  const bySection = new Map();
                  const getSecId = (s) => {
                    const sec = s?.section;
                    if (typeof sec === 'object') return sec?.id ?? sec?.section_id ?? null;
                    return s?.section_id ?? null;
                  };
                  for (const s of fromClassStudents || []) {
                    const sid = String(s.id ?? s.student_id);
                    if (!sid) continue;
                    const secId = getSecId(s) ?? 'none';
                    if (!bySection.has(secId)) bySection.set(secId, []);
                    bySection.get(secId).push(s);
                  }
                  const ovResp = promoteExamId ? await scopedGet('/api/results/overall/', id, { examination: promoteExamId, year: promoteYear, page_size: 5000 }, { timeout: 30000 }) : null;
                  const ovData = ovResp ? (Array.isArray(ovResp.data) ? ovResp.data : (ovResp.data?.results || [])) : [];
                  const totalsMap = new Map();
                  for (const o of ovData || []) {
                    const sid = typeof o.student === 'object' ? o.student?.id : o.student;
                    const tot = o.total_marks_obtained != null ? parseFloat(o.total_marks_obtained) : null;
                    if (sid && tot != null) totalsMap.set(String(sid), tot);
                  }
                  const rsResp = promoteExamId ? await scopedGet('/api/results/results/', id, { examination: promoteExamId, year: promoteYear, page_size: 5000 }, { timeout: 30000 }) : null;
                  const rsArr = rsResp ? (Array.isArray(rsResp.data) ? rsResp.data : (rsResp.data?.results || [])) : [];
                  const hasFailMap = new Map();
                  const hasAnyMap = new Map();
                  const sumBySid = new Map();
                  const resultTotal = (res) => {
                    if (!res) return 0;
                    const t = typeof res.total === 'number' ? res.total : undefined;
                    const to = typeof res.total_obtained === 'number' ? res.total_obtained : (typeof res.totalObtained === 'number' ? res.totalObtained : undefined);
                    if (typeof t === 'number') return t;
                    if (typeof to === 'number') return to;
                    const cq = parseFloat(res.written_marks ?? res.cq ?? 0);
                    const mcq = parseFloat(res.mcq_marks ?? res.mcq ?? 0);
                    const pr = parseFloat(res.practical_marks ?? res.practical ?? 0);
                    const sum = (Number.isFinite(cq) ? cq : 0) + (Number.isFinite(mcq) ? mcq : 0) + (Number.isFinite(pr) ? pr : 0);
                    return Number.isFinite(sum) ? sum : 0;
                  };
                  for (const r of rsArr || []) {
                    const sid = typeof r.student === 'object' ? r.student?.id : r.student;
                    if (!sid) continue;
                    hasAnyMap.set(String(sid), true);
                    const grade = String(r.grade || '').toUpperCase();
                    const passed = r.is_passed != null ? Boolean(r.is_passed) : (grade !== 'F');
                    if (!passed) hasFailMap.set(String(sid), true);
                    const cur = sumBySid.get(String(sid)) || 0;
                    sumBySid.set(String(sid), cur + resultTotal(r));
                  }
                  if (totalsMap.size === 0 && sumBySid.size > 0) {
                    for (const [k, v] of sumBySid.entries()) totalsMap.set(k, v);
                  }
                  const toAsciiDigits = (s) => {
                    return String(s || '').replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
                  };
                  const rollNumOf = (s) => {
                    const rollStr = String(s.roll_number || '');
                    const ascii = toAsciiDigits(rollStr);
                    const n = parseInt(ascii.replace(/\D/g, ''), 10);
                    return Number.isNaN(n) ? 999999 : n;
                  };
                  const newRollMap = new Map();
                  for (const [secId, list] of bySection.entries()) {
                    const arr = list.map(s => {
                      const sidStr = String(s.id);
                      const any = hasAnyMap.get(sidStr) === true;
                      const fail = hasFailMap.get(sidStr) === true;
                      const rankCode = !any ? 2 : (fail ? 1 : 0);
                      const total = totalsMap.get(sidStr) || 0;
                      return { s, total, rollNum: rollNumOf(s), rankCode };
                    });
                    arr.sort((a, b) => {
                      if (a.rankCode !== b.rankCode) return a.rankCode - b.rankCode;
                      if (b.total !== a.total) return b.total - a.total;
                      return a.rollNum - b.rollNum;
                    });
                    let rk = 1;
                    for (const it of arr) newRollMap.set(String(it.s.id), rk++);
                  }
                  promoteExpectedRoll = newRollMap;
                  // Resolve target section by matching source section name in target class
                  const srcSectionsResp = await scopedGet('/api/academics/sections/', id, { classroom: promoteFromClassId, page_size: 2000 }, { timeout: 15000 });
                  const tgtSectionsResp = await scopedGet('/api/academics/sections/', id, { classroom: promoteToClassId, page_size: 2000 }, { timeout: 15000 });
                  const srcList = Array.isArray(srcSectionsResp.data) ? srcSectionsResp.data : (srcSectionsResp.data?.results || []);
                  const tgtList = Array.isArray(tgtSectionsResp.data) ? tgtSectionsResp.data : (tgtSectionsResp.data?.results || []);
                  const srcById = new Map(srcList.map(s => [String(s.id), s]));
                  const tgtByName = new Map(tgtList.map(s => [String(s.name || '').trim(), s]));
                  const neededNames = Array.from(new Set(
                    (fromClassStudents || [])
                      .map(s => sectionMap[String(s.id ?? s.student_id)])
                      .filter(v => v != null)
                      .map(v => {
                        const src = srcById.get(String(v));
                        return String(src?.name || '').trim();
                      })
                      .filter(n => n.length > 0)
                  ));
                  const missingNames = neededNames.filter(n => !tgtByName.has(n));
                  if (missingNames.length > 0) {
                    const createAttempts = missingNames.map(n => {
                      const fd = new FormData();
                      fd.append('school_id', String(id));
                      fd.append('classroom_id', String(promoteToClassId));
                      fd.append('name', String(n));
                      return api.post('/api/academics/sections/', fd);
                    });
                    const created = await Promise.allSettled(createAttempts);
                    const okCreated = created.filter(r => r.status === 'fulfilled').length;
                    if (okCreated > 0) {
                      try {
                        const refreshTgt = await scopedGet('/api/academics/sections/', id, { classroom: promoteToClassId, page_size: 2000 }, { timeout: 15000 });
                        const newTgtList = Array.isArray(refreshTgt.data) ? refreshTgt.data : (refreshTgt.data?.results || []);
                        tgtByName.clear();
                        for (const s of newTgtList) tgtByName.set(String(s.name || '').trim(), s);
                      } catch (_) {}
                    }
                  }
                  const resolveTargetSectionId = (sidStr) => {
                    const src = srcById.get(String(sidStr));
                    if (!src) return null;
                    const name = String(src.name || '').trim();
                    const tgt = tgtByName.get(name);
                    return tgt ? (tgt.id ?? tgt.section_id ?? null) : null;
                  };
                  const updateStudentPromotion = async (sidStr, keepSecSrc, newRoll) => {
                    const keepSecTarget = keepSecSrc != null ? resolveTargetSectionId(keepSecSrc) : null;
                    const fd = new FormData();
                    fd.append('school_id', String(id));
                    fd.append('classroom_id', String(promoteToClassId));
                    if (keepSecTarget != null) fd.append('section_id', String(keepSecTarget));
                    if (newRoll != null) fd.append('roll_number', String(newRoll));
                    try {
                      const sObj = (fromClassStudents || []).find(st => String(st.id ?? st.student_id) === String(sidStr)) || {};
                      const uObj = sObj.user || {};
                      const minimalFirst = String(uObj.first_name || '').trim();
                      if (minimalFirst) fd.append('first_name', minimalFirst);
                    } catch (_) {}
                    const attempts = [
                      { m: 'patch', url: `/api/academics/students/${sidStr}/`, data: fd, headers: { 'Content-Type': 'multipart/form-data' } },
                      { m: 'patch', url: `/api/students/${sidStr}/`, data: fd, headers: { 'Content-Type': 'multipart/form-data' } },
                      { m: 'put', url: `/api/academics/students/${sidStr}/`, data: { school_id: id, classroom_id: promoteToClassId, section_id: keepSecTarget ?? undefined, roll_number: newRoll ?? undefined }, headers: { 'Content-Type': 'application/json' } },
                      { m: 'put', url: `/api/students/${sidStr}/`, data: { school_id: id, classroom_id: promoteToClassId, section_id: keepSecTarget ?? undefined, roll_number: newRoll ?? undefined }, headers: { 'Content-Type': 'application/json' } },
                    ];
                    for (const att of attempts) {
                      try {
                        const r = await api[att.m](att.url, att.data, att.headers ? { headers: att.headers } : undefined);
                        if (r && (r.status === 200 || r.status === 204)) return true;
                      } catch (_) { /* try next */ }
                    }
                    return false;
                  };
                  const patches = [];
                  for (const s of fromClassStudents || []) {
                    const sidStr = String(s.id ?? s.student_id);
                    if (!sidStr) continue;
                    const keepSecSrc = sectionMap[sidStr];
                    const newRoll = newRollMap.get(sidStr);
                    patches.push(updateStudentPromotion(sidStr, keepSecSrc, newRoll));
                  }
                  const results = await Promise.allSettled(patches);
                  const ok = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
                  const fail = results.length - ok;
                  toast.success(`ফোর্স প্রমোশন সম্পন্ন — আপডেটেড: ${ok}, ব্যর্থ: ${fail}`);
                } catch (_) {}
                setPromoteDialogOpen(false);
                // reload lists
                await refreshStudents(id);
                await refreshSections(id);
                await refreshClassrooms(id);
                try {
                  const tgtStudents = await fetchStudentsScoped(id, { classroom: promoteToClassId });
                  const mismatches = [];
                  for (const s of tgtStudents || []) {
                    const sidStr = String(s.id ?? s.student_id);
                    const expected = promoteExpectedRoll.get(sidStr);
                    const current = parseInt(String(s.roll_number || '').replace(/\D/g, ''), 10);
                    if (expected != null && expected !== current) {
                      const fd = new FormData();
                      fd.append('school_id', String(id));
                      fd.append('roll_number', String(expected));
                      try {
                        await api.patch(`/api/academics/students/${sidStr}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                      } catch {
                        try {
                          await api.put(`/api/academics/students/${sidStr}/`, { school_id: id, roll_number: expected }, { headers: { 'Content-Type': 'application/json' } });
                        } catch {
                          mismatches.push(sidStr);
                        }
                      }
                    }
                  }
                  if (mismatches.length) {
                    toast.warning(`কিছু রোল আপডেট হয়নি: ${mismatches.length} জন—পুনরায় চেষ্টা করুন`);
                  } else {
                    toast.success('নতুন রোল সংরক্ষণ সম্পন্ন');
                  }
                  await refreshStudents(id);
                } catch (_) {}
              } catch (e) {
                console.error('Class promotion error', e);
                toast.error('প্রমোশন ব্যর্থ হয়েছে');
              } finally {
                setPromoting(false);
              }
            }}
            disabled={promoting}
          >
            {promoting ? 'প্রমোশন হচ্ছে...' : 'প্রমোশন দিন'}
          </Button>
        </DialogActions>
      </Dialog>
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        schoolId={id}
        onComplete={() => {
          // After import, refresh list
          loadStudents();
        }}
      />

      {/* Add Student Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                🎓 নতুন শিক্ষার্থী যোগ করুন
              </Typography>
              <Typography variant="body2" color="text.secondary">
                নতুন শিক্ষার্থীর একাউন্ট তৈরি করুন এবং শ্রেণিতে ভর্তি করুন
              </Typography>
            </Box>
            <IconButton onClick={() => setAddDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        
      <DialogContent dividers>
          <Grid container spacing={2}>
            {/* Photo */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                🖼️ প্রোফাইল ছবি (ঐচ্ছিক)
              </Typography>
              <PhotoUpload currentPhoto={null} onPhotoChange={(f) => setNewStudent(ns => ({ ...ns, _photoFile: f }))} userName={newStudent.first_name || newStudent.username || 'User'} />
            </Grid>

            {/* Account Information */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                🔐 একাউন্ট তথ্য
              </Typography>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="ইউজারনেম"
                value={newStudent.username}
                onChange={(e) => setNewStudent({...newStudent, username: e.target.value})}
                fullWidth
                error={usernameCheck.available === false}
                helperText={usernameCheck.loading ? 'অ্যাভেইলেবিলিটি চেক হচ্ছে…' : usernameCheck.available === false ? 'ইউজারনেমটি ব্যবহারযোগ্য নয়' : 'ঐচ্ছিক — খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে'}
              />
              {usernameCheck.available === false && usernameCheck.suggestions?.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {usernameCheck.suggestions.map((sug, i) => (
                    <Chip key={i} label={sug} onClick={() => setNewStudent(ns => ({ ...ns, username: sug }))} clickable />
                  ))}
                </Stack>
              )}
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="পাসওয়ার্ড"
                type="password"
                value={newStudent.password}
                onChange={(e) => setNewStudent({...newStudent, password: e.target.value})}
                fullWidth
                error={!!newStudentErrors.password}
                helperText={newStudentErrors.password || 'ঐচ্ছিক — খালি থাকলে নিরাপদ পাসওয়ার্ড স্বয়ংক্রিয়ভাবে তৈরি হবে'}
              />
            </Grid>

            {/* Personal Information */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, mt: 2 }}>
                👤 ব্যক্তিগত তথ্য
              </Typography>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="নাম"
                value={newStudent.first_name}
                onChange={(e) => setNewStudent({...newStudent, first_name: e.target.value})}
                fullWidth
                error={!!newStudentErrors.first_name}
                helperText={newStudentErrors.first_name || 'ইউজারনেম বা নাম — যেকোনো একটি দিন'}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="লাস্ট নেম"
                value={newStudent.last_name}
                onChange={(e) => setNewStudent({...newStudent, last_name: e.target.value})}
                fullWidth
                error={!!newStudentErrors.last_name}
                helperText={newStudentErrors.last_name || ''}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="ইমেইল"
                type="email"
                value={newStudent.email}
                onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                fullWidth
                error={!!newStudentErrors.email}
                helperText={newStudentErrors.email || ''}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="ফোন নম্বর"
                value={newStudent.phone_number}
                onChange={(e) => setNewStudent({...newStudent, phone_number: e.target.value})}
                fullWidth
                placeholder="+8801712345678"
                error={!!newStudentErrors.phone_number}
                helperText={newStudentErrors.phone_number || 'কান্ট্রি কোডসহ লিখুন'}
              />
            </Grid>

            {/* Academic Information */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, mt: 2 }}>
                📚 একাডেমিক তথ্য
              </Typography>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="শ্রেণি (ঐচ্ছিক)"
                value={newStudent.classroom_id}
                onChange={(e) => setNewStudent({...newStudent, classroom_id: e.target.value, section_id: ''})}
                fullWidth
                error={!!newStudentErrors.classroom_id}
                helperText={newStudentErrors.classroom_id || ''}
              >
                <MenuItem value="">শ্রেণি নির্বাচন করুন</MenuItem>
                {sortedClasses.map(c => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="সেকশন"
                value={(() => {
                  const fallbackOptions = contextSections.filter(s => {
                    if (!newStudent.classroom_id) return false;
                    const classIdNum = Number(newStudent.classroom_id);
                    const secClassId = s.classroom?.id ?? s.classroom;
                    return secClassId === classIdNum;
                  });
                  const sectionOptions = (addFormSections.length > 0 ? addFormSections : fallbackOptions);
                  const hasCurrent = sectionOptions.some(s => String(s.id) === String(newStudent.section_id));
                  return hasCurrent ? newStudent.section_id : '';
                })()}
                onChange={(e) => setNewStudent({...newStudent, section_id: e.target.value})}
                fullWidth
                disabled={!newStudent.classroom_id || !requiresSection}
                error={!!newStudentErrors.section_id}
                helperText={
                  newStudentErrors.section_id
                  || (!newStudent.classroom_id ? 'আগে শ্রেণি নির্বাচন করুন'
                    : (!requiresSection ? 'এই শ্রেণিতে সেকশন নেই'
                      : (addFormSectionsLoading ? 'সেকশন লোড হচ্ছে...' : 'সেকশন নির্বাচন করুন')))
                }
              >
                {(requiresSection
                  ? (addFormSections.length > 0 ? addFormSections : contextSections
                    .filter(s => {
                      if (!newStudent.classroom_id) return false;
                      const classIdNum = Number(newStudent.classroom_id);
                      const secClassId = s.classroom?.id ?? s.classroom; // support object or id
                      return secClassId === classIdNum;
                    }))
                  : [])
                  .map(s => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="গ্রুপ (ঐচ্ছিক)"
                value={newStudent.group || ''}
                onChange={(e) => setNewStudent({...newStudent, group: e.target.value})}
                fullWidth
              >
                <MenuItem value="">কোনো গ্রুপ নেই</MenuItem>
                <MenuItem value="science">বিজ্ঞান</MenuItem>
                <MenuItem value="arts">মানবিক</MenuItem>
                <MenuItem value="commerce">ব্যবসায় শিক্ষা</MenuItem>
              </TextField>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="রোল নম্বর (ঐচ্ছিক)"
                type="text"
                value={newStudent.roll_number}
                onChange={(e) => setNewStudent({...newStudent, roll_number: e.target.value})}
                fullWidth
                error={!!newStudentErrors.roll_number}
                helperText={newStudentErrors.roll_number || 'শ্রেণিতে ইউনিক'}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="রক্তের গ্রুপ (ঐচ্ছিক)"
                value={newStudent.blood_group}
                onChange={(e) => setNewStudent({...newStudent, blood_group: e.target.value})}
                fullWidth
              >
                <MenuItem value="">নির্বাচন করুন</MenuItem>
                <MenuItem value="A+">A+</MenuItem>
                <MenuItem value="A-">A-</MenuItem>
                <MenuItem value="B+">B+</MenuItem>
                <MenuItem value="B-">B-</MenuItem>
                <MenuItem value="AB+">AB+</MenuItem>
                <MenuItem value="AB-">AB-</MenuItem>
                <MenuItem value="O+">O+</MenuItem>
                <MenuItem value="O-">O-</MenuItem>
              </TextField>
            </Grid>

            {/* Parent/Guardian */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, mt: 2 }}>
                👨‍👩‍👧 অভিভাবক/প্যারেন্ট (ঐচ্ছিক)
              </Typography>
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                freeSolo
                inputValue={newStudent.guardian_name}
                onInputChange={(e, input) => setNewStudent({ ...newStudent, guardian_name: input || '', guardian_id: '' })}
                options={(parents || []).filter(p => String(p.id) !== String(newStudent.guardian_id || ''))}
                getOptionLabel={(p) => `${p?.user?.first_name || ''} ${p?.user?.last_name || ''} (${p?.user?.username || ''})`.trim()}
                value={(parents || []).find(p => String(p.id) === String(newStudent.guardian_id)) || null}
                onChange={(e, val) => setNewStudent({ ...newStudent, guardian_id: val ? val.id : '' })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="অভিভাবক/প্যারেন্ট (নতুন হলে নাম টাইপ করুন)"
                    helperText={newStudentErrors.guardian_id || 'টাইপ করলে নতুন তৈরি হবে, সিলেক্ট করলে লিংক হবে'}
                    error={!!newStudentErrors.guardian_id}
                    fullWidth
                  />
                )}
                clearOnEscape
                autoHighlight
                isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)}>বাতিল</Button>
          <Button 
            variant="contained" 
            onClick={handleAddStudent}
            disabled={saving}
            startIcon={<AddIcon />}
          >
            {saving ? 'যোগ হচ্ছে...' : 'শিক্ষার্থী যোগ করুন'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>

      {/* Edit Student Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                ✏️ Edit Student Profile
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Update student information and academic details
              </Typography>
            </Box>
            <IconButton onClick={() => setEditDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Photo Upload */}
            <Grid size={{ xs: 12, md: 3 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <PhotoUpload 
                currentPhoto={resolvePhotoUrl(
                  selectedStudent?.user?.photo_url ||
                  selectedStudent?.user?.photo ||
                  selectedStudent?.user?.profile_picture
                )}
                onPhotoChange={handlePhotoChange}
                userName={`${selectedStudent?.user?.first_name || ''} ${selectedStudent?.user?.last_name || ''}`}
              />
              <Typography variant="caption" color="textSecondary" align="center" sx={{ mt: 1 }}>
                Click on the photo to change
              </Typography>
            </Grid>
            
            {/* Personal Information */}
            <Grid size={{ xs: 12, md: 9 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                👤 Personal Information
              </Typography>
              <Grid container spacing={2}>
            
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="First Name"
                    fullWidth
                    value={editFormData.first_name}
                    onChange={(e) => setEditFormData({...editFormData, first_name: e.target.value})}
                  />
                </Grid>
            
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Last Name"
                    fullWidth
                    value={editFormData.last_name}
                    onChange={(e) => setEditFormData({...editFormData, last_name: e.target.value})}
                  />
                </Grid>
                
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Email"
                    type="email"
                    fullWidth
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                  />
                </Grid>
                
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Phone Number"
                    fullWidth
                    value={editFormData.phone_number}
                    onChange={(e) => setEditFormData({...editFormData, phone_number: e.target.value})}
                    placeholder="+8801712345678"
                  />
                </Grid>
                
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Username"
                    fullWidth
                    value={editFormData.username}
                    onChange={(e) => setEditFormData({...editFormData, username: e.target.value})}
                    helperText="Username for login"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    type="password"
                    label="New Password"
                    fullWidth
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    type="password"
                    label="Confirm New Password"
                    fullWidth
                    value={editPasswordConfirm}
                    onChange={(e) => setEditPasswordConfirm(e.target.value)}
                  />
                </Grid>

                {/* Academic Information */}
                <Grid size={{ xs: 12 }}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    📚 Academic Information
                  </Typography>
                </Grid>
                
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="Class"
                    value={editFormData.classroom_id}
                    onChange={(e) => setEditFormData({...editFormData, classroom_id: e.target.value, section_id: ''})}
                    fullWidth
                  >
                    <MenuItem value="">No Class</MenuItem>
                  {sortedClasses.map(c => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="Section"
                    value={editFormData.section_id}
                    onChange={(e) => setEditFormData({...editFormData, section_id: e.target.value})}
                    fullWidth
                    disabled={!editFormData.classroom_id}
                    helperText={
                      !editFormData.classroom_id
                        ? 'Select a class first'
                        : (editFormSectionsLoading
                          ? 'Sections loading...'
                          : (editFormSectionsList.length === 0 ? 'এই শ্রেণির জন্য কোনো সেকশন নেই' : ''))
                    }
                  >
                    <MenuItem value="">No Section</MenuItem>
                    {(editFormSectionsList.length > 0 ? editFormSectionsList :
                      contextSections.filter(s => {
                        if (!editFormData.classroom_id) return true;
                        const classIdNum = Number(editFormData.classroom_id);
                        const secClassId = s.classroom?.id ?? s.classroom;
                        return secClassId === classIdNum;
                      }))
                      .map(s => (
                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                      ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="গ্রুপ"
                    value={editFormData.group}
                    onChange={(e) => setEditFormData({...editFormData, group: e.target.value})}
                    fullWidth
                  >
                    <MenuItem value="">কোনো গ্রুপ নেই</MenuItem>
                    <MenuItem value="science">বিজ্ঞান</MenuItem>
                    <MenuItem value="arts">মানবিক</MenuItem>
                    <MenuItem value="commerce">ব্যবসায় শিক্ষা</MenuItem>
                  </TextField>
                </Grid>
                
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Roll Number"
                    fullWidth
                    value={editFormData.roll_number}
                    onChange={(e) => setEditFormData({...editFormData, roll_number: e.target.value})}
                  />
                </Grid>
                
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="Blood Group"
                    value={editFormData.blood_group}
                    onChange={(e) => setEditFormData({...editFormData, blood_group: e.target.value})}
                    fullWidth
                  >
                    <MenuItem value="">Select</MenuItem>
                    <MenuItem value="A+">A+</MenuItem>
                    <MenuItem value="A-">A-</MenuItem>
                    <MenuItem value="B+">B+</MenuItem>
                    <MenuItem value="B-">B-</MenuItem>
                    <MenuItem value="AB+">AB+</MenuItem>
                    <MenuItem value="AB-">AB-</MenuItem>
                    <MenuItem value="O+">O+</MenuItem>
                    <MenuItem value="O-">O-</MenuItem>
                  </TextField>
                </Grid>

                {/* Parent/Guardian */}
                <Grid size={{ xs: 12 }}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    👨‍👩‍👧 Parent/Guardian
                  </Typography>
                </Grid>
                
                <Grid size={{ xs: 12 }}>
                  <Autocomplete
                    options={(parents || []).filter(p => {
                      const keys = [
                        p?.id != null ? String(p.id) : null,
                        p?.user?.id != null ? String(p.user.id) : null,
                        p?.user?.username ? `u:${String(p.user.username)}` : null
                      ].filter(Boolean);
                      return !keys.some(k => currentGuardianKeySet.has(k));
                    })}
                    getOptionLabel={(p) => `${p?.user?.first_name || ''} ${p?.user?.last_name || ''} (${p?.user?.username || ''})`.trim()}
                    value={(parents || []).find(p => String(p.id) === String(editFormData.guardian_id)) || null}
                    onChange={(e, val) => setEditFormData({ ...editFormData, guardian_id: val ? val.id : '' })}
                    inputValue={editFormData.guardian_name || ''}
                    onInputChange={(e, input) => setEditFormData({ ...editFormData, guardian_name: input || '', guardian_id: '' })}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Parent/Guardian (টাইপ করলে নতুন তৈরি হবে)"
                        helperText="টাইপ করলে নতুন তৈরি হবে, সিলেক্ট করলে লিংক হবে"
                        fullWidth
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleUpdateStudent}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the student profile for {selectedStudent ? 
              (`${selectedStudent.user?.first_name || ''} ${selectedStudent.user?.last_name || ''}`.trim() || selectedStudent.user?.username) : ''}?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={confirmDeleteStudent}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
