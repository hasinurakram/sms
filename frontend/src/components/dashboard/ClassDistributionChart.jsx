import React from 'react';
import { Box, Typography, LinearProgress, Stack, Chip } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';

const ClassDistributionChart = ({ classDistribution }) => {
  // Sort classes by student count for better visualization
  const sortedData = [...(classDistribution || [])].sort((a, b) => b.count - a.count);
  
  // Calculate total for percentages
  const total = sortedData.reduce((sum, item) => sum + item.count, 0);
  
  // Generate colors for the bars
  const getBarColor = (index) => {
    const colors = [
      '#2196F3', '#4CAF50', '#FF9800', 
      '#9C27B0', '#E91E63', '#3F51B5',
      '#F44336', '#FF5722', '#009688'
    ];
    return colors[index % colors.length];
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {sortedData.length > 0 ? (
        <Stack spacing={3} sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
          {sortedData.map((classItem, index) => {
            const percentage = Math.round((classItem.count / total) * 100);
            const barColor = getBarColor(index);
            
            return (
              <Box 
                key={index} 
                sx={{ 
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(0, 0, 0, 0.02)',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transform: 'translateX(4px)'
                  }
                }}
              >
                {/* Class Name and Stats */}
                <Stack 
                  direction="row" 
                  justifyContent="space-between" 
                  alignItems="center" 
                  sx={{ mb: 1.5 }}
                  spacing={2}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                    <SchoolIcon sx={{ color: barColor, fontSize: 20 }} />
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 600,
                        color: 'text.primary',
                        fontSize: '0.95rem'
                      }}
                    >
                      {classItem.classroom__name || 'Unnamed Class'}
                    </Typography>
                  </Stack>
                  
                  <Chip
                    label={`${classItem.count} students`}
                    size="small"
                    sx={{
                      bgcolor: barColor,
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      height: 24
                    }}
                  />
                </Stack>

                {/* Progress Bar */}
                <Box sx={{ position: 'relative' }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={percentage}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      bgcolor: 'rgba(0, 0, 0, 0.08)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: barColor,
                        borderRadius: 5,
                        transition: 'transform 0.4s ease'
                      }
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      mr: 1,
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      color: percentage > 50 ? 'white' : barColor,
                      textShadow: percentage > 50 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
                    }}
                  >
                    {percentage}%
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
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
          <SchoolIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
          <Typography variant="body2" color="text.secondary">
            No class distribution data available
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ClassDistributionChart;