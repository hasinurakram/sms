import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
  Button,
  Stack
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import { useSchool } from '../context/SchoolContext';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

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
  const navigate = useNavigate();
  const { schoolId: contextSchoolId } = useSchool();
  const schoolId = contextSchoolId || id;
  const tableRef = useRef(null);
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
        const computed = computeNewRolls(list);
        setRankings(computed);
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

  const computeNewRolls = (list) => {
    const byStudent = new Map();
    list.forEach(item => {
      const sid = item?.student?.id ?? item?.student_id ?? `${item?.student?.user?.id || ''}-${item?.student?.roll_number || ''}`;
      if (!sid) return;
      const prev = byStudent.get(sid);
      const currScore = Number(item?.total_marks_obtained ?? 0);
      const prevScore = Number(prev?.total_marks_obtained ?? -1);
      if (!prev || currScore > prevScore) byStudent.set(sid, item);
    });
    const unique = Array.from(byStudent.values());
    const sorted = unique.sort((a, b) => {
      const aScore = Number(a?.total_marks_obtained ?? 0);
      const bScore = Number(b?.total_marks_obtained ?? 0);
      if (bScore !== aScore) return bScore - aScore;
      const aFail = Number(a?.failed_subjects_count ?? 0);
      const bFail = Number(b?.failed_subjects_count ?? 0);
      if (aFail !== bFail) return aFail - bFail;
      const aCgpa = Number(a?.cgpa ?? 0);
      const bCgpa = Number(b?.cgpa ?? 0);
      if (bCgpa !== aCgpa) return bCgpa - aCgpa;
      const aName = `${a?.student?.user?.first_name || ''} ${a?.student?.user?.last_name || ''}`.trim();
      const bName = `${b?.student?.user?.first_name || ''} ${b?.student?.user?.last_name || ''}`.trim();
      return aName.localeCompare(bName, 'bn');
    });
    return sorted.map((item, idx) => ({ ...item, _new_roll: idx + 1 }));
  };

  const printRef = useRef(null);

  const getClassName = () => {
    return classrooms.find(c => String(c.id) === String(selectedClass))?.name || '';
  };

  const getSectionName = () => {
    return sections.find(s => String(s.id) === String(selectedSection))?.name || '';
  };

  const handlePrint = () => {
    window.print();
  };

  const downloadPDF = async () => {
    const el = printRef.current;
    if (!el) return;
    
    // Temporarily make it visible for html2canvas if needed, 
    // but off-screen rendering usually works if display is not none.
    
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait might be better for fewer columns
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    
    let position = 0;
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    } else {
      let y = 0;
      const sliceHeight = canvas.height * (pageHeight / imgHeight);
      while (y < canvas.height) {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(sliceHeight, canvas.height - y);
        const ctx = pageCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, y, pageCanvas.width, pageCanvas.height, 0, 0, pageCanvas.width, pageCanvas.height);
        const pageImgData = pageCanvas.toDataURL('image/png');
        if (y === 0) {
          pdf.addImage(pageImgData, 'PNG', 0, 0, imgWidth, pageCanvas.height * (imgWidth / pageCanvas.width));
        } else {
          pdf.addPage();
          pdf.addImage(pageImgData, 'PNG', 0, 0, imgWidth, pageCanvas.height * (imgWidth / pageCanvas.width));
        }
        y += sliceHeight;
      }
    }
    pdf.save(`rank-list-${getClassName()}-${getSectionName()}.pdf`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ '@media print': { display: 'none' } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom>Student Rankings</Typography>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>ব্যাক</Button>
      </Stack>
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
        {rankings.length > 0 && (
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={downloadPDF}>
              ডাউনলোড PDF
            </Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
              প্রিন্ট
            </Button>
          </Stack>
        )}
        <TableContainer component={Paper} ref={tableRef}>
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
                  <TableCell>{row._new_roll ?? 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        </>
      )}
      </Box>
      <Box
        ref={printRef}
        sx={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '210mm',
          padding: '20px',
          backgroundColor: 'white',
          '@media print': {
            position: 'static',
            left: 'auto',
            top: 'auto',
            width: '100%',
            display: 'block'
          }
        }}
      >
        <Typography variant="h5" align="center" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Class: {getClassName()} &nbsp;&nbsp; Section: {getSectionName()}
        </Typography>
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #ddd' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>Current Roll</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>Total Marks</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>Failed Subjects</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>New Roll</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rankings.map((row, index) => (
                <TableRow key={index}>
                  <TableCell sx={{ border: '1px solid #ddd' }}>{row.student?.roll_number ?? 'N/A'}</TableCell>
                  <TableCell sx={{ border: '1px solid #ddd' }}>{`${row.student?.user?.first_name || ''} ${row.student?.user?.last_name || ''}`.trim() || row.student?.user?.username || 'N/A'}</TableCell>
                  <TableCell sx={{ border: '1px solid #ddd' }}>{row.total_marks_obtained ?? 'N/A'}</TableCell>
                  <TableCell sx={{ border: '1px solid #ddd' }}>{row.failed_subjects_count ?? 0}</TableCell>
                  <TableCell sx={{ border: '1px solid #ddd' }}>{row._new_roll ?? 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default RankListPage;
