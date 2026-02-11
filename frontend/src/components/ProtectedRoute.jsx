import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const { user, loading } = useAuth();
  const role = ((user && (user.profile?.role || user.role)) || '').toLowerCase();

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
        const ok = hasRole ? allowedRoles.map(r => String(r).toLowerCase()).includes(role) : true;
        if (hasRole && !ok) {
          const next = encodeURIComponent(location.pathname + location.search);
          navigate(`/login?next=${next}&require=${allowedRoles.join(',')}`, { replace: true });
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
      const ok = allowedRoles.map(r => String(r).toLowerCase()).includes(role);
      if (!ok) return null;
    }
  }

  return children;
};

export default ProtectedRoute;
