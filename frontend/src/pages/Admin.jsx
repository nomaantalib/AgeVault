import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, CheckCircle, Clock, AlertTriangle, ShieldCheck, 
  ExternalLink, Check, X, RefreshCw, MessageSquare, Download,
  Trash2, Edit, Plus, Smartphone, Mail, Calendar, Eye, Shield
} from 'lucide-react';

const DEFAULT_CLUBS = ['The Palace Lounge', 'Hype Nightclub', 'Mirage Club & Garden', 'Decibel Arena', 'Vibe Superclub'];

const Admin = () => {
  const { token, apiUrl } = useAuth();
  
  // Tabs: 'audits', 'users', 'event', 'database', 'clubs'
  const [activeTab, setActiveTab] = useState('audits');
  
  // Multi-club tenancy states
  const [selectedClub, setSelectedClub] = useState('All Clubs');
  const [userClub, setUserClub] = useState('The Palace Lounge');
  const [eventClub, setEventClub] = useState('The Palace Lounge');
  
  // Dynamic venue states
  const [clubs, setClubs] = useState([]);
  const activeClubs = clubs.length > 0 ? clubs.map((c) => c.name) : DEFAULT_CLUBS;

  // Sync default club options when clubs load
  useEffect(() => {
    if (clubs.length > 0) {
      const firstClub = clubs[0].name;
      setUserClub(firstClub);
      setEventClub(firstClub);
      setCrudUser(prev => ({ ...prev, club: firstClub }));
    }
  }, [clubs]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [showClubModal, setShowClubModal] = useState(false);
  const [clubModalMode, setClubModalMode] = useState('create'); // 'create' or 'edit'
  const [clubName, setClubName] = useState('');
  const [editingClubId, setEditingClubId] = useState('');
  const [clubError, setClubError] = useState('');
  const [clubSuccess, setClubSuccess] = useState('');

  // Admin destructive action OTP verification states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [otpAction, setOtpAction] = useState(''); // 'clear-history' or 'delete-club'
  const [otpTargetId, setOtpTargetId] = useState('');
  const [adminOtpCode, setAdminOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

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

  // Event scheduling states
  const [activeEvent, setActiveEvent] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDateTime, setEventDateTime] = useState('');
  const [eventVenue, setEventVenue] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState('');
  const [eventSuccess, setEventSuccess] = useState('');
  
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
    age: '',
    club: 'The Palace Lounge'
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

      // 4. Fetch Active Event details
      const eventRes = await fetch(`${apiUrl}/api/admin/event`);
      const eventData = await eventRes.json();
      if (eventData.success && eventData.event) {
        setActiveEvent(eventData.event);
        setEventTitle(eventData.event.title);
        setEventVenue(eventData.event.venue);
        setEventDescription(eventData.event.description || '');
        
        // Format date to local string suitable for datetime-local input
        const dt = new Date(eventData.event.dateTime);
        const formattedDt = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setEventDateTime(formattedDt);
      } else {
        setActiveEvent(null);
        setEventTitle('');
        setEventVenue('');
        setEventDescription('');
        setEventDateTime('');
      }

      // 5. Fetch all events list (history)
      const allEventsRes = await fetch(`${apiUrl}/api/admin/events`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allEventsData = await allEventsRes.json();
      if (allEventsData.success) {
        setAllEvents(allEventsData.events);
      }

      // 6. Fetch dynamic clubs
      const clubsRes = await fetch(`${apiUrl}/api/admin/clubs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const clubsData = await clubsRes.json();
      if (clubsData.success) {
        setClubs(clubsData.clubs);
      }
    } catch (err) {
      console.error('Failed to fetch admin dashboard:', err);
      setGeneralError('Failed to load dashboard data. Verify if backend is reachable.');
    }
  };

  const handleScheduleEvent = async (e) => {
    e.preventDefault();
    setEventLoading(true);
    setEventError('');
    setEventSuccess('');

    try {
      const response = await fetch(`${apiUrl}/api/admin/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: eventTitle,
          dateTime: eventDateTime,
          venue: eventVenue,
          description: eventDescription,
          club: eventClub
        })
      });

      const data = await response.json();
      setEventLoading(false);

      if (data.success) {
        setEventSuccess(data.message || 'Event scheduled successfully!');
        setActiveEvent(data.event);
        fetchDashboardData();
      } else {
        setEventError(data.message || 'Failed to schedule event.');
      }
    } catch (err) {
      console.error('Error scheduling event:', err);
      setEventError('Network error. Failed to reach verification server.');
      setEventLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    const confirmDelete = window.confirm('Are you sure you want to permanently delete this event?');
    if (!confirmDelete) return;

    try {
      const response = await fetch(`${apiUrl}/api/admin/event/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        alert('Event deleted successfully.');
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to delete event.');
      }
    } catch (err) {
      console.error('Delete event error:', err);
      alert('Failed to delete event due to network error.');
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const filteredPendingQueue = selectedClub === 'All Clubs' 
    ? pendingQueue 
    : pendingQueue.filter(u => u.club === selectedClub);

  const filteredAllUsers = selectedClub === 'All Clubs' 
    ? allUsers 
    : allUsers.filter(u => u.club === selectedClub);

  const filteredAllEvents = selectedClub === 'All Clubs' 
    ? allEvents 
    : allEvents.filter(e => e.club === selectedClub);

  // Dynamic stats calculation for the selected club!
  const clubUsers = selectedClub === 'All Clubs' 
    ? allUsers.filter(u => u.role === 'user') 
    : allUsers.filter(u => u.role === 'user' && u.club === selectedClub);

  const clubStats = {
    total: clubUsers.length,
    verified: clubUsers.filter(u => u.status === 'verified').length,
    pending: clubUsers.filter(u => u.status === 'pending').length,
    rejected: clubUsers.filter(u => u.status === 'rejected').length
  };

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
  const handleClearHistory = async (otpCodeVal = '') => {
    if (!hasExported) return;
    
    // If not verifying with OTP yet, prompt confirmation first
    if (!otpCodeVal) {
      const confirmMessage = selectedClub === 'All Clubs'
        ? 'WARNING: This will permanently wipe all standard user profiles across ALL clubs from the database. Make sure you have downloaded the CSV export. Proceed?'
        : `WARNING: This will permanently wipe all standard user profiles registered at "${selectedClub}" from the database. Make sure you have downloaded the CSV export. Proceed?`;
        
      const confirmClear = window.confirm(confirmMessage);
      if (!confirmClear) return;
    }

    setLoading(true);
    try {
      const url = `${apiUrl}/api/admin/clear-history?club=${encodeURIComponent(selectedClub)}${otpCodeVal ? `&otp=${otpCodeVal}` : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setLoading(false);
      
      if (data.success) {
        setHasExported(false); // Relock the button
        alert(data.message);
        setShowOtpModal(false);
        setAdminOtpCode('');
        fetchDashboardData();
      } else if (data.requiresOtp) {
        setOtpAction('clear-history');
        setOtpTargetId('');
        setOtpMessage(data.message);
        setOtpError('');
        setShowOtpModal(true);
      } else {
        if (otpCodeVal) {
          setOtpError(data.message || 'Verification failed');
        } else {
          alert('Clear operation failed: ' + data.message);
        }
      }
    } catch (err) {
      console.error('Failed to wipe user database:', err);
      if (otpCodeVal) {
        setOtpError('Network error. Failed to reach verification server.');
      } else {
        alert('Network error. Failed to wipe database.');
      }
      setLoading(false);
    }
  };

  // Dynamic Clubs Action Handlers
  const handleCreateClub = async (e) => {
    e.preventDefault();
    if (!clubName.trim()) {
      setClubError('Club name is required.');
      return;
    }
    setClubError('');
    setClubSuccess('');
    setClubsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/clubs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: clubName })
      });
      const data = await response.json();
      setClubsLoading(false);
      if (data.success) {
        setClubSuccess('Club added successfully!');
        setClubName('');
        setShowClubModal(false);
        fetchDashboardData();
      } else {
        setClubError(data.message || 'Failed to add club.');
      }
    } catch (err) {
      setClubError('Network error. Failed to add club.');
      setClubsLoading(false);
    }
  };

  const handleEditClub = async (e) => {
    e.preventDefault();
    if (!clubName.trim()) {
      setClubError('Club name is required.');
      return;
    }
    setClubError('');
    setClubSuccess('');
    setClubsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/clubs/${editingClubId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: clubName })
      });
      const data = await response.json();
      setClubsLoading(false);
      if (data.success) {
        setClubSuccess('Club renamed successfully!');
        setClubName('');
        setShowClubModal(false);
        fetchDashboardData();
      } else {
        setClubError(data.message || 'Failed to rename club.');
      }
    } catch (err) {
      setClubError('Network error. Failed to rename club.');
      setClubsLoading(false);
    }
  };

  const handleDeleteClub = async (clubId, otpCodeVal = '') => {
    if (!otpCodeVal) {
      const confirmDelete = window.confirm('WARNING: Deleting this club will permanently wipe its profile, all scheduled events, and all standard members associated with it. This action is irreversible. Proceed?');
      if (!confirmDelete) return;
    }

    setLoading(true);
    try {
      const url = `${apiUrl}/api/admin/clubs/${clubId}${otpCodeVal ? `?otp=${otpCodeVal}` : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setLoading(false);
      
      if (data.success) {
        alert(data.message);
        setShowOtpModal(false);
        setAdminOtpCode('');
        fetchDashboardData();
      } else if (data.requiresOtp) {
        setOtpAction('delete-club');
        setOtpTargetId(clubId);
        setOtpMessage(data.message);
        setOtpError('');
        setShowOtpModal(true);
      } else {
        if (otpCodeVal) {
          setOtpError(data.message || 'Verification failed');
        } else {
          alert('Delete operation failed: ' + data.message);
        }
      }
    } catch (err) {
      console.error('Failed to delete club:', err);
      if (otpCodeVal) {
        setOtpError('Network error. Failed to reach verification server.');
      } else {
        alert('Network error. Failed to delete club.');
      }
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!adminOtpCode.trim()) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      if (otpAction === 'clear-history') {
        await handleClearHistory(adminOtpCode);
      } else if (otpAction === 'delete-club') {
        await handleDeleteClub(otpTargetId, adminOtpCode);
      }
      setOtpLoading(false);
    } catch (err) {
      setOtpError('Error verifying OTP.');
      setOtpLoading(false);
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
      age: '',
      club: selectedClub !== 'All Clubs' ? selectedClub : 'The Palace Lounge'
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
      age: user.age || '',
      club: user.club || 'The Palace Lounge'
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-850 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 font-sans">
            <ShieldCheck className="w-6 h-6 text-indigo-500" />
            Admin System Control
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage verifications, browse users directory, and handle daily database maintenance.
          </p>
        </div>

        {/* Club Dropdown Selector */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Select Club:
          </span>
          <select
            value={selectedClub}
            onChange={(e) => setSelectedClub(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl glass-input text-slate-800 dark:text-white text-xs font-extrabold cursor-pointer focus:outline-none"
          >
            <option value="All Clubs" className="bg-slate-900 text-white font-bold">All Clubs (Unified)</option>
            {activeClubs.map((c) => (
              <option key={c} value={c} className="bg-slate-900 text-white font-bold">
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
        
        {/* Responsive Tab Selector */}
        <div className="flex overflow-x-auto whitespace-nowrap bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 w-full md:w-auto self-stretch md:self-center no-scrollbar gap-1.5">
          <button
            onClick={() => setActiveTab('audits')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition duration-200 flex-shrink-0 ${activeTab === 'audits' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/15' : 'text-slate-400 hover:text-white'}`}
          >
            Audit Queue
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition duration-200 flex-shrink-0 ${activeTab === 'users' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/15' : 'text-slate-400 hover:text-white'}`}
          >
            User CRUD
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition duration-200 flex-shrink-0 ${activeTab === 'staff' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/15' : 'text-slate-400 hover:text-white'}`}
          >
            Manage Staff
          </button>
          <button
            onClick={() => setActiveTab('event')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition duration-200 flex-shrink-0 ${activeTab === 'event' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/15' : 'text-slate-400 hover:text-white'}`}
          >
            Schedule Event
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition duration-200 flex-shrink-0 ${activeTab === 'database' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/15' : 'text-slate-400 hover:text-white'}`}
          >
            Database Operations
          </button>
          <button
            onClick={() => setActiveTab('clubs')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition duration-200 flex-shrink-0 ${activeTab === 'clubs' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/15' : 'text-slate-400 hover:text-white'}`}
          >
            Manage Clubs
          </button>
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
          <div className="text-2xl font-extrabold text-white">{clubStats.total}</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border-slate-800/80">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Verified Pass</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">{clubStats.verified}</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border-indigo-900/60 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
          <div className="flex justify-between items-center text-indigo-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Pending Audit</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-400">{clubStats.pending}</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border-slate-800/80">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Rejected Requests</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold text-rose-400">{clubStats.rejected}</div>
        </div>
      </div>

      {/* TAB CONTENTS */}

      {/* TAB 1: AUDIT QUEUE */}
      {activeTab === 'audits' && (
        <div className="grid md:grid-cols-5 gap-6 items-start">
          {/* Audit Queue List */}
          <div className="glass-panel rounded-3xl p-5 border-slate-800/80 md:col-span-2 space-y-4 min-h-[300px]">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Pending Queue ({filteredPendingQueue.length})</h2>
              <button onClick={fetchDashboardData} className="text-slate-500 hover:text-white transition">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {filteredPendingQueue.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs italic">
                Queue is empty. No pending audits.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredPendingQueue.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => setSelectedUser(user)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      selectedUser && selectedUser._id === user._id
                        ? 'bg-indigo-600/10 border-indigo-500'
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-slate-205 text-xs">{user.name || 'Anonymous User'}</span>
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
                      href={selectedUser.idCardUrl ? (selectedUser.idCardUrl.startsWith('http') ? selectedUser.idCardUrl : `${apiUrl}${selectedUser.idCardUrl}`) : '#'} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="relative block rounded-xl overflow-hidden bg-slate-950 border border-slate-850 hover:border-indigo-500 transition group"
                    >
                      <img 
                        src={selectedUser.idCardUrl ? (selectedUser.idCardUrl.startsWith('http') ? selectedUser.idCardUrl : `${apiUrl}${selectedUser.idCardUrl}`) : ''} 
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
                      href={selectedUser.selfieUrl ? (selectedUser.selfieUrl.startsWith('http') ? selectedUser.selfieUrl : `${apiUrl}${selectedUser.selfieUrl}`) : '#'} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="relative block rounded-xl overflow-hidden bg-slate-950 border border-slate-850 hover:border-indigo-500 transition group"
                    >
                      <img 
                        src={selectedUser.selfieUrl ? (selectedUser.selfieUrl.startsWith('http') ? selectedUser.selfieUrl : `${apiUrl}${selectedUser.selfieUrl}`) : ''} 
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
                    <span className={`font-bold ${selectedUser.faceMatchConfidence >= 40 ? 'text-emerald-400' : 'text-amber-400'}`}>
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
                {filteredAllUsers.map((user) => (
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

      {/* TAB 3: SCHEDULE EVENT */}
      {activeTab === 'event' && (
        <div className="grid md:grid-cols-2 gap-6 items-start animate-fade-in">
          {/* Scheduling Form */}
          <div className="glass-panel rounded-3xl p-6 border-slate-800/80 space-y-6">
            <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Host/Schedule Club Event</h2>
            </div>

            {eventError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl">
                {eventError}
              </div>
            )}

            {eventSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl">
                {eventSuccess}
              </div>
            )}

            <form onSubmit={handleScheduleEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Event Title / Headline
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Saturday Retro Glow Night"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  disabled={eventLoading}
                  className="w-full px-3.5 py-3 rounded-xl glass-input text-white text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={eventDateTime}
                    onChange={(e) => setEventDateTime(e.target.value)}
                    disabled={eventLoading}
                    className="w-full px-3.5 py-3 rounded-xl glass-input text-white text-xs focus:outline-none font-mono bg-dark-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Venue / Club Gate
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VIP Main Entrance"
                    value={eventVenue}
                    onChange={(e) => setEventVenue(e.target.value)}
                    disabled={eventLoading}
                    className="w-full px-3.5 py-3 rounded-xl glass-input text-white text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Target Club
                  </label>
                  <select
                    value={eventClub}
                    onChange={(e) => setEventClub(e.target.value)}
                    disabled={eventLoading}
                    className="w-full px-3.5 py-3 rounded-xl glass-input text-slate-800 dark:text-white text-xs focus:outline-none bg-dark-900 font-extrabold cursor-pointer"
                  >
                    {activeClubs.map((c) => (
                      <option key={c} value={c} className="bg-slate-900 text-white font-bold">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Event Description & Details
                </label>
                <textarea
                  placeholder="e.g. Doors open at 9 PM. Age limit 18+. Pre-register here to get your pass scanned."
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  disabled={eventLoading}
                  rows={4}
                  className="w-full p-3 text-xs rounded-xl glass-input text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={eventLoading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition duration-200 flex items-center justify-center gap-1.5 shadow"
              >
                {eventLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Publishing Event Details...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Update/Publish Event Schedule
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Event Schedule & History List */}
          <div className="glass-panel rounded-3xl p-6 border-slate-800/80 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-wider text-left">
                Event History & Schedule ({filteredAllEvents.length})
              </h2>
              <button 
                type="button"
                onClick={fetchDashboardData}
                className="text-slate-500 hover:text-white transition"
                title="Refresh Events"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {filteredAllEvents.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs italic">
                No events scheduled. Users will see standby mode on registration screen.
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
                {filteredAllEvents.map((evt) => {
                  const isPast = new Date(evt.dateTime) < new Date();
                  return (
                    <div 
                      key={evt._id} 
                      className={`p-4 rounded-2xl border transition duration-200 text-left ${
                        isPast 
                          ? 'bg-slate-900/20 border-slate-850 hover:border-slate-800' 
                          : 'bg-indigo-950/10 border-indigo-900/40 hover:border-indigo-850/60 shadow-[0_0_15px_rgba(99,102,241,0.02)]'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1">
                          <h3 className="text-sm font-extrabold text-white">{evt.title}</h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-mono">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-indigo-400" />
                              {new Date(evt.dateTime).toLocaleString()}
                            </span>
                            <span className="text-slate-650">|</span>
                            <span>{evt.venue}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isPast ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-800 border border-slate-700 text-slate-400">
                              Past Event
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                              </span>
                              Active
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(evt._id)}
                            className="p-1.5 bg-slate-900 hover:bg-rose-500/10 hover:text-rose-400 rounded-md text-slate-500 transition duration-200"
                            title="Delete Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2.5 border-t border-slate-900/60">
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold block mb-0.5">Description</span>
                        {evt.description ? (
                          <p className="text-[11px] text-slate-350 leading-relaxed break-words">{evt.description}</p>
                        ) : isPast ? (
                          <p className="text-[11px] text-slate-500 italic">Description auto-compressed to save database storage.</p>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">No description provided.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DATABASE OPERATIONS */}
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

      {/* TAB 5: DYNAMIC CLUBS DIRECTORY */}
      {activeTab === 'clubs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-850 pb-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                Dynamic Club Gates Directory
              </h2>
              <p className="text-[11px] text-slate-450 mt-1">
                Add, rename, or delete venue collections. Any changes dynamically update associated users and scheduled events.
              </p>
            </div>
            <button
              onClick={() => {
                setClubModalMode('create');
                setClubName('');
                setClubError('');
                setClubSuccess('');
                setShowClubModal(true);
              }}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition duration-200 flex items-center justify-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              Add Club Gate
            </button>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {clubs.map((c) => (
              <div key={c._id} className="glass-panel rounded-3xl p-5 border-slate-800/80 flex flex-col justify-between hover:border-slate-700/80 transition duration-300 group">
                <div className="space-y-1">
                  <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest block">Venue/Gate</span>
                  <h3 className="text-sm font-extrabold text-white group-hover:text-indigo-300 transition duration-200">{c.name}</h3>
                  <span className="text-[10px] text-slate-500 block">Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-end gap-2.5 mt-5 pt-3.5 border-t border-slate-850/80">
                  <button
                    onClick={() => {
                      setClubModalMode('edit');
                      setEditingClubId(c._id);
                      setClubName(c.name);
                      setClubError('');
                      setClubSuccess('');
                      setShowClubModal(true);
                    }}
                    className="p-2 bg-slate-800/80 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition duration-200"
                    title="Rename Club"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClub(c._id)}
                    className="p-2 bg-slate-800/80 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg transition duration-200"
                    title="Delete Club"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {clubs.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-500 text-xs italic">
                No custom clubs configured. Using default lists.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: STAFF CRUD */}
      {activeTab === 'staff' && (
        <div className="glass-panel rounded-3xl p-6 border-slate-800/80 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-850 pb-4">
            <div>
              <h2 className="text-sm font-bold text-gradient uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                Gate Staff Management CRUD
              </h2>
              <p className="text-[10px] text-slate-500 mt-1">
                Manually register authorized gate staff members. Authorized staff can log in with their email/phone and password to scan tickets.
              </p>
            </div>
            <button
              onClick={() => {
                setModalMode('create');
                setCrudUser({
                  id: '',
                  phone: '',
                  name: '',
                  email: '',
                  role: 'club', // force role to gate staff
                  status: 'verified', // staff is verified by default
                  password: '',
                  club: selectedClub !== 'All Clubs' ? selectedClub : 'The Palace Lounge'
                });
                setCrudError('');
                setShowUserModal(true);
              }}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition shadow-lg shadow-amber-500/15"
            >
              <Plus className="w-4 h-4" />
              Add Staff Person
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                  <th className="py-3 px-2">Staff Phone</th>
                  <th className="py-3 px-2">Staff Name</th>
                  <th className="py-3 px-2">Staff Email</th>
                  <th className="py-3 px-2">Assigned Venue/Club</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {allUsers.filter(u => u.role === 'club').map((staff) => (
                  <tr key={staff._id} className="hover:bg-slate-900/20 text-slate-350">
                    <td className="py-3.5 px-2 font-mono text-slate-200">{staff.phone}</td>
                    <td className="py-3.5 px-2 font-semibold text-slate-100">{staff.name || 'Staff User'}</td>
                    <td className="py-3.5 px-2 text-slate-400">{staff.email}</td>
                    <td className="py-3.5 px-2 font-semibold text-amber-500">{staff.club || 'The Palace Lounge'}</td>
                    <td className="py-3.5 px-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setModalMode('edit');
                            setCrudUser({
                              id: staff._id,
                              phone: staff.phone,
                              name: staff.name || '',
                              email: staff.email || '',
                              role: staff.role,
                              status: staff.status,
                              password: '', // blank by default, only hash and update on edit if user inputs something
                              club: staff.club || 'The Palace Lounge'
                            });
                            setCrudError('');
                            setShowUserModal(true);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-amber-500/10 hover:text-amber-400 rounded-md text-slate-400 transition"
                          title="Edit Staff"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(staff._id)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 rounded-md text-slate-400 transition"
                          title="Delete Staff"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {allUsers.filter(u => u.role === 'club').length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500 italic">No authorized staff found. Add staff members above.</td>
                  </tr>
                )}
              </tbody>
            </table>
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

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    System Role
                  </label>
                  <select
                    value={crudUser.role}
                    onChange={(e) => setCrudUser({ ...crudUser, role: e.target.value })}
                    className="w-full px-2 py-2 text-xs rounded-lg glass-input text-slate-800 dark:text-white focus:outline-none bg-dark-900"
                  >
                    <option value="user" className="bg-slate-900 text-white font-semibold">Standard User</option>
                    <option value="club" className="bg-slate-900 text-white font-semibold">Club Gate Staff</option>
                    <option value="admin" className="bg-slate-900 text-white font-semibold">System Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={crudUser.status}
                    onChange={(e) => setCrudUser({ ...crudUser, status: e.target.value })}
                    className="w-full px-2 py-2 text-xs rounded-lg glass-input text-slate-800 dark:text-white focus:outline-none bg-dark-900"
                  >
                    <option value="pending" className="bg-slate-900 text-white font-semibold">Pending Audit</option>
                    <option value="verified" className="bg-slate-900 text-white font-semibold">Verified Pass</option>
                    <option value="rejected" className="bg-slate-900 text-white font-semibold">Rejected Pass</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Assigned Club
                  </label>
                  <select
                    value={crudUser.club}
                    onChange={(e) => setCrudUser({ ...crudUser, club: e.target.value })}
                    className="w-full px-2 py-2 text-xs rounded-lg glass-input text-slate-800 dark:text-white focus:outline-none bg-dark-900 font-extrabold cursor-pointer"
                  >
                    {activeClubs.map((c) => (
                      <option key={c} value={c} className="bg-slate-900 text-white font-bold">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Account Password {modalMode === 'create' ? <span className="text-amber-500">*</span> : <span className="text-slate-500">(Leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  placeholder={modalMode === 'create' ? "Enter password" : "Enter new password to update"}
                  value={crudUser.password || ''}
                  onChange={(e) => setCrudUser({ ...crudUser, password: e.target.value })}
                  required={modalMode === 'create'}
                  className="w-full px-3 py-2.5 text-xs rounded-lg glass-input text-white focus:outline-none"
                />
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

      {/* CLUB MODAL (CREATE/EDIT) */}
      {showClubModal && (
        <div className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-glow rounded-3xl p-6 max-w-sm w-full animate-scale-up space-y-5">
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <h3 className="font-bold text-white text-base">
                {clubModalMode === 'create' ? 'Create Dynamic Club Gate' : 'Rename Club Gate'}
              </h3>
              <button 
                onClick={() => setShowClubModal(false)}
                className="text-slate-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {clubError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl">
                {clubError}
              </div>
            )}
            {clubSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs rounded-xl">
                {clubSuccess}
              </div>
            )}

            <form onSubmit={clubModalMode === 'create' ? handleCreateClub : handleEditClub} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Club Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oasis Lounge"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl glass-input text-white focus:outline-none"
                  disabled={clubsLoading}
                />
              </div>

              <div className="flex justify-end gap-2 text-xs pt-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowClubModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                  disabled={clubsLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition font-semibold"
                  disabled={clubsLoading}
                >
                  {clubsLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DESTRUCTIVE ACTION SECURITY VERIFICATION OTP MODAL */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-glow rounded-3xl p-6 max-w-sm w-full animate-scale-up space-y-5 border-rose-500/20">
            <div className="flex items-center gap-2 text-rose-500 border-b border-slate-850 pb-3">
              <Shield className="w-5 h-5 animate-pulse" />
              <h3 className="font-extrabold text-white text-base">Security Verification</h3>
            </div>

            <div className="text-xs text-slate-350 leading-relaxed">
              {otpMessage}
            </div>

            {otpError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl font-bold leading-normal">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                  Enter 6-Digit Authorization Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="------"
                  value={adminOtpCode}
                  onChange={(e) => setAdminOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 text-center text-lg tracking-[8px] font-bold font-mono rounded-xl glass-input text-rose-450 focus:outline-none bg-slate-950"
                  disabled={otpLoading}
                />
              </div>

              <div className="flex gap-2 text-xs pt-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpModal(false);
                    setAdminOtpCode('');
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                  disabled={otpLoading}
                >
                  Cancel Action
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition font-bold"
                  disabled={otpLoading}
                >
                  {otpLoading ? 'Verifying Code...' : 'Authorize Action'}
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
