import React, { useState, useEffect } from 'react';
import { LogIn, UserPlus, LogOut, CheckCircle2, AlertCircle, Loader2, User as UserIcon, Lock, Mail } from 'lucide-react';
import type { User } from './types';

export default function App() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialChecking, setInitialChecking] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Check if session is already active
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setCurrentUser({ id: data.userId });
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch {
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setInitialChecking(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (res.ok && res.status === 201) {
        setMessage({
          type: 'success',
          text: `Account created successfully for ${data.user?.name || name}! You can now sign in.`,
        });
        setMode('login');
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'Registration failed. Please check your inputs.',
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Unable to connect to server.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && res.status === 200) {
        setIsAuthenticated(true);
        setCurrentUser({
          id: data.data?.user_id,
          name: data.data?.name,
          email: data.data?.email,
        });
        setMessage({
          type: 'success',
          text: `Welcome back, ${data.data?.name || 'User'}!`,
        });
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'Invalid email or password.',
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Unable to connect to server.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setIsAuthenticated(false);
      setCurrentUser(null);
      setMessage({
        type: 'success',
        text: 'You have been logged out.',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Logout failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialChecking) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 className="spinner" size={32} style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Checking authentication session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {isAuthenticated ? (
          /* Logged In Dashboard View */
          <div className="logged-in-container">
            <div className="user-avatar">
              <UserIcon size={36} color="#6366f1" />
            </div>

            <h2>Signed In</h2>
            <p className="subtitle">You have an active authenticated session.</p>

            <div className="user-details-card">
              {currentUser?.name && (
                <div className="detail-row">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{currentUser.name}</span>
                </div>
              )}
              {currentUser?.email && (
                <div className="detail-row">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{currentUser.email}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">User ID</span>
                <span className="detail-value font-mono">{currentUser?.id || 'Active'}</span>
              </div>
            </div>

            {message && (
              <div className={`message-banner ${message.type}`}>
                {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{message.text}</span>
              </div>
            )}

            <button
              id="logout-btn"
              type="button"
              className="btn btn-secondary"
              onClick={handleLogout}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="spinner" /> : <LogOut size={16} />}
              Log Out
            </button>
          </div>
        ) : (
          /* Login & Register Forms */
          <div>
            {/* Header Tabs */}
            <div className="auth-tabs">
              <button
                id="tab-login"
                type="button"
                className={`tab-item ${mode === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setMode('login');
                  setMessage(null);
                }}
              >
                <LogIn size={16} />
                Sign In
              </button>
              <button
                id="tab-register"
                type="button"
                className={`tab-item ${mode === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setMode('register');
                  setMessage(null);
                }}
              >
                <UserPlus size={16} />
                Register
              </button>
            </div>

            <div className="auth-header">
              <h2>{mode === 'login' ? 'Welcome Back' : 'Create an Account'}</h2>
              <p className="subtitle">
                {mode === 'login'
                  ? 'Enter your credentials to access your session.'
                  : 'Fill in your details to register a new user.'}
              </p>
            </div>

            {message && (
              <div className={`message-banner ${message.type}`}>
                {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{message.text}</span>
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="form-layout">
                <div className="input-group">
                  <label htmlFor="login-email">Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={18} className="input-icon" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="login-password">Password</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" />
                    <input
                      id="login-password"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button id="login-submit-btn" type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <Loader2 size={18} className="spinner" /> : <LogIn size={18} />}
                  Sign In
                </button>

                <p className="toggle-hint">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setMode('register');
                      setMessage(null);
                    }}
                  >
                    Register here
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="form-layout">
                <div className="input-group">
                  <label htmlFor="register-name">Full Name</label>
                  <div className="input-with-icon">
                    <UserIcon size={18} className="input-icon" />
                    <input
                      id="register-name"
                      type="text"
                      required
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="register-email">Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={18} className="input-icon" />
                    <input
                      id="register-email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="register-password">Password</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" />
                    <input
                      id="register-password"
                      type="password"
                      required
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button id="register-submit-btn" type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <Loader2 size={18} className="spinner" /> : <UserPlus size={18} />}
                  Create Account
                </button>

                <p className="toggle-hint">
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setMode('login');
                      setMessage(null);
                    }}
                  >
                    Sign in here
                  </button>
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
