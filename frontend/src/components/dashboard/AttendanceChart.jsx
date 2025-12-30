import React from 'react';
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  LinearProgress,
  Chip,
  Stack,
  Paper
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

const AttendanceChart = ({ attendanceData }) => {
  // Format data for display
  const formattedData = attendanceData?.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    present: day.present || 0,
    absent: day.absent || 0,
    total: (day.present || 0) + (day.absent || 0)
  })) || [];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
          <Table stickyHeader size="small" sx={{ minWidth: 560 }}>
            <TableHead>
              <TableRow>
                <TableCell 
                  sx={{ 
                    bgcolor: '#1976d2', 
                    color: 'white',
                    fontWeight: 700,
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    py: 1.5
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CalendarTodayIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
                    <span>Date</span>
                  </Stack>
                </TableCell>
                <TableCell 
                  align="center"
                  sx={{ 
                    bgcolor: '#1976d2', 
                    color: 'white',
                    fontWeight: 700,
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    py: 1.5
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                    <CheckCircleIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
                    <span>Present</span>
                  </Stack>
                </TableCell>
                <TableCell 
                  align="center"
                  sx={{ 
                    bgcolor: '#1976d2', 
                    color: 'white',
                    fontWeight: 700,
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    py: 1.5
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                    <CancelIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
                    <span>Absent</span>
                  </Stack>
                </TableCell>
                <TableCell 
                  sx={{ 
                    bgcolor: '#1976d2', 
                    color: 'white',
                    fontWeight: 700,
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    py: 1.5,
                    minWidth: 180
                  }}
                >
                  Attendance Rate
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {formattedData.map((day, index) => {
                const rate = day.total > 0 ? Math.round((day.present / day.total) * 100) : 0;
                const rateColor = rate >= 90 ? '#4caf50' : rate >= 75 ? '#ff9800' : '#f44336';
                
                return (
                  <TableRow 
                    key={index}
                    sx={{
                      '&:nth-of-type(odd)': { bgcolor: 'rgba(0, 0, 0, 0.02)' },
                      '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.08)' },
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <TableCell sx={{ py: 2, fontWeight: 500, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                      {day.date}
                    </TableCell>
                    <TableCell align="center" sx={{ py: 2 }}>
                      <Chip 
                        icon={<CheckCircleIcon />}
                        label={day.present}
                        size="small"
                        sx={{
                          bgcolor: '#e8f5e9',
                          color: '#2e7d32',
                          fontWeight: 600,
                          '& .MuiChip-icon': { color: '#2e7d32' },
                          fontSize: { xs: '0.7rem', sm: '0.75rem' }
                        }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ py: 2 }}>
                      <Chip 
                        icon={<CancelIcon />}
                        label={day.absent}
                        size="small"
                        sx={{
                          bgcolor: '#ffebee',
                          color: '#c62828',
                          fontWeight: 600,
                          '& .MuiChip-icon': { color: '#c62828' },
                          fontSize: { xs: '0.7rem', sm: '0.75rem' }
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Stack spacing={0.5}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 700,
                            color: rateColor,
                            fontSize: { xs: '0.8rem', sm: '0.875rem' }
                          }}
                        >
                          {day.total > 0 ? `${rate}%` : 'N/A'}
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={rate}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: 'rgba(0, 0, 0, 0.08)',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: rateColor,
                              borderRadius: 4
                            }
                          }}
                        />
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            color: 'text.secondary'
          }}
        >
          <CalendarTodayIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
          <Typography variant="body2" color="text.secondary">
            No attendance data available
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default AttendanceChart;