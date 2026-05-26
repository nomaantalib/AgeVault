import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Verification from './pages/Verification';
import Scanner from './pages/Scanner';
import Admin from './pages/Admin';
import { LogOut, Shield, ShieldAlert, Scan, LayoutDashboard, Sun, Moon } from 'lucide-react';

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
  const { theme, toggleTheme } = useTheme();
  
  if (!user) return null;

  return (
    <nav className="glass-panel border-b border-slate-200 dark:border-slate-800/80 sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <Link to="/" className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-amber-950 to-amber-600 dark:from-white dark:via-slate-200 dark:to-amber-400 bg-clip-text text-transparent font-sans">
          AgeVault
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Navigation for specific roles */}
        <div className="hidden md:flex items-center gap-1">
          {user.role === 'admin' && (
            <NavLink 
              to="/admin" 
              className={({ isActive }) => 
                `flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition rounded-lg ${
                  isActive 
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-sm' 
                    : 'text-slate-600 hover:text-amber-500 dark:text-slate-300 dark:hover:text-amber-400 hover:bg-amber-500/5 dark:hover:bg-amber-950/20'
                }`
              }
            >
              <ShieldAlert className="w-4 h-4" />
              Admin Portal
            </NavLink>
          )}
          {(user.role === 'club' || user.role === 'admin') && (
            <NavLink 
              to="/scanner" 
              className={({ isActive }) => 
                `flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition rounded-lg ${
                  isActive 
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-sm' 
                    : 'text-slate-600 hover:text-amber-500 dark:text-slate-300 dark:hover:text-amber-400 hover:bg-amber-500/5 dark:hover:bg-amber-950/20'
                }`
              }
            >
              <Scan className="w-4 h-4" />
              Club Scanner
            </NavLink>
          )}
          <NavLink 
            to="/" 
            className={({ isActive }) => 
              `flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition rounded-lg ${
                isActive 
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-sm' 
                  : 'text-slate-600 hover:text-amber-500 dark:text-slate-300 dark:hover:text-amber-400 hover:bg-amber-500/5 dark:hover:bg-amber-950/20'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </NavLink>
        </div>

        {/* User profile summary & theme toggle */}
        <div className="flex items-center gap-3.5 pl-4 border-l border-slate-200 dark:border-slate-800">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-250 leading-tight">{user.name || 'User'}</p>
            <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-extrabold uppercase tracking-wider">{user.role}</p>
          </div>
          
          <button
            onClick={toggleTheme}
            className="p-2 bg-slate-100 hover:bg-amber-500/10 hover:text-amber-600 dark:bg-slate-900/60 dark:hover:bg-amber-500/15 dark:hover:text-amber-400 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-800 transition duration-300"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>

          <button
            onClick={logout}
            className="p-2 bg-slate-100 hover:bg-red-500/10 hover:text-red-600 dark:bg-slate-900/60 dark:hover:bg-red-500/15 dark:hover:text-red-400 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-800 transition duration-300"
            title="Log Out"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </nav>
  );
};

const AppContent = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col animated-bg relative">
      <Navbar />
      {!user && (
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2.5 bg-slate-100 hover:bg-amber-500/10 hover:text-amber-600 dark:bg-slate-900/60 dark:hover:bg-amber-500/15 dark:hover:text-amber-400 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-800/80 transition duration-300 shadow-md backdrop-blur-md z-30"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>
      )}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 pb-20 md:pb-8">
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

      {/* Mobile Bottom Navigation Bar */}
      {user && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-slate-200 dark:border-slate-800/80 z-50 flex justify-around py-2.5 backdrop-blur-md">
          <NavLink 
            to="/" 
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 text-[10px] font-bold transition duration-300 ${
                isActive 
                  ? 'text-amber-500 dark:text-amber-400 scale-105' 
                  : 'text-slate-600 dark:text-slate-350 hover:text-amber-500 dark:hover:text-amber-400'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </NavLink>
          {(user.role === 'club' || user.role === 'admin') && (
            <NavLink 
              to="/scanner" 
              className={({ isActive }) => 
                `flex flex-col items-center gap-1 text-[10px] font-bold transition duration-300 ${
                  isActive 
                    ? 'text-amber-500 dark:text-amber-400 scale-105' 
                    : 'text-slate-600 dark:text-slate-350 hover:text-amber-500 dark:hover:text-amber-400'
                }`
              }
            >
              <Scan className="w-5 h-5" />
              <span>Scanner</span>
            </NavLink>
          )}
          {user.role === 'admin' && (
            <NavLink 
              to="/admin" 
              className={({ isActive }) => 
                `flex flex-col items-center gap-1 text-[10px] font-bold transition duration-300 ${
                  isActive 
                    ? 'text-amber-500 dark:text-amber-400 scale-105' 
                    : 'text-slate-600 dark:text-slate-350 hover:text-amber-500 dark:hover:text-amber-400'
                }`
              }
            >
              <ShieldAlert className="w-5 h-5" />
              <span>Admin</span>
            </NavLink>
          )}
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
