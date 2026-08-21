import React, { useState, useEffect } from 'react';
import {
  LogIn,
  UserPlus,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User as UserIcon,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { User, PasswordLoginResponse, TotpSetupResponse } from './types';

export default function App() {
  const [mode, setMode] = useState<'login' | 'register' | 'totp-login'>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialChecking, setInitialChecking] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // TOTP Login temporary state
  const [totpUserId, setTotpUserId] = useState<string | null>(null);
  const [totpLoginCode, setTotpLoginCode] = useState('');

  // TOTP Setup state (when authenticated)
  const [totpSetupUri, setTotpSetupUri] = useState<string | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [totpSetupLoading, setTotpSetupLoading] = useState(false);
  const [totpSetupMessage, setTotpSetupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/user/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setCurrentUser({
          id: data.userId,
          name: data.name,
          email: data.email,
        });
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
      const res = await fetch('/api/auth/password/register', {
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
      } else if (res.status === 409) {
        setMessage({
          type: 'error',
          text: data.message || 'An account with this email already exists.',
        });
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
      const res = await fetch('/api/auth/password/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data: PasswordLoginResponse = await res.json();

      if (res.ok) {
        if (data.requiresTotp && data.userId) {
          // TOTP flow required
          setTotpUserId(data.userId);
          setTotpLoginCode('');
          setMode('totp-login');
          setMessage({
            type: 'success',
            text: 'Password verified. Please enter the 6-digit code from your authenticator app.',
          });
        } else {
          // Normal password login success
          await checkSession();
          setMessage({
            type: 'success',
            text: `Welcome back!`,
          });
        }
      } else if (res.status === 401) {
        setMessage({
          type: 'error',
          text: 'Invalid email or password.',
        });
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'Login failed. Please try again.',
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

  const handleTotpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpUserId) {
      setMessage({ type: 'error', text: 'Missing login context. Please sign in again.' });
      setMode('login');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/totp/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: totpUserId, code: totpLoginCode.trim() }),
      });

      const data = await res.json();

      if (res.ok && res.status === 200) {
        setTotpUserId(null);
        setTotpLoginCode('');
        await checkSession();
        setMessage({
          type: 'success',
          text: 'Two-factor authentication successful. Welcome back!',
        });
      } else if (res.status === 401) {
        setMessage({
          type: 'error',
          text: 'Invalid 6-digit authenticator code. Please check your app and try again.',
        });
      } else if (res.status === 404) {
        setMessage({
          type: 'error',
          text: 'TOTP is not configured for this account.',
        });
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'Two-factor authentication failed.',
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
      await fetch('/api/auth/password/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setIsAuthenticated(false);
      setCurrentUser(null);
      setTotpSetupUri(null);
      setTotpVerifyCode('');
      setTotpSetupMessage(null);
      setTotpEnabled(false);
      setMode('login');
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

  // Start TOTP Setup
  const handleStartTotpSetup = async () => {
    setTotpSetupLoading(true);
    setTotpSetupMessage(null);

    try {
      const res = await fetch('/api/auth/totp/setup', {
        method: 'POST',
        credentials: 'include',
      });

      const data: TotpSetupResponse = await res.json();

      if (res.ok && data.data?.uri) {
        setTotpSetupUri(data.data.uri);
        setTotpVerifyCode('');
        setTotpSetupMessage({
          type: 'success',
          text: 'Authenticator setup generated. Scan the code or copy the URI into your authenticator app.',
        });
      } else if (res.status === 409) {
        setTotpSetupMessage({
          type: 'error',
          text: 'Two-factor authentication (TOTP) is already enabled for this account.',
        });
        setTotpEnabled(true);
      } else {
        setTotpSetupMessage({
          type: 'error',
          text: data.message || 'Failed to initiate TOTP setup.',
        });
      }
    } catch (err: any) {
      setTotpSetupMessage({
        type: 'error',
        text: err.message || 'Unable to connect to server.',
      });
    } finally {
      setTotpSetupLoading(false);
    }
  };

  // Verify TOTP Setup
  const handleVerifyTotpSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpSetupLoading(true);
    setTotpSetupMessage(null);

    try {
      const res = await fetch('/api/auth/totp/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: totpVerifyCode.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setTotpEnabled(true);
        setTotpSetupUri(null);
        setTotpVerifyCode('');
        setTotpSetupMessage({
          type: 'success',
          text: 'Two-factor authentication (TOTP) has been enabled successfully!',
        });
      } else if (res.status === 401) {
        setTotpSetupMessage({
          type: 'error',
          text: 'Invalid 6-digit code. Please enter the current code from your authenticator app.',
        });
      } else if (res.status === 400) {
        setTotpSetupMessage({
          type: 'error',
          text: 'Two-factor authentication is already completed.',
        });
        setTotpEnabled(true);
      } else {
        setTotpSetupMessage({
          type: 'error',
          text: data.message || 'Failed to verify TOTP code.',
        });
      }
    } catch (err: any) {
      setTotpSetupMessage({
        type: 'error',
        text: err.message || 'Unable to connect to server.',
      });
    } finally {
      setTotpSetupLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
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

            <h2>{currentUser?.name ? `Welcome, ${currentUser.name}` : 'Signed In'}</h2>
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
                  <span className="detail-value font-mono">{currentUser.email}</span>
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

            {/* TOTP 2FA Management Section */}
            <div className="totp-setup-section">
              <div className="totp-section-header">
                <Shield size={20} color="#6366f1" />
                <h3>Two-Factor Authentication (TOTP)</h3>
              </div>

              {totpSetupMessage && (
                <div className={`message-banner ${totpSetupMessage.type}`} style={{ margin: '0.75rem 0' }}>
                  {totpSetupMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{totpSetupMessage.text}</span>
                </div>
              )}

              {totpEnabled ? (
                <div className="totp-status-badge enabled">
                  <ShieldCheck size={18} color="#10b981" />
                  <span>Two-Factor Authentication is Enabled</span>
                </div>
              ) : totpSetupUri ? (
                /* Step 2: Show URI / QR & Verify Form */
                <div className="totp-qr-box">
                  <p className="totp-instruction">
                    1. Scan this QR Code with your Authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.):
                  </p>

                  <div className="qr-code-wrapper">
                    <QRCodeSVG
                      value={totpSetupUri}
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#0a0e17"
                      level="M"
                      includeMargin={true}
                    />
                  </div>

                  <p className="totp-instruction" style={{ marginTop: '1rem' }}>
                    Or enter this key manually:
                  </p>

                  <div className="uri-display-card">
                    <span className="uri-text">{totpSetupUri}</span>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => copyToClipboard(totpSetupUri)}
                      title="Copy URI"
                    >
                      {copiedUri ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                    </button>
                  </div>

                  <form onSubmit={handleVerifyTotpSetup} className="form-layout" style={{ marginTop: '1.25rem' }}>
                    <div className="input-group">
                      <label htmlFor="verify-totp-code">2. Enter 6-Digit Code from App</label>
                      <div className="input-with-icon">
                        <KeyRound size={18} className="input-icon" />
                        <input
                          id="verify-totp-code"
                          type="text"
                          required
                          maxLength={6}
                          placeholder="123456"
                          className="font-mono text-center"
                          value={totpVerifyCode}
                          onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>

                    <button
                      id="verify-totp-submit-btn"
                      type="submit"
                      className="btn btn-primary"
                      disabled={totpSetupLoading || totpVerifyCode.length !== 6}
                    >
                      {totpSetupLoading ? <Loader2 size={18} className="spinner" /> : <ShieldCheck size={18} />}
                      Verify & Enable TOTP
                    </button>
                  </form>
                </div>
              ) : (
                /* Step 1: Trigger Setup */
                <button
                  id="start-totp-btn"
                  type="button"
                  className="btn btn-totp"
                  onClick={handleStartTotpSetup}
                  disabled={totpSetupLoading}
                >
                  {totpSetupLoading ? <Loader2 size={16} className="spinner" /> : <Shield size={16} />}
                  Set Up Two-Factor Authentication
                </button>
              )}
            </div>

            <button
              id="logout-btn"
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: '1.5rem' }}
              onClick={handleLogout}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="spinner" /> : <LogOut size={16} />}
              Log Out
            </button>
          </div>
        ) : mode === 'totp-login' ? (
          /* TOTP Verification Step during Login */
          <div>
            <button
              type="button"
              className="back-btn"
              onClick={() => {
                setTotpUserId(null);
                setTotpLoginCode('');
                setMode('login');
                setMessage(null);
              }}
            >
              <ArrowLeft size={16} /> Back to Sign In
            </button>

            <div className="auth-header">
              <div className="totp-icon-badge">
                <ShieldCheck size={28} color="#6366f1" />
              </div>
              <h2>Two-Factor Authentication</h2>
              <p className="subtitle">Enter the 6-digit code from your authenticator app to complete login.</p>
            </div>

            {message && (
              <div className={`message-banner ${message.type}`}>
                {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleTotpLogin} className="form-layout">
              <div className="input-group">
                <label htmlFor="totp-login-code">Authenticator Code</label>
                <div className="input-with-icon">
                  <KeyRound size={18} className="input-icon" />
                  <input
                    id="totp-login-code"
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    className="font-mono text-center"
                    value={totpLoginCode}
                    onChange={(e) => setTotpLoginCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <button
                id="totp-login-submit-btn"
                type="submit"
                className="btn btn-primary"
                disabled={loading || totpLoginCode.length !== 6}
              >
                {loading ? <Loader2 size={18} className="spinner" /> : <ShieldCheck size={18} />}
                Verify & Sign In
              </button>
            </form>
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
