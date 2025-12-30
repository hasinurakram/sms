import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Tabs,
  Tab,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CloseIcon from '@mui/icons-material/Close';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import AdmissionCard from '../components/AdmissionCard';

// Sample exam data (replace with actual API call)
const sampleExams = [
  { id: 1, name: 'Annual Examination 2024', exam_id: 'ANNUAL-2024', academic_year: '2024', start_date: '2024-12-01', start_time: '09:00 AM', center: 'Main Campus' },
  { id: 2, name: 'Half Yearly Exam 2024', exam_id: 'HY-2024', academic_year: '2024', start_date: '2024-06-15', start_time: '09:00 AM', center: 'Main Campus' },
  { id: 3, name: 'Test Exam 2024', exam_id: 'TEST-2024', academic_year: '2024', start_date: '2024-03-01', start_time: '09:00 AM', center: 'Main Campus' },
];

export default function AdmissionCardGenerator() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [openPreview, setOpenPreview] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Load school data
  useEffect(() => {
    if (!id) return;
    
    const loadSchool = async () => {
      try {
        const res = await api.get(`/api/schools/${id}/`);
        setSchool(res.data);
      } catch (err) {
        console.error('Failed to load school data:', err);
        showSnackbar('Failed to load school data', 'error');
      }
    };

    const loadClassrooms = async () => {
      try {
        const res = await api.get(`/api/academics/classrooms/?school=${id}`);
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setClassrooms(data);
      } catch (err) {
        console.error('Failed to load classrooms:', err);
        showSnackbar('Failed to load classrooms', 'error');
      }
    };

    loadSchool();
    loadClassrooms();
  }, [id]);

  // Load sections when class is selected
  const loadSections = async (classroomId) => {
    if (!classroomId) {
      setSections([]);
      return;
    }
    
    try {
      const res = await api.get(`/api/academics/sections/?classroom=${classroomId}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setSections(data);
    } catch (err) {
      console.error('Failed to load sections:', err);
      showSnackbar('Failed to load sections', 'error');
    }
  };

  const searchStudents = async () => {
    if (!selectedExam) {
      showSnackbar('Please select an exam first', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      let url = `/api/academics/students/?school=${id}`;
      
      if (searchQuery) {
        if (/^\d+$/.test(searchQuery)) {
          url += `&roll_number=${searchQuery}`;
        } else {
          url += `&search=${searchQuery}`;
        }
      } else if (classFilter) {
        url += `&classroom=${classFilter}`;
        if (sectionFilter) url += `&section=${sectionFilter}`;
      } else {
        showSnackbar('Please enter search criteria or select class', 'warning');
        setLoading(false);
        return;
      }

      const res = await api.get(url);
      let data = Array.isArray(res.data) ? res.data : res.data.results || [];
      
      // Map student data to ensure photo URL is in the correct format
      data = data.map(student => ({
        ...student,
        user: {
          ...student.user,
          photo_url: student.photo || student.user?.photo || student.user?.photo_url,
          first_name: student.user?.first_name || student.name?.split(' ')[0] || '',
          last_name: student.user?.last_name || student.name?.split(' ').slice(1).join(' ') || ''
        }
      }));
      
      if (data.length === 0) {
        showSnackbar('No students found with the specified criteria', 'warning');
      } else {
        // Sort by roll number if available
        const sortedData = [...data].sort((a, b) => {
          if (a.roll_number && b.roll_number) {
            return parseInt(a.roll_number) - parseInt(b.roll_number);
          }
          return 0;
        });
        
        setStudents(sortedData);
        showSnackbar(`Found ${sortedData.length} student(s)`, 'success');
      }
    } catch (err) {
      console.error('Error searching students:', err);
      showSnackbar('Failed to search students', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async (student = null) => {
    // If printing all students, ensure we respect the current class filter
    if (!student && classFilter) {
      // Check if current students match the filter, if not, search again
      const hasMismatchedStudents = students.some(s => 
        (s.classroom?.id != classFilter) && (s.classroom_id != classFilter)
      );
      if (hasMismatchedStudents || students.length === 0) {
        // Automatically search with current filter
        await searchStudents();
      }
    }
    
    const studentsToPrint = student ? [student] : students;
    
    if (studentsToPrint.length === 0) {
      showSnackbar('No students to print', 'warning');
      return;
    }

    setLoading(true);
    
    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      
      if (!printWindow) {
        showSnackbar('Please allow popups for this website', 'error');
        return;
      }

      // Generate HTML content for 4-card layout optimized for A4
      let htmlContent = `
        <html>
          <head>
            <title>Admission Cards</title>
            <style>
              @page {
                size: A4;
                margin: 8mm; /* Smaller margins for more space */
              }
              body { 
                margin: 0; 
                padding: 0; 
                font-family: Arial, sans-serif;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .print-page {
                width: 210mm; /* A4 width */
                height: 297mm; /* A4 height */
                box-sizing: border-box;
                padding: 5mm;
                page-break-after: always;
                page-break-inside: avoid;
              }
              .print-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: 1fr 1fr;
                gap: 4mm; /* Consistent gap between cards */
                width: 100%;
                height: 100%;
                box-sizing: border-box;
              }
              .card-slot {
                border: 1px solid #333;
                padding: 2mm;
                background: white;
                box-sizing: border-box;
                width: 100%;
                height: 100%;
                overflow: hidden;
                page-break-inside: avoid;
                break-inside: avoid;
                position: relative;
              }
              .card-content {
                transform: scale(0.85); /* Optimized scale for A4 */
                transform-origin: top left;
                width: 120%;
                height: 120%;
                overflow: hidden;
                position: absolute;
                top: 0;
                left: 0;
              }
              @media print {
                body { margin: 0; padding: 0; }
                .no-print { display: none !important; }
                .print-page {
                  page-break-after: always;
                  margin: 0;
                  padding: 5mm;
                }
                .card-slot {
                  page-break-inside: avoid;
                  break-inside: avoid;
                  border: 1px solid #333;
                }
              }
            </style>
          </head>
          <body>
        `;

      // Add up to 4 admission cards per page
      const cardsPerPage = 4;
      const totalPages = Math.ceil(studentsToPrint.length / cardsPerPage);
      
      for (let page = 0; page < totalPages; page++) {
        const startIndex = page * cardsPerPage;
        const endIndex = Math.min(startIndex + cardsPerPage, studentsToPrint.length);
        
        htmlContent += `
          <div class="print-page">
            <div class="print-container">
        `;
        
        for (let i = startIndex; i < endIndex; i++) {
          const student = studentsToPrint[i];
          const element = document.getElementById(`admission-card-${student.id}`);
          
          if (element) {
            htmlContent += `
              <div class="card-slot">
                <div class="card-content">
                  ${element.innerHTML}
                </div>
              </div>
            `;
          } else {
            // Fallback if element not found - create a placeholder
            htmlContent += `
              <div class="card-slot">
                <div class="card-content">
                  <div style="padding: 20px; text-align: center;">
                    <h3>Admission Card</h3>
                    <p>${student.user?.first_name || ''} ${student.user?.last_name || ''}</p>
                    <p>Roll: ${student.roll_number || 'N/A'}</p>
                    <p>Class: ${student.classroom?.name || 'N/A'}</p>
                  </div>
                </div>
              </div>
            `;
          }
        }
        
        htmlContent += `
            </div>
          </div>
        `;
      }

      htmlContent += `
          </body>
        </html>
      `;

      // Write content to the print window
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 1500); // Increased timeout for better loading
      };

    } catch (err) {
      console.error('Print error:', err);
      showSnackbar('Failed to print. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async (student = null) => {
    const studentsToExport = student ? [student] : students;
    
    if (studentsToExport.length === 0) {
      showSnackbar('No students to export', 'warning');
      return;
    }

    setLoading(true);
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < studentsToExport.length; i++) {
        const student = studentsToExport[i];
        const element = document.getElementById(`admission-card-${student.id}`);
        
        if (element) {
          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
          });
          
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 210; // A4 width in mm
          const pageHeight = 297; // A4 height in mm
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          let heightLeft = imgHeight;
          let position = 0;
          
          if (i > 0) {
            pdf.addPage();
          }
          
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
          
          while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }
        }
      }

      pdf.save('admission-cards.pdf');
      showSnackbar('PDF downloaded successfully!', 'success');

    } catch (err) {
      console.error('PDF generation error:', err);
      showSnackbar('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (student) => {
    setSelectedStudent(student);
    setOpenPreview(true);
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const selectedExamData = sampleExams.find(exam => exam.id.toString() === selectedExam) || {};

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3, 
          p: 3, 
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white',
          borderRadius: 3
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              Exam Admission Card Generator
            </Typography>
            <Typography variant="body1">
              Generate and print admission cards for students
            </Typography>
            {school && (
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                School: {school.name}
              </Typography>
            )}
          </Box>
          
          {students.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={() => handlePrint()}
                disabled={loading}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  backdropFilter: 'blur(10px)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}
              >
                {loading ? 'Preparing...' : 'Print All'}
              </Button>
              <Button
                variant="contained"
                startIcon={<PictureAsPdfIcon />}
                onClick={() => handleExportPDF()}
                disabled={loading}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  backdropFilter: 'blur(10px)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}
              >
                {loading ? 'Generating...' : 'Export as PDF'}
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Search Form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          Search Criteria
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label="Select Exam"
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              variant="outlined"
              size="small"
              required
            >
              <MenuItem value="">Select an exam</MenuItem>
              {sampleExams.map((exam) => (
                <MenuItem key={exam.id} value={exam.id}>
                  {exam.name} ({exam.academic_year})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Search by Name or Roll Number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="outlined"
              size="small"
              placeholder="Enter student name or roll number"
              onKeyPress={(e) => e.key === 'Enter' && searchStudents()}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Select Class"
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                loadSections(e.target.value);
                setSectionFilter('');
                setSearchQuery('');
              }}
              variant="outlined"
              size="small"
            >
              <MenuItem value="">All Classes</MenuItem>
              {classrooms.map((cls) => (
                <MenuItem key={cls.id} value={cls.id}>
                  {cls.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Select Section"
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value);
                setSearchQuery('');
              }}
              variant="outlined"
              size="small"
              disabled={!classFilter}
            >
              <MenuItem value="">All Sections</MenuItem>
              {sections.map((sec) => (
                <MenuItem key={sec.id} value={sec.id}>
                  {sec.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          
          <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={searchStudents}
              disabled={loading || (!searchQuery && !classFilter)}
              fullWidth
              sx={{ height: '40px' }}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
            >
              {loading ? 'Searching...' : 'Search Students'}
            </Button>
          </Grid>
        </Grid>
        
        {selectedExam && (
          <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Selected Exam: {selectedExamData.name}
            </Typography>
            <Typography variant="body2">
              Date: {selectedExamData.start_date ? new Date(selectedExamData.start_date).toLocaleDateString() : 'TBA'}
              {' | '}
              Time: {selectedExamData.start_time || 'TBA'}
              {' | '}
              Center: {selectedExamData.center || 'TBA'}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Results */}
      {students.length > 0 ? (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Found {students.length} Student(s)
            </Typography>
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<PrintIcon />}
              onClick={() => handlePrint()}
              disabled={loading}
            >
              Print All
            </Button>
          </Box>
          
          <Grid container spacing={3}>
            {students.map((student) => (
              <Grid item xs={12} sm={6} md={4} key={student.id}>
                <Box position="relative">
                  <Box id={`admission-card-${student.id}`}>
                    <AdmissionCard 
                      data={student} 
                      school={school} 
                      exam={selectedExamData}
                    />
                  </Box>
                  <Box 
                    sx={{ 
                      position: 'absolute', 
                      top: 10, 
                      right: 10,
                      display: 'flex',
                      gap: 1,
                      '& .MuiIconButton-root': {
                        bgcolor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'rgba(0,0,0,0.8)'
                        }
                      }
                    }}
                  >
                    <Tooltip title="Preview">
                      <IconButton size="small" onClick={() => handlePreview(student)}>
                        <SearchIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Print">
                      <IconButton size="small" onClick={() => handlePrint(student)}>
                        <PrintIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No students found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Use the search form above to find students and generate admission cards.
          </Typography>
        </Paper>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={openPreview}
        onClose={() => setOpenPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <span>Admission Card Preview</span>
            <IconButton onClick={() => setOpenPreview(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedStudent && (
            <Box display="flex" justifyContent="center" p={2}>
              <Box maxWidth="400px" width="100%">
                <AdmissionCard 
                  data={selectedStudent} 
                  school={school} 
                  exam={selectedExamData}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
          <Button 
            onClick={() => setOpenPreview(false)}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            Close
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<PrintIcon />}
            onClick={() => {
              handlePrint(selectedStudent);
              setOpenPreview(false);
            }}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
