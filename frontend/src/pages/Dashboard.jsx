import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resolveImageUrl } from '../utils/image';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ShieldCheck, ShieldAlert, Clock, AlertOctagon, User, Phone, 
  Calendar, RotateCcw, Award, CheckCircle2, ChevronRight 
} from 'lucide-react';

const Dashboard = () => {
  const { user, token, refreshUser, apiUrl } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState(null);

  // Fetch event details on mount
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/admin/event`);
        const data = await response.json();
        if (data.success) {
          setEvent(data.event);
        }
      } catch (err) {
        console.error('Error fetching event on dashboard:', err);
      }
    };
    fetchEvent();
  }, [apiUrl]);

  // Poll status occasionally if user is pending and has uploaded documents
  useEffect(() => {
    let interval;
    if (user && user.status === 'pending' && user.idCardUrl) {
      interval = setInterval(() => {
        refreshUser();
      }, 5000); // Poll every 5s to show immediate manual verification approvals
    }
    return () => clearInterval(interval);
  }, [user, refreshUser]);

  const handleRetry = () => {
    navigate('/verify');
  };

  if (!user) return null;

  const formattedDate = user.dob 
    ? new Date(user.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Not provided';

  return (
    <div className="w-full max-w-lg">
      {/* Welcome Banner */}
      <div className="mb-6 text-center">
        <h1 className="text-2.5xl font-bold tracking-tight text-white font-sans">
          Welcome to <span className="text-gradient font-cursive text-3.5xl">AgeVault</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Your digital age pass for fast and private club verification.
        </p>
      </div>

      {/* Verification Status Cards */}

      {/* Case 1: USER IS VERIFIED */}
      {user.status === 'verified' && (
        <div className="space-y-6">
          <div className="glass-panel-glow vip-glitter-card rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col items-center">
            <div className="absolute inset-0 glitter-bg pointer-events-none opacity-35 z-0" />
            {/* Glowing top badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold rounded-full uppercase tracking-wider mb-2 z-10">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verified Age Pass
            </div>
            <div className="font-cursive text-3.5xl text-gradient mb-6 z-10">VIP Access Pass</div>

            {/* Secure QR Code Container */}
            <div className="bg-white p-4.5 rounded-2xl shadow-xl shadow-amber-500/10 mb-5 border-2 border-amber-500/30 relative flex flex-col items-center justify-center min-w-[210px] min-h-[210px]">
              {user.qrScanned ? (
                <div className="w-[180px] h-[180px] flex flex-col items-center justify-center text-center p-2">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/25 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <span className="text-slate-900 font-extrabold text-xs uppercase tracking-wider">Pass Claimed</span>
                  <span className="text-slate-500 font-bold text-[10px] uppercase mt-1">Checked In</span>
                  {user.qrScannedAt && (
                    <span className="text-slate-400 font-mono text-[9px] mt-1.5">
                      {new Date(user.qrScannedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              ) : user.qrToken ? (
                <>
                  <QRCodeSVG
                    value={user.qrToken}
                    size={180}
                    level="H"
                    includeMargin={true}
                    className="rounded-lg"
                  />
                  {/* Inner overlay laser animation */}
                  <div className="absolute top-4 left-4 right-4 h-0.5 bg-amber-500 shadow-[0_0_10px_2px_rgba(217,160,91,0.5)] animate-pulse pointer-events-none"></div>
                </>
              ) : (
                <div className="w-[180px] h-[180px] flex items-center justify-center text-xs text-slate-400 font-medium">
                  Generating QR...
                </div>
              )}
            </div>

            {/* Access PIN Code Display */}
            {user.qrPin && !user.qrScanned && (
              <div className="mb-6 px-5 py-2 border border-amber-500/20 bg-black/40 rounded-2xl flex flex-col items-center shadow-inner">
                <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">Access PIN Code</span>
                <span className="text-2xl font-black font-mono text-gradient tracking-[4px] mt-0.5">
                  {user.qrPin.slice(0, 4)} - {user.qrPin.slice(4)}
                </span>
                <span className="text-[8px] text-slate-500 mt-1 uppercase font-semibold">Valid for 3 days or until scanned</span>
              </div>
            )}

            {/* User Selfie Badge */}
            {user.selfieUrl && (
              <div className="mb-4">
                <img
                  src={resolveImageUrl(user.selfieUrl, apiUrl)}
                  alt="Verified Profile Avatar"
                  className="w-20 h-20 object-cover rounded-2xl border-2 border-emerald-500/60 shadow-lg shadow-emerald-500/10"
                />
              </div>
            )}

            {/* User Details */}
            <div className="w-full text-center space-y-1 mb-5">
              <h2 className="text-xl font-bold text-white tracking-wide">{user.name}</h2>
              <p className="text-xs text-slate-400 font-mono">
                {user.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1 ***** $3')}
              </p>
              {user.email && <p className="text-[10px] text-slate-500">{user.email}</p>}
            </div>

            {/* Active Event Pass Details */}
            {event && (
              <div className="mb-5 w-full bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-3.5 flex flex-col items-center">
                <span className="text-[9px] text-indigo-400 uppercase tracking-wider font-extrabold">Active Event Ticket</span>
                <span className="text-white font-extrabold text-sm mt-0.5">{event.title}</span>
                <span className="text-[10px] text-slate-300 font-mono mt-1 font-semibold">{event.venue}</span>
                <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                  {new Date(event.dateTime).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}

            {/* Quick Details Grid */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/40 rounded-2xl p-4 border border-slate-800/80 mb-6 text-xs text-slate-300">
              <div className="flex flex-col gap-1 sm:border-r border-slate-800/60 sm:pr-1.5 pb-2 sm:pb-0 border-b sm:border-b-0 text-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Extracted Age</span>
                <span className="text-white font-extrabold text-sm">{user.age ? `${user.age} Yrs` : 'N/A'}</span>
              </div>
              <div className="flex flex-col gap-1 sm:border-r border-slate-800/60 sm:px-1.5 pb-2 sm:pb-0 border-b sm:border-b-0 text-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Date of Birth</span>
                <span className="text-white font-semibold font-mono text-[10px]">{formattedDate}</span>
              </div>
              <div className="flex flex-col gap-1 sm:pl-1.5 text-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Face Match Score</span>
                <span className="text-emerald-400 font-extrabold text-sm">{user.faceMatchConfidence || 0}%</span>
              </div>
            </div>

            {/* Help guidelines */}
            <p className="text-[10px] text-slate-500 text-center leading-relaxed max-w-xs">
              Present this secure, signed QR code or the 8-digit Access PIN to the club gate staff. They will scan or verify it to grant entry.
            </p>

            <div className="mt-5 pt-4 border-t border-slate-800/60 w-full text-center space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-extrabold block">
                ❓ Access Support
              </span>
              <p className="text-[10px] text-slate-400">
                Issues with verification? Contact our admin at: <a href="mailto:admin@agevault.com" className="text-amber-500 font-bold hover:underline">admin@agevault.com</a>
              </p>
            </div>
          </div>

          {/* Quick link for scanning if admin/club */}
          {(user.role === 'club' || user.role === 'admin') && (
            <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-indigo-400 border border-slate-700/50">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Staff Privileges Active</h4>
                  <p className="text-[10px] text-slate-400">Launch the scanner to verify club-goers.</p>
                </div>
              </div>
              <Link 
                to="/scanner" 
                className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                Scan Codes
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Case 2: USER IS PENDING MODERATION */}
      {user.status === 'pending' && user.idCardUrl && (
        <div className="glass-panel rounded-3xl p-6 md:p-8 border-slate-800/80 flex flex-col items-center">
          <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl flex items-center justify-center mb-5 animate-pulse">
            <Clock className="w-7 h-7 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Verification Pending</h2>
          <p className="text-xs text-slate-400 text-center mt-2 max-w-xs leading-relaxed">
            Your verification request has been received. Our automated AI is analyzing your documents, or a human moderator is reviewing them.
          </p>

          <div className="w-full bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4 mt-6 text-xs text-slate-300 space-y-3.5">
            <div className="flex justify-between items-center py-1 border-b border-slate-900/60">
              <span className="text-slate-500">Submitted Name:</span>
              <span className="text-white font-medium">{user.name || 'Processing...'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-900/60">
              <span className="text-slate-500">Selfie Similarity Match:</span>
              <span className="text-indigo-400 font-bold">{user.faceMatchConfidence}%</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Current Queue Status:</span>
              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-extrabold uppercase rounded-full">
                Reviewing
              </span>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2 text-[10px] text-slate-500 font-medium animate-pulse">
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping"></div>
            Polling verification status every 5 seconds...
          </div>
        </div>
      )}

      {/* Case 3: USER IS REJECTED / NEEDS INITIAL SUBMISSION */}
      {user.status === 'rejected' && (
        <div className="glass-panel rounded-3xl p-6 md:p-8 border-slate-800/80 flex flex-col items-center">
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-red-500/5">
            <AlertOctagon className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white">Verification Failed</h2>
          
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl w-full text-center">
            <p className="font-semibold text-red-300">Reason for rejection:</p>
            <p className="mt-1 text-slate-300">{user.rejectionReason || 'The uploaded document image was blurry or facial structure did not match.'}</p>
          </div>

          <p className="text-xs text-slate-500 text-center mt-4 max-w-xs leading-relaxed">
            Please re-upload your ID card and take a clear, well-lit live selfie.
          </p>

          <button
            onClick={handleRetry}
            className="mt-6 w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition duration-300 flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/15"
          >
            <RotateCcw className="w-4 h-4" />
            Retry Verification Pipeline
          </button>
        </div>
      )}

      {/* Case 4: NO ATTEMPT SUBMITTED YET */}
      {user.status !== 'verified' && user.status !== 'rejected' && (!user.idCardUrl) && (
        <div className="glass-panel vip-glitter-card rounded-3xl p-6 md:p-8 flex flex-col items-center">
          <div className="absolute inset-0 glitter-bg pointer-events-none opacity-20 z-0" />
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-5 text-white shadow-lg shadow-indigo-600/20 z-10">
            <Award className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white z-10">Verify Your Identity</h2>
          <p className="text-xs text-slate-400 text-center mt-2 max-w-xs leading-relaxed">
            You need to complete a quick identity check to generate your secure Age Pass.
          </p>

          <button
            onClick={() => navigate('/verify')}
            className="mt-6 w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition duration-300 flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/15"
          >
            Start Verification Process
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
