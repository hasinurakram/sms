import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  Container,
  Grid,
  Divider,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import { Print as PrintIcon } from '@mui/icons-material';
import { fetchSchoolById } from '../services/api';
import api from '../utils/api';
import './ReceiptBook.css';

const ReceiptBook = () => {
  const { id } = useParams();
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    const fetchSchoolData = async () => {
      try {
        const schoolData = await fetchSchoolById(id);
        setSchool(schoolData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchSchoolData();
    }
  }, [id]);

  const feeItems = [
    { name: 'রেজিস্ট্রেশন ফি', amount: '' },
    { name: 'সেশন ফি', amount: '' },
    { name: 'ষান্মাসিক/বাৎসরিক মূল্যায়ন ফি', amount: '' },
    { name: 'বোর্ড ফি', amount: '' },
    { name: 'পরীক্ষার কেন্দ্র ফি', amount: '' },
    { name: 'আইসিটি ফি', amount: '' },
    { name: 'ক্রীড়া ফি', amount: '' },
    { name: 'উন্নয়ন ফি', amount: '' },
    { name: 'বিদ্যুৎ/কল্যাণ ফি', amount: '' },
    { name: 'টিসি/প্রশংসা পত্র ফি', amount: '' },
    { name: 'কম্পিউটার ল্যাব ফি', amount: '' },
    { name: 'স্কাউটস ফি', amount: '' },
    { name: 'ভর্তি ফি', amount: '' },
    { name: 'মাসিক বেতন', amount: '' },
    { name: 'পরীক্ষার ফি', amount: '' }
  ];

  const getLogoUrl = (logo) => {
    if (!logo) return '/public/school-logo.png';
    if (logo.startsWith('http')) return logo;
    const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
    return `${base}${logo.startsWith('/') ? logo : `/${logo}`}`;
  };

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
      if (hundred) parts.push(`${hundred === 1 ? 'একশত' : twoDigitWords(hundred) + ' শত'}`);
      if (rest) parts.push(twoDigitWords(rest));
      return parts.join(' ');
    } catch (_) {
      return '';
    }
  };

  const ReceiptTemplate = ({ copyType }) => (
    <Paper className="receipt-copy" elevation={0}>
      <Box className="receipt-header">
        <Box className="school-header">
          <Box className="school-logo">
            <img 
              src={getLogoUrl(school?.logo)} 
              alt="School Logo" 
              className="logo-image"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </Box>
          <Box className="school-details">
            <Typography variant="h6" className="school-name" sx={{ color: 'blue' }}>
              {school?.name || 'স্কুল নাম'}
            </Typography>
            <Typography variant="body2" className="school-address" sx={{ color: 'blue' }}>
              {school?.address || ''}
            </Typography>
            <Typography variant="body2" className="bank-info" sx={{ color: 'blue' }}>
              {school?.bank_info || ''}
            </Typography>
            <Typography variant="body2" className="bank-account" sx={{ color: 'blue' }}>
              {school?.bank_account || ''}
            </Typography>
            <Typography variant="body2" className="account-name" sx={{ color: 'blue' }}>
              {school?.name || ''}
            </Typography>
          </Box>
        </Box>
        <Typography variant="h6" className="receipt-title" sx={{ color: 'blue' }}>
          বেতন পরিশোধের রশিদ
        </Typography>
        <Typography variant="body2" className="copy-label">
          {copyType}
        </Typography>
      </Box>

      <Box className="receipt-info">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="body2" sx={{ color: 'blue' }}>
              <strong>রশিদ নং:</strong> _______________ <strong>তারিখ:</strong> _______________
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <Box className="student-info">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="body2" sx={{ color: '#334065' }}>
              <strong>শিক্ষার্থীর নাম:</strong> _______________ &nbsp;&nbsp; <strong>রোল:</strong> 
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ color: '#334065' }}>
              <strong>শ্রেণী:</strong> _______________
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ color: '#334065' }}>
              <strong>শাখা:</strong> _______________
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <table className="fee-table">
        <thead>
          <tr>
            <th>বিবরণ</th>
            <th>পরিমাণ</th>
          </tr>
        </thead>
        <tbody>
          {feeItems.map((item, index) => (
            <tr key={index}>
              <td>{item.name}</td>
              <td></td>
            </tr>
          ))}
          <tr className="total-row">
            <td><strong>মোট</strong></td>
            <td>
              <input
                className="amount-input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="টাকার পরিমাণ"
              />
              {amount ? (
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center' }}>
                  ৳{toBnDigits(parseInt(amount, 10) || 0)}
                </Typography>
              ) : null}
            </td>
          </tr>
          <tr>
            <td><strong>অবশিষ্ট বকেয়া</strong></td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <Typography variant="body1" className="amount-in-words" align="center" sx={{ color: '#334065' }}>
        কথায়: {amount ? numberToBanglaWords(parseInt(amount, 10) || 0) : '__________'} টাকা মাত্র
      </Typography>

      <Box className="signatures">
        <Typography variant="body2" className="signature-label" align="center" sx={{ color: '#334065' }}>
          গ্রহণকারীর স্বাক্ষর
        </Typography>
      </Box>
    </Paper>
  );

  if (loading) {
    return (
      <Container maxWidth="lg" className="receipt-book-container">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" className="receipt-book-container">
        <Alert severity="error" sx={{ mb: 2 }}>
          স্কুলের তথ্য লোড করতে সমস্যা হয়েছে: {error}
        </Alert>
        <Box className="receipt-copies">
          <Box className="receipt-copy">
            <ReceiptTemplate copyType="বিদ্যালয় কপি" />
          </Box>
          <Box className="receipt-copy">
            <ReceiptTemplate copyType="শিক্ষার্থী কপি" />
          </Box>
          <Box className="receipt-copy">
            <ReceiptTemplate copyType="ব্যাংক কপি" />
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" className="receipt-book-container">
      <Box className="receipt-book-header">
        <Typography variant="h4" component="h1" gutterBottom>
          রিসিট বই
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          ব্যাংক জমা, অভিভাবকের কপি এবং স্কুলের কপির জন্য ব্লাংক রশিদ
        </Typography>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
          className="print-button"
        >
          প্রিন্ট করুন
        </Button>
      </Box>

      <Box className="receipt-copies">
        <Box className="receipt-copy">
          <ReceiptTemplate copyType="বিদ্যালয় কপি" />
        </Box>
        <Box className="receipt-copy">
          <ReceiptTemplate copyType="শিক্ষার্থী কপি" />
        </Box>
        <Box className="receipt-copy">
          <ReceiptTemplate copyType="ব্যাংক কপি" />
        </Box>
      </Box>
    </Container>
  );
};

export default ReceiptBook;
