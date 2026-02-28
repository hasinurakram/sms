import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Checkbox,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Assessment as AssessmentIcon,
  CalendarMonth as CalendarIcon,
  School as SchoolIcon,
  Class as ClassIcon,
  Group as GroupIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import { useToast } from '../components/Toast';
import dayjs from 'dayjs';
import { isAuthenticated } from '../utils/auth';

export default function AttendancePageNew() {
  const { id } = useParams(); // School ID
  const navigate = useNavigate();
  const toast = useToast();
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
    }
  }, []);
  
  // State management
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [dailySummary, setDailySummary] = useState([]);
  const [monthlyReport, setMonthlyReport] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedYear, setSelectedYear] = useState(dayjs().format('YYYY'));
  const [selectedStudent, setSelectedStudent] = useState('');
  const autoSaveTimerRef = useRef(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [takenByInfo, setTakenByInfo] = useState(null);

  // Load classrooms on mount
  useEffect(() => {
    loadClassrooms();
  }, [id]);

  // Load sections when classroom changes
  useEffect(() => {
    if (selectedClassroom) {
      loadSections(selectedClassroom);
    } else {
      setSections([]);
      setSelectedSection('');
    }
  }, [selectedClassroom]);

  // Load students when classroom or section changes
  useEffect(() => {
    if (selectedClassroom) {
      loadStudents();
    }
  }, [selectedClassroom, selectedSection]);

  const loadClassrooms = async () => {
    try {
      const res = await scopedGet('/api/academics/classrooms/', id, {}, { timeout: 15000 });
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data || []);
      setClassrooms(data);
    } catch (error) {
      console.error('Failed to load classrooms:', error);
      toast.error('Failed to load classrooms');
    }
  };

  const [yearlyReport, setYearlyReport] = useState([]);
  const loadYearlyReport = async () => {
    try {
      const months = Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);
      const aggregate = new Map();
      for (const m of months) {
        let url = `/api/attendance/records/monthly_report/?school=${id}&month=${m}`;
        if (selectedClassroom) url += `&classroom=${selectedClassroom}`;
        if (selectedSection) url += `&section=${selectedSection}`;
        const res = await api.get(url);
        const rows = res.data || [];
        for (const r of rows) {
          if (selectedStudent && String(r.student_id) !== String(selectedStudent)) continue;
          const key = r.student_id;
          const prev = aggregate.get(key) || {
            student_id: r.student_id,
            student_name: r.student_name,
            classroom: r.classroom,
            section: r.section,
            total_days: 0,
            present_days: 0,
            absent_days: 0
          };
          prev.total_days += (parseInt(r.total_days, 10) || 0);
          prev.present_days += (parseInt(r.present_days, 10) || 0);
          prev.absent_days += (parseInt(r.absent_days, 10) || 0);
          aggregate.set(key, prev);
        }
      }
      const out = Array.from(aggregate.values()).map(r => ({
        ...r,
        attendance_percentage: r.total_days > 0 ? Math.round((r.present_days / r.total_days) * 100) : 0
      }));
      setYearlyReport(out);
      toast.success('বাৎসরিক রিপোর্ট লোড হয়েছে');
    } catch (error) {
      console.error('Failed to load yearly report:', error);
      toast.error('বাৎসরিক রিপোর্ট লোড ব্যর্থ');
    }
  };
  const loadSections = async (classroomId) => {
    try {
      const res = await scopedGet('/api/academics/sections/', id, { classroom: classroomId }, { timeout: 15000 });
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data || []);
      setSections(data);
    } catch (error) {
      console.error('Failed to load sections:', error);
      setSections([]);
    }
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await scopedGet('/api/academics/students/', id, { classroom: selectedClassroom, section: selectedSection || undefined }, { timeout: 15000 });
      const raw = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
      const studentList = [...raw].sort((a, b) => {
        const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
        const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
        const aNum = Number.isNaN(ar) ? null : ar;
        const bNum = Number.isNaN(br) ? null : br;
        if (aNum !== null && bNum !== null) return aNum - bNum;
        const as = String(a?.roll_number ?? '');
        const bs = String(b?.roll_number ?? '');
        return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
      });
      setStudents(studentList);

      // Load existing attendance for the date
      const attendanceRes = await scopedGet('/api/attendance/records/', id, { date }, { timeout: 15000 });
      const studentIdSet = new Set(studentList.map(s => s.id));
      const filteredRecords = (Array.isArray(attendanceRes.data) ? attendanceRes.data : []).filter(rec => studentIdSet.has(rec.student));
      const attendanceMap = {};
      filteredRecords.forEach(record => {
        attendanceMap[record.student] = record.present;
      });
      const withMeta = filteredRecords.filter(r => r.taken_by || r.taken_by_name);
      let info = null;
      if (withMeta.length > 0) {
        withMeta.sort((a, b) => {
          const ta = new Date(a.created_at || a.date).getTime();
          const tb = new Date(b.created_at || b.date).getTime();
          return tb - ta;
        });
        const r = withMeta[0];
        info = {
          name: (r.taken_by && r.taken_by.name) ? r.taken_by.name : (r.taken_by_name || ''),
          username: (r.taken_by && r.taken_by.username) ? r.taken_by.username : '',
          date: r.date,
          created_at: r.created_at
        };
      }
      setTakenByInfo(info);

      // Initialize attendance state
      const initialAttendance = {};
      studentList.forEach(student => {
        initialAttendance[student.id] = attendanceMap[student.id] !== undefined 
          ? attendanceMap[student.id] 
          : true; // Default to present
      });
      
      setAttendance(initialAttendance);
    } catch (error) {
      console.error('Failed to load students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  // Refresh attendance when date changes without reloading students list
  useEffect(() => {
    (async () => {
      if (!selectedClassroom || students.length === 0) return;
      try {
        const attendanceRes = await scopedGet('/api/attendance/records/', id, { date }, { timeout: 15000 });
        const studentIdSet = new Set(students.map(s => s.id));
        const filteredRecords = (Array.isArray(attendanceRes.data) ? attendanceRes.data : []).filter(rec => studentIdSet.has(rec.student));
        const attendanceMap = {};
        filteredRecords.forEach(record => {
          attendanceMap[record.student] = record.present;
        });
        const initialAttendance = {};
        students.forEach(student => {
          initialAttendance[student.id] = attendanceMap[student.id] !== undefined 
            ? attendanceMap[student.id] 
            : true;
        });
        setAttendance(initialAttendance);
      } catch (_) {}
    })();
  }, [date]);

  const toggleAttendance = (studentId) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
    scheduleAutoSave();
  };

  const markAllPresent = () => {
    const newAttendance = {};
    students.forEach(student => {
      newAttendance[student.id] = true;
    });
    setAttendance(newAttendance);
    toast.success('All students marked present');
    scheduleAutoSave();
  };

  const markAllAbsent = () => {
    const newAttendance = {};
    students.forEach(student => {
      newAttendance[student.id] = false;
    });
    setAttendance(newAttendance);
    toast.success('All students marked absent');
    scheduleAutoSave();
  };

  const scheduleAutoSave = () => {
    try {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      setAutoSaving(true);
      autoSaveTimerRef.current = setTimeout(async () => {
        await saveAttendance(true);
        setAutoSaving(false);
      }, 800);
    } catch (_) {
      setAutoSaving(false);
    }
  };

  const saveAttendance = async (silentOrEvent = false) => {
    const silent = typeof silentOrEvent === 'boolean' ? silentOrEvent : false;
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (students.length === 0) {
      if (!silent) toast.warning('No students to save attendance for');
      return;
    }

    setSaving(true);
    try {
      const records = students.map(student => ({
        school: parseInt(id),
        student: student.id,
        date: date,
        present: attendance[student.id] !== undefined ? attendance[student.id] : true,
        note: ''
      }));

      // Use bulk save endpoint
      const response = await api.post('/api/attendance/records/bulk_save/', {
        records: records
      });

      if (response.data.success) {
        if (!silent) toast.success(`Attendance saved successfully! ${response.data.saved} records saved.`);
        if (response.data.errors && response.data.errors.length > 0) {
          console.warn('Some records had errors:', response.data.errors);
        }
        if (!silent) {
          loadDailySummary();
        }
      } else {
        if (!silent) toast.error('Failed to save some attendance records');
      }
    } catch (error) {
      console.error('Failed to save attendance:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.detail || 'Failed to save attendance';
      if (!silent) toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const loadDailySummary = async () => {
    try {
      const res = await api.get(
        `/api/attendance/records/daily_summary/?school=${id}&date=${date}`
      );
      setDailySummary(res.data || []);
      setSummaryDialogOpen(true);
    } catch (error) {
      console.error('Failed to load daily summary:', error);
      toast.error('Failed to load attendance summary');
    }
  };

  const loadMonthlyReport = async () => {
    try {
      let url = `/api/attendance/records/monthly_report/?school=${id}&month=${selectedMonth}`;
      if (selectedClassroom) {
        url += `&classroom=${selectedClassroom}`;
      }
      if (selectedSection) {
        url += `&section=${selectedSection}`;
      }

      const res = await api.get(url);
      const data = res.data || [];
      setMonthlyReport(
        selectedStudent ? data.filter(r => String(r.student_id) === String(selectedStudent)) : data
      );
    } catch (error) {
      console.error('Failed to load monthly report:', error);
      toast.error('Failed to load monthly report');
    }
  };

  const presentCount = Object.values(attendance).filter(p => p).length;
  const absentCount = students.length - presentCount;
  const attendancePercentage = students.length > 0 
    ? ((presentCount / students.length) * 100).toFixed(1) 
    : 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 3
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <SchoolIcon sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                হাজিরা ব্যবস্থাপনা
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                শ্রেণি ও সেকশন অনুযায়ী শিক্ষার্থীদের হাজিরা চিহ্নিত ও ব্যবস্থাপনা করুন
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            startIcon={<DescriptionIcon />}
            onClick={() => navigate(`/school/${id}/attendance/report-card`)}
            sx={{
              bgcolor: 'white',
              color: 'primary.main',
              '&:hover': {
                bgcolor: 'grey.100'
              }
            }}
          >
            হাজিরা রিপোর্ট কার্ড
          </Button>
        </Stack>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          শ্রেণি ও তারিখ নির্বাচন
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="শ্রেণি *"
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
            >
              <MenuItem value="">-- শ্রেণি নির্বাচন করুন --</MenuItem>
              {classrooms.map(classroom => (
                <MenuItem key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="সেকশন (ঐচ্ছিক)"
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              disabled={!selectedClassroom}
              helperText="সেকশন না দিলে এই শ্রেণির সব সেকশনের শিক্ষার্থী লোড হবে"
            >
              <MenuItem value="">-- সব সেকশন --</MenuItem>
              {sections.map(section => (
                <MenuItem key={section.id} value={section.id}>
                  {section.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              type="date"
              fullWidth
              label="তারিখ"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="শিক্ষার্থী (ঐচ্ছিক)"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              disabled={!selectedClassroom || students.length === 0}
            >
              <MenuItem value="">-- শিক্ষার্থী নির্বাচন করুন --</MenuItem>
              {students.map(s => (
                <MenuItem key={s.id} value={s.id}>
                  {s.user?.first_name} {s.user?.last_name} ({s.roll_number || 'N/A'})
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={loadStudents}
              disabled={!selectedClassroom}
              sx={{ height: '56px' }}
            >
              শিক্ষার্থী লোড করুন
            </Button>
          </Grid>
        </Grid>
      </Paper>
      {takenByInfo && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, borderLeft: '4px solid', borderColor: 'primary.main' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <CalendarIcon color="primary" />
            <Box>
              <Typography variant="body1">
                আজকের হাজিরা দিয়েছেন: {takenByInfo.name || takenByInfo.username || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                সময়: {dayjs(takenByInfo.created_at || takenByInfo.date).format('YYYY-MM-DD HH:mm')}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      {/* Statistics Cards */}
      {students.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {students.length}
                    </Typography>
                    <Typography variant="body2">মোট শিক্ষার্থী</Typography>
                  </Box>
                  <GroupIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {presentCount}
                    </Typography>
                    <Typography variant="body2">উপস্থিত</Typography>
                  </Box>
                  <CheckCircleIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {absentCount}
                    </Typography>
                    <Typography variant="body2">অনুপস্থিত</Typography>
                  </Box>
                  <CancelIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {attendancePercentage}%
                    </Typography>
                    <Typography variant="body2">হাজিরার হার</Typography>
                  </Box>
                  <AssessmentIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Attendance Table */}
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : students.length === 0 ? (
          <Alert severity="info">
            হাজিরা দেওয়ার জন্য প্রথমে শ্রেণি নির্বাচন করে "শিক্ষার্থী লোড করুন" বাটনে ক্লিক করুন
          </Alert>
        ) : (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                শিক্ষার্থীদের হাজিরার তালিকা
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  onClick={markAllPresent}
                >
                  সবাইকে উপস্থিত করুন
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={markAllAbsent}
                >
                  সবাইকে অনুপস্থিত করুন
                </Button>
              </Stack>
            </Stack>

            <Divider sx={{ mb: 2 }} />

            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>রোল</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>শিক্ষার্থীর নাম</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>শ্রেণি</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>সেকশন</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">উপস্থিত</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">অবস্থা</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student, index) => (
                  <TableRow 
                    key={student.id}
                    sx={{
                      '&:hover': { bgcolor: 'grey.50' },
                      bgcolor: attendance[student.id] ? 'success.50' : 'error.50'
                    }}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {student.user?.first_name} {student.user?.last_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {student.user?.username}
                      </Typography>
                    </TableCell>
                    <TableCell>{student.classroom?.name || 'N/A'}</TableCell>
                    <TableCell>{student.section?.name || 'N/A'}</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={attendance[student.id] || false}
                        onChange={() => toggleAttendance(student.id)}
                        color="success"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {attendance[student.id] ? (
                        <Chip
                          label="উপস্থিত"
                          color="success"
                          size="small"
                          icon={<CheckCircleIcon />}
                        />
                      ) : (
                        <Chip
                          label="অনুপস্থিত"
                          color="error"
                          size="small"
                          icon={<CancelIcon />}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Stack direction="row" spacing={2} sx={{ mt: 3 }} justifyContent="center">
              <Button
                variant="contained"
                size="large"
                startIcon={<SaveIcon />}
                onClick={saveAttendance}
                disabled={saving}
              >
                {saving ? 'সংরক্ষণ হচ্ছে...' : 'হাজিরা সংরক্ষণ করুন'}
              </Button>
              {autoSaving && (
                <Chip label="অটো-সেভ হচ্ছে..." color="info" />
              )}
              <Button
                variant="outlined"
                size="large"
                startIcon={<AssessmentIcon />}
                onClick={loadDailySummary}
              >
                সারাংশ দেখুন
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<CalendarIcon />}
                onClick={loadMonthlyReport}
              >
                মাসিক রিপোর্ট
              </Button>
              <TextField
                select
                size="small"
                sx={{ minWidth: 120 }}
                label="সাল"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {Array.from({ length: 6 }, (_, i) => String(dayjs().year() - i)).map(y => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                size="large"
                startIcon={<CalendarIcon />}
                onClick={loadYearlyReport}
              >
                বাৎসরিক রিপোর্ট
              </Button>
            </Stack>
          </>
        )}
      </Paper>

      {/* Daily Summary Dialog */}
      <Dialog
        open={summaryDialogOpen}
        onClose={() => setSummaryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            📊 দৈনিক হাজিরা সারাংশ - {date}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {dailySummary.length === 0 ? (
            <Alert severity="info">এই তারিখের জন্য কোনো হাজিরার তথ্য নেই</Alert>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>শ্রেণি</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>সেকশন</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">মোট</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">উপস্থিত</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">অনুপস্থিত</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">%</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailySummary.map((summary, index) => (
                  <TableRow key={index}>
                    <TableCell>{summary.classroom}</TableCell>
                    <TableCell>{summary.section}</TableCell>
                    <TableCell align="center">{summary.total_students}</TableCell>
                    <TableCell align="center">
                      <Chip label={summary.present_count} color="success" size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={summary.absent_count} color="error" size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={`${summary.attendance_percentage}%`} 
                        color={summary.attendance_percentage >= 75 ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryDialogOpen(false)}>বন্ধ করুন</Button>
          <Button variant="contained" startIcon={<DownloadIcon />}>
            রিপোর্ট ডাউনলোড
          </Button>
        </DialogActions>
      </Dialog>

      {/* Monthly Report Section */}
      {monthlyReport.length > 0 && (
        <Paper sx={{ p: 3, mt: 3, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            📅 মাসিক হাজিরা রিপোর্ট - {selectedMonth}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              type="month"
              label="মাস পরিবর্তন করুন"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <Button variant="outlined" size="small" onClick={loadMonthlyReport} startIcon={<CalendarIcon />}>
              রিফ্রেশ
            </Button>
          </Stack>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>শিক্ষার্থীর নাম</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>শ্রেণি</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>সেকশন</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">মোট দিন</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">উপস্থিত</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">অনুপস্থিত</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">হাজিরা %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {monthlyReport.map((report) => (
                <TableRow key={report.student_id}>
                  <TableCell>{report.student_name}</TableCell>
                  <TableCell>{report.classroom}</TableCell>
                  <TableCell>{report.section}</TableCell>
                  <TableCell align="center">{report.total_days}</TableCell>
                  <TableCell align="center">
                    <Chip label={report.present_days} color="success" size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={report.absent_days} color="error" size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${report.attendance_percentage}%`}
                      color={
                        report.attendance_percentage >= 75 ? 'success' :
                        report.attendance_percentage >= 50 ? 'warning' : 'error'
                      }
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      {yearlyReport.length > 0 && (
        <Paper sx={{ p: 3, mt: 3, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            📅 বাৎসরিক হাজিরা রিপোর্ট - {selectedYear}
          </Typography>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>শিক্ষার্থীর নাম</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>শ্রেণি</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>সেকশন</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">মোট দিন</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">উপস্থিত</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">অনুপস্থিত</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">হাজিরা %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {yearlyReport.map((report) => (
                <TableRow key={report.student_id}>
                  <TableCell>{report.student_name}</TableCell>
                  <TableCell>{report.classroom}</TableCell>
                  <TableCell>{report.section}</TableCell>
                  <TableCell align="center">{report.total_days}</TableCell>
                  <TableCell align="center">
                    <Chip label={report.present_days} color="success" size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={report.absent_days} color="error" size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${report.attendance_percentage}%`}
                      color={
                        report.attendance_percentage >= 75 ? 'success' :
                        report.attendance_percentage >= 50 ? 'warning' : 'error'
                      }
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
