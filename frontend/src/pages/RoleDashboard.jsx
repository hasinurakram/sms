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
        setAdminLoading(true);
        getDashboardStats(id)
          .then(stats => setAdminStats(stats))
          .catch(() => setAdminError('Failed to load admin dashboard stats.'))
          .finally(() => setAdminLoading(false));
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
      setAdminLoading(true);
      setAdminError(null);
      getDashboardStats(id)
        .then(stats => setAdminStats(stats))
        .catch(err => {
          const status = err?.response?.status;
          const detail = err?.response?.data?.detail || err?.message;
          console.error('Error fetching admin dashboard stats:', status, detail);
          setAdminError('Failed to load admin dashboard stats.');
        })
        .finally(() => setAdminLoading(false));
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
            <Grid item xs={12} sm={6} md={4}>
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
            <Grid item xs={12} sm={6} md={4}>
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
            <Grid item xs={12} sm={6} md={4}>
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
    setAdminLoading(true);
    setAdminError(null);
    getDashboardStats(id)
      .then(stats => {
        setAdminStats(stats);
        toast.success('Dashboard data refreshed successfully');
      })
      .catch(err => {
        console.error('Error refreshing dashboard:', err);
        setAdminError('Failed to refresh dashboard data. Please try again.');
        toast.error('Failed to refresh dashboard data');
      })
      .finally(() => {
        setAdminLoading(false);
      });
  };

  const renderCharts = () => {
    if (role === 'admin') {
      if (!adminStats) return null;
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
          </Box>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} lg={6}>
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
            <Grid item xs={12} lg={6}>
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
                  <FeeCollectionChart feeData={adminStats.fee_data || []} />
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
