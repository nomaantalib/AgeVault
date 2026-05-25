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

  // Send OTP handler (Resend integration)
  const sendOtp = async (email, name, phone, role, authMode) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name, phone, role, authMode }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Send OTP failed:', error);
      return { success: false, message: 'Server unreachable. Check if backend is running.' };
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP handler (Resend integration)
  const verifyOtp = async (email, otp) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
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
      console.error('Verify OTP failed:', error);
      return { success: false, message: 'Server unreachable. Check if backend is running.' };
    } finally {
      setLoading(false);
    }
  };

  // Login handler (Retained for legacy/direct backdoors if needed)
  const login = async (email, name, phone, role) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/supabase-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name, phone, role }),
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
      console.error('Login request failed:', error);
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
    <AuthContext.Provider value={{ user, token, loading, sendOtp, verifyOtp, login, logout, refreshUser, apiUrl: API_URL }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
