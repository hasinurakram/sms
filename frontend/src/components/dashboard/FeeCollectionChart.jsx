import React from 'react';
import { useParams } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Paper,
  Stack,
  Chip,
  Divider
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

const FeeCollectionChart = ({ feeData, feeDuesSummary, feeDuesByClass }) => {
  const { id } = useParams();
  // Format data for display
  const formattedData = feeData?.map(item => ({
    date: new Date(item.date).toLocaleDateString('bn-BD', { month: 'short', day: 'numeric', year: 'numeric' }),
    amount: item.amount || 0
  })) || [];

  // Calculate total amount
  const totalAmount = formattedData.reduce((sum, item) => sum + item.amount, 0);

  const summary = feeDuesSummary || {};
  const byClass = Array.isArray(feeDuesByClass) ? feeDuesByClass : [];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Total Summary Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 2,
          background: 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)',
          color: 'white',
          borderRadius: 2,
          flexShrink: 0
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <AccountBalanceWalletIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem', mb: 0.5 }}>
              গত ৩০ দিনে মোট সংগ্রহ
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              ৳{totalAmount.toLocaleString('bn-BD')}
            </Typography>
          </Box>
          <TrendingUpIcon sx={{ fontSize: 40, opacity: 0.7 }} />
        </Stack>
      </Paper>
      {/* Fee Collection Table - moved up to appear before dues summary */}
      {formattedData.length > 0 ? (
        <TableContainer 
          component={Paper} 
          elevation={0}
          sx={{ 
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: 2,
            mb: 2,
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
              borderRadius: '10px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888',
              borderRadius: '10px',
              '&:hover': {
                background: '#555',
              },
            },
          }}
        >
          <Table stickyHeader size="small" sx={{ minWidth: 520 }}>
            <TableHead>
              <TableRow>
                <TableCell 
                  sx={{ 
                    bgcolor: '#2e7d32', 
                    color: 'white',
                    fontWeight: 700,
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    py: 1.5
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CalendarTodayIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
                    <span>তারিখ</span>
                  </Stack>
                </TableCell>
                <TableCell 
                  align="right"
                  sx={{ 
                    bgcolor: '#2e7d32', 
                    color: 'white',
                    fontWeight: 700,
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    py: 1.5
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1}>
                    <AccountBalanceWalletIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
                    <span>পরিমাণ</span>
                  </Stack>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {formattedData.map((item, index) => (
                <TableRow 
                  key={index}
                  sx={{
                    '&:nth-of-type(odd)': { bgcolor: 'rgba(0, 0, 0, 0.02)' },
                    '&:hover': { bgcolor: 'rgba(46, 125, 50, 0.08)' },
                    transition: 'background-color 0.2s'
                  }}
                >
                  <TableCell sx={{ py: 2, fontWeight: 500, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                    {item.date}
                  </TableCell>
                  <TableCell align="right" sx={{ py: 2 }}>
                    <Chip
                      label={`৳${item.amount.toLocaleString('bn-BD')}`}
                      size="small"
                      sx={{
                        bgcolor: '#e8f5e9',
                        color: '#2e7d32',
                        fontWeight: 700,
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        minWidth: 100
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      {/* Dues Summary (Tuition vs Exam) */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 2,
          background: 'linear-gradient(135deg, #6a1b9a 0%, #9c27b0 100%)',
          color: 'white',
          borderRadius: 2,
          flexShrink: 0
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center" justifyContent="space-evenly" divider={<Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.3)', display: { xs: 'none', md: 'block' } }} />}>
          <Box textAlign="center">
            <Typography variant="body1" sx={{ opacity: 0.9, mb: 0.5 }}>মোট বকেয়া</Typography>
            <Typography variant="h3" sx={{ fontWeight: 700 }}>
              ৳{Math.floor(Number(summary?.total_due || 0)).toLocaleString('bn-BD')}
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="body1" sx={{ opacity: 0.9, mb: 0.5 }}>বেতন বকেয়া</Typography>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              ৳{Math.floor(Number(summary?.tuition_due_total || 0)).toLocaleString('bn-BD')}
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="body1" sx={{ opacity: 0.9, mb: 0.5 }}>পরীক্ষার ফি বকেয়া</Typography>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              ৳{Math.floor(Number(summary?.exam_due_total || 0)).toLocaleString('bn-BD')}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Class-wise Total Due Summary (Compact Box) */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          bgcolor: 'white',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 2
        }}
      >
        {Array.isArray(feeDuesByClass) && feeDuesByClass.length > 0 ? (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {byClass.map((row, i) => (
              <Chip
                key={i}
                label={`${row.class_name} মোট বকেয়া: ৳${Math.round(Number(row.total_due || (row.tuition_due||0)+(row.exam_due||0))).toLocaleString('bn-BD')}`}
                sx={{ bgcolor: '#f9fafb' }}
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">কোনো বকেয়ার তথ্য নেই</Typography>
        )}
      </Paper>


      {/* Class-wise Dues Table */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          শ্রেণিভিত্তিক বকেয়ার তালিকা
        </Typography>
        {Array.isArray(feeDuesByClass) && feeDuesByClass.length > 0 ? (
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#6a1b9a', color: 'white', fontWeight: 700 }}>শ্রেণি</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#6a1b9a', color: 'white', fontWeight: 700 }}>বেতন বকেয়া</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#6a1b9a', color: 'white', fontWeight: 700 }}>পরীক্ষার ফি বকেয়া</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#6a1b9a', color: 'white', fontWeight: 700 }}>মোট বকেয়া</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byClass.map((row, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{row.class_name}</TableCell>
                    <TableCell align="right">৳{Math.round(Number(row.tuition_due || 0)).toLocaleString('bn-BD')}</TableCell>
                    <TableCell align="right">৳{Math.round(Number(row.exam_due || 0)).toLocaleString('bn-BD')}</TableCell>
                    <TableCell align="right">
                      <Chip label={`৳${Math.round(Number(row.total_due || (row.tuition_due||0)+(row.exam_due||0))).toLocaleString('bn-BD')}`} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">কোনো বকেয়ার তথ্য নেই</Typography>
        )}
      </Box>
    </Box>
  );
};

export default FeeCollectionChart;
