import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken, login as authLogin, logout as authLogout } from '../utils/auth';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          await fetchUser();
        } catch (error) {
          console.error('Initial user fetch failed:', error);
          // Don't auto-logout here, let the interceptor handle 401s
          // or if it's a network error, we might still have a valid token
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/api/users/me/');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      let uname = username;
      try {
        const digits = String(username || '').replace(/\D/g, '');
        const isNumericId = !!digits && /^\d+$/.test(digits);
        if (isNumericId) {
          // Try resolve student by ID first
          try {
            const s = await api.get(`/api/academics/students/${digits}/`);
            const u = s.data?.user;
            if (u?.username) uname = u.username;
          } catch (_) {
            // Fallback: search within current school
            const schoolId = localStorage.getItem('currentSchoolId');
            if (schoolId) {
              try {
                const r = await api.get(`/api/academics/students/?school=${schoolId}`);
                const arr = Array.isArray(r.data) ? r.data : (r.data?.results || []);
                const found = (arr || []).find(it => String(it.id) === digits || String(it.roll_number) === digits);
                if (found?.user?.username) uname = found.user.username;
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
      await authLogin(uname, password);
      await fetchUser();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const logout = () => {
    authLogout();
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
