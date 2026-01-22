import React from 'react';
import { Card, CardContent, Stack, Typography, Box } from '@mui/material';

// Map legacy tailwind-like border color strings to hex colors for backward compatibility
const mapLegacyColor = (c) => {
  const map = {
    'border-blue-500': '#2196f3',
    'border-green-500': '#4caf50',
    'border-purple-500': '#9c27b0',
    'border-red-500': '#f44336',
    'border-orange-500': '#fb8c00',
  };
  return map[c] || '#1976d2';
};

const normalizeColor = (color) => {
  if (!color) return '#1976d2';
  if (typeof color === 'string' && color.startsWith('border-')) return mapLegacyColor(color);
  return color;
};

const StatCard = ({ title, value, icon, color = '#1976d2', onClick }) => {
  const base = normalizeColor(color);
  return (
    <Card
      elevation={4}
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: 8 },
        '&:focus-visible': { outline: '3px solid rgba(25,118,210,0.6)' },
        background: `linear-gradient(135deg, ${base} 0%, #90caf9 100%)`,
        color: 'white',
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography 
              variant="subtitle2" 
              sx={{ 
                color: 'rgba(255,255,255,0.95)',
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: 'none',
                mb: 0.5,
                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              {title}
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 'bold', 
                lineHeight: 1.2,
                color: 'white',
                textShadow: '0 1px 2px rgba(0,0,0,0.25)'
              }}
            >
              {value}
            </Typography>
          </Box>
          <Box sx={{ fontSize: 36, opacity: 0.9, lineHeight: 1 }}>
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default StatCard;
