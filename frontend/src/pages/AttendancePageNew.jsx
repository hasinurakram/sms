import React, { useEffect, useState } from 'react';
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
  }, [selectedClassroom, selectedSection, date]);

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
      
      // Create attendance map
      const attendanceMap = {};
      attendanceRes.data.forEach(record => {
        attendanceMap[record.student] = record.present;
      });

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

  const toggleAttendance = (studentId) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const markAllPresent = () => {
    const newAttendance = {};
    students.forEach(student => {
      newAttendance[student.id] = true;
    });
    setAttendance(newAttendance);
    toast.success('All students marked present');
  };

  const markAllAbsent = () => {
    const newAttendance = {};
    students.forEach(student => {
      newAttendance[student.id] = false;
    });
    setAttendance(newAttendance);
    toast.success('All students marked absent');
  };

  const saveAttendance = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (students.length === 0) {
      toast.warning('No students to save attendance for');
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
        toast.success(`Attendance saved successfully! ${response.data.saved} records saved.`);
        if (response.data.errors && response.data.errors.length > 0) {
          console.warn('Some records had errors:', response.data.errors);
        }
        loadDailySummary();
      } else {
        toast.error('Failed to save some attendance records');
      }
    } catch (error) {
      console.error('Failed to save attendance:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.detail || 'Failed to save attendance';
      toast.error(errorMsg);
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
      setMonthlyReport(res.data || []);
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
          শ্রেণী ও তারিখ নির্বাচন
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="শ্রেণী *"
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
            >
              <MenuItem value="">-- শ্রেণী নির্বাচন করুন --</MenuItem>
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
            হাজিরা দেওয়ার জন্য প্রথমে শ্রেণী নির্বাচন করে "শিক্ষার্থী লোড করুন" বাটনে ক্লিক করুন
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
                  <TableCell sx={{ fontWeight: 'bold' }}>শ্রেণী</TableCell>
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
                  <TableCell sx={{ fontWeight: 'bold' }}>শ্রেণী</TableCell>
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
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>শিক্ষার্থীর নাম</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>শ্রেণী</TableCell>
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
    </Box>
  );
}
