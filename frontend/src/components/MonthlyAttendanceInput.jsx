import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Grid,
  Paper,
  Typography,
  Box,
  IconButton,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../utils/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { enGB, bn } from 'date-fns/locale';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import { isAuthenticated } from '../utils/auth';

const MonthlyAttendanceInput = ({ open, onClose, studentId, schoolId, onSave }) => {
  const [month, setMonth] = useState(new Date());
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isWeeklyHoliday = (date) => {
    return date instanceof Date && date.getDay() === 5; // Friday only
  };

  // Generate days of the month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  // Initialize attendance state when month changes
  useEffect(() => {
    const initialAttendance = {};
    daysInMonth.forEach(day => {
      initialAttendance[format(day, 'yyyy-MM-dd')] = {
        status: isWeeklyHoliday(day) ? 'weekend' : 'present',
        note: ''
      };
    });
    setAttendance(initialAttendance);
  }, [month]);

  const handleStatusChange = (date, value) => {
    setAttendance(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        status: value
      }
    }));
  };

  const handleNoteChange = (date, value) => {
    setAttendance(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        note: value
      }
    }));
  };

  const handleSubmit = async () => {
    if (!isAuthenticated()) {
      onClose();
      // Optionally navigate to login, but since it's a dialog, maybe just close or show toast?
      // Better to navigate to login.
      window.location.href = '/login'; 
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const records = Object.entries(attendance)
        .filter(([_, data]) => data.status !== 'weekend')
        .map(([date, data]) => {
          const status = data.status;
          const present = status === 'present' || status === 'late';
          return {
            date,
            student: parseInt(studentId, 10),
            school: parseInt(schoolId, 10),
            present,
            note: data.note || ''
          };
        });

      await api.post(`/api/attendance/records/bulk_save/`, { records });

      onSave && onSave();
      onClose();
    } catch (err) {
      setError(err.message || 'An error occurred while saving attendance');
    } finally {
      setLoading(false);
    }
  };

  const getDayName = (date) => {
    return new Date(date).toLocaleDateString('bn-BD', { weekday: 'short' });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <span>মাসিক হাজিরা ইনপুট</span>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={bn}>
          <Box mb={3} mt={2}>
            <DatePicker
              views={['year', 'month']}
              label="মাস নির্বাচন করুন"
              value={month}
              onChange={(newValue) => setMonth(newValue)}
              slotProps={{ textField: { fullWidth: true, helperText: '' } }}
            />
          </Box>
        </LocalizationProvider>

        {error && (
          <Box mb={2} p={1} bgcolor="#ffebee" color="#c62828" borderRadius={1}>
            <Typography variant="body2">{error}</Typography>
          </Box>
        )}

        <Grid container spacing={1}>
          {daysInMonth.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isWeekendDay = isWeeklyHoliday(day);
            const dayData = attendance[dateStr] || { status: 'present', note: '' };
            
            return (
              <Grid item xs={6} sm={4} md={3} key={dateStr}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 1, 
                    bgcolor: isWeekendDay ? '#f5f5f5' : 'white',
                    opacity: isWeekendDay ? 0.7 : 1
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" fontWeight="bold">
                      {format(day, 'd MMM')} ({getDayName(day)})
                    </Typography>
                    <FormControl size="small" variant="outlined" fullWidth>
                      <Select
                        value={isWeekendDay ? 'weekend' : dayData.status}
                        onChange={(e) => handleStatusChange(dateStr, e.target.value)}
                        disabled={isWeekendDay}
                        sx={{ height: 32 }}
                      >
                        <MenuItem value="present">উপস্থিত</MenuItem>
                        <MenuItem value="absent">অনুপস্থিত</MenuItem>
                        <MenuItem value="late">দেরী</MenuItem>
                        <MenuItem value="excused">ছুটি</MenuItem>
                        {isWeekendDay && <MenuItem value="weekend">সাপ্তাহিক ছুটি</MenuItem>}
                      </Select>
                    </FormControl>
                  </Box>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="নোট"
                    value={dayData.note}
                    onChange={(e) => handleNoteChange(dateStr, e.target.value)}
                    disabled={isWeekendDay}
                  />
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="secondary">
          বাতিল
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          disabled={loading}
        >
          {loading ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MonthlyAttendanceInput;
