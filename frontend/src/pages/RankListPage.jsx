import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button
} from '@mui/material';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import { useSchool } from '../context/SchoolContext';

const EXAM_TYPE_LABELS = {
  'half_yearly': 'অর্ধবার্ষিক',
  'annual': 'বার্ষিক',
  'test': 'বিশেষ মূল্যায়ন',
  'model_test': 'মডেল টেস্ট',
  'pre_test': 'প্রাক-নির্বাচনী',
  'final': 'চূড়ান্ত পরীক্ষা'
};

const RankListPage = () => {
  const { id } = useParams();
  const { schoolId: contextSchoolId } = useSchool();
  const schoolId = contextSchoolId || id;
  const [examinations, setExaminations] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    scopedGet('/api/results/examinations/', schoolId)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
        setExaminations(Array.isArray(data) ? data : []);
        const types = [...new Set((Array.isArray(data) ? data : []).map(e => e?.exam_type).filter(Boolean))];
        setExamTypes(types);
      })
      .catch(err => console.error('Examinations fetch error:', err));
    scopedGet('/api/academics/classrooms/', schoolId)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
        setClassrooms(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error('Classrooms fetch error:', err));
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !selectedClass) { setSections([]); return; }
    scopedGet('/api/academics/sections/', schoolId, { classroom: selectedClass })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
        setSections(Array.isArray(data) ? data : []);
      })
      .catch(() => setSections([]));
  }, [schoolId, selectedClass]);

  const handleFetchRankings = () => {
    if (!selectedExamType || !selectedClass || !selectedSection) return;
    setLoading(true);
    setErrorMessage('');
    setRankings([]);
    api.get('/api/results/overall/combined_rank_list_by_exam_type/', {
      params: {
        exam_type: selectedExamType,
        classroom: selectedClass,
        section: selectedSection,
        school: schoolId || undefined,
        page_size: 1000
      }
    })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
        const list = Array.isArray(data) ? data : [];
        if (!list.length) {
          setErrorMessage('কোন ডাটা পাওয়া যায়নি');
          setRankings([]);
          return;
        }
        const sortedData = [...list].sort((a, b) => (a.rank ?? 999999) - (b.rank ?? 999999));
        setRankings(sortedData);
      })
      .catch(err => {
        const msg = err?.response?.data?.detail || err?.message || 'ডাটা লোড করা যায়নি';
        setErrorMessage(msg);
        setRankings([]);
      })
      .finally(() => setLoading(false));
  };

  const getGradeStyle = (grade) => {
    switch (grade) {
      case 'A+': return { bg: '#4CAF50', fg: 'white' };
      case 'A': return { bg: '#8BC34A', fg: 'black' };
      case 'A-': return { bg: '#CDDC39', fg: 'black' };
      case 'B': return { bg: '#FFEB3B', fg: 'black' };
      case 'C': return { bg: '#FFC107', fg: 'black' };
      case 'D': return { bg: '#FF9800', fg: 'black' };
      case 'F': return { bg: '#F44336', fg: 'white' };
      default: return { bg: '#E0E0E0', fg: 'black' };
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Student Rankings</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <FormControl fullWidth>
              <InputLabel id="ranklist-exam-label">Examination</InputLabel>
              <Select
                labelId="ranklist-exam-label"
                id="ranklist-exam"
                value={selectedExamType}
                label="Examination"
                onChange={(e) => {
                  setSelectedExamType(e.target.value);
                  setRankings([]);
                  setErrorMessage('');
                }}
              >
                <MenuItem value="">
                  <em>Select Examination</em>
                </MenuItem>
                {examTypes.map(type => (
                  <MenuItem key={type} value={type}>
                    {EXAM_TYPE_LABELS[type] || type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={5}>
            <FormControl fullWidth>
              <InputLabel id="ranklist-class-label">Class</InputLabel>
              <Select
                labelId="ranklist-class-label"
                id="ranklist-class"
                value={selectedClass}
                label="Class"
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedSection('');
                  setRankings([]);
                  setErrorMessage('');
                }}
              >
                <MenuItem value="">
                  <em>Select Class</em>
                </MenuItem>
                {classrooms.map(cls => (
                  <MenuItem key={cls.id} value={String(cls.id)}>
                    {cls.name || cls.class_name || cls.title || cls.className || `Class ${cls.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth disabled={!selectedClass}>
              <InputLabel id="ranklist-section-label">Section</InputLabel>
              <Select
                labelId="ranklist-section-label"
                id="ranklist-section"
                value={selectedSection}
                label="Section"
                onChange={(e) => {
                  setSelectedSection(e.target.value);
                  setRankings([]);
                  setErrorMessage('');
                }}
              >
                <MenuItem value="">
                  <em>Select Section</em>
                </MenuItem>
                {sections.map(sec => (
                  <MenuItem key={sec.id} value={String(sec.id)}>
                    {sec.name || `Section ${sec.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              onClick={handleFetchRankings}
              disabled={!selectedExamType || !selectedClass || !selectedSection || loading}
              fullWidth
            >
              Show
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
        {errorMessage ? (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography color="error">{errorMessage}</Typography>
          </Paper>
        ) : null}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Current Roll</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Section</TableCell>
                <TableCell>Group</TableCell>
                <TableCell>Total Marks</TableCell>
                <TableCell>Result Status</TableCell>
                <TableCell>Failed Subjects</TableCell>
                <TableCell>AVG. GPA</TableCell>
                <TableCell>AVG. Grade</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell>New Roll</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rankings.map(row => (
                <TableRow key={row.student?.id || `${row.rank}-${row.student?.roll_number || ''}`}>
                  <TableCell>{row.student?.roll_number ?? 'N/A'}</TableCell>
                  <TableCell>{`${row.student?.user?.first_name || ''} ${row.student?.user?.last_name || ''}`.trim() || row.student?.user?.username || 'N/A'}</TableCell>
                  <TableCell>{row.student?.classroom?.name || classrooms.find(c => String(c.id) === String(selectedClass))?.name || 'N/A'}</TableCell>
                  <TableCell>{row.student?.section?.name ?? 'N/A'}</TableCell>
                  <TableCell>{row.student?.group ?? 'N/A'}</TableCell>
                  <TableCell>{row.total_marks_obtained ?? 'N/A'}</TableCell>
                  <TableCell>
                    <Chip
                      label={row.is_passed ? 'Passed' : 'Failed'}
                      color={row.is_passed ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{row.failed_subjects_count ?? 0}</TableCell>
                  <TableCell>{row.cgpa ?? 'N/A'}</TableCell>
                  <TableCell>
                    {row.grade ? <Chip
                      label={row.grade}
                      size="small"
                      sx={{
                        backgroundColor: getGradeStyle(row.grade).bg,
                        color: getGradeStyle(row.grade).fg,
                        fontWeight: 'bold'
                      }}
                    /> : 'N/A'}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell>{row.rank ?? 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        </>
      )}
    </Box>
  );
};

export default RankListPage;
