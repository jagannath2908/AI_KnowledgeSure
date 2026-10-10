import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children, user, requireAdmin = false, requireUserOnly = false }) {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/chat" replace />;
  }

  if (requireUserOnly && user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

