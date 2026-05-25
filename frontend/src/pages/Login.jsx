import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Info, Mail, User, Phone, CheckCircle, AlertTriangle, Key } from 'lucide-react';

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
    <div className="w-full max-w-4xl">
      <div className="grid md:grid-cols-2 gap-8 items-stretch">
        
        {/* Left Column: Event Advertisement & Rules */}
        {event ? (
          <div className="glass-panel-glow rounded-3xl p-6 md:p-8 flex flex-col justify-between border-indigo-500/25 relative overflow-hidden min-h-[350px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>

            <div className="relative z-10 text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-extrabold rounded-full uppercase tracking-wider mb-6">
                Featured Upcoming Event
              </div>

              <h3 className="text-2xl font-extrabold text-white leading-tight mb-3 font-sans">
                {event.title}
              </h3>
              
              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                {event.description || 'Join us for an exclusive night! Verify your age pass now for seamless, fast-track entry.'}
              </p>

              {/* Event details schedule */}
              <div className="space-y-3 text-xs bg-slate-950/40 p-4 rounded-2xl border border-slate-900/60">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-900/60">
                  <span className="text-slate-500">Venue / Location:</span>
                  <span className="text-white font-semibold">{event.venue}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500">Date & Time:</span>
                  <span className="text-indigo-400 font-bold font-mono">
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

            {/* Registration warning/instruction */}
            <div className="mt-6 pt-4 border-t border-slate-900/80 relative z-10 text-left">
              <div className={`p-4 rounded-xl border flex items-start gap-2.5 leading-relaxed text-xs ${
                isTooEarly 
                  ? 'bg-amber-500/5 border-amber-500/30 text-amber-300' 
                  : 'bg-emerald-500/5 border-emerald-500/30 text-emerald-300'
              }`}>
                <Info className={`w-4.5 h-4.5 flex-shrink-0 mt-0.5 ${isTooEarly ? 'text-amber-400' : 'text-emerald-400'}`} />
                <div>
                  <span className="font-bold block mb-1">Registration Rules:</span>
                  Please do not register more than 3 days in advance of the event.
                  {isTooEarly ? (
                    <span className="block mt-1.5 font-semibold text-[10px] text-amber-500 animate-pulse">
                      Warning: Event is {daysBeforeEvent} days away. Please return and register within 3 days of the event.
                    </span>
                  ) : (
                    <span className="block mt-1.5 font-semibold text-[10px] text-emerald-400">
                      Registration is OPEN! You are within the 3-day window.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel rounded-3xl p-8 flex flex-col justify-center items-center border-slate-800/80 min-h-[350px] text-center">
            <Shield className="w-12 h-12 text-slate-700 mb-4 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-400 font-sans">No Event Scheduled</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-[220px] leading-relaxed">
              There is currently no upcoming event hosted on the platform.
            </p>
          </div>
        )}

        {/* Right Column: Login Card */}
        <div className="glass-panel-glow rounded-3xl p-8 relative overflow-hidden flex flex-col justify-center border-slate-800 text-left">
          
          {/* Toggle Mode Button */}
          {isSupabaseConfigured && (
            <button 
              type="button"
              onClick={() => setUseSimulated(!useSimulated)}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border border-slate-700 bg-slate-800/40 text-slate-400 hover:text-white transition z-20"
            >
              {useSimulated ? (
                <>
                  <ToggleRight className="w-4 h-4 text-indigo-400" />
                  Demo Mode
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-slate-500" />
                  Live (Supabase)
                </>
              )}
            </button>
          )}

          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-3">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white font-sans text-center">
              AgeVault
            </h2>
            <p className="text-xs text-slate-400 mt-1 text-center">
              Secure Magic Link Access System
            </p>
          </div>

          {/* Form AuthMode Toggle Tabs */}
          {!isOtpSent && (
            <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-850 mb-5">
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setError(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition duration-200 ${authMode === 'register' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Register / Sign Up
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition duration-200 ${authMode === 'login' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Sign In / Log In
              </button>
            </div>
          )}

          {error && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl flex items-start gap-2">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {infoMsg && (
            <div className="mb-5 p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs rounded-xl flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <Info className="w-4.5 h-4.5 text-indigo-400 flex-shrink-0" />
                <span>{infoMsg}</span>
              </div>
            </div>
          )}

          {!isOtpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              
              {/* Name (Registration Only) */}
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Full Name <span className="text-indigo-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4.5 h-4.5" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Enter full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-white text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="name@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-white text-sm"
                  />
                </div>
              </div>

              {/* Phone Number (Registration Only) */}
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Mobile Phone Number <span className="text-indigo-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Phone className="w-4.5 h-4.5" />
                    </div>
                    <input
                      type="tel"
                      required
                      placeholder="Enter 10-digit mobile number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-white text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Role Selection (Registration Only) */}
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Select Account Role
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('user')}
                      className={`py-2 rounded-xl border text-[10px] font-bold transition duration-300 ${
                        role === 'user'
                          ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-lg'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      Member
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('club')}
                      className={`py-2 rounded-xl border text-[10px] font-bold transition duration-300 ${
                        role === 'club'
                          ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-lg'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      Club Staff
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className={`py-2 rounded-xl border text-[10px] font-bold transition duration-300 ${
                        role === 'admin'
                          ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-lg'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      Admin
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-semibold text-xs transition-all duration-300 shadow-md shadow-indigo-600/20 flex justify-center items-center gap-1.5"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Verification OTP Code
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2 animate-bounce" />
              <h3 className="text-lg font-bold text-white">Enter Verification Code</h3>
              <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed mb-4">
                We've sent a 6-digit security verification code to <strong>{email}</strong>. Please enter it below to authorize.
              </p>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 text-left">
                  6-Digit OTP Security Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="------"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  className="w-full text-center tracking-[12px] font-mono py-3 rounded-xl glass-input text-white text-lg font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-semibold text-xs transition-all duration-300 shadow-md shadow-indigo-600/20 flex justify-center items-center gap-1.5"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Verify & Access AgeVault
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setIsOtpSent(false); setError(''); setInfoMsg(''); setOtpCode(''); }}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition mt-4 block mx-auto font-medium"
              >
                Back to sign in page
              </button>
            </form>
          )}

          {/* Quick Demo Credentials Footer */}
          <div className="mt-6 pt-5 border-t border-slate-850">
            <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800 flex flex-col gap-2 text-[10px] text-slate-400">
              <div className="flex items-center gap-1 text-indigo-400 font-semibold uppercase tracking-wider text-[9px]">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                Demo Credentials (Simulated OTP Delivery)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950/40 p-1.5 rounded border border-slate-900">
                  <span className="text-slate-500 block">Admin:</span>
                  <code className="text-white font-mono font-semibold">admin@agevault.com</code>
                </div>
                <div className="bg-slate-950/40 p-1.5 rounded border border-slate-900">
                  <span className="text-slate-500 block">Club Staff:</span>
                  <code className="text-white font-mono font-semibold">staff@agevault.com</code>
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
