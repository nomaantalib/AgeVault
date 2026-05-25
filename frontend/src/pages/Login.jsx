import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Info, Mail, User, Phone, CheckCircle, AlertTriangle, Key } from 'lucide-react';
import Typewriter from '../utils/Typewriter';

const Login = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('user'); // 'user', 'club', 'admin'
  const [authMode, setAuthMode] = useState('register'); // 'register' or 'login'
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const { sendOtp, verifyOtp, user, apiUrl } = useAuth();
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

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    if (!email) {
      setError('Please enter a valid email address');
      return;
    }

    if (authMode === 'register') {
      if (!name.trim()) {
        setError('Full Name is required for registration');
        return;
      }
      if (!phoneNumber || phoneNumber.length < 10) {
        setError('Please enter a valid 10-digit phone number');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await sendOtp(email, name, phoneNumber, role, authMode);
      setLoading(false);

      if (res.success) {
        setIsOtpSent(true);
        if (res.otp) {
          // Fallback / Demo Simulation
          setInfoMsg(`DEMO MODE: An email security code ${res.otp} was simulated. Please input it below.`);
          setOtpCode(res.otp);
        } else {
          // Real Resend OTP
          setInfoMsg(`A secure 6-digit security code has been sent via Resend to ${email}. Please check your inbox.`);
        }
      } else {
        setError(res.message || 'Failed to dispatch verification code');
      }
    } catch (err) {
      console.error('OTP Send Error:', err);
      setError('Failed to contact authentication network.');
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    if (!otpCode || otpCode.length < 6) {
      setError('Please enter the 6-digit code sent to your email');
      return;
    }

    setLoading(true);

    try {
      const res = await verifyOtp(email, otpCode);
      setLoading(false);

      if (res.success) {
        navigate('/');
      } else {
        setError(res.message || 'Invalid or expired verification code');
      }
    } catch (err) {
      console.error('OTP verification failed:', err);
      setError('Network verification error.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl relative z-10">
      <div className="grid md:grid-cols-2 gap-6 items-stretch">

        {/* Left Column: Event Info */}
        {event ? (
          <div className="glass-panel-glow club-shine rounded-3xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden min-h-[380px]">
            {/* Neon orb accents */}
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-10 w-52 h-52 rounded-full bg-pink-600/15 blur-3xl pointer-events-none" />

            <div className="relative z-10 text-left">
              {/* Club badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 neon-badge rounded-full text-[10px] font-extrabold uppercase tracking-widest mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping inline-block" />
                Featured Event
              </div>

              <h3 className="text-2xl font-extrabold leading-tight mb-3 text-gradient">
                {event.title}
              </h3>

              <p className="text-xs leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
                {event.description || 'Join us for an exclusive night out! Verify your age pass now for seamless, fast-track VIP entry.'}
              </p>

              {/* Event details */}
              <div className="space-y-0 text-xs rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border-muted)', background: 'var(--glass-input-bg)' }}>
                <div className="flex justify-between items-center px-4 py-3 border-b" style={{ borderColor: 'var(--border-muted)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>📍 Venue</span>
                  <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{event.venue}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span style={{ color: 'var(--text-muted)' }}>🕐 Date & Time</span>
                  <span className="font-bold font-mono text-violet-400">
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

            {/* Registration window notice */}
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
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-900/10 to-pink-900/10 pointer-events-none" />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/30 to-pink-600/20 border border-violet-500/20 flex items-center justify-center mb-5">
              <Shield className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No Event Scheduled</h3>
            <p className="text-xs leading-relaxed max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
              There is currently no upcoming event hosted on this platform.
            </p>
          </div>
        )}

        {/* Right Column: Auth Card */}
        <div className="glass-panel-glow club-shine rounded-3xl p-8 relative overflow-hidden flex flex-col justify-center">
          {/* Subtle top glow accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-8 bg-violet-500/10 blur-xl pointer-events-none rounded-full" />

          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-violet-500/30 mb-3 neon-pulse">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-gradient mb-1">
              AgeVault
            </h2>
            <p className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              Secure Age Verification
            </p>
          </div>

          {/* Auth mode tabs */}
          {!isOtpSent && (
            <div className="flex p-1 rounded-2xl mb-6 border" style={{ background: 'var(--glass-input-bg)', borderColor: 'var(--glass-input-border)' }}>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setError(''); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                  authMode === 'register'
                    ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-lg shadow-violet-500/25'
                    : 'hover:text-white'
                }`}
                style={{ color: authMode !== 'register' ? 'var(--text-muted)' : undefined }}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(''); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                  authMode === 'login'
                    ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-lg shadow-violet-500/25'
                    : 'hover:text-white'
                }`}
                style={{ color: authMode !== 'login' ? 'var(--text-muted)' : undefined }}
              >
                Sign In
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/25 text-red-300 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Info */}
          {infoMsg && (
            <div className="mb-5 p-3.5 bg-violet-500/10 border border-violet-500/25 text-violet-200 text-xs rounded-xl flex items-start gap-2">
              <Info className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* Form */}
          {!isOtpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">

              {authMode === 'register' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Full Name <span className="text-violet-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm"
                  />
                </div>
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Mobile Number <span className="text-violet-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit mobile number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>
              )}

              {authMode === 'register' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Account Role
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'user', label: '🎟 Member' },
                      { value: 'club', label: '🎭 Staff' },
                      { value: 'admin', label: '👑 Admin' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRole(value)}
                        className={`py-2.5 rounded-xl border text-[10px] font-bold transition-all duration-300 ${
                          role === value
                            ? 'bg-gradient-to-br from-violet-600/30 to-pink-600/20 border-violet-500/60 text-violet-300 shadow-lg shadow-violet-500/15'
                            : 'border-opacity-30 hover:border-violet-500/40'
                        }`}
                        style={{
                          borderColor: role === value ? undefined : 'var(--glass-input-border)',
                          color: role === value ? undefined : 'var(--text-muted)',
                          background: role === value ? undefined : 'var(--glass-input-bg)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl btn-neon text-sm tracking-wide flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Verification Code
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5 animate-fade-in text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600/30 to-teal-600/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Check Your Email</h3>
                <p className="text-xs leading-relaxed max-w-[280px] mx-auto" style={{ color: 'var(--text-muted)' }}>
                  A 6-digit security code was sent to <strong className="text-violet-400">{email}</strong>
                </p>
              </div>

              <div className="text-left">
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                  OTP Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  className="w-full text-center tracking-[14px] font-mono py-3.5 rounded-xl glass-input text-xl font-black"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full py-3.5 rounded-xl btn-neon text-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Verify & Enter AgeVault
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setIsOtpSent(false); setError(''); setInfoMsg(''); setOtpCode(''); }}
                className="text-xs font-medium transition hover:text-violet-300"
                style={{ color: 'var(--text-muted)' }}
              >
                ← Back to sign in
              </button>
            </form>
          )}

          {/* Demo credentials */}
          <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--border-muted)' }}>
            <div className="rounded-2xl p-3 text-[10px] space-y-2" style={{ background: 'var(--glass-input-bg)', border: '1px solid var(--glass-input-border)' }}>
              <div className="flex items-center gap-1.5 text-violet-400 font-bold uppercase tracking-widest text-[9px]">
                <Info className="w-3 h-3" />
                Demo Accounts
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-2" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-muted)' }}>
                  <span className="block mb-0.5" style={{ color: 'var(--text-muted)' }}>👑 Admin</span>
                  <code className="font-mono font-bold text-violet-300 text-[9px]">mohdnomaantalib@gmail.com</code>
                </div>
                <div className="rounded-xl p-2" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-muted)' }}>
                  <span className="block mb-0.5" style={{ color: 'var(--text-muted)' }}>🎭 Staff</span>
                  <code className="font-mono font-bold text-violet-300 text-[9px]">staff@agevault.com</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

