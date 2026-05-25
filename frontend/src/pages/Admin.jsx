import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, CheckCircle, Clock, AlertTriangle, ShieldCheck, 
  ExternalLink, Check, X, RefreshCw, MessageSquare 
} from 'lucide-react';

const Admin = () => {
  const { token, apiUrl } = useAuth();
  
  // Dashboard stats
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0, rejected: 0 });
  const [pendingQueue, setPendingQueue] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Action state
  const [loading, setLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [generalError, setGeneralError] = useState('');

  // Fetch admin dashboard details
  const fetchDashboardData = async () => {
    setGeneralError('');
    try {
      // 1. Fetch Stats
      const statsRes = await fetch(`${apiUrl}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // 2. Fetch Pending Queue
      const queueRes = await fetch(`${apiUrl}/api/admin/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const queueData = await queueRes.json();
      if (queueData.success) {
        setPendingQueue(queueData.users);
      }
    } catch (err) {
      console.error('Failed to fetch admin dashboard:', err);
      setGeneralError('Failed to load dashboard data. Verify if backend is reachable.');
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [apiUrl, token]);

  const handleAction = async (userId, action) => {
    setLoading(true);
    setActionError('');
    try {
      const response = await fetch(`${apiUrl}/api/admin/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          action,
          reason: action === 'reject' ? rejectReason : ''
        })
      });

      const data = await response.json();
      setLoading(false);

      if (data.success) {
        setSelectedUser(null);
        setRejecting(false);
        setRejectReason('');
        // Refresh details
        fetchDashboardData();
      } else {
        setActionError(data.message || 'Failed to complete moderation action');
      }
    } catch (err) {
      console.error('Moderation action failed:', err);
      setActionError('Network error. Failed to reach verification server.');
      setLoading(false);
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setRejecting(false);
    setRejectReason('');
    setActionError('');
  };

  return (
    <div className="w-full max-w-6xl space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            Admin Moderation Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit user details, check face similarities, and manually verify/reject requests.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="px-3.5 py-2 border border-slate-700 hover:border-slate-500 rounded-lg text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reload Queue
        </button>
      </div>

      {generalError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl text-center">
          {generalError}
        </div>
      )}

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-4 border-slate-800/80">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Total Users</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.total}</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border-slate-800/80">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Verified Pass</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">{stats.verified}</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border-indigo-900/60 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
          <div className="flex justify-between items-center text-indigo-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Pending Audit</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-400">{stats.pending}</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border-slate-800/80">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Rejected Requests</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold text-rose-400">{stats.rejected}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-6 items-start">
        {/* PENDING QUEUE LIST (Columns 2) */}
        <div className="glass-panel rounded-3xl p-5 border-slate-800/80 md:col-span-2 space-y-4 min-h-[300px]">
          <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Pending Queue ({pendingQueue.length})</h2>
          
          {pendingQueue.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs italic">
              Queue is empty. No pending audits.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {pendingQueue.map((user) => (
                <div
                  key={user._id}
                  onClick={() => handleUserSelect(user)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                    selectedUser && selectedUser._id === user._id
                      ? 'bg-indigo-600/10 border-indigo-500'
                      : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-slate-200 text-xs">{user.name || 'Anonymous User'}</span>
                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 px-1.5 py-0.5 rounded-md uppercase font-mono">
                      {user.faceMatchConfidence}% Match
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>{user.phone}</span>
                    <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AUDITING DETAILS WORKSPACE (Columns 3) */}
        <div className="glass-panel rounded-3xl p-6 border-slate-800/80 md:col-span-3 min-h-[400px] flex flex-col justify-center">
          {selectedUser ? (
            <div className="space-y-6">
              <div className="flex justify-between items-start pb-4 border-b border-slate-850">
                <div>
                  <h3 className="font-bold text-white text-base">{selectedUser.name || 'Auditing User'}</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedUser.phone}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-slate-500">Extracted Age:</p>
                  <p className="font-extrabold text-white text-sm">
                    {selectedUser.age ? `${selectedUser.age} Years` : 'N/A'}
                  </p>
                </div>
              </div>

              {actionError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl">
                  {actionError}
                </div>
              )}

              {/* Side by side Image Auditing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Uploaded ID Card</span>
                  <a 
                    href={selectedUser.idCardUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="relative block rounded-xl overflow-hidden bg-slate-950 border border-slate-850 hover:border-indigo-500 transition group"
                  >
                    <img 
                      src={selectedUser.idCardUrl} 
                      alt="ID Card Document" 
                      className="w-full h-40 object-contain p-1"
                    />
                    <div className="absolute inset-0 bg-dark-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                      <ExternalLink className="w-5 h-5 text-white" />
                    </div>
                  </a>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Captured Selfie</span>
                  <a 
                    href={selectedUser.selfieUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="relative block rounded-xl overflow-hidden bg-slate-950 border border-slate-850 hover:border-indigo-500 transition group"
                  >
                    <img 
                      src={selectedUser.selfieUrl} 
                      alt="Captured Selfie" 
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-dark-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                      <ExternalLink className="w-5 h-5 text-white" />
                    </div>
                  </a>
                </div>
              </div>

              {/* Verification Details Table */}
              <div className="bg-slate-950/45 border border-slate-850 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">OCR Extracted DOB:</span>
                  <span className="text-white font-semibold font-mono">
                    {selectedUser.dob ? new Date(selectedUser.dob).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">AI face likeness match:</span>
                  <span className={`font-bold ${selectedUser.faceMatchConfidence >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {selectedUser.faceMatchConfidence}% similarity
                  </span>
                </div>
              </div>

              {/* REJECTION REASON DIALOGUE */}
              {rejecting ? (
                <div className="space-y-3 p-4 bg-slate-950/50 rounded-2xl border border-slate-850">
                  <label className="block text-xs font-bold text-slate-400 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                    Reason for Rejection
                  </label>
                  <textarea
                    placeholder="Enter reason e.g., 'ID card was blurry' or 'Face match score is too low'."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    disabled={loading}
                    rows={2}
                    className="w-full p-2.5 text-xs rounded-xl glass-input text-white focus:outline-none"
                  />
                  <div className="flex justify-end gap-2 text-xs">
                    <button
                      onClick={() => { setRejecting(false); setRejectReason(''); }}
                      disabled={loading}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAction(selectedUser._id, 'reject')}
                      disabled={loading || !rejectReason.trim()}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition font-semibold"
                    >
                      Submit Rejection
                    </button>
                  </div>
                </div>
              ) : (
                /* ACTION SHEET BUTTONS */
                <div className="flex gap-3">
                  <button
                    onClick={() => setRejecting(true)}
                    disabled={loading}
                    className="flex-1 py-3 bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/20 text-rose-400 hover:text-rose-300 font-bold text-xs rounded-xl transition duration-200 flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    Reject Submission
                  </button>

                  <button
                    onClick={() => handleAction(selectedUser._id, 'approve')}
                    disabled={loading}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/10 transition duration-200 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Approve Verification
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 space-y-3">
              <Users className="w-12 h-12 mx-auto text-slate-700" />
              <p className="text-xs">
                Select a user request from the pending queue list on the left to begin audit review.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
