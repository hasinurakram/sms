import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const { user, loading } = useAuth();
  const role = ((user && (user.profile?.role || user.role)) || '').trim().toLowerCase();

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isAuthenticated() || !!user;
      if (!authenticated) {
        const next = encodeURIComponent(location.pathname + location.search);
        navigate(`/login?next=${next}${Array.isArray(allowedRoles) && allowedRoles.length ? `&require=${allowedRoles.join(',')}` : ''}`, { replace: true });
      }
      setIsChecking(false);
      if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
        const hasRole = !!role;
        const isAdminLike = role === 'admin' || role === 'super_admin';
        const ok = isAdminLike ? true : (hasRole ? allowedRoles.map(r => String(r).toLowerCase()).includes(role) : true);
        if (hasRole && !ok) {
          setIsChecking(false);
          return;
        }
      }
    };


    if (!loading) checkAuth();
  }, [navigate, user, loading, location.pathname, location.search]);

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
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const hasRole = !!role;
    if (hasRole) {
      const isAdminLike = role === 'admin' || role === 'super_admin';
      const ok = isAdminLike ? true : allowedRoles.map(r => String(r).toLowerCase()).includes(role);
      if (!ok) {
        return (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
            <Typography variant="h6" sx={{ mb: 1 }}>
              আপনি এই পেজে প্রবেশের অনুমতি পাচ্ছেন না
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              প্রয়োজনীয় ভূমিকা: {allowedRoles.join(', ')}
            </Typography>
            <Button variant="contained" onClick={() => navigate(-1)} sx={{ mr: 1 }}>
              ব্যাক
            </Button>
            <Button variant="outlined" onClick={() => navigate('/')}>
              হোম
            </Button>
          </Box>
        );
      }
    }
  }

  return children;
};

export default ProtectedRoute;
