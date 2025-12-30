import React, { useState, useEffect, useContext } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Checkbox,
  IconButton
} from '@mui/material';
import { Receipt, Print, Download, Person, School, CalendarToday, Payment } from '@mui/icons-material';
import html2canvas from 'html2canvas';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useSchool } from '../context/SchoolContext';

const FeePaymentReceipt = () => {
  const { schoolId } = useSchool();
  console.log('FeePaymentReceipt component mounted with schoolId:', schoolId);
  
  // Helper function to resolve student photo URL
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
      if (typeof v === 'string' && v.startsWith('http')) return v;
      const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/,'');
      if (typeof v === 'string' && v.startsWith('/')) return `${base}${v}`;
      if (typeof v === 'string') return `${base}/media/${v.replace(/\\/g, '/')}`;
    }
    return null;
  };
  
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [outstandingFees, setOutstandingFees] = useState([]);
  const [selectedFees, setSelectedFees] = useState({});
  const [feeSummaryData, setFeeSummaryData] = useState(null);
  const [paymentData, setPaymentData] = useState({
    date: dayjs(),
    method: 'cash',
    reference: '',
    note: ''
  });
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [generatedReceipt, setGeneratedReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [schoolData, setSchoolData] = useState(null);
  const [classFeeMatrix, setClassFeeMatrix] = useState([]);

  useEffect(() => {
    if (schoolId) {
      fetchStudents();
      fetchSchoolData();
      fetchClasses();
    }
  }, [schoolId]);

  useEffect(() => {
    if (selectedClass) {
      fetchSections();
    } else {
      setSections([]);
      setSelectedSection('');
    }
  }, [selectedClass]);

  useEffect(() => {
    fetchStudents();
  }, [selectedClass, selectedSection]);

  useEffect(() => {
    if (!selectedStudent) return;
    const valid = students.some(s => String(s.id) === String(selectedStudent));
    if (!valid) return;
    fetchOutstandingFees();
  }, [selectedStudent, students]);

  useEffect(() => {}, [students]);

  const handleClassChange = (classId) => {
    setSelectedClass(classId);
    setSelectedSection('');
    setSelectedStudent('');
  };

  const handleSectionChange = (sectionId) => {
    setSelectedSection(sectionId);
    setSelectedStudent('');
  };

  const fetchStudents = async () => {
    try {
      let url = `/api/academics/students/?school=${schoolId}`;
      if (selectedClass) {
        url += `&classroom=${selectedClass}`;
      }
      if (selectedSection) {
        url += `&section=${selectedSection}`;
      }
      console.log('Fetching students with URL:', url);
      const response = await api.get(url);
      console.log('Students response:', response.data);
      setStudents(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      console.log('Fetching classes for school:', schoolId);
      const response = await api.get(`/api/academics/classrooms/?school=${schoolId}`);
      console.log('Classes response:', response.data);
      setClasses(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  useEffect(() => {
    const buildClassFeeMatrix = () => {
      if (!classes || classes.length === 0) { setClassFeeMatrix([]); return; }
      const mapping = [
        { key: 'ষষ্ঠ', session: 1200, monthly: 150, assessment: 360 },
        { key: 'সপ্তম', session: 1200, monthly: 180, assessment: 380 },
        { key: 'অষ্টম', session: 1200, monthly: 200, assessment: 400 },
        { key: 'নবম', session: 1300, monthly: 250, assessment: 500 },
        { key: 'দশম', session: 0, monthly: 250, assessment: 500 }
      ];
      const rows = classes.map((cls) => {
        const name = cls.name || cls.title || `Class ${cls.id}`;
        const match = mapping.find(m => String(name).includes(m.key));
        const session = match?.session ?? 0;
        const monthly = match?.monthly ?? 0;
        const assessment = match?.assessment ?? 0;
        return { classId: cls.id, className: name, session, monthly, assessment };
      });
      setClassFeeMatrix(rows);
    };
    buildClassFeeMatrix();
  }, [classes]);

  const fetchSections = async () => {
    try {
      console.log('Fetching sections for school:', schoolId, 'class:', selectedClass);
      const response = await api.get(`/api/academics/sections/?school=${schoolId}&classroom=${selectedClass}`);
      console.log('Sections response:', response.data);
      setSections(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  };

  const fetchSchoolData = async () => {
    try {
      const response = await api.get(`/api/schools/${schoolId}/`);
      setSchoolData(response.data);
    } catch (error) {
      console.error('Error fetching school data:', error);
    }
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      'cash': 'নগদ',
      'bank_transfer': 'ব্যাংক ট্রান্সফার',
      'bkash': 'বিকাশ',
      'nagad': 'নগদ',
      'rocket': 'রকেট',
      'cheque': 'চেক'
    };
    return methods[method] || method;
  };

  const fetchOutstandingFees = async () => {
    setLoading(true);
    try {
      // Fetch fee assignments
      const response = await api.get(`/api/fees/assignments/?student_id=${selectedStudent}&school=${schoolId}`);
      const assignments = response.data.results || response.data || [];
      
      // Fetch comprehensive fee summary data
      let feeSummary = null;
      try {
        const summaryResponse = await api.get(`/api/fees/student-summary/?student_id=${selectedStudent}&school=${schoolId}`);
        feeSummary = summaryResponse.data;
        console.log('Fee summary:', feeSummary);
      } catch (summaryError) {
        console.log('Fee summary not available, using assignments only');
      }
      
      const feesWithDetails = await Promise.all(
        assignments.map(async (assignment) => {
          try {
            const paymentsResponse = await api.get(`/api/fees/payments/?student_id=${selectedStudent}&assignment_id=${assignment.id}`);
            const payments = paymentsResponse.data.results || paymentsResponse.data || [];
            
            const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
            const due = parseFloat(assignment.payable_amount || assignment.amount || 0) - totalPaid;
            
            return {
              ...assignment,
              totalPaid,
              due,
              feeType: assignment.fee_structure?.fee_type || 'general',
              month: assignment.fee_structure?.frequency === 'monthly' ? assignment.month || '' : '',
              examName: assignment.fee_structure?.fee_type === 'exam' ? assignment.exam_name || '' : ''
            };
          } catch (error) {
            return {
              ...assignment,
              totalPaid: 0,
              due: parseFloat(assignment.payable_amount || assignment.amount || 0),
              feeType: 'general'
            };
          }
        })
      );
      
      // Store fee summary data for use in receipt
      if (feeSummary) {
        setFeeSummaryData(feeSummary);
      }
      
      setOutstandingFees(feesWithDetails.filter(fee => fee.due > 0));
    } catch (error) {
      console.error('Error fetching outstanding fees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeeSelection = (feeId, checked) => {
    setSelectedFees(prev => ({
      ...prev,
      [feeId]: checked ? (outstandingFees.find(f => f.id === feeId)?.due || 0) : 0
    }));
  };

  const handleAmountChange = (feeId, amount) => {
    setSelectedFees(prev => ({
      ...prev,
      [feeId]: parseFloat(amount) || 0
    }));
  };

  const getTotalSelected = () => {
    return Object.values(selectedFees).reduce((sum, amount) => sum + amount, 0);
  };

  const generateReceipt = async () => {
    const total = getTotalSelected();
    try {
      // Auto-fetch monthly tuition and exam fees
      let autoFetchedFees = [];
      try {
        const allFeesResponse = await api.get(`/api/fees/assignments/?student_id=${selectedStudent}&school=${schoolId}`);
        const allAssignments = allFeesResponse.data.results || allFeesResponse.data || [];
        
        // Filter for monthly tuition and exam fees
        autoFetchedFees = allAssignments.filter(assignment => {
          const feeType = assignment.fee_structure?.fee_type || '';
          const frequency = assignment.fee_structure?.frequency || '';
          const name = (assignment.fee_structure?.name || '').toLowerCase();
          
          // Check for monthly tuition fees
          const isMonthlyTuition = frequency === 'monthly' || 
                                   name.includes('মাসিক') || 
                                   name.includes('বেতন') || 
                                   name.includes('tuition') || 
                                   name.includes('monthly');
          
          // Check for exam fees
          const isExamFee = feeType === 'exam' || 
                           name.includes('পরীক্ষা') || 
                           name.includes('exam') || 
                           name.includes('পরীক্ষার');
          
          return isMonthlyTuition || isExamFee;
        });
        
        // Get payment details for auto-fetched fees
        autoFetchedFees = await Promise.all(
          autoFetchedFees.map(async (assignment) => {
            try {
              const paymentsResponse = await api.get(`/api/fees/payments/?student_id=${selectedStudent}&assignment_id=${assignment.id}`);
              const payments = paymentsResponse.data.results || paymentsResponse.data || [];
              
              const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
              const due = parseFloat(assignment.payable_amount || assignment.amount || 0) - totalPaid;
              
              return {
                ...assignment,
                totalPaid,
                due,
                feeType: assignment.fee_structure?.fee_type || 'general',
                month: assignment.fee_structure?.frequency === 'monthly' ? assignment.month || '' : '',
                examName: assignment.fee_structure?.fee_type === 'exam' ? assignment.exam_name || '' : ''
              };
            } catch (error) {
              return {
                ...assignment,
                totalPaid: 0,
                due: parseFloat(assignment.payable_amount || assignment.amount || 0),
                feeType: 'general'
              };
            }
          })
        );
        
        console.log('Auto-fetched fees:', autoFetchedFees);
      } catch (error) {
        console.error('Error auto-fetching fees:', error);
      }
      
      const studentObj = students.find(s => s.id === parseInt(selectedStudent));
      const selectedList = outstandingFees.filter(fee => selectedFees[fee.id] > 0);

      // Build fee summary fallback when server summary not available
      let baseFeesForSummary = (Array.isArray(autoFetchedFees) && autoFetchedFees.length > 0) ? autoFetchedFees : outstandingFees;
      if (!baseFeesForSummary || baseFeesForSummary.length === 0) {
        const endpoints = [
          `/api/fees/fee-structures/?classroom_id=${selectedClass}`,
          `/api/fees/fee-structures/?class_id=${selectedClass}`,
          `/api/fees/structures/?classroom=${selectedClass}`,
          `/api/fees/structures/?classroom_id=${selectedClass}`,
          `/api/fees/structures/?class_id=${selectedClass}`
        ];
        let structs = [];
        for (const ep of endpoints) {
          try {
            const r = await api.get(ep);
            const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
            if (arr && arr.length) { structs = arr; break; }
          } catch (_) { /* try next */ }
        }
        baseFeesForSummary = (structs || []).map(s => ({
          id: s.id || s._id || Math.random().toString(36).slice(2),
          name: s.name || s.title || s.label || '',
          fee_structure: s,
          due: Math.max(0, parseFloat(s.amount ?? s.default_amount ?? 0)),
          month: (s.frequency || '').toLowerCase() === 'monthly' ? (s.month || null) : null,
          examName: (s.frequency || '').toLowerCase() === 'one_time' ? (s.exam || s.exam_type || null) : null
        }));
      }

      const nameOf = (f) => String(f.fee_structure?.name || f.name || '').toLowerCase();
      const isMonthlyF = (f) => {
        const n = nameOf(f);
        return n.includes('মাসিক') || n.includes('বেতন') || n.includes('tuition') || n.includes('monthly') || !!f.month;
      };
      const isGenericExamF = (f) => {
        const n = nameOf(f);
        return n.includes('পরীক্ষা') || n.includes('exam') || n.includes('পরীক্ষার') || !!f.examName || (f.fee_structure?.fee_type === 'exam');
      };
      const isSpecialF = (f) => {
        const n = nameOf(f);
        return n.includes('কেন্দ্র') || n.includes('center') || n.includes('exam center') || n.includes('বোর্ড') || n.includes('board') || n.includes('মূল্যায়ন') || n.includes('assessment') || n.includes('annual') || n.includes('রেজিস্ট্রেশন') || n.includes('registration') || n.includes('সেশন') || n.includes('session');
      };
      const isSessionF = (f) => {
        const n = nameOf(f);
        return n.includes('সেশন') || n.includes('session');
      };
      const isAssessmentF = (f) => {
        const n = nameOf(f);
        return n.includes('মূল্যায়ন') || n.includes('assessment') || n.includes('annual') || n.includes('বাৎসরিক') || n.includes('ষান্মাসিক');
      };
      // amount getter: if selected fees present, use selected amount; else use due
      const amountOf = (fee) => {
        if (selectedList.some(sf => sf.id === fee.id)) {
          return Math.max(0, parseFloat(selectedFees[fee.id] ?? 0));
        }
        return Math.max(0, parseFloat(fee.due ?? 0));
      };
      const sumBy = (arr, pred) => arr.reduce((sum, f) => pred(f) ? sum + amountOf(f) : sum, 0);

      let sourceFees = selectedList.length > 0 ? selectedList : baseFeesForSummary;

      sourceFees = sourceFees;

      const monthlyTuitionTotal = sumBy(sourceFees, isMonthlyF);
      const examFeesTotal = sumBy(sourceFees, (f) => isGenericExamF(f) && !isSpecialF(f));
      const sessionFeesTotal = sumBy(sourceFees, (f) => isSessionF(f));
      const assessmentFeesTotal = sumBy(sourceFees, (f) => isAssessmentF(f));
      const otherFeesTotal = sumBy(sourceFees, (f) => !isMonthlyF(f) && !(isGenericExamF(f) && !isSpecialF(f)) && !isSessionF(f) && !isAssessmentF(f));
      const grandTotal = sourceFees.reduce((sum, f) => sum + amountOf(f), 0);

      const computedSummary = feeSummaryData || { 
        monthly_tuition: monthlyTuitionTotal, 
        session_fee: sessionFeesTotal,
        assessment_fee: assessmentFeesTotal,
        exam_fees: examFeesTotal, 
        other_fees: otherFeesTotal,
        total: grandTotal
      };

      const receiptData = {
        student: studentObj,
        selectedFees: selectedList,
        autoFetchedFees: sourceFees,
        classFeeMatrix,
        feeSummary: computedSummary,
        paymentData: {
          ...paymentData,
          date: paymentData.date.format('YYYY-MM-DD'),
          totalAmount: total > 0 ? total : (computedSummary.total || 0)
        },
        receiptNumber: `RCP-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
      };
      
      setGeneratedReceipt(receiptData);
      setReceiptOpen(true);
    } catch (error) {
      console.error('Error generating receipt:', error);
      alert('রশিদ তৈরিতে সমস্যা হয়েছে');
    }
  };

  const printReceipt = async () => {
    const content = document.getElementById('receipt-content');
    if (!content) return;
    const prevWidth = content.style.width;
    const prevMaxWidth = content.style.maxWidth;
    content.style.width = '1800px';
    content.style.maxWidth = '1800px';
    const canvas = await html2canvas(content, {
      scale: Math.min(3, window.devicePixelRatio || 2),
      backgroundColor: '#ffffff',
      useCORS: true,
      foreignObjectRendering: false
    });
    content.style.width = prevWidth;
    content.style.maxWidth = prevMaxWidth;
    const img = canvas.toDataURL('image/jpeg', 0.95);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>পেমেন্ট রশিদ</title>
          <style>
           @page { size: A4 landscape; margin: 0; }
           html, body { height: 100%; }
           body { margin: 0; background: #ffffff; }
            .sheet { width: 297mm; height: 210mm; display: flex; align-items: center; justify-content: center; padding: 0; box-sizing: border-box; overflow: hidden; }
            img { width: 100%; height: 100%; object-fit: contain; display: block; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <img src="${img}" />
          </div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 250);
  };

  const ReceiptContent = ({ data }) => {
    const [methodChecks, setMethodChecks] = useState({ cash: false, bkash: false, bank: false });
    const toggleMethod = (key) => setMethodChecks(prev => ({ ...prev, [key]: !prev[key] }));
    const [manualAmounts, setManualAmounts] = useState({});
    const [fineAmount, setFineAmount] = useState(0);
    const toBnDigits = (val) => {
      const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
      return String(val).replace(/\d/g, d => bn[d] ?? d);
    };
    const BN_0_99 = [
      'শূন্য','এক','দুই','তিন','চার','পাঁচ','ছয়','সাত','আট','নয়','দশ','এগারো','বারো','তেরো','চৌদ্দ','পনেরো','ষোল','সতেরো','আঠারো','ঊনিশ','বিশ','একুশ','বাইশ','তেইশ','চব্বিশ','পঁচিশ','ছাব্বিশ','সাতাশ','আটাশ','ঊনত্রিশ','ত্রিশ','একত্রিশ','বত্রিশ','তেত্রিশ','চৌত্রিশ','পঁয়ত্রিশ','ছত্রিশ','সাইত্রিশ','আটত্রিশ','ঊনচল্লিশ','চল্লিশ','একচল্লিশ','বিয়াল্লিশ','তেতাল্লিশ','চুয়াল্লিশ','পঁয়তাল্লিশ','ছেচল্লিশ','সাতচল্লিশ','আটচল্লিশ','ঊনপঞ্চাশ','পঞ্চাশ','একান্ন','বাহান্ন','তিপ্পান্ন','চুয়ান্ন','পঞ্চান্ন','ষাট','একষট্টি','বাষট্টি','তেষট্টি','চৌষট্টি','পঁয়ষট্টি','ছেষট্টি','সাতষট্টি','আটষট্টি','ঊনসত্তর','সত্তর','একাত্তর','বাহাত্তর','তিয়াত্তর','চুয়াত্তর','পঁচাত্তর','ছিয়াত্তর','সাতাত্তর','আটাত্তর','ঊনআশি','আশি','একাশি','বিরাশি','তিরাশি','চুরাশি','পঁচাশি','ছিয়াশি','সাতাশি','আটাশি','ঊননব্বই','নব্বই','একানব্বই','বিরানব্বই','তিরানব্বই','চুরানব্বই','পঁচানব্বই','ছিয়ানব্বই','সাতানব্বই','আটানব্বই','নিরানব্বই'
    ];
    const twoDigitWords = (n) => {
      if (n === 0) return '';
      if (n < 100) return BN_0_99[n];
      return '';
    };
    const numberToBanglaWords = (num) => {
      try {
        const n = Math.max(0, parseInt(num, 10) || 0);
        if (n === 0) return 'শূন্য';
        const parts = [];
        const crore = Math.floor(n / 10000000);
        const lakh = Math.floor((n % 10000000) / 100000);
        const thousand = Math.floor((n % 100000) / 1000);
        const hundred = Math.floor((n % 1000) / 100);
        const rest = n % 100;
        if (crore) parts.push(`${twoDigitWords(crore)} কোটি`);
        if (lakh) parts.push(`${twoDigitWords(lakh)} লক্ষ`);
        if (thousand) parts.push(`${twoDigitWords(thousand)} হাজার`);
        if (hundred) parts.push(`${hundred === 1 ? 'একশো' : twoDigitWords(hundred) + ' শত'}`);
        if (rest) parts.push(twoDigitWords(rest));
        return parts.join(' ');
      } catch (_) {
        return '';
      }
    };
    const renderCopy = (copyLabel) => (
      <Box sx={{ 
        p: 2, 
        bgcolor: 'white', 
        color: 'black',
        fontFamily: 'monospace',
        width: '100%',
        maxWidth: 'none',
        mx: 0
      }}>
        <Box sx={{ textAlign: 'center', mb: 2, pb: 1, borderBottom: '2px solid #000' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {schoolData?.logo && (
                <img src={schoolData.logo} alt={schoolData.name} style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
              )}
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
              {schoolData?.name || 'স্কুল নাম'}
            </Typography>
            <Box sx={{ width: 80, height: 80, border: '1px solid #000', borderRadius: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(data.student?.user?.photo_url || data.student?.photo || data.student?.user?.photo) ? (
                <img src={data.student?.user?.photo_url || data.student?.photo || data.student?.user?.photo} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : null}
            </Box>
          </Box>
          {schoolData?.bank_info && (
            <Typography variant="body2" sx={{ fontSize: '0.9rem', mt: 1 }}>
              {schoolData.bank_info}
            </Typography>
          )}
        </Box>

        <Box sx={{ textAlign: 'center', mb: 2, py: 1, bgcolor: '#f5f5f5', border: '1px solid #000' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
            বেতন পরিশোধের রশিদ
          </Typography>
          <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#666' }}>
            {copyLabel}
          </Typography>
        </Box>

        <Grid container spacing={1} sx={{ mb: 2, fontSize: '0.9rem' }}>
          <Grid item xs={6}>
            <Typography variant="body2"><strong>রশিদ নং:</strong> {data.receiptNumber}</Typography>
            <Typography variant="body2"><strong>তারিখ:</strong> {data.paymentData.date}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2"><strong>শিক্ষার্থীর নাম:</strong> {data.student?.user?.first_name} {data.student?.user?.last_name}</Typography>
            <Typography variant="body2"><strong>শ্রেণী:</strong> {data.student?.classroom?.name || '-'}</Typography>
            <Typography variant="body2"><strong>শাখা:</strong> {data.student?.section?.name || '-'}</Typography>
            <Typography variant="body2"><strong>রোল:</strong> {data.student?.roll_number || '-'}</Typography>
          </Grid>
        </Grid>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>ফি-এর বিবরণঃ</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">গ্রহণ পদ্ধতি:</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Checkbox checked={methodChecks.cash} onChange={() => toggleMethod('cash')} />
                <Typography variant="body2">ক্যাশ</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Checkbox checked={methodChecks.bkash} onChange={() => toggleMethod('bkash')} />
                <Typography variant="body2">বিকাশ</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Checkbox checked={methodChecks.bank} onChange={() => toggleMethod('bank')} />
                <Typography variant="body2">ব্যাংক</Typography>
              </Box>
            </Box>
          </Box>
          {(() => {
          // Combine selected fees with auto-fetched fees
          const allFees = [...(data.selectedFees || []), ...(data.autoFetchedFees || [])];
          
          const clsId = data.student?.classroom?.id;
          const clsName = data.student?.classroom?.name || '';
          const row = (data.classFeeMatrix || []).find(r => r.classId === clsId) || (data.classFeeMatrix || []).find(r => clsName.includes(r.className));
          const monthlyTuitionTotal = Number(row?.monthly || 0);
          const sessionFeeTotal = Number(row?.session || 0);
          const assessmentFeeTotal = Number(row?.assessment || 0);
          const registrationFeeTotal = data.feeSummary?.registration_fee || 350;
          const boardFeeTotal = data.feeSummary?.board_fee || 0;
          const examCenterFeeTotal = data.feeSummary?.exam_center_fee || 0;
          const ictFeeTotal = data.feeSummary?.ict_fee || 200;
          const sportsFeeTotal = data.feeSummary?.sports_fee || 75;
          const developmentFeeTotal = data.feeSummary?.development_fee || 300;
          const electricityWelfareFeeTotal = data.feeSummary?.electricity_welfare_fee || 30;
          const tcCertificateFeeTotal = data.feeSummary?.tc_certificate_fee || 300;
          const computerLabFeeTotal = data.feeSummary?.computer_lab_fee || 20;
          const scoutsFeeTotal = data.feeSummary?.scouts_fee || 20;
          const admissionFeeTotal = data.feeSummary?.admission_fee || 0;
          const examFeeTotal = data.feeSummary?.exam_fee || 0;
          
          const grandTotal = data.feeSummary?.total || (registrationFeeTotal + sessionFeeTotal + assessmentFeeTotal + boardFeeTotal + examCenterFeeTotal + ictFeeTotal + sportsFeeTotal + developmentFeeTotal + electricityWelfareFeeTotal + tcCertificateFeeTotal + computerLabFeeTotal + scoutsFeeTotal + admissionFeeTotal + monthlyTuitionTotal + examFeeTotal);
          
          // Calculate individual fee types for detailed breakdown
          const sumFor = (predicate) =>
            allFees.reduce((sum, fee) => {
              // For selected fees, use the selected amount
              if (data.selectedFees?.some(sf => sf.id === fee.id)) {
                const amt = Math.max(0, parseFloat(selectedFees[fee.id] ?? 0));
                return predicate(fee) ? sum + amt : sum;
              }
              // For auto-fetched fees, use the due amount
              const amt = Math.max(0, parseFloat(fee.due ?? 0));
              return predicate(fee) ? sum + amt : sum;
            }, 0);
          
          const isAdmission = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('ভর্তি') || name.includes('admission');
          };
          const isMonthly = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('মাসিক') || name.includes('বেতন') || name.includes('tuition') || name.includes('monthly') || !!fee.month;
          };
          const isExam = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            const isGenericExam = name.includes('পরীক্ষা') || name.includes('exam') || name.includes('পরীক্ষার') || !!fee.examName || (fee.fee_structure?.fee_type === 'exam');
            const isSpecial = name.includes('কেন্দ্র') || name.includes('center') || name.includes('exam center') || name.includes('বোর্ড') || name.includes('board') || name.includes('মূল্যায়ন') || name.includes('assessment') || name.includes('annual') || name.includes('রেজিস্ট্রেশন') || name.includes('registration') || name.includes('সেশন') || name.includes('session');
            return isGenericExam && !isSpecial;
          };
          
          // New fee type checkers
          const isRegistrationFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('রেজিস্ট্রেশন') || name.includes('registration');
          };
          const isSessionFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('সেশন') || name.includes('session');
          };
          const isAssessmentFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('ষান্মাসিক') || name.includes('বাৎসরিক') || name.includes('মূল্যায়ন') || name.includes('assessment') || name.includes('annual');
          };
          const isBoardFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('বোর্ড') || name.includes('board');
          };
          const isExamCenterFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('কেন্দ্র') || name.includes('center') || name.includes('exam center');
          };
          const isICTFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('আইসিটি') || name.includes('ict') || name.includes('কম্পিউটার');
          };
          const isSportsFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('ক্রীড়া') || name.includes('sports');
          };
          const isDevelopmentFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('উন্নয়ন') || name.includes('development');
          };
          const isElectricityFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('বিদ্যুৎ') || name.includes('কল্যাণ') || name.includes('electricity') || name.includes('welfare');
          };
          const isTCFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('টিসি') || name.includes('প্রশংসা') || name.includes('tc') || name.includes('certificate');
          };
          const isComputerLabFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('ল্যাব') || name.includes('lab') || name.includes('computer lab');
          };
          const isScoutsFee = (fee) => {
            const name = (fee.fee_structure?.name || fee.name || '').toLowerCase();
            return name.includes('স্কাউট') || name.includes('scout') || name.includes('scouts');
          };
          
          // Use hardcoded amounts
          const admissionAmount = admissionFeeTotal;
          const registrationFeeAmount = registrationFeeTotal;
          const sessionFeeAmount = sessionFeeTotal;
          const assessmentFeeAmount = assessmentFeeTotal;
          const boardFeeAmount = boardFeeTotal;
          const examCenterFeeAmount = examCenterFeeTotal;
          const ictFeeAmount = ictFeeTotal;
          const sportsFeeAmount = sportsFeeTotal;
          const developmentFeeAmount = developmentFeeTotal;
          const electricityFeeAmount = electricityWelfareFeeTotal;
          const tcFeeAmount = tcCertificateFeeTotal;
          const computerLabFeeAmount = computerLabFeeTotal;
          const scoutsFeeAmount = scoutsFeeTotal;
          const monthlyAmount = monthlyTuitionTotal;
          const examAmount = examFeeTotal;
          
          const knownSum = admissionAmount + registrationFeeAmount + sessionFeeAmount + assessmentFeeAmount + 
            boardFeeAmount + examCenterFeeAmount + ictFeeAmount + sportsFeeAmount + 
            developmentFeeAmount + electricityFeeAmount + tcFeeAmount + computerLabFeeAmount + 
            scoutsFeeAmount + monthlyAmount + examAmount;
          
          const total = knownSum;
          
          const asText = (num) => `৳${Math.max(0, num).toFixed(2)}`;
          
          return (
            <Table size="small" sx={{ border: '1px solid #000' }}>
              <TableHead>
              <TableRow>
                  <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold', bgcolor: '#e3f2fd' }}>বিবরণ</TableCell>
                  <TableCell align="right" sx={{ border: '1px solid #000', fontWeight: 'bold', bgcolor: '#e3f2fd' }}>পরিমাণ</TableCell>
              </TableRow>
            </TableHead>
              <TableBody>
                {[
                  { key: 'registration', label: 'রেজিস্ট্রেশন ফি', amount: registrationFeeAmount },
                  { key: 'session', label: 'সেশন ফি', amount: sessionFeeAmount },
                  { key: 'assessment', label: 'ষান্মাসিক/বাৎসরিক মূল্যায়ন ফি', amount: assessmentFeeAmount },
                  { key: 'board', label: 'বোর্ড ফি', amount: boardFeeAmount },
                  { key: 'exam_center', label: 'পরীক্ষার কেন্দ্র ফি', amount: examCenterFeeAmount },
                  { key: 'ict', label: 'আইসিটি ফি', amount: ictFeeAmount },
                  { key: 'sports', label: 'ক্রীড়া ফি', amount: sportsFeeAmount },
                  { key: 'development', label: 'উন্নয়ন ফি', amount: developmentFeeAmount },
                  { key: 'electricity', label: 'বিদ্যুৎ/কল্যাণ ফি', amount: electricityFeeAmount },
                  { key: 'tc', label: 'টিসি/প্রশংসা পত্র ফি', amount: tcFeeAmount },
                  { key: 'computer_lab', label: 'কম্পিউটার ল্যাব ফি', amount: computerLabFeeAmount },
                  { key: 'scouts', label: 'স্কাউটস ফি', amount: scoutsFeeAmount },
                  { key: 'admission', label: 'ভর্তি ফি', amount: admissionAmount },
                  { key: 'monthly', label: 'মাসিক বেতন', amount: monthlyAmount },
                  { key: 'exam', label: 'পরীক্ষার ফি', amount: examAmount }
                ].map((row) => (
                  <TableRow key={row.key}>
                    <TableCell sx={{ border: '1px solid #000' }}>{row.label}</TableCell>
                    <TableCell align="right" sx={{ border: '1px solid #000' }}>
                      <TextField
                        type="number"
                        size="small"
                        value={manualAmounts[row.key] ?? ''}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value || 0));
                          setManualAmounts(prev => ({ ...prev, [row.key]: val }));
                        }}
                        inputProps={{ min: 0, step: '0.01' }}
                        placeholder={String(row.amount ?? '')}
                        sx={{ width: 140, '& .MuiInputBase-input::placeholder': { color: '#9aa0a6' } }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ border: '1px solid #000' }}>জরিমানা</TableCell>
                  <TableCell align="right" sx={{ border: '1px solid #000' }}>
                    <TextField
                      type="number"
                      size="small"
                      value={fineAmount}
                      onChange={(e) => setFineAmount(Math.max(0, Number(e.target.value || 0)))}
                      inputProps={{ min: 0, step: '0.01' }}
                      placeholder="পরিমাণ"
                      sx={{ width: 140 }}
                    />
                  </TableCell>
                </TableRow>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>মোট</TableCell>
                  <TableCell align="right" sx={{ border: '1px solid #000', fontWeight: 'bold' }}>{'৳' + Math.max(0, ([
                      { key: 'registration', amount: registrationFeeAmount },
                      { key: 'session', amount: sessionFeeAmount },
                      { key: 'assessment', amount: assessmentFeeAmount },
                      { key: 'board', amount: boardFeeAmount },
                      { key: 'exam_center', amount: examCenterFeeAmount },
                      { key: 'ict', amount: ictFeeAmount },
                      { key: 'sports', amount: sportsFeeAmount },
                      { key: 'development', amount: developmentFeeTotal },
                      { key: 'electricity', amount: electricityFeeAmount },
                      { key: 'tc', amount: tcFeeAmount },
                      { key: 'computer_lab', amount: computerLabFeeAmount },
                      { key: 'scouts', amount: scoutsFeeAmount },
                      { key: 'admission', amount: admissionAmount },
                      { key: 'monthly', amount: monthlyAmount },
                      { key: 'exam', amount: examAmount }
                  ].reduce((acc, r) => acc + Number(manualAmounts[r.key] || 0), 0) + Number(fineAmount || 0))).toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          );
        })()}
      </Box>



      <Box sx={{ mb: 2, p: 1.5, textAlign: 'center', border: '1px dashed #000', bgcolor: '#fafafa' }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>কথায়</Typography>
        <Typography variant="body2">
          {(() => {
            const clsId = data.student?.classroom?.id;
            const clsName = data.student?.classroom?.name || '';
            const row = (data.classFeeMatrix || []).find(r => r.classId === clsId) || (data.classFeeMatrix || []).find(r => clsName.includes(r.className));
            const monthly = Number(row?.monthly || 0);
            const session = Number(row?.session || 0);
            const assessment = Number(row?.assessment || 0);
            const reg = Number(data.feeSummary?.registration_fee ?? 350);
            const ict = Number(data.feeSummary?.ict_fee ?? 200);
            const sports = Number(data.feeSummary?.sports_fee ?? 75);
            const dev = Number(data.feeSummary?.development_fee ?? 300);
            const elec = Number(data.feeSummary?.electricity_welfare_fee ?? 30);
            const tc = Number(data.feeSummary?.tc_certificate_fee ?? 300);
            const lab = Number(data.feeSummary?.computer_lab_fee ?? 20);
            const scouts = Number(data.feeSummary?.scouts_fee ?? 20);
            const board = Number(data.feeSummary?.board_fee ?? 0);
            const center = Number(data.feeSummary?.exam_center_fee ?? 0);
            const admission = Number(data.feeSummary?.admission_fee ?? 0);
            const exam = Number(data.feeSummary?.exam_fee ?? 0);
            const currentEnteredTotal = ([
              'registration','session','assessment','board','exam_center','ict','sports','development','electricity','tc','computer_lab','scouts','admission','monthly','exam'
            ].reduce((acc, k) => acc + Number(manualAmounts[k] || 0), 0) + Number(fineAmount || 0));
            return `${numberToBanglaWords(Math.floor(Math.max(0, currentEnteredTotal)))} টাকা মাত্র`;
          })()}
        </Typography>
      </Box>

      {/* Signature & Seal */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, pt: 2, borderTop: '1px solid #000' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ mb: 2, fontSize: '0.9rem' }}>
            গ্রহণকারীর স্বাক্ষর
          </Typography>
          <Box sx={{ 
            width: 80, 
            height: 80, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            mb: 1,
            mx: 'auto'
          }}>
            <img 
              src="/images/signatures/seal.png" 
              alt="School Seal"
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain'
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ fontSize: '0.8rem', color: '#666' }}>
            (অফিস সহকারী / হিসাব রক্ষক)
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ mb: 2, fontSize: '0.9rem' }}>
            স্বাক্ষর
          </Typography>
          <Box sx={{ 
            width: 100, 
            height: 100, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            mb: 1,
            position: 'relative'
          }}>
            <img 
              src="/images/signatures/seal.png" 
              alt="School Seal"
              style={{ 
                position: 'absolute',
                width: '80%', 
                height: '80%', 
                objectFit: 'contain',
                opacity: 0.3,
                zIndex: 1
              }}
            />
            <img 
              src="/images/signatures/signature.png" 
              alt="Head Master Signature"
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain',
                position: 'relative',
                zIndex: 2
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ fontSize: '0.8rem', color: '#666' }}>
            (হেড মাস্টার)
          </Typography>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ textAlign: 'center', mt: 3, pt: 2, borderTop: '1px solid #000' }}>
        <Typography variant="caption" sx={{ fontSize: '0.8rem', color: '#666', display: 'block' }}>
          আপনার সন্তানের স্কুলের বকেয়া ফি পরিশোধের জন্য আপনাকে ধন্যবাদ।
        </Typography>
      </Box>
      </Box>
    );

    return (
      <Box id="receipt-content" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        {['বিদ্যালয় কপি','শিক্ষার্থী কপি','ব্যাংক কপি'].map((lbl) => (
          <Box key={lbl} sx={{ flex: '1 1 33.333%', maxWidth: '33.333%', boxSizing: 'border-box' }}>
            {renderCopy(lbl)}
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3 }}>
        {!schoolId ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <School sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                স্কুল নির্বাচন করুন
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ফি রশিদ তৈরি করার জন্য অনুগ্রহ করে প্রথমে একটি স্কুল নির্বাচন করুন
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <>
            <Typography variant="h5" gutterBottom fontWeight="bold" display="flex" alignItems="center" gap={1}>
              <Receipt /> বকেয়া পরিশোধের রশিদ
            </Typography>

            {/* Debug Info - Remove in production */}
            {process.env.NODE_ENV === 'development' && (
              <Box sx={{ mb: 2, p: 1, bgcolor: '#f5f5f5', fontSize: '0.8rem' }}>
                <Typography variant="body2">
                  School ID: {schoolId} | Classes: {classes.length} | Sections: {sections.length} | Students: {students.length}
                </Typography>
                <Typography variant="body2">
                  Selected: Class={selectedClass}, Section={selectedSection}, Student={selectedStudent}
                </Typography>
              </Box>
            )}

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>শ্রেণী</InputLabel>
                  <Select
                    value={selectedClass}
                    onChange={(e) => handleClassChange(e.target.value)}
                    label="শ্রেণৄ"
                  >
                    {classes.length === 0 ? (
                      <MenuItem disabled>
                        {selectedClass ? 'কোন ক্লাস পাওয়া যায়নি' : 'প্রথমে স্কুল নির্বাচন করুন'}
                      </MenuItem>
                    ) : (
                      classes.map((cls) => (
                        <MenuItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>সেকশন</InputLabel>
                  <Select
                    value={selectedSection}
                    onChange={(e) => handleSectionChange(e.target.value)}
                    label="সেকশন"
                    disabled={!selectedClass}
                  >
                    {sections.length === 0 && selectedClass ? (
                      <MenuItem disabled>কোন সেকশন পাওয়া যায়নি</MenuItem>
                    ) : sections.map((section) => (
                      <MenuItem key={section.id} value={section.id}>
                        {section.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>শিক্ষার্থী নির্বাচন</InputLabel>
                  <Select
                    value={selectedStudent || ''}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    label="শিক্ষার্থী নির্বাচন"
                    disabled={!selectedClass}
                  >
                    {students.length === 0 && selectedClass ? (
                      <MenuItem disabled>কোন শিক্ষার্থী পাওয়া যায়নি</MenuItem>
                    ) : students.map((student) => (
                      <MenuItem key={student.id} value={student.id}>
                        {student.user?.first_name} {student.user?.last_name} ({student.roll_number})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={2}>
                <DatePicker
                  label="পেমেন্ট তারিখ"
                  value={paymentData.date}
                  onChange={(date) => setPaymentData(prev => ({ ...prev, date }))}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>পেমেন্ট পদ্ধতি</InputLabel>
                  <Select
                    value={paymentData.method}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, method: e.target.value }))}
                    label="পেমেন্ট পদ্ধতি"
                  >
                    <MenuItem value="cash">নগদ</MenuItem>
                    <MenuItem value="bank_transfer">ব্যাংক ট্রান্সফার</MenuItem>
                    <MenuItem value="bkash">বিকাশ</MenuItem>
                    <MenuItem value="nagad">নগদ</MenuItem>
                    <MenuItem value="rocket">রকেট</MenuItem>
                    <MenuItem value="cheque">চেক</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="রেফারেন্স (ট্রানজেকশন আইডি/চেক নম্বর)"
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, reference: e.target.value }))}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="প্রাপ্ত অর্থ (টাকা)"
                  value={paymentData.amount || ''}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, amount: Math.max(0, Number(e.target.value || 0)) }))}
                  size="small"
                  inputProps={{ min: 0, step: '0.01' }}
                />
              </Grid>
              
              <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                onClick={generateReceipt}
                disabled={!selectedStudent}
                fullWidth
                sx={{ height: '100%' }}
              >
                রশিদ তৈরি
              </Button>
              </Grid>
            </Grid>

            <Grid item xs={12} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="নোট"
                value={paymentData.note}
                onChange={(e) => setPaymentData(prev => ({ ...prev, note: e.target.value }))}
                size="small"
                multiline
                rows={2}
              />
            </Grid>
          </CardContent>
        </Card>

        {selectedStudent && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                বকেয়া ফিসমূহ
              </Typography>
              
              {loading ? (
                <Typography>লোডিং...</Typography>
              ) : outstandingFees.length === 0 ? (
                <Typography color="text.secondary">কোনো বকেয়া নেই</Typography>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white' }}>নির্বাচন</TableCell>
                        <TableCell sx={{ color: 'white' }}>ফি এর ধরণ</TableCell>
                        <TableCell sx={{ color: 'white' }}>মাস/পরীক্ষা</TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">মোট</TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">পরিশোধিত</TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">বকেয়া</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outstandingFees.map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedFees[fee.id] > 0}
                              onChange={(e) => handleFeeSelection(fee.id, e.target.checked)}
                            />
                          </TableCell>
                          <TableCell>{fee.fee_structure?.name || fee.name}</TableCell>
                          <TableCell>
                            {fee.month ? `${fee.month} মাস` : fee.examName || '-'}
                          </TableCell>
                          <TableCell align="right">
                            ৳{parseFloat(fee.payable_amount || fee.amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell align="right">
                            ৳{fee.totalPaid.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                            ৳{fee.due.toFixed(2)}
                          </TableCell>
                          
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: '#f5f5f5', fontWeight: 'bold' }}>
                        <TableCell colSpan={5} align="right">
                          সর্বমোট পরিশোধ:
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '1.2em', color: 'primary.main' }}>
                          ৳{getTotalSelected().toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={receiptOpen} onClose={() => setReceiptOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            পেমেন্ট রশিদ
            <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
              <IconButton onClick={printReceipt}>
                <Print />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {generatedReceipt && <ReceiptContent data={generatedReceipt} />}
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setReceiptOpen(false)}>
              বন্ধ করুন
            </Button>
            <Button onClick={printReceipt} variant="contained" startIcon={<Print />}>
              প্রিন্ট করুন
            </Button>
          </DialogActions>
        </Dialog>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default FeePaymentReceipt;
