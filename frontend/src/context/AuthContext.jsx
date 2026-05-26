import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const API_URL = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ''
  ? import.meta.env.VITE_API_URL
  : (window.location.origin.includes('localhost') ? 'http://localhost:5000' : window.location.origin);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem('agevault_token');
    return t && t !== 'null' && t !== 'undefined' ? t : null;
  });
  const [loading, setLoading] = useState(true);

  // Fetch current user details on load or token change
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        
        if (data.success) {
          setUser(data.user);
        } else {
          // Token expired or invalid
          logout();
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, [token]);

  // Login handler
  const login = async (emailOrPhone, password) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailOrPhone, password }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('agevault_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, message: 'Server unreachable. Check if backend is running.' };
    } finally {
      setLoading(false);
    }
  };

  // Register handler
  const register = async (name, email, phone, password, schoolAnswer, petAnswer, cityAnswer) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, phone, password, schoolAnswer, petAnswer, cityAnswer }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('agevault_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Registration failed:', error);
      return { success: false, message: 'Server unreachable. Check if backend is running.' };
    } finally {
      setLoading(false);
    }
  };

  // Google Login handler
  const googleLogin = async (idToken, phone) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/google-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken, phone }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('agevault_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Google login failed:', error);
      return { success: false, message: 'Server unreachable. Check if backend is running.' };
    } finally {
      setLoading(false);
    }
  };

  // Reset Password handler
  const resetPassword = async (emailOrPhone, schoolAnswer, petAnswer, cityAnswer, newPassword) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailOrPhone, schoolAnswer, petAnswer, cityAnswer, newPassword }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Reset password failed:', error);
      return { success: false, message: 'Server unreachable. Check if backend is running.' };
    } finally {
      setLoading(false);
    }
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('agevault_token');
    setToken(null);
    setUser(null);
  };

  // Refresh profile details (useful after verification submission)
  const refreshUser = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, googleLogin, resetPassword, logout, refreshUser, apiUrl: API_URL }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
