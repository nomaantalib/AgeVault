import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth, isFirebaseConfigured } from '../utils/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { Shield, Phone, Key, Smartphone, Info, ToggleLeft, ToggleRight, Mail, User } from 'lucide-react';

const Login = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [useSimulated, setUseSimulated] = useState(!isFirebaseConfigured);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);

  const { login, user, apiUrl } = useAuth();
  const navigate = useNavigate();
  const recaptchaVerifierRef = useRef(null);
  const otpInputsRef = useRef([]);
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
          
          // Check if current date is more than 3 days prior to the event
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

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Focus helper for OTP inputs
  useEffect(() => {
    if (isOtpSent && otpInputsRef.current[0]) {
      otpInputsRef.current[0].focus();
    }
  }, [isOtpSent]);

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMsg('');

    // Format phone with country code (defaults to +91 if not specified)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    if (useSimulated) {
      // Simulated OTP Send
      setTimeout(() => {
        setIsOtpSent(true);
        setCountdown(30);
        setLoading(false);
        setInfoMsg(`DEMO MODE: OTP sent to ${formattedPhone}. Enter 123456 to verify.`);
      }, 1000);
    } else {
      // Real Firebase OTP Send
      try {
        if (!recaptchaVerifierRef.current) {
          recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => {
              console.log('reCAPTCHA solved');
            }
          });
        }

        const appVerifier = recaptchaVerifierRef.current;
        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
        setConfirmationResult(confirmation);
        setIsOtpSent(true);
        setCountdown(60);
        setLoading(false);
        setInfoMsg(`OTP successfully sent to ${formattedPhone}`);
      } catch (err) {
        console.error('Firebase Auth SMS Send Error:', err);
        setError(err.message || 'Failed to send SMS OTP. Falling back to Simulated OTP mode might help if keys are invalid.');
        setLoading(false);
        // Fallback option in case firebase initialization fails
        if (!isFirebaseConfigured) {
          setUseSimulated(true);
        }
      }
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputsRef.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    // Backspace handling
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1].focus();
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    setError('');

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    if (useSimulated) {
      // Simulated OTP Verify
      setTimeout(async () => {
        if (otpCode === '123456' || formattedPhone === '+919999999999' || formattedPhone === '+918888888888') {
          const simulatedToken = `simulated-token-${formattedPhone}`;
          const res = await login(simulatedToken, email, name);
          setLoading(false);
          if (res.success) {
            navigate('/');
          } else {
            setError(res.message);
          }
        } else {
          setError('Invalid OTP code. Please enter 123456.');
          setLoading(false);
        }
      }, 1000);
    } else {
      // Real Firebase OTP Verify
      try {
        const result = await confirmationResult.confirm(otpCode);
        const idToken = await result.user.getIdToken();
        const res = await login(idToken, email, name);
        setLoading(false);
        if (res.success) {
          navigate('/');
        } else {
          setError(res.message);
        }
      } catch (err) {
        console.error('Firebase Code Verification Error:', err);
        setError('Invalid OTP code. Please try again.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="w-full max-w-4xl">
      {/* Firebase hidden reCAPTCHA */}
      <div id="recaptcha-container"></div>

      <div className="grid md:grid-cols-2 gap-8 items-stretch">
        
        {/* Left Column: Event Advertisement & Rules */}
        {event ? (
          <div className="glass-panel-glow rounded-3xl p-6 md:p-8 flex flex-col justify-between border-indigo-500/25 relative overflow-hidden min-h-[350px]">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>

            <div className="relative z-10">
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
            <div className="mt-6 pt-4 border-t border-slate-900/80 relative z-10">
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
        <div className="glass-panel-glow rounded-3xl p-8 relative overflow-hidden flex flex-col justify-center border-slate-800">
          {/* Toggle Mode Button */}
          {isFirebaseConfigured && (
            <button 
              type="button"
              onClick={() => setUseSimulated(!useSimulated)}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border border-slate-700 bg-slate-800/40 text-slate-400 hover:text-white transition z-20"
            >
              {useSimulated ? (
                <>
                  <ToggleRight className="w-4 h-4 text-indigo-400" />
                  Demo Mode Active
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-slate-500" />
                  Live Mode (Firebase)
                </>
              )}
            </button>
          )}

          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-4 animate-pulse">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-sans text-center">
              AgeVault
            </h2>
            <p className="text-sm text-slate-400 mt-2 text-center">
              Club entry verification system
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl flex items-start gap-2">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {infoMsg && (
            <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs rounded-xl flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>{infoMsg}</span>
            </div>
          )}

          {isTooEarly && !isOtpSent && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs rounded-xl flex items-start gap-2">
              <Info className="w-4.5 h-4.5 text-amber-400 flex-shrink-0" />
              <span>
                <strong>Notice:</strong> You can register, but please remember the club's policy to register only within 3 days of the event.
              </span>
            </div>
          )}

          {!isOtpSent ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Full Name (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl glass-input text-white text-base tracking-wide"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Email Address (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl glass-input text-white text-base tracking-wide"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Mobile Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    disabled={loading}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl glass-input text-white text-base tracking-wide"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Include country code (e.g. +91) if outside India. Defaults to +91.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-semibold text-sm transition-all duration-300 shadow-md shadow-indigo-600/20 flex justify-center items-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    Send Verification SMS
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 text-center">
                  Enter 6-Digit OTP Code
                </label>
                
                <div className="flex justify-between gap-2 max-w-xs mx-auto">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      maxLength={1}
                      value={digit}
                      ref={(el) => (otpInputsRef.current[idx] = el)}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      disabled={loading}
                      className="w-12 h-14 text-center rounded-xl glass-input text-xl font-bold text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-semibold text-sm transition-all duration-300 shadow-md shadow-indigo-600/20 flex justify-center items-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Verify OTP & Log In
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  disabled={countdown > 0 || loading}
                  onClick={handlePhoneSubmit}
                  className="text-xs text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 transition"
                >
                  {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP Code'}
                </button>
              </div>
            </form>
          )}

          {/* Demo Account Reference Card */}
          <div className="mt-8 pt-6 border-t border-slate-850">
            <div className="bg-slate-900/50 rounded-xl p-3.5 border border-slate-800 flex flex-col gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 text-indigo-400 font-semibold uppercase tracking-wider text-[10px]">
                <Info className="w-3.5 h-3.5" />
                Demo Accounts (Use simulated OTP 123456)
              </div>
              <div className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded border border-slate-900">
                <span>Admin Profile:</span>
                <code className="text-white font-mono font-bold">+919999999999</code>
              </div>
              <div className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded border border-slate-900">
                <span>Club Staff Scanner:</span>
                <code className="text-white font-mono font-bold">+918888888888</code>
              </div>
              <div className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded border border-slate-900">
                <span>Standard User:</span>
                <code className="text-white font-mono font-bold">+919000000000</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
