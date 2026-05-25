import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, CheckCircle, Clock, AlertTriangle, ShieldCheck, 
  ExternalLink, Check, X, RefreshCw, MessageSquare, Download,
  Trash2, Edit, Plus, Smartphone, Mail, Calendar, Eye, Shield
} from 'lucide-react';

const Admin = () => {
  const { token, apiUrl } = useAuth();
  
  // Tabs: 'audits', 'users', 'database'
  const [activeTab, setActiveTab] = useState('audits');
  
  // Dashboard stats
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0, rejected: 0 });
  const [pendingQueue, setPendingQueue] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Action states
  const [loading, setLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [generalError, setGeneralError] = useState('');
  
  // Safeguards for Database Deletion
  const [hasExported, setHasExported] = useState(false);
  
  // CRUD states
  const [showUserModal, setShowUserModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [crudUser, setCrudUser] = useState({
    id: '',
    phone: '',
    name: '',
    email: '',
    role: 'user',
    status: 'pending',
    dob: '',
    age: ''
  });
  const [crudError, setCrudError] = useState('');

  // Fetch admin stats & queues
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

      // 3. Fetch All Users for CRUD directory
      const usersRes = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const usersData = await usersRes.json();
      if (usersData.success) {
        setAllUsers(usersData.users);
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

  // CSV Export utility
  const handleExportData = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!data.success) {
        alert('Failed to retrieve user data for export.');
        return;
      }

      const usersToExport = data.users;
      if (usersToExport.length === 0) {
        alert('No user verification logs found to export.');
        return;
      }

      const headers = ['Phone', 'Full Name', 'Email', 'DOB', 'Calculated Age', 'Verification Status', 'Face Match %', 'Registration Date'];
      const csvRows = [
        headers.join(','), // header row
        ...usersToExport.map(user => [
          `"${user.phone}"`,
          `"${user.name || ''}"`,
          `"${user.email || ''}"`,
          `"${user.dob ? new Date(user.dob).toLocaleDateString() : ''}"`,
          user.age || '',
          `"${user.status}"`,
          user.faceMatchConfidence || 0,
          `"${new Date(user.createdAt).toLocaleDateString()}"`
        ].join(','))
      ];

      const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
      const encodedUri = encodeURI(csvContent);
      const downloadLink = document.createElement('a');
      downloadLink.setAttribute('href', encodedUri);
      downloadLink.setAttribute('download', `agevault_export_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setHasExported(true); // Unlocks the database clear button!
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to download CSV export. Try again.');
    }
  };

  // Clear Daily History
  const handleClearHistory = async () => {
    if (!hasExported) return;
    
    const confirmClear = window.confirm(
      'WARNING: This will permanently wipe all standard user profiles from the database to optimize space. Admin and Club Staff records will remain intact. Make sure you have downloaded the CSV export file. Proceed?'
    );

    if (!confirmClear) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/clear-history`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setLoading(false);
      
      if (data.success) {
        setHasExported(false); // Relock the button
        alert(data.message);
        fetchDashboardData();
      } else {
        alert('Clear operation failed: ' + data.message);
      }
    } catch (err) {
      console.error('Failed to wipe user database:', err);
      alert('Network error. Failed to wipe database.');
      setLoading(false);
    }
  };

  // CRUD handlers
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setCrudUser({
      id: '',
      phone: '',
      name: '',
      email: '',
      role: 'user',
      status: 'pending',
      dob: '',
      age: ''
    });
    setCrudError('');
    setShowUserModal(true);
  };

  const handleOpenEditModal = (user) => {
    setModalMode('edit');
    setCrudUser({
      id: user._id,
      phone: user.phone,
      name: user.name || '',
      email: user.email || '',
      role: user.role,
      status: user.status,
      dob: user.dob ? new Date(user.dob).toISOString().slice(0, 10) : '',
      age: user.age || ''
    });
    setCrudError('');
    setShowUserModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setCrudError('');

    if (!crudUser.phone) {
      setCrudError('Phone number is required');
      return;
    }

    const method = modalMode === 'create' ? 'POST' : 'PUT';
    const endpoint = modalMode === 'create' 
      ? `${apiUrl}/api/admin/users` 
      : `${apiUrl}/api/admin/users/${crudUser.id}`;

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(crudUser)
      });
      
      const data = await response.json();
      if (data.success) {
        setShowUserModal(false);
        fetchDashboardData();
      } else {
        setCrudError(data.message || 'Operation failed');
      }
    } catch (err) {
      setCrudError('Failed to contact server');
    }
  };

  const handleDeleteUser = async (userId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this user profile?');
    if (!confirmDelete) return;

    try {
      const response = await fetch(`${apiUrl}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        fetchDashboardData();
      } else {
        alert(data.message || 'Deletion failed');
      }
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  return (
    <div className="w-full max-w-6xl space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            Admin System Control
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage verifications, browse users directory, and handle daily database maintenance.
          </p>
        </div>
        
        {/* Responsive Tab Selector */}
        <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 self-start sm:self-center">
          <button
            onClick={() => setActiveTab('audits')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition duration-200 ${activeTab === 'audits' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Audit Queue
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition duration-200 ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            User CRUD
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition duration-200 ${activeTab === 'database' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Database Operations
          </button>
        </div>
      </div>

      {generalError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl text-center">
          {generalError}
        </div>
      )}

      {/* STATS CARDS */}
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

      {/* TAB CONTENTS */}

      {/* TAB 1: AUDIT QUEUE */}
      {activeTab === 'audits' && (
        <div className="grid md:grid-cols-5 gap-6 items-start">
          {/* Audit Queue List */}
          <div className="glass-panel rounded-3xl p-5 border-slate-800/80 md:col-span-2 space-y-4 min-h-[300px]">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Pending Queue ({pendingQueue.length})</h2>
              <button onClick={fetchDashboardData} className="text-slate-500 hover:text-white transition">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            
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

          {/* Audit Workspace */}
          <div className="glass-panel rounded-3xl p-6 border-slate-800/80 md:col-span-3 min-h-[400px] flex flex-col justify-center">
            {selectedUser ? (
              <div className="space-y-6">
                <div className="flex justify-between items-start pb-4 border-b border-slate-850">
                  <div>
                    <h3 className="font-bold text-white text-base">{selectedUser.name || 'Auditing User'}</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedUser.phone}</p>
                    {selectedUser.email && <p className="text-[10px] text-slate-500 mt-0.5">{selectedUser.email}</p>}
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

                {/* Images auditing side-by-side */}
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

                {/* Audit specifications */}
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

                {/* Reject actions */}
                {rejecting ? (
                  <div className="space-y-3 p-4 bg-slate-950/50 rounded-2xl border border-slate-850 animate-fade-in">
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
                <Users className="w-12 h-12 mx-auto text-slate-700 animate-pulse" />
                <p className="text-xs">
                  Select a user request from the pending queue list on the left to begin audit review.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USER CRUD DIRECTORY */}
      {activeTab === 'users' && (
        <div className="glass-panel rounded-3xl p-6 border-slate-800/80 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">User Directory CRUD</h2>
            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition"
            >
              <Plus className="w-4 h-4" />
              Add User Manually
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                  <th className="py-3 px-2">Phone</th>
                  <th className="py-3 px-2">Name</th>
                  <th className="py-3 px-2">Email</th>
                  <th className="py-3 px-2">Role</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2">Age (DOB)</th>
                  <th className="py-3 px-2">Similarity</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {allUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-slate-900/20 text-slate-300">
                    <td className="py-3.5 px-2 font-mono text-slate-200">{user.phone}</td>
                    <td className="py-3.5 px-2 font-medium">{user.name || <span className="text-slate-600 italic">None</span>}</td>
                    <td className="py-3.5 px-2 text-slate-400">{user.email || <span className="text-slate-650 italic">None</span>}</td>
                    <td className="py-3.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        user.role === 'admin' 
                          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' 
                          : user.role === 'club' 
                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                            : 'bg-slate-800 text-slate-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        user.status === 'verified'
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          : user.status === 'rejected'
                            ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                            : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 animate-pulse'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-2">
                      {user.age ? `${user.age} Y` : '-'} 
                      <span className="text-slate-500 font-mono text-[10px] ml-1">
                        ({user.dob ? new Date(user.dob).toLocaleDateString() : 'N/A'})
                      </span>
                    </td>
                    <td className="py-3.5 px-2 font-mono text-[10px]">
                      {user.faceMatchConfidence ? `${user.faceMatchConfidence}%` : '-'}
                    </td>
                    <td className="py-3.5 px-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          className="p-1.5 bg-slate-800 hover:bg-indigo-500/10 hover:text-indigo-400 rounded-md text-slate-400 transition"
                          title="Edit User"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user._id)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 rounded-md text-slate-400 transition"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DATABASE OPERATIONS */}
      {activeTab === 'database' && (
        <div className="grid md:grid-cols-2 gap-6 items-start">
          
          {/* Safeguarded Clears Card */}
          <div className="glass-panel rounded-3xl p-6 border-slate-800/80 space-y-6">
            <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-500" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Database Maintenance</h2>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              To keep the application running inside free MongoDB limits, you must periodically clear the daily history files of users.
            </p>

            <div className="p-4.5 bg-amber-500/5 border border-amber-500/20 text-amber-200 text-xs rounded-xl flex items-start gap-2.5 leading-relaxed">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <span className="font-bold text-amber-400 block mb-0.5">Safeguarded Data Protection Rule:</span>
                The **Clear History** button is strictly locked. You are only allowed to wipe verification records once you have successfully exported today's log entries to a CSV spreadsheet file.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleExportData}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition duration-200 flex items-center justify-center gap-1.5 shadow"
              >
                <Download className="w-4 h-4" />
                1. Download CSV Export
              </button>

              <button
                onClick={handleClearHistory}
                disabled={!hasExported || loading}
                className={`flex-1 py-3 px-4 font-bold text-xs rounded-xl transition duration-200 flex items-center justify-center gap-1.5 ${
                  hasExported
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/10 cursor-pointer'
                    : 'bg-slate-800 text-slate-600 border border-slate-850 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                2. Clear User Database
              </button>
            </div>

            {hasExported && (
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 justify-center animate-pulse">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                Spreadsheet downloaded! Delete action is now unlocked.
              </div>
            )}
          </div>

          {/* Database Specs Card */}
          <div className="glass-panel rounded-3xl p-6 border-slate-800/80 space-y-4">
            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Storage Utilisation</h2>
            <div className="space-y-3.5 text-xs text-slate-300 pt-1">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-850">
                <span className="text-slate-500">Database Engine:</span>
                <span className="text-white font-semibold">MongoDB Atlas Free Tier</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-850">
                <span className="text-slate-500">Estimated capacity:</span>
                <span className="text-white font-semibold">~10,000 Verified Profiles</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-850">
                <span className="text-slate-500">Daily verification target:</span>
                <span className="text-indigo-400 font-semibold font-mono">400 - 500 users</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
                Wiping users data daily resets the collection count, avoiding memory threshold warnings while archiving records securely offsite in Excel-compatible formats.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* CRUD MODAL FOR CREATE / EDIT */}
      {showUserModal && (
        <div className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-glow rounded-3xl p-6 max-w-md w-full animate-scale-up space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {modalMode === 'create' ? 'Create User Profile' : 'Edit User Profile'}
              </h3>
              <button 
                onClick={() => setShowUserModal(false)}
                className="text-slate-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {crudError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl">
                {crudError}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91..."
                    value={crudUser.phone}
                    onChange={(e) => setCrudUser({ ...crudUser, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={crudUser.name}
                    onChange={(e) => setCrudUser({ ...crudUser, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@email.com"
                  value={crudUser.email}
                  onChange={(e) => setCrudUser({ ...crudUser, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={crudUser.dob}
                    onChange={(e) => setCrudUser({ ...crudUser, dob: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Calculated Age
                  </label>
                  <input
                    type="number"
                    placeholder="Age"
                    value={crudUser.age}
                    onChange={(e) => setCrudUser({ ...crudUser, age: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    System Role
                  </label>
                  <select
                    value={crudUser.role}
                    onChange={(e) => setCrudUser({ ...crudUser, role: e.target.value })}
                    className="w-full px-2 py-2 text-xs rounded-lg glass-input text-white focus:outline-none bg-dark-900"
                  >
                    <option value="user">Standard User</option>
                    <option value="club">Club Gate Staff</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={crudUser.status}
                    onChange={(e) => setCrudUser({ ...crudUser, status: e.target.value })}
                    className="w-full px-2 py-2 text-xs rounded-lg glass-input text-white focus:outline-none bg-dark-900"
                  >
                    <option value="pending">Pending Audit</option>
                    <option value="verified">Verified Pass</option>
                    <option value="rejected">Rejected Pass</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 text-xs pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition font-semibold"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Admin;
