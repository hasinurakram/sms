import React from 'react';
import { Card, CardContent, Typography, CardMedia, Box } from '@mui/material';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';

const SchoolCard = ({ school }) => {
  const navigate = useNavigate();

  // Handle both logo and img properties, with fallback to empty string
  const logoSrc = React.useMemo(() => {
    const imgUrl = school?.logo || school?.img;
    if (!imgUrl) return '';
    
    try {
      if (typeof imgUrl === 'string') {
        if (imgUrl.startsWith('http')) return imgUrl;
        const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/,'');
        return `${base}/media/${imgUrl.replace(/\\/g, '/')}`;
      }
      return '';
    } catch (error) {
      console.error('Error processing image URL:', error);
      return '';
    }
  }, [school?.logo, school?.img]);

  return (
    <Card
      onClick={() => navigate(`/school/${school.id}`)}
      sx={{
        width: 250,
        margin: 1,
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'transform 0.3s, box-shadow 0.3s',
        '&:hover': {
          transform: 'translateY(-10px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          cursor: 'pointer'
        },
        background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
        color: 'white',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
        {logoSrc &&
          <CardMedia
            component="img"
            height="120"
            image={logoSrc}
            alt={school.name}
            sx={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid white',
            }}
          />
        }
      </Box>
      <CardContent sx={{ textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
          {school.name}
        </Typography>
        {school.address && (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
            {school.address}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default SchoolCard;
