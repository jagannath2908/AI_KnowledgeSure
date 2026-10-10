import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import UserChat from './pages/UserChat';

import Canvas3DBackground from './components/Canvas3DBackground';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const navigate = useNavigate();

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      navigate('/login');
    };
    window.addEventListener('auth-expired', handleExpired);
    return () => window.removeEventListener('auth-expired', handleExpired);
  }, [navigate]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      <Canvas3DBackground />
      <Navbar user={user} onLogout={handleLogout} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to={user.role === 'admin' ? "/admin" : "/chat"} replace /> : <Login onLoginSuccess={handleLoginSuccess} />}
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute user={user} requireUserOnly>
                <UserChat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute user={user} requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={<Navigate to={user ? (user.role === 'admin' ? "/admin" : "/chat") : "/login"} replace />}
          />
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>

      </main>
    </div>
  );
}
