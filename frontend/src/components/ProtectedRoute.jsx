import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const { user, loading } = useAuth();

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isAuthenticated() || !!user;
      if (!authenticated) {
        navigate('/login', { replace: true });
      }
      setIsChecking(false);
    };

    if (!loading) checkAuth();
  }, [navigate, user, loading]);

  if (isChecking || loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
      >
        <CircularProgress size={40} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Checking authentication...
        </Typography>
      </Box>
    );
  }

  if (!(isAuthenticated() || !!user)) {
    return null;
  }

  return children;
};

export default ProtectedRoute;
