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
      if (response.data) {
        // Flatten the structure if it contains nested 'user' and 'profile'
        // This ensures user.username, user.first_name, etc. work in components
        const data = response.data;
        if (data.user && typeof data.user === 'object') {
          const flattened = {
            ...data.user,
            profile: data.profile || {},
            // Keep role at top level for convenience
            role: data.profile?.role || data.user.role || (data.user.is_superuser ? 'admin' : 'student')
          };
          setUser(flattened);
        } else {
          setUser(data);
        }
      } else {
        setUser(null);
      }
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
      if (typeof uname === 'string') {
        try {
          uname = uname.normalize('NFKC').trim();
        } catch (_) {}
      }
      try {
        const trimmed = String(uname || '').trim();
        // A numeric ID must be strictly digits and typically 4+ digits for a system ID or a short roll number
        // We only try to resolve as numeric if there are ONLY digits. Bengali digits are handled as strings.
        const isNumericId = /^[0-9]+$/.test(trimmed);
        const digits = isNumericId ? trimmed : '';
        // If it contains non-digit characters (like Bengali), it's definitely a username, skip numeric resolving
        if (isNumericId) {
          // Try resolve student by roll number within current school first (safer than direct ID fetch which might 404)
          const schoolId = localStorage.getItem('currentSchoolId');
          if (schoolId) {
            try {
              const r = await api.get(`/api/academics/students/`, { params: { school: schoolId, roll_number: digits } });
              const arr = Array.isArray(r.data) ? r.data : (r.data?.results || []);
              const found = (arr || []).find(it => String(it.roll_number) === digits);
              if (found?.user?.username) {
                uname = found.user.username;
              } else if (digits.length > 3) {
                // If not found by roll, and ID is long enough, try direct ID fetch
                try {
                  const s = await api.get(`/api/academics/students/${digits}/`);
                  const u = s.data?.user;
                  if (u?.username) uname = u.username;
                } catch (_) {}
              }
            } catch (_) {}
          } else if (digits.length > 3) {
            // No school ID, but long enough digits to be a direct ID
            try {
              const s = await api.get(`/api/academics/students/${digits}/`);
              const u = s.data?.user;
              if (u?.username) uname = u.username;
            } catch (_) {}
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
