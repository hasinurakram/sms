
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, CircularProgress, Grid, Card, CardContent, Chip, Avatar,
  Tabs, Tab, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, MenuItem, Stack, Container, AppBar, Toolbar, Divider
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { ArrowBack, Save as SaveIcon, History as HistoryIcon } from '@mui/icons-material';
// import { DataGrid } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import 'dayjs/locale/bn';
import { useToast } from '../components/Toast';
import api from '../utils/api';
import MonthlyAttendanceInput from '../components/MonthlyAttendanceInput';
import ResultCardComponent from '../components/ResultCard';
import StudentFeeSlipCard from '../components/StudentFeeSlipCard';
import PaymentHistoryDialog from '../components/PaymentHistoryDialog';

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
// import FeeReceipt from '../components/FeeReceipt';

// Placeholder components for StudentDashboard
const StudentProfile = ({ student, schoolInfo }) => {
  if (!student) return <CircularProgress />;
  const user = student.user || {};
  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6" gutterBottom>ছাত্র/ছাত্রী প্রোফাইল</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" color="text.secondary">নাম</Typography>
          <Typography variant="body1">{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}</Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" color="text.secondary">ইমেইল</Typography>
          <Typography variant="body1">{user.email || 'N/A'}</Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" color="text.secondary">ফোন</Typography>
          <Typography variant="body1">{user.phone_number || 'N/A'}</Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" color="text.secondary">রক্তের গ্রুপ</Typography>
          <Typography variant="body1">{student.blood_group || 'N/A'}</Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" color="text.secondary">রোল নম্বর</Typography>
          <Typography variant="body1">{student.roll_number || 'N/A'}</Typography>
        </Grid>
      </Grid>
    </Paper>
  );
};

const StudentAttendance = ({ attendance, summary, studentId, schoolId, student }) => {
  const currentMonth = dayjs().format('YYYY-MM');
  const normalizeDate = (rec) => rec?.date || rec?.attendance_date || '';
  const isPresent = (record) => {
    const status = (record?.status || '').toLowerCase();
    if (status) {
      if (status === 'absent') return false;
      if (status === 'present' || status === 'late' || status === 'excused') return true;
    }
    if (typeof record?.present === 'boolean') return record.present;
    if (typeof record?.is_present === 'boolean') return record.is_present;
    return false;
  };
  const toBnDigits = (s) => String(s).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
  const monthYearBn = `${dayjs().locale('bn').format('MMMM')} ${toBnDigits(dayjs().format('YYYY'))} ইং`;
  const monthRecords = Array.isArray(attendance)
    ? attendance.filter((rec) => String(normalizeDate(rec)).startsWith(currentMonth))
    : [];
  const presentCount = monthRecords.reduce((sum, rec) => sum + (isPresent(rec) ? 1 : 0), 0);
  const absentCount = monthRecords.length - presentCount;
  const totalCount = monthRecords.length;

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">Attendance</Typography>
            <Typography variant="subtitle2" color="text.secondary">{monthYearBn}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip label={`Present: ${presentCount}`} color="success" size="small" />
            <Chip label={`Absent: ${absentCount}`} color="error" size="small" />
            <Chip label={`Total: ${totalCount}`} color="primary" size="small" />
          </Stack>
        </Box>
        {resolveStudentPhoto(student) && (
          <Avatar src={resolveStudentPhoto(student)} sx={{ width: 48, height: 48 }} />
        )}
      </Box>
      {monthRecords && monthRecords.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...monthRecords]
                .sort((a, b) => {
                  const ad = new Date(a.date || a.attendance_date);
                  const bd = new Date(b.date || b.attendance_date);
                  return bd - ad;
                })
                .map((record, idx) => (
                <TableRow key={idx}>
                  <TableCell>{record.date || record.attendance_date || 'N/A'}</TableCell>
                  <TableCell>{(() => {
                    const present = isPresent(record);
                    return (
                      <Chip label={present ? 'Present' : 'Absent'} color={present ? 'success' : 'error'} size="small" sx={{ fontWeight: 'bold' }} />
                    );
                  })()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">No attendance records found.</Alert>
      )}
    </Paper>
  );
};

const StudentFees = ({ rows, totals, payments, loading, studentId, schoolId, classroomId, student, schoolInfo }) => {
  if (loading) return <CircularProgress />;

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Fees</Typography>
      </Box>
      {rows && rows.length > 0 && (
        <StudentFeeSlipCard
          title="শিক্ষার্থীর বকেয়া ফি"
          school={schoolInfo}
          student={student}
          rows={rows}
          totals={totals}
          payments={payments}
        />
      )}
      {rows && rows.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Fee Type</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{row.fee_type || row.name || 'N/A'}</TableCell>
                  <TableCell>৳{Number(row.amount || 0).toFixed(2)}</TableCell>
                  <TableCell>{row.status || 'Pending'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">No fee records found.</Alert>
      )}
    </Paper>
  );
};

const StudentResults = ({ 
  results, 
  studentId, 
  student, 
  schoolInfo, 
  resultCardData, 
  loadingResultCard,
  selectedExamType,
  onExamTypeChange,
  onLoadResultCard,
  examTypes
}) => {
  return (
    <Box sx={{ mt: 2 }}>
      {/* Result Card Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Result Card</Typography>
          <TextField
            select
            label="Select Exam Type"
            value={selectedExamType}
            onChange={(e) => onExamTypeChange(e.target.value)}
            fullWidth
            sx={{ maxWidth: 400 }}
          >
            <MenuItem value="">Select exam type</MenuItem>
            {examTypes.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                {type.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={onLoadResultCard}
            disabled={!selectedExamType || loadingResultCard}
            sx={{ maxWidth: 200 }}
          >
            {loadingResultCard ? 'Loading...' : 'Load Result Card'}
          </Button>
        </Stack>
      </Paper>

      {/* Result Card Display */}
      {loadingResultCard ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : resultCardData && resultCardData.studentData && resultCardData.results && resultCardData.results.length > 0 ? (
        <ResultCardComponent
          studentData={resultCardData.studentData}
          results={resultCardData.results}
          overallResult={resultCardData.overallResult}
          examination={resultCardData.examination}
          school={schoolInfo}
        />
      ) : resultCardData && resultCardData.studentData ? (
        <Alert severity="info">No results found for the selected exam type.</Alert>
      ) : (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Results Table</Typography>
          {results && results.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Exam</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Marks</TableCell>
                    <TableCell>Grade</TableCell>
                    <TableCell>GPA</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((result, idx) => {
                    // Extract exam name - handle both object and string
                    const examName = typeof result.examination === 'object' 
                      ? (result.examination?.name || result.examination?.exam_name || 'N/A')
                      : (result.exam_name || result.examination || 'N/A');
                    
                    // Extract subject name - handle both object and string
                    const subjectName = typeof result.subject === 'object'
                      ? (result.subject?.name || result.subject?.subject_name || 'N/A')
                      : (result.subject_name || result.subject || 'N/A');
                    
                    // Extract marks
                    const marks = result.total_obtained || result.marks || result.total_marks || 'N/A';
                    
                    // Extract grade
                    const grade = result.grade || 'N/A';
                    
                    // Extract GPA
                    const gpa = result.gpa || '0.00';
                    
                    return (
                      <TableRow key={result.id || idx}>
                        <TableCell>{String(examName)}</TableCell>
                        <TableCell>{String(subjectName)}</TableCell>
                        <TableCell>{String(marks)}</TableCell>
                        <TableCell>{String(grade)}</TableCell>
                        <TableCell>{String(gpa)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">No results found.</Alert>
          )}
        </Paper>
      )}
    </Box>
  );
};

// Higher-Order Component to inject hooks into a class component
function withHooks(Component) {
  return function WrappedComponent(props) {
    const params = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    return <Component {...props} params={params} navigate={navigate} toast={toast} />;
  }
}

class StudentDashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: null,
      student: null,
      attendance: [],
      results: [],
      attendanceSummary: null,
      feesLoading: false,
      feeRows: [],
      feeTotals: { amount: 0, paid: 0, due: 0 },
      feePayments: [],
      selectedTab: 0,
      schoolInfo: null,
      feeStructures: [],
      showMonthlyAttendanceDialog: false,
      showPaymentHistoryDialog: false,
      // Result card state
      resultCardData: null,
      loadingResultCard: false,
      selectedExamType: 'annual',
      examinations: [],
      examTypes: [
        { value: 'test', label: 'বিশেষ মূল্যায়ন' },
        { value: 'half_yearly', label: 'অর্ধবার্ষিক' },
        { value: 'annual', label: 'বার্ষিক' },
        { value: 'terminal', label: 'টার্মিনাল' },
        { value: 'model', label: 'মডেল টেস্ট' },
        { value: 'first_term', label: 'প্রথম টার্ম' },
        { value: 'final', label: 'ফাইনাল' }
      ],
    };
  }

  componentDidMount() {
    this.loadStudentData();
  }

  getStructureLabel = (s, fallback) => {
    if (!s) return fallback;
    const { frequency, academic_year, category, name, title, label, month, type, month_no, month_number, exam_code, exam_type, exam, _month_inferred } = s;
    // Ignore raw name to enforce requested Bengali formatting
    const monthsBn = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
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
      if (m >= 1 && m <= 12) return `মাসিক বেতন(${monthsBn[m - 1]})`;
      // If month not present, still return a generic tuition label without 'undefined'
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
  }

  loadStudentData = async () => {
    const { id, studentId } = this.props.params;
    if (!studentId) return;

    this.setState({ loading: true, error: null });

    try {
      const res = await api.get(`/api/academics/students/${studentId}/`);
      const s = res.data;
      this.setState({ student: s });

      try {
        const sch = await api.get(`/api/schools/${id}/`);
        this.setState({ schoolInfo: sch.data });
      } catch (_) {}

      // Load examinations for result card
      try {
        const examsRes = await api.get(`/api/results/examinations/?school=${id}`);
        const examsData = Array.isArray(examsRes.data) ? examsRes.data : (examsRes.data?.results || []);
        const classroomId = s?.classroom?.id;
        if (classroomId) {
          const classExams = examsData.filter(exam => {
            const cid = typeof exam.classroom === 'object' ? (exam.classroom?.id ?? null) : exam.classroom;
            return parseInt(cid) === parseInt(classroomId);
          });
          if (classExams.length === 0) {
            try {
              const classOnlyRes = await api.get(`/api/results/examinations/?classroom=${classroomId}`);
              const classOnlyData = Array.isArray(classOnlyRes.data) ? classOnlyRes.data : (classOnlyRes.data?.results || []);
              this.setState({ examinations: classOnlyData });
            } catch (_) {
              this.setState({ examinations: classExams });
            }
          } else {
            this.setState({ examinations: classExams });
          }
        } else {
          this.setState({ examinations: examsData });
        }
      } catch (_) {
        this.setState({ examinations: [] });
      }

      try {
        const [att] = await Promise.all([
          api.get(`/api/attendance/records/?student=${studentId}`)
        ]);
        let resultsArr = [];
        const resultEndpoints = [
          `/api/results/results/?student=${studentId}&ordering=-exam__date`,
          `/api/results/student-results/?student=${studentId}`,
          `/api/results/?student=${studentId}`
        ];
        for (const ep of resultEndpoints) {
          try {
            const r = await api.get(ep);
            const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
            if (Array.isArray(arr)) { resultsArr = arr; break; }
          } catch (_) {}
        }
        this.setState({
          attendance: Array.isArray(att.data) ? att.data : (att.data?.results || []),
          results: resultsArr
        });

        try {
          const currentMonth = dayjs().format('YYYY-MM');
          const clsId = s?.classroom?.id;
          if (clsId) {
            const m = await api.get(`/api/attendance/records/monthly_report/?school=${id}&month=${currentMonth}&classroom=${clsId}`);
            const row = (Array.isArray(m.data) ? m.data : (m.data?.results || [])).find(r => r.student_id === Number(studentId));
            this.setState({ attendanceSummary: row || null });
          } else {
            this.setState({ attendanceSummary: null });
          }
        } catch (_) {
          this.setState({ attendanceSummary: null });
        }

        try {
          this.setState({ feesLoading: true });
          let assignments = [];
          let usedFallbackAssignments = false;
          let clsIdForFees = s?.classroom?.id ?? s?.classroom ?? s?.class?.id ?? s?.class_id ?? s?.class ?? null;

          if (!clsIdForFees) {
            const studentListEndpoints = [
              `/api/academics/students/?school=${id}`,
              `/api/students/?school=${id}`,
              `/api/academics/students/`,
              `/api/students/`
            ];
            for (const ep of studentListEndpoints) {
              try {
                const resp = await api.get(ep);
                const arr = Array.isArray(resp.data) ? resp.data : (resp.data?.results || resp.data?.data || []);
                if (Array.isArray(arr) && arr.length) {
                  const found = arr.find(it => String(it.id || it._id) === String(studentId));
                  if (found) {
                    clsIdForFees = found.classroom?.id ?? found.classroom ?? found.class?.id ?? found.class_id ?? found.class ?? null;
                    if (clsIdForFees) break;
                  }
                }
              } catch (_) {}
            }
          }

          const assignmentEndpoints = [
            `/api/fees/assignments/?student_id=${studentId}&school=${id}`,
            `/api/fees/assignments/?student=${studentId}&school=${id}`,
            `/api/fees/assignments/?student_id=${studentId}`,
            `/api/fees/assignments/?student=${studentId}`,
            clsIdForFees ? `/api/fees/assignments/?classroom=${clsIdForFees}&student=${studentId}` : null,
            clsIdForFees ? `/api/fees/assignments/?classroom=${clsIdForFees}&student_id=${studentId}` : null,
          ].filter(Boolean);

          for (const ep of assignmentEndpoints) {
            try {
              const r = await api.get(ep);
              const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
              if (Array.isArray(arr) && arr.length) {
                assignments = arr;
                break;
              }
            } catch (_) {}
          }

          let structList = this.state.feeStructures;
          if (!structList || structList.length === 0) {
            try {
              const structEndpoints = [
                `/api/fees/fees/?school=${id}`,
                `/api/fees/fee-structures/?school=${id}`,
                `/api/fees/structures/?school=${id}`,
                `/api/fees/fees/`,
                `/api/fees/fee-structures/`,
                `/api/fees/structures/`
              ];
              let all = [];
              for (const ep of structEndpoints) {
                try {
                  const r = await api.get(ep);
                  const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
                  if (Array.isArray(arr) && arr.length) {
                    all = arr;
                    break;
                  }
                } catch (_) {}
              }
              // If school-wide list is empty, try classroom-specific endpoints
              if ((!all || all.length === 0) && clsIdForFees) {
                const classStructEndpoints = [
                  `/api/fees/fees/?classroom=${clsIdForFees}`,
                  `/api/fees/fees/?classroom_id=${clsIdForFees}`,
                  `/api/fees/fees/?class_id=${clsIdForFees}`,
                  `/api/fees/fee-structures/?classroom=${clsIdForFees}`,
                  `/api/fees/fee-structures/?classroom_id=${clsIdForFees}`,
                  `/api/fees/fee-structures/?class_id=${clsIdForFees}`,
                  `/api/fees/structures/?classroom=${clsIdForFees}`,
                  `/api/fees/structures/?classroom_id=${clsIdForFees}`,
                  `/api/fees/structures/?class_id=${clsIdForFees}`,
                ];
                for (const ep of classStructEndpoints) {
                  try {
                    const r = await api.get(ep);
                    const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
                    if (Array.isArray(arr) && arr.length) {
                      all = arr;
                      break;
                    }
                  } catch (_) {}
                }
              }
              structList = all;
              this.setState({ feeStructures: all });
            } catch (_) {
              structList = [];
            }
          }

          // Fallback: if no explicit assignments were found, derive from fee structures of the student's class
          if ((!assignments || assignments.length === 0) && Array.isArray(structList) && structList.length > 0 && clsIdForFees) {
            try {
              const filteredStructs = structList.filter(st => {
                const stCls = st.classroom?.id ?? st.classroom ?? st.class?.id ?? st.class_id ?? st.class ?? null;
                return stCls && String(stCls) === String(clsIdForFees);
              });
              // If school-wide structures didn't include class IDs, treat whole list as for this class
              const candidates = filteredStructs.length > 0 ? filteredStructs : structList;
              if (candidates.length > 0) {
                assignments = candidates.map(st => ({
                  id: st.id || st._id || `struct-${String(st.id || st._id || Math.random())}`,
                  fee_structure: st,
                  amount: st.amount ?? st.default_amount ?? 0,
                  custom_amount: null,
                  discount_amount: 0,
                  discount_percentage: 0,
                  due_date: null,
                }));
                usedFallbackAssignments = true;
              }
            } catch (_) {}
          }
          if ((!assignments || assignments.length === 0) && Array.isArray(structList) && structList.length > 0) {
            try {
              const toLower = (v) => String(v || '').toLowerCase();
              const isMonthly = (x) => toLower(x.frequency) === 'monthly';
              const isOneTime = (x) => toLower(x.frequency) === 'one_time';
              const monthlyList = structList.filter(isMonthly);
              const oneTimeList = structList.filter(isOneTime);
              const sum = (arr) => arr.reduce((acc, it) => acc + Number(it.amount ?? it.default_amount ?? 0), 0);
              const monthlySum = sum(monthlyList);
              const examSum = sum(oneTimeList);
              const synthetic = [];
              if (monthlySum > 0) {
                synthetic.push({ id: `syn-monthly-${studentId}`, fee_structure: { name: '12 months tuition' }, amount: monthlySum, custom_amount: null, discount_amount: 0, discount_percentage: 0, due_date: null });
              }
              if (examSum > 0) {
                synthetic.push({ id: `syn-exam-${studentId}`, fee_structure: { name: 'Examination fees' }, amount: examSum, custom_amount: null, discount_amount: 0, discount_percentage: 0, due_date: null });
              }
              if (synthetic.length > 0) {
                assignments = synthetic;
                usedFallbackAssignments = true;
              }
            } catch (_) {}
          }

          let payments = [];
          const payEndpoints = [
            `/api/fees/payments/?student_id=${studentId}`,
            `/api/fees/payments/?student=${studentId}`,
            `/api/payments/?student_id=${studentId}`,
            `/api/payments/?student=${studentId}`,
            `/api/fees/collections/?student_id=${studentId}`,
            `/api/fees/collections/?student=${studentId}`
          ];
          for (const ep of payEndpoints) {
            try {
              const p = await api.get(ep);
              if (Array.isArray(p.data)) { payments = p.data; break; }
              if (p.data?.results) { payments = p.data.results; break; }
              if (p.data?.data) { payments = p.data.data; break; }
            } catch (_) {}
          }

          const sidStr2 = String(studentId);
          payments = (payments || []).filter(p => {
            const sid = p.student_id ?? p.studentId ?? p.student?.id ?? p.student;
            return sid ? String(sid) === sidStr2 : true;
          });
          this.setState({ feePayments: payments });

          if (!assignments || assignments.length === 0) {
            // Nothing to show even after fallback
          }

          const sumByAssign = {};
          for (const pay of payments) {
            const aidRaw = pay.assignment_id || pay.assignment || pay.fee_assignment || pay.student_fee_assignment || pay.fee_assignment_id || pay.assignment?.id;
            const aid = aidRaw != null ? String(aidRaw) : '';
            if (!aid) continue;
            sumByAssign[aid] = (sumByAssign[aid] || 0) + Number(pay.amount || pay.paid_amount || 0);
          }

          // If monthly items have no month info, infer an order-based month mapping
          try {
            const monthlyIdxMap = new Map(); // key: assignment id -> inferred month number (1..12)
            const monthlyItems = (assignments || []).filter(a => {
              const sObj = a.fee_structure || a.fee || {};
              return String(sObj.frequency || '').toLowerCase() === 'monthly';
            });
            if (monthlyItems.length >= 2) {
              // Sort by stable key to maintain consistent display
              const sorted = monthlyItems.slice().sort((x, y) => {
                const xn = String((x.fee_structure?.name || x.fee?.name || '')).toLowerCase();
                const yn = String((y.fee_structure?.name || y.fee?.name || '')).toLowerCase();
                if (xn && yn && xn !== yn) return xn < yn ? -1 : 1;
                const xi = Number(x.id || 0); const yi = Number(y.id || 0);
                return xi - yi;
              });
              let monthCounter = 1;
              for (const it of sorted) {
                const sObj = it.fee_structure || it.fee || {};
                const hasMonth = (sObj.month || sObj.month_no || sObj.month_number);
                if (!hasMonth && monthCounter <= 12) {
                  monthlyIdxMap.set(String(it.id || it._id || ''), monthCounter);
                  monthCounter += 1;
                }
              }
              // Inject inferred month into structures
              assignments = (assignments || []).map(a => {
                const aid = String(a.id || a._id || '');
                const sObj = a.fee_structure || a.fee || {};
                const mInf = monthlyIdxMap.get(aid);
                if (mInf && !sObj.month && !sObj.month_no && !sObj.month_number) {
                  return { ...a, fee_structure: { ...sObj, _month_inferred: mInf } };
                }
                return a;
              });
            }
          } catch (_) {}

          let rows = (assignments || []).map(a => {
            const aid = a.id || a._id;
            const sObj = a.fee_structure || a.fee || {};
            const base = a.custom_amount ?? a.amount ?? sObj.amount ?? 0;
            const discountAmt = Number(a.discount_amount || 0);
            const discountPct = Number(a.discount_percentage ?? a.discount_percent ?? a.discount ?? 0);
            const amount = Math.max(0, Number(base) - discountAmt - (Number(base) * discountPct / 100));
            const name = a.fee_structure?.name || (a.fee_structure?.category?.name) || a.fee?.name || this.getStructureLabel(sObj, String(aid)) || 'Fee';
            const paid = Number(sumByAssign[String(aid)] || 0);
            const due = Math.max(0, amount - paid);
            const freq = String(sObj.frequency || '').toLowerCase();
            const rtype = freq === 'monthly' ? 'tuition' : (freq === 'one_time' ? 'exam' : 'other');
            return { id: aid, name, amount, paid, due, due_date: a.due_date || null, type: rtype };
          });

          // Enrich labels: add month names to generic 'মাসিক বেতন' rows when month not present
          try {
            const monthNameRegex = /মাসিক বেতন\((.+)\)/;
            const monthlyGeneric = rows.filter(r => r.name === 'মাসিক বেতন' || (typeof r.name === 'string' && r.name.startsWith('মাসিক বেতন') && !monthNameRegex.test(r.name)));
            if (monthlyGeneric.length >= 2) {
              // Determine stable order by id to keep consistent month mapping
              const monthsBn = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
              const sortedIdx = monthlyGeneric
                .map(r => r.id)
                .sort((a, b) => Number(a) - Number(b));
              const idToMonth = new Map(sortedIdx.map((id, idx) => [String(id), monthsBn[idx % 12]]));
              rows = rows.map(r => {
                if (r.name === 'মাসিক বেতন' || (typeof r.name === 'string' && r.name.startsWith('মাসিক বেতন') && !monthNameRegex.test(r.name))) {
                  const m = idToMonth.get(String(r.id));
                  if (m) return { ...r, name: `মাসিক বেতন(${m})` };
                }
                return r;
              });
            }
          } catch (_) {}

          // Enrich labels: if exam label is generic and there's only one exam-like row, default to বার্ষিক
          try {
            const isExamLike = (nm) => typeof nm === 'string' && (nm === 'পরীক্ষার ফি' || nm === 'পরীক্ষার ফি(পরীক্ষা)' || /^পরীক্ষার ফি\(/.test(nm));
            const examRows = rows.filter(r => isExamLike(r.name));
            if (examRows.length === 1) {
              rows = rows.map(r => isExamLike(r.name) ? { ...r, name: 'পরীক্ষার ফি(বার্ষিক)' } : r);
            }
          } catch (_) {}

          // Deduplicate monthly fees for the same month (common issue with multiple structures or generation bugs)
          try {
             const seenMonths = new Set();
             const uniqueRows = [];
             for (const r of rows) {
                // Check for duplicate monthly fees
                if (String(r.name || '').startsWith('মাসিক বেতন')) {
                   const key = `${r.name}-${r.amount}`; // Dedup by Name + Amount
                   if (seenMonths.has(key)) {
                      continue; 
                   }
                   seenMonths.add(key);
                }
                uniqueRows.push(r);
             }
             rows = uniqueRows;
          } catch (_) {}

          let totals = rows.reduce((acc, r) => ({
            amount: acc.amount + r.amount,
            paid: acc.paid + r.paid,
            due: acc.due + r.due
          }), { amount: 0, paid: 0, due: 0 });

          try {
            const schoolIdNum = Number(this.state.schoolInfo?.id || this.props.params.id || 0);
            if (schoolIdNum === 19) {
              const currentMonthNo = Number(dayjs().format('M'));
              const monthsBn = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
              const isMonthlyRow = (nm) => typeof nm === 'string' && nm.startsWith('মাসিক বেতন');
              const monthFromLabel = (nm) => {
                const rx = /মাসিক বেতন\((.+)\)/; const mm = nm.match(rx); if (!mm) return null;
                const idx = monthsBn.indexOf(mm[1]); return idx >= 0 ? (idx + 1) : null;
              };
              rows = rows.filter(r => {
                if (isMonthlyRow(r.name)) {
                  const mno = monthFromLabel(r.name);
                  return mno == null ? true : (mno <= currentMonthNo);
                }
                if (r.type === 'exam') {
                  try {
                    const dd = r.due_date ? new Date(r.due_date) : null;
                    const today = new Date();
                    return !!dd && dd <= today;
                  } catch (_) { return true; }
                }
                return true;
              });
              totals = rows.reduce((acc, r) => ({
                amount: acc.amount + Number(r.amount || 0),
                paid: acc.paid + Number(r.paid || 0),
                due: acc.due + Number(r.due || 0)
              }), { amount: 0, paid: 0, due: 0 });
            }
          } catch (_) {}

          // Totals-only payment fallback: if using structure-derived rows (no real assignments),
          // reflect total student payments even if not linked to assignments.
          if (usedFallbackAssignments) {
            const totalPaymentsAmount = (payments || []).reduce((sum, p) => sum + Number(p.amount || p.paid_amount || 0), 0);
            if (totalPaymentsAmount > 0) {
              totals = {
                amount: totals.amount,
                paid: totalPaymentsAmount,
                due: Math.max(0, totals.amount - totalPaymentsAmount)
              };
            }
          }

          const formattedPays = payments.map(p => ({
            date: p.payment_date || p.date || p.created_at,
            amount: Number(p.amount || p.paid_amount || 0),
            method: p.payment_method || p.method || 'N/A',
            reference: p.reference || p.transaction_id || p.receipt_number || ''
          }));

          this.setState({ feeRows: rows, feeTotals: totals, feePayments: formattedPays });

        } finally {
          this.setState({ feesLoading: false });
        }
      } catch (_) {
        this.setState({ attendance: [], results: [] });
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || 'Failed to load student';
      this.setState({ error: msg });
      this.props.toast.error(msg);
    } finally {
      this.setState({ loading: false });
    }
  }

  handleTabChange = (event, newValue) => {
    this.setState({ selectedTab: newValue });
  };

  handleOpenPaymentHistory = () => {
    this.setState({ showPaymentHistoryDialog: true });
  };

  handleClosePaymentHistory = () => {
    this.setState({ showPaymentHistoryDialog: false });
  };

  handleExamTypeChange = (examType) => {
    this.setState({ selectedExamType: examType, resultCardData: null });
  };

  normalizeExamType = (type, name) => {
    const s = String(type || '').toLowerCase();
    if (!s) {
      const rn = String(name || '').toLowerCase();
      if (/(বার্ষিক|final|annual)/.test(rn)) return 'annual';
      if (/(অর্ধ|half|mid)/.test(rn)) return 'half_yearly';
      if (/(টার্মিনাল|terminal)/.test(rn)) return 'terminal';
      if (/(মডেল|model)/.test(rn)) return 'model';
      if (/(টেস্ট|test|monthly)/.test(rn)) return 'test';
    }
    if (['final','annual','yearly'].includes(s)) return 'annual';
    if (['half','half_yearly','mid','half-yearly'].includes(s)) return 'half_yearly';
    if (['terminal','term'].includes(s)) return 'terminal';
    if (['model','model_test','model-test'].includes(s)) return 'model';
    if (['test','monthly'].includes(s)) return 'test';
    if (['first_term','first','first-term'].includes(s)) return 'first_term';
    return s || 'annual';
  };

  getClassroomId = (cls) => {
    const v = typeof cls === 'object' ? (cls?.id ?? null) : cls;
    const n = parseInt(v);
    return Number.isNaN(n) ? null : n;
  };

  loadResultCard = async () => {
    const { id, studentId } = this.props.params;
    const { selectedExamType, student, examinations, schoolInfo } = this.state;
    const classroomId = student?.classroom?.id;

    if (!selectedExamType || !studentId || !classroomId) {
      this.props.toast.warning('Please select exam type');
      return;
    }

    this.setState({ loadingResultCard: true, resultCardData: null });

    try {
      // Get student details
      const studentRes = await api.get(`/api/academics/students/${studentId}/`);
      const studentData = { student: studentRes.data };

      // Find examinations by exam type for this class
      const matchingExams = examinations.filter(exam => 
        this.normalizeExamType(exam.exam_type, exam.name) === selectedExamType && 
        this.getClassroomId(exam.classroom) === parseInt(classroomId)
      );

      if (matchingExams.length === 0) {
        const fallbackExams = examinations.filter(exam => this.getClassroomId(exam.classroom) === parseInt(classroomId));
        let alt = [];
        if (selectedExamType === 'annual') alt = fallbackExams.filter(ex => /(বার্ষিক|final|annual)/i.test(String(ex.name || '')));
        else if (selectedExamType === 'half_yearly') alt = fallbackExams.filter(ex => /(অর্ধ|half|mid)/i.test(String(ex.name || '')));
        else if (selectedExamType === 'terminal') alt = fallbackExams.filter(ex => /(টার্মিনাল|terminal)/i.test(String(ex.name || '')));
        else if (selectedExamType === 'model') alt = fallbackExams.filter(ex => /(মডেল|model)/i.test(String(ex.name || '')));
        else if (selectedExamType === 'test') alt = fallbackExams.filter(ex => /(টেস্ট|test|monthly)/i.test(String(ex.name || '')));
        const useExams = alt.length ? alt : fallbackExams;
        if (!useExams.length) {
          this.props.toast.error(`No ${this.state.examTypes.find(t => t.value === selectedExamType)?.label || selectedExamType} examination found for this class`);
          this.setState({ loadingResultCard: false, resultCardData: null });
          return;
        }
        const examRes = await api.get(`/api/results/examinations/${useExams[0].id}/`);
        const examination = examRes.data;
        let allResults = [];
        try {
          const resultsRes = await api.get(`/api/results/results/?examination=${useExams[0].id}&student=${studentId}`);
          allResults = Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || []);
        } catch (_) { allResults = []; }
        this.setState({
          resultCardData: {
            studentData,
            results: allResults,
            overallResult: null,
            examination
          },
          loadingResultCard: false
        });
        if (allResults.length > 0) this.props.toast.success(`Result card loaded for selected exam (${allResults.length} subjects)`);
        else this.props.toast.info('No results found for the selected exam type.');
        return;
      }

      const examResList = await Promise.all(matchingExams.map(ex => api.get(`/api/results/examinations/${ex.id}/`).then(r => r.data).catch(() => null)));
      const validExams = examResList.filter(Boolean);
      const examination = validExams.sort((a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0))[0] || validExams[0] || null;
      let allResults = [];
      for (const ex of matchingExams) {
        try {
          const resultsRes = await api.get(`/api/results/results/?examination=${ex.id}&student=${studentId}&page_size=1000`);
          const arr = Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || []);
          allResults = allResults.concat(arr);
        } catch (_) {}
      }
      
      // Get combined overall result with rank from backend
      let overallResult = null;
      try {
        const overallRes = await api.get(`/api/results/overall/combined_by_exam_type/?student=${studentId}&exam_type=${selectedExamType}&classroom=${classroomId}`);
        overallResult = overallRes.data;
      } catch (err) {
        console.error('Error fetching combined overall result:', err);
        // Fallback: Calculate on frontend without rank
        if (allResults.length > 0) {
          const totalObtained = allResults.reduce((sum, r) => sum + (parseFloat(r.total_obtained) || 0), 0);
          const totalPossible = allResults.reduce((sum, r) => {
            const ex = r.examination || {};
            const wm = parseFloat(ex.written_max) || 0;
            const mm = parseFloat(ex.mcq_max) || 0;
            const pm = parseFloat(ex.practical_max) || 0;
            const maximaSum = (wm || mm || pm) ? (wm + mm + pm) : (parseFloat(ex.total_marks) || 100);
            return sum + maximaSum;
          }, 0);
          const avgGPA = allResults.reduce((sum, r) => sum + (parseFloat(r.gpa) || 0), 0) / allResults.length;
          const percentage = totalPossible > 0 ? (totalObtained / totalPossible * 100).toFixed(2) : 0;
          const isPassed = allResults.every(r => r.is_passed);
          
          // Determine grade based on CGPA
          let grade = 'F';
          if (avgGPA >= 5.0) grade = 'A+';
          else if (avgGPA >= 4.0) grade = 'A';
          else if (avgGPA >= 3.5) grade = 'A-';
          else if (avgGPA >= 3.0) grade = 'B';
          else if (avgGPA >= 2.0) grade = 'C';
          else if (avgGPA >= 1.0) grade = 'D';
          
          overallResult = {
            total_marks_obtained: totalObtained.toFixed(2),
            total_marks_possible: totalPossible.toFixed(2),
            percentage: percentage,
            cgpa: avgGPA.toFixed(2),
            grade: grade,
            is_passed: isPassed,
            rank: null
          };
        }
      }

      this.setState({
        resultCardData: {
          studentData,
          results: allResults,
          overallResult,
          examination
        },
        loadingResultCard: false
      });

      if (allResults.length > 0) {
        this.props.toast.success(`Result card loaded for selected exam (${allResults.length} subjects)`);
      } else {
        this.props.toast.warning('No results found for this exam type');
      }
    } catch (err) {
      console.error(err);
      this.props.toast.error('Failed to load result card');
      this.setState({ loadingResultCard: false, resultCardData: null });
    }
  };

  render() {
    const { loading, error, student, attendance, results, attendanceSummary, feesLoading, feeRows, feeTotals, feePayments, selectedTab, schoolInfo } = this.state;
    const { navigate } = this.props;

    if (loading) {
      return (
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      );
    }

    

    const attendanceColumns = [
      { 
        field: 'date', 
        headerName: 'Date', 
        width: 150,
        valueFormatter: ({ value }) => dayjs(value).format('DD MMM YYYY')
      },
      { 
        field: 'is_present', 
        headerName: 'Status', 
        width: 120, 
        renderCell: (params) => (
          <Chip 
            label={params.value ? 'Present' : 'Absent'} 
            color={params.value ? 'success' : 'error'} 
            size="small" 
          />
        )
      },
    ];

    const resultColumns = [
      { 
        field: 'subject', 
        headerName: 'Subject', 
        flex: 1,
        valueFormatter: ({ value }) => value || 'N/A'
      },
      { 
        field: 'marks', 
        headerName: 'Marks', 
        width: 100,
        valueFormatter: ({ value }) => value || 'N/A'
      },
      { 
        field: 'grade', 
        headerName: 'Grade', 
        width: 100,
        valueFormatter: ({ value }) => value || 'N/A'
      },
    ];

    const feeColumns = [
      { 
        field: 'name', 
        headerName: 'Fee', 
        flex: 1,
        valueFormatter: ({ value }) => value || 'N/A'
      },
      { 
        field: 'amount', 
        headerName: 'Amount', 
        width: 120, 
        renderCell: (params) => `৳${Number(params.value || 0).toFixed(2)}`,
        valueFormatter: ({ value }) => `৳${Number(value || 0).toFixed(2)}`
      },
      { 
        field: 'paid', 
        headerName: 'Paid', 
        width: 120, 
        renderCell: (params) => `৳${Number(params.value || 0).toFixed(2)}`,
        valueFormatter: ({ value }) => `৳${Number(value || 0).toFixed(2)}`
      },
      { 
        field: 'due', 
        headerName: 'Due', 
        width: 120, 
        renderCell: (params) => `৳${Number(params.value || 0).toFixed(2)}`,
        valueFormatter: ({ value }) => `৳${Number(value || 0).toFixed(2)}`
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 200,
        renderCell: (params) => (
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={() => this.setState({ showMonthlyAttendanceDialog: true })}
            startIcon={<SaveIcon />}
          >
            মাসিক হাজিরা দিন
          </Button>
        )
      }
    ];

    // Styled components for better UI
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
      width: 120,
      height: 120,
      border: '4px solid white',
      boxShadow: theme.shadows[4],
      marginRight: theme.spacing(3),
      [theme.breakpoints.down('sm')]: {
        width: 100,
        height: 100,
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

    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: '#f5f7fa',
        pb: 4
      }}>
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate(-1)}
              color="inherit"
              sx={{ color: 'text.primary' }}
            >
              Back
            </Button>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg">
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
              <CircularProgress />
            </Box>
          ) : !student ? (
            <Alert severity="error">Student not found</Alert>
          ) : (
            <Box>
              <HeaderCard elevation={3}>
                <Grid container alignItems="center" spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
                  <Grid item>
                    <StyledAvatar
                      src={resolveStudentPhoto(student)}
                      alt={student.user?.first_name || 'Student'}
                    />
                  </Grid>
                  <Grid item xs>
                    <Typography variant="h4" component="h1" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
                      {`${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim() || 'Student Dashboard'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                      {student.roll_number && (
                        <Chip 
                          label={`রোল: ${student.roll_number}`} 
                          color="primary" 
                          variant="outlined" 
                          sx={{ 
                            bgcolor: 'rgba(255,255,255,0.15)', 
                            color: 'white',
                            borderColor: 'rgba(255,255,255,0.3)'
                          }} 
                        />
                      )}
                      {student.classroom?.name && (
                        <Chip 
                          label={`শ্রেণি: ${student.classroom.name}`} 
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

              <Tabs
                value={selectedTab}
                onChange={this.handleTabChange}
                variant="scrollable"
                scrollButtons
                allowScrollButtonsMobile
                sx={{ mb: 2 }}
              >
                <Tab label="প্রোফাইল" />
                <Tab label="অ্যাটেনড্যান্স" />
                <Tab label="ফিস" />
                <Tab label="রেজাল্ট" />
              </Tabs>

        {selectedTab === 0 && (
          <StudentProfile student={student} schoolInfo={schoolInfo} />
        )}
        {selectedTab === 1 && (
          <>
            <StudentAttendance
              attendance={attendance}
              summary={attendanceSummary}
              studentId={student?.id}
              schoolId={schoolInfo?.id}
              student={student}
            />
            <MonthlyAttendanceInput
              open={this.state.showMonthlyAttendanceDialog}
              onClose={() => this.setState({ showMonthlyAttendanceDialog: false })}
              studentId={student?.id}
              schoolId={schoolInfo?.id}
              onSave={() => {
                this.loadStudentData(); // Refresh attendance data
                this.props.toast.success('হাজিরা সফলভাবে সংরক্ষণ করা হয়েছে');
              }}
            />
          </>
        )}
        {selectedTab === 2 && (
          <>
            <Box mb={2} display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                color="primary"
                startIcon={<HistoryIcon />}
                onClick={this.handleOpenPaymentHistory}
                sx={{ mb: 2 }}
              >
                পূর্ববর্তী পেমেন্টের হিস্টোরি
              </Button>
            </Box>
            <StudentFees
              rows={feeRows}
              totals={feeTotals}
              payments={feePayments}
              loading={feesLoading}
              studentId={student?.id}
              schoolId={schoolInfo?.id}
              classroomId={student?.classroom?.id}
              student={student}
              schoolInfo={schoolInfo}
            />
            <PaymentHistoryDialog
              open={this.state.showPaymentHistoryDialog}
              onClose={this.handleClosePaymentHistory}
              payments={feePayments}
              loading={feesLoading}
            />
          </>
        )}
        {selectedTab === 3 && (
          <StudentResults 
            results={results} 
            studentId={student?.id}
            student={student}
            schoolInfo={schoolInfo}
            resultCardData={this.state.resultCardData}
            loadingResultCard={this.state.loadingResultCard}
            selectedExamType={this.state.selectedExamType}
            onExamTypeChange={this.handleExamTypeChange}
            onLoadResultCard={this.loadResultCard}
            examTypes={this.state.examTypes}
          />
        )}
          </Box>
          )}
          </Container>
        </Box>
      );
  }
}

export default withHooks(StudentDashboard);
