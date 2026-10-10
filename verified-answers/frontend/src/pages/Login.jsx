import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, User, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('admin@verifiedanswers.io');
  const [password, setPassword] = useState('AdminPass123!');
  const [fullName, setFullName] = useState('Compliance Admin');
  const [role, setRole] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  const handlePresetSelect = (presetRole) => {
    if (presetRole === 'admin') {
      setEmail('admin@verifiedanswers.io');
      setPassword('AdminPass123!');
      setFullName('Compliance Admin');
      setRole('admin');
    } else {
      setEmail('analyst@verifiedanswers.io');
      setPassword('UserPass123!');
      setFullName('Risk Analyst');
      setRole('user');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let data;
      if (isRegister) {
        data = await api.register(email, password, fullName, role);
      } else {
        data = await api.login(email, password);
      }

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);

      const destination = location.state?.from?.pathname || (data.user.role === 'admin' ? '/admin' : '/chat');
      navigate(destination, { replace: true });
    } catch (err) {
      // If logging in with demo credentials fails on fresh database, offer to auto-register
      if (!isRegister && err.message.includes('Incorrect email or password')) {
        setError('User not registered in database yet. Click "Create Account" below or toggle the tab.');
      } else {
        setError(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="glass-panel auth-card" id="auth-container">
        <div className="auth-header">
          <div className="brand-icon-wrapper" style={{ margin: '0 auto', width: 44, height: 44 }}>
            <ShieldCheck size={26} color="#ffffff" />
          </div>
          <h1 id="auth-title">{isRegister ? 'Create Account' : 'Welcome Back'}</h1>
          <p>Enterprise Grounded Intelligence & Citation Verification</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            id="tab-login"
            className={`auth-tab ${!isRegister ? 'active' : ''}`}
            onClick={() => { setIsRegister(false); setError(''); }}
          >
            Sign In
          </button>
          <button
            type="button"
            id="tab-register"
            className={`auth-tab ${isRegister ? 'active' : ''}`}
            onClick={() => { setIsRegister(true); setError(''); }}
          >
            Create Account
          </button>
        </div>

        {/* Demo Quick Presets */}
        <div className="demo-credentials-box">
          <h4>
            <ShieldCheck size={14} />
            Quick Demo Presets
          </h4>
          <div>
            <button
              type="button"
              id="preset-admin-btn"
              className="demo-preset-btn"
              onClick={() => handlePresetSelect('admin')}
            >
              Admin (Knowledge Base + Q&A)
            </button>
            <button
              type="button"
              id="preset-analyst-btn"
              className="demo-preset-btn"
              onClick={() => handlePresetSelect('user')}
            >
              Auditor / User (Q&A Only)
            </button>
          </div>
        </div>

        {error && (
          <div className="banner-alert error" id="auth-error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} id="auth-form">
          {isRegister && (
            <>
              <div className="form-group">
                <label htmlFor="reg-fullname">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="reg-fullname"
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-role">Role</label>
                <select
                  id="reg-role"
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="admin">Administrator (Upload & Index)</option>
                  <option value="user">Auditor / User (Q&A Access)</option>
                </select>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <input
              type="email"
              id="auth-email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@enterprise.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <input
              type="password"
              id="auth-password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          <button
            type="submit"
            id="auth-submit-btn"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.75rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : (isRegister ? 'Register & Continue' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
}
