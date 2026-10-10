import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, MessageSquare, Database, LogOut, User } from 'lucide-react';

export default function Navbar({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <header className="navbar" id="app-navbar">
      <Link to={user?.role === 'admin' ? "/admin" : (user ? "/chat" : "/login")} className="nav-brand" id="brand-link">
        <div className="brand-icon-wrapper">
          <ShieldCheck size={22} color="#ffffff" />
        </div>
        <span>Verified<span style={{ color: 'var(--accent-cyan)' }}>Answers</span></span>
      </Link>


      <nav className="nav-links">
        {user && (
          <>
            {user.role === 'user' && (
              <Link
                to="/chat"
                id="nav-chat-link"
                className={`nav-link ${location.pathname === '/chat' ? 'active' : ''}`}
              >
                <MessageSquare size={17} />
                <span>Grounded Q&A</span>
              </Link>
            )}

            {user.role === 'admin' && (
              <Link
                to="/admin"
                id="nav-admin-link"
                className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
              >
                <Database size={17} />
                <span>Knowledge Base (Admin)</span>
              </Link>
            )}
          </>
        )}
      </nav>


      <div className="nav-user">
        {user ? (
          <>
            <div className="user-badge" id="user-profile-badge">
              <User size={15} />
              <span>{user.full_name}</span>
              <span className={`role-pill ${user.role}`}>{user.role}</span>
            </div>
            <button
              onClick={handleLogoutClick}
              id="logout-btn"
              className="btn btn-secondary btn-sm"
              title="Sign Out"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </>
        ) : (
          <Link to="/login" id="nav-login-btn" className="btn btn-primary btn-sm">
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
