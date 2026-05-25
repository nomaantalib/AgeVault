import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Verification from './pages/Verification';
import Scanner from './pages/Scanner';
import Admin from './pages/Admin';
import { LogOut, Shield, ShieldAlert, Scan, LayoutDashboard, UserCheck } from 'lucide-react';

// Route Guards
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

const ClubRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || (user.role !== 'club' && user.role !== 'admin')) return <Navigate to="/" replace />;
  return children;
};

const LoadingScreen = () => (
  <div className="min-h-screen bg-dark-900 flex items-center justify-center flex-col">
    <div className="relative w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
    <p className="mt-4 text-indigo-400 font-medium tracking-wide">Loading AgeVault...</p>
  </div>
);

// Main Navigation / Layout
const Navbar = () => {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <nav className="glass-panel border-b border-slate-800 sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <Link to="/" className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
          AgeVault
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Navigation for specific roles */}
        <div className="hidden md:flex items-center gap-2">
          {user.role === 'admin' && (
            <Link to="/admin" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-indigo-400 transition">
              <ShieldAlert className="w-4 h-4" />
              Admin Portal
            </Link>
          )}
          {(user.role === 'club' || user.role === 'admin') && (
            <Link to="/scanner" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-indigo-400 transition">
              <Scan className="w-4 h-4" />
              Club Scanner
            </Link>
          )}
          <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-indigo-400 transition">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
        </div>

        {/* User profile summary */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-200">{user.name || 'User'}</p>
            <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">{user.role}</p>
          </div>
          
          <button
            onClick={logout}
            className="p-2 bg-slate-800/40 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-slate-400 border border-slate-700/50 transition duration-300"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col animated-bg">
          <Navbar />
          <main className="flex-1 flex items-center justify-center p-4 md:p-8">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/verify"
                element={
                  <ProtectedRoute>
                    <Verification />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scanner"
                element={
                  <ClubRoute>
                    <Scanner />
                  </ClubRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
