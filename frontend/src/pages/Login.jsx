import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Info, Mail, User, Phone, Lock, HelpCircle, CheckCircle, AlertTriangle, Key } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  
  // Security Answers
  const [schoolAnswer, setSchoolAnswer] = useState('');
  const [petAnswer, setPetAnswer] = useState('');
  const [cityAnswer, setCityAnswer] = useState('');
  
  // Reset Password State
  const [resetEmailOrPhone, setResetEmailOrPhone] = useState('');
  const [resetSchool, setResetSchool] = useState('');
  const [resetPet, setResetPet] = useState('');
  const [resetCity, setResetCity] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', or 'forgot'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const { login, register, googleLogin, resetPassword, user, apiUrl } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [isTooEarly, setIsTooEarly] = useState(false);
  const [daysBeforeEvent, setDaysBeforeEvent] = useState(0);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch event details on mount
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/admin/event`);
        const data = await response.json();
        if (data.success && data.event) {
          setEvent(data.event);
          
          const eventDate = new Date(data.event.dateTime).getTime();
          const today = Date.now();
          const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
          
          if (eventDate - today > threeDaysInMs) {
            setIsTooEarly(true);
            const diffDays = Math.ceil((eventDate - today) / (24 * 60 * 60 * 1000));
            setDaysBeforeEvent(diffDays);
          } else {
            setIsTooEarly(false);
          }
        }
      } catch (err) {
        console.error('Error fetching event on login page:', err);
      }
    };
    fetchEvent();
  }, [apiUrl]);

  // Load Google Sign-In script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleSignIn;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const initializeGoogleSignIn = () => {
    try {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id.apps.googleusercontent.com',
          callback: handleGoogleCredentialResponse,
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { 
            type: 'icon',
            theme: 'filled_black',
            size: 'large',
            shape: 'circle'
          }
        );
      }
    } catch (err) {
      console.warn('Google Sign-In initialization failed:', err);
    }
  };

  const handleGoogleCredentialResponse = async (response) => {
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      const res = await googleLogin(response.credential);
      setLoading(false);
      if (res.success) {
        setInfoMsg('Successfully logged in with Google!');
        navigate('/');
      } else {
        setError(res.message || 'Google authentication failed.');
      }
    } catch (err) {
      console.error('Google callback error:', err);
      setError('Connection to Google Auth failed.');
      setLoading(false);
    }
  };

  // Simulated Google Auth for developer environments
  const handleSimulatedGoogleLogin = async (mockEmail, mockName) => {
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      // Simulate ID token backend call
      const mockToken = btoa(JSON.stringify({ email: mockEmail, name: mockName, sub: 'simulated-google-id' }));
      const res = await googleLogin(mockToken);
      setLoading(false);
      if (res.success) {
        setInfoMsg('Developer Bypass: Logged in using simulated Google identity.');
        navigate('/');
      } else {
        setError(res.message || 'Failed to authenticate Google bypass.');
      }
    } catch (err) {
      setError('Failed to reach local server.');
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    if (!emailOrPhone || !password) {
      setError('Email/Phone and Password are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(emailOrPhone, password);
      setLoading(false);
      if (res.success) {
        navigate('/');
      } else {
        setError(res.message || 'Incorrect credentials.');
      }
    } catch (err) {
      setError('Server unreachable.');
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    if (!name || !email || !phoneNumber || !password || !schoolAnswer || !petAnswer || !cityAnswer) {
      setError('All fields and security questions are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await register(name, email, phoneNumber, password, schoolAnswer, petAnswer, cityAnswer);
      setLoading(false);
      if (res.success) {
        setInfoMsg('Account registered successfully!');
        navigate('/verify');
      } else {
        setError(res.message || 'Failed to register account.');
      }
    } catch (err) {
      setError('Server unreachable.');
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    if (!resetEmailOrPhone || !resetSchool || !resetPet || !resetCity || !newPassword) {
      setError('All fields are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(resetEmailOrPhone, resetSchool, resetPet, resetCity, newPassword);
      setLoading(false);
      if (res.success) {
        setInfoMsg('Password updated successfully! Please login with your new credentials.');
        setAuthMode('login');
        setEmailOrPhone(resetEmailOrPhone);
      } else {
        setError(res.message || 'Verification answers are incorrect.');
      }
    } catch (err) {
      setError('Server unreachable.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl relative z-10">
      <div className="grid md:grid-cols-2 gap-6 items-stretch">

        {/* Left Column: Event info & registration rules */}
        {event ? (
          <div className="glass-panel-glow vip-glitter-card rounded-3xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden min-h-[380px]">
            <div className="absolute inset-0 glitter-bg pointer-events-none opacity-30 z-0" />
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-10 w-52 h-52 rounded-full bg-amber-600/5 blur-3xl pointer-events-none" />

            <div className="relative z-10 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 neon-badge rounded-full text-[10px] font-extrabold uppercase tracking-widest mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                Featured Event
              </div>

              <div className="font-cursive text-2xl text-gradient mb-1">You're Invited</div>
              <h3 className="text-2xl font-extrabold leading-tight mb-3 text-gradient">
                {event.title}
              </h3>

              <p className="text-xs leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
                {event.description || 'Join us for an exclusive night out! Verify your age pass now for seamless, fast-track VIP entry.'}
              </p>

              <div className="space-y-0 text-xs rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border-muted)', background: 'var(--glass-input-bg)' }}>
                <div className="flex justify-between items-center px-4 py-3 border-b" style={{ borderColor: 'var(--border-muted)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>📍 Venue</span>
                  <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{event.venue}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span style={{ color: 'var(--text-muted)' }}>🕐 Date & Time</span>
                  <span className="font-bold font-mono text-amber-500">
                    {new Date(event.dateTime).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t relative z-10 text-left" style={{ borderColor: 'var(--border-muted)' }}>
              <div className={`p-4 rounded-2xl border flex items-start gap-2.5 leading-relaxed text-xs ${
                isTooEarly
                  ? 'bg-amber-500/8 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/8 border-emerald-500/30 text-emerald-300'
              }`}>
                <Info className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isTooEarly ? 'text-amber-400' : 'text-emerald-400'}`} />
                <div>
                  <span className="font-bold block mb-1">Registration Rules:</span>
                  Please do not register more than 3 days in advance of the event.
                  {isTooEarly ? (
                    <span className="block mt-1.5 font-semibold text-[10px] text-amber-400 animate-pulse">
                      ⚠ Event is {daysBeforeEvent} days away. Return closer to the event date.
                    </span>
                  ) : (
                    <span className="block mt-1.5 font-semibold text-[10px] text-emerald-400">
                      ✓ Registration is OPEN — you're within the 3-day window!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel rounded-3xl p-8 flex flex-col justify-center items-center min-h-[350px] text-center relative overflow-hidden">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/5 to-amber-600/5 pointer-events-none" />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center mb-5">
              <Shield className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No Event Scheduled</h3>
            <p className="text-xs leading-relaxed max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
              There is currently no upcoming event hosted on this platform.
            </p>
          </div>
        )}

        {/* Right Column: Auth Card */}
        <div className="glass-panel-glow vip-glitter-card rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col justify-center">
          <div className="absolute inset-0 glitter-bg pointer-events-none opacity-20 z-0" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-8 bg-amber-500/10 blur-xl pointer-events-none rounded-full" />

          {/* Logo Header */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 mb-3 neon-pulse">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-3.5xl tracking-wide text-gradient mb-1 font-cursive">
              AgeVault
            </h2>
            <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              Secure Age Verification
            </p>
          </div>

          {/* Tab Selection */}
          {authMode !== 'forgot' && (
            <div className="flex p-1 rounded-2xl mb-5 border" style={{ background: 'var(--glass-input-bg)', borderColor: 'var(--glass-input-border)' }}>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(''); setInfoMsg(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-300 ${
                  authMode === 'login'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/15'
                    : 'hover:text-white'
                }`}
                style={{ color: authMode !== 'login' ? 'var(--text-muted)' : undefined }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setError(''); setInfoMsg(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-300 ${
                  authMode === 'register'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/15'
                    : 'hover:text-white'
                }`}
                style={{ color: authMode !== 'register' ? 'var(--text-muted)' : undefined }}
              >
                Register
              </button>
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/25 text-red-300 text-xs rounded-xl flex items-start gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {infoMsg && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs rounded-xl flex items-start gap-2 text-left">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* AUTH FORMS */}

          {/* 1. LOGIN MODE */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-left">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                  Email or Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Enter email or mobile"
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setError(''); setInfoMsg(''); }}
                    className="text-[9px] font-bold text-amber-500 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl btn-neon text-xs tracking-wide flex justify-center items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Continue with Email
                  </>
                )}
              </button>

              {/* Google Sign-in GIS container */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
                <span className="relative px-3 text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)', background: 'var(--glass-bg-glow)' }}>Or Google verification</span>
              </div>

              <div id="google-signin-btn" className="flex justify-center my-3 hover:scale-110 active:scale-95 transition-all duration-300"></div>

              {/* Developer fallback/bypass to log in immediately */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSimulatedGoogleLogin('mohdnomaantalib@gmail.com', 'Nomaan Talib')}
                  className="py-2 text-[8px] uppercase tracking-wider font-extrabold rounded-lg border border-amber-500/20 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 transition"
                >
                  👑 Admin Bypass
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulatedGoogleLogin('staff@agevault.com', 'Staff Member')}
                  className="py-2 text-[8px] uppercase tracking-wider font-extrabold rounded-lg border border-amber-500/20 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 transition"
                >
                  🎭 Staff Bypass
                </button>
              </div>
            </form>
          )}

          {/* 2. REGISTRATION MODE */}
          {authMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-left max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                  Full Name <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="First & Last Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                  Email Address <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                  Mobile Number <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                  Password <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              {/* Security Questions Section */}
              <div className="pt-2 border-t border-slate-800 space-y-3.5">
                <div className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest">
                  🔒 Configure 3 Security Questions (Case-Insensitive)
                </div>
                
                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest mb-1 text-slate-400">
                    1. First school name?
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Saint Mary High"
                    value={schoolAnswer}
                    onChange={(e) => setSchoolAnswer(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest mb-1 text-slate-400">
                    2. First pet name?
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bruno"
                    value={petAnswer}
                    onChange={(e) => setPetAnswer(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest mb-1 text-slate-400">
                    3. Home city name?
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mumbai"
                    value={cityAnswer}
                    onChange={(e) => setCityAnswer(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl btn-neon text-xs tracking-wide flex justify-center items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    Register Account
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. FORGOT PASSWORD MODE */}
          {authMode === 'forgot' && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5 text-left max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                  Email or Phone number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="your@email.com or mobile"
                    value={resetEmailOrPhone}
                    onChange={(e) => setResetEmailOrPhone(e.target.value)}
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Answer Verification Questions
                </div>
                
                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest mb-1 text-slate-400">
                    1. First school name?
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter answer"
                    value={resetSchool}
                    onChange={(e) => setResetSchool(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest mb-1 text-slate-400">
                    2. First pet name?
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter answer"
                    value={resetPet}
                    onChange={(e) => setResetPet(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest mb-1 text-slate-400">
                    3. Home city name?
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter answer"
                    value={resetCity}
                    onChange={(e) => setResetCity(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition text-xs font-semibold text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl btn-neon text-xs tracking-wide flex justify-center items-center gap-1"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Save Password
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Card Footer Help Section */}
          <div className="mt-5 pt-4 border-t flex flex-col items-center text-center space-y-1.5" style={{ borderColor: 'var(--border-muted)' }}>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-amber-500" /> Administrative Support
            </span>
            <p className="text-[10px] text-slate-400">
              Access issues? Report directly to <a href="mailto:admin@agevault.com" className="text-amber-400 font-bold hover:underline">admin@agevault.com</a>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
