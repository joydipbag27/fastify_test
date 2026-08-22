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
  Fingerprint,
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
  Home,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import type { User, PasswordLoginResponse, TotpSetupResponse } from './types';

export default function App() {
  const [mode, setMode] = useState<'login' | 'register' | 'totp-login'>('login');
  const [loginMethod, setLoginMethod] = useState<'password' | 'passkey' | 'totp'>('password');
  const [dashboardTab, setDashboardTab] = useState<'home' | 'security'>('home');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialChecking, setInitialChecking] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // TOTP Login state
  const [totpLoginCode, setTotpLoginCode] = useState('');

  // TOTP Setup state (when authenticated)
  const [totpSetupUri, setTotpSetupUri] = useState<string | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [totpSetupLoading, setTotpSetupLoading] = useState(false);
  const [totpSetupMessage, setTotpSetupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);

  // Passkey Setup state (when authenticated)
  const [passkeySetupLoading, setPasskeySetupLoading] = useState(false);
  const [passkeySetupMessage, setPasskeySetupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  // Reload/re-initialize Tenor embed script when home page is viewed
  useEffect(() => {
    if (isAuthenticated && dashboardTab === 'home') {
      const existingScript = document.getElementById('tenor-embed-script');
      if (existingScript) {
        existingScript.remove();
      }
      const script = document.createElement('script');
      script.id = 'tenor-embed-script';
      script.type = 'text/javascript';
      script.src = 'https://tenor.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [isAuthenticated, dashboardTab]);

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

  const handlePasswordLogin = async (e: React.FormEvent) => {
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
        if (data.requiresTotp) {
          // TOTP flow required
          setTotpLoginCode('');
          setMode('totp-login');
          setMessage({
            type: 'success',
            text: 'Password verified. Please enter the 6-digit code from your authenticator app.',
          });
        } else {
          // Normal password login success
          await checkSession();
          setDashboardTab('home');
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

  const handlePasskeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter your email address to sign in with a passkey.',
      });
      return;
    }

    if (!browserSupportsWebAuthn()) {
      setMessage({
        type: 'error',
        text: 'Passkey authentication is not supported in this browser.',
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Step 1: Request authentication challenge options for this email
      const optionRes = await fetch('/api/auth/passkey/option', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const optionData = await optionRes.json();

      if (!optionRes.ok || !optionData.options) {
        setMessage({
          type: 'error',
          text: optionData.message || 'Passkey options request failed.',
        });
        return;
      }

      // Step 2: Prompt native passkey authenticator
      let credential;
      try {
        credential = await startAuthentication({ optionsJSON: optionData.options });
      } catch (authError: any) {
        if (authError.name === 'NotAllowedError') {
          setMessage({
            type: 'error',
            text: 'Passkey authentication was canceled.',
          });
        } else {
          setMessage({
            type: 'error',
            text: authError.message || 'Passkey authentication failed.',
          });
        }
        return;
      }

      // Step 3: Send authenticated credential to login endpoint
      const loginRes = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim(),
          credential,
        }),
      });

      const loginData = await loginRes.json();

      if (loginRes.ok) {
        await checkSession();
        setDashboardTab('home');
        setMessage({
          type: 'success',
          text: 'Welcome back! Signed in with Passkey.',
        });
      } else {
        setMessage({
          type: 'error',
          text: loginData.message || 'Passkey login verification failed.',
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Unable to connect to server for passkey login.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Direct TOTP Login via POST /api/auth/totp/login
  const handleTotpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim();
    const targetCode = totpLoginCode.trim();

    if (!targetEmail) {
      setMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }

    if (targetCode.length !== 6) {
      setMessage({ type: 'error', text: 'Please enter a valid 6-digit TOTP code.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/totp/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: targetEmail, code: targetCode }),
      });

      const data = await res.json();

      if (res.ok && res.status === 200) {
        setTotpLoginCode('');
        await checkSession();
        setDashboardTab('home');
        setMessage({
          type: 'success',
          text: 'Two-factor authentication successful. Welcome back!',
        });
      } else if (res.status === 401) {
        setMessage({
          type: 'error',
          text: 'Invalid 6-digit authenticator code. Please check your app.',
        });
      } else if (res.status === 404) {
        setMessage({
          type: 'error',
          text: data.message || 'User not found or TOTP is not enabled.',
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
      setPasskeySetupMessage(null);
      setDashboardTab('home');
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

  // Start Passkey Setup
  const handlePasskeySetup = async () => {
    if (!browserSupportsWebAuthn()) {
      setPasskeySetupMessage({
        type: 'error',
        text: 'Passkey registration is not supported in this browser.',
      });
      return;
    }

    setPasskeySetupLoading(true);
    setPasskeySetupMessage(null);

    try {
      // Step 1: Request registration options
      const setupRes = await fetch('/api/auth/passkey/setup', {
        method: 'POST',
        credentials: 'include',
      });

      const setupData = await setupRes.json();

      if (!setupRes.ok || !setupData.options) {
        setPasskeySetupMessage({
          type: 'error',
          text: setupData.message || 'Failed to initiate passkey registration.',
        });
        return;
      }

      // Step 2: Prompt native WebAuthn passkey registration
      let credential;
      try {
        credential = await startRegistration({ optionsJSON: setupData.options });
      } catch (regError: any) {
        if (regError.name === 'NotAllowedError') {
          setPasskeySetupMessage({
            type: 'error',
            text: 'Passkey creation was canceled.',
          });
        } else {
          setPasskeySetupMessage({
            type: 'error',
            text: regError.message || 'Failed to create passkey.',
          });
        }
        return;
      }

      // Step 3: Send verification payload to backend
      const verifyRes = await fetch('/api/auth/passkey/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credential),
      });

      const verifyData = await verifyRes.json();

      if (verifyRes.ok) {
        setPasskeySetupMessage({
          type: 'success',
          text: 'Passkey registered successfully! You can now use it to sign in.',
        });
      } else {
        setPasskeySetupMessage({
          type: 'error',
          text: verifyData.message || 'Failed to verify and save passkey.',
        });
      }
    } catch (err: any) {
      setPasskeySetupMessage({
        type: 'error',
        text: err.message || 'Unable to connect to server for passkey setup.',
      });
    } finally {
      setPasskeySetupLoading(false);
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
    <div className={`auth-wrapper ${isAuthenticated ? 'logged-in' : ''}`}>
      <div className="auth-card">
        {isAuthenticated ? (
          /* Logged In Dashboard & Home View */
          <div className="logged-in-container">
            {/* Top Dashboard Nav */}
            <div className="dashboard-nav">
              <button
                type="button"
                className={`dashboard-nav-item ${dashboardTab === 'home' ? 'active' : ''}`}
                onClick={() => setDashboardTab('home')}
              >
                <Home size={16} />
                Home
              </button>
              <button
                type="button"
                className={`dashboard-nav-item ${dashboardTab === 'security' ? 'active' : ''}`}
                onClick={() => setDashboardTab('security')}
              >
                <Shield size={16} />
                Security & Passkeys
              </button>
            </div>

            {dashboardTab === 'home' ? (
              /* Home Page View with Cat Dance Spotlight */
              <div>
                <div className="user-avatar" style={{ marginBottom: '0.5rem' }}>
                  <UserIcon size={28} color="#6366f1" />
                </div>

                <h2>{currentUser?.name ? `Welcome, ${currentUser.name}!` : 'Welcome!'}</h2>
                <p className="subtitle">You have successfully authenticated into the application.</p>

                {/* Funny Message Banner */}
                <div className="funny-banner">
                  <div className="funny-banner-title">
                    <Sparkles size={16} color="#f43f5e" />
                    <span>Exclusive VIP Content</span>
                    <Sparkles size={16} color="#38bdf8" />
                  </div>
                  <p className="funny-banner-subtitle">
                    You logged in just to see this dance 🫡
                  </p>
                </div>

                {/* Tenor Cat Dance GIF Embed */}
                <div className="cat-dance-card">
                  <div className="tenor-container">
                    <div
                      className="tenor-gif-embed"
                      data-postid="1598914448700171832"
                      data-share-method="host"
                      data-aspect-ratio="0.666667"
                      data-width="100%"
                    >
                      <a href="https://tenor.com/view/cat-dance-cat-arabic-turkish-middle-east-gif-1598914448700171832">
                        Cat Dance Arabic GIF
                      </a>
                      from <a href="https://tenor.com/search/cat+dance-gifs">Cat Dance GIFs</a>
                    </div>
                  </div>
                </div>

                {message && (
                  <div className={`message-banner ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{message.text}</span>
                  </div>
                )}

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
                    <span className="detail-value font-mono" style={{ fontSize: '0.725rem' }}>{currentUser?.id || 'Active'}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Security & Passkeys Tab */
              <div>
                <div className="auth-header" style={{ marginBottom: '0.75rem' }}>
                  <h2>Security & Authentication</h2>
                  <p className="subtitle">Manage passwordless passkeys and multi-factor authentication.</p>
                </div>

                {message && (
                  <div className={`message-banner ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{message.text}</span>
                  </div>
                )}

                {/* Passkey Security Card */}
                <div className="security-card">
                  <div className="security-card-header">
                    <Fingerprint size={18} color="#38bdf8" />
                    <h3>Passkey Authentication</h3>
                  </div>
                  <p className="security-card-desc">
                    Sign in seamlessly and securely using biometric authentication (Touch ID, Face ID, Windows Hello) or hardware security keys.
                  </p>

                  {passkeySetupMessage && (
                    <div className={`message-banner ${passkeySetupMessage.type}`} style={{ margin: '0.5rem 0' }}>
                      {passkeySetupMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      <span>{passkeySetupMessage.text}</span>
                    </div>
                  )}

                  <button
                    id="register-passkey-btn"
                    type="button"
                    className="btn btn-passkey"
                    onClick={handlePasskeySetup}
                    disabled={passkeySetupLoading}
                  >
                    {passkeySetupLoading ? <Loader2 size={16} className="spinner" /> : <Fingerprint size={16} />}
                    Register New Passkey
                  </button>
                </div>

                {/* TOTP 2FA Management Section */}
                <div className="security-card">
                  <div className="security-card-header">
                    <Shield size={18} color="#6366f1" />
                    <h3>Two-Factor Authentication (TOTP)</h3>
                  </div>
                  <p className="security-card-desc">
                    Protect your account with standard time-based one-time codes generated by your mobile authenticator app.
                  </p>

                  {totpSetupMessage && (
                    <div className={`message-banner ${totpSetupMessage.type}`} style={{ margin: '0.5rem 0' }}>
                      {totpSetupMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      <span>{totpSetupMessage.text}</span>
                    </div>
                  )}

                  {totpEnabled ? (
                    <div className="totp-status-badge enabled">
                      <ShieldCheck size={16} color="#10b981" />
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
                          size={140}
                          bgColor="#ffffff"
                          fgColor="#0a0e17"
                          level="M"
                          includeMargin={true}
                        />
                      </div>

                      <p className="totp-instruction" style={{ marginTop: '0.5rem' }}>
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
                          {copiedUri ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>
                      </div>

                      <form onSubmit={handleVerifyTotpSetup} className="form-layout" style={{ marginTop: '0.75rem' }}>
                        <div className="input-group">
                          <label htmlFor="verify-totp-code">2. Enter 6-Digit Code from App</label>
                          <div className="input-with-icon">
                            <KeyRound size={16} className="input-icon" />
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
                          {totpSetupLoading ? <Loader2 size={16} className="spinner" /> : <ShieldCheck size={16} />}
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
              </div>
            )}

            <button
              id="logout-btn"
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: '0.75rem' }}
              onClick={handleLogout}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="spinner" /> : <LogOut size={16} />}
              Log Out
            </button>
          </div>
        ) : mode === 'totp-login' ? (
          /* Step 2 TOTP Verification Screen (from Password Login) */
          <div>
            <button
              type="button"
              className="back-btn"
              onClick={() => {
                setTotpLoginCode('');
                setMode('login');
                setMessage(null);
              }}
            >
              <ArrowLeft size={16} /> Back to Sign In
            </button>

            <div className="auth-header">
              <div className="totp-icon-badge">
                <ShieldCheck size={24} color="#6366f1" />
              </div>
              <h2>Two-Factor Authentication</h2>
              <p className="subtitle">Enter the 6-digit code from your authenticator app to complete login.</p>
            </div>

            {message && (
              <div className={`message-banner ${message.type}`}>
                {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleTotpLogin} className="form-layout">
              <div className="input-group">
                <label htmlFor="totp-login-code">6-Digit Authenticator Code</label>
                <div className="input-with-icon">
                  <KeyRound size={16} className="input-icon" />
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
                {loading ? <Loader2 size={16} className="spinner" /> : <ShieldCheck size={16} />}
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
                <LogIn size={14} />
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
                <UserPlus size={14} />
                Register
              </button>
            </div>

            {mode === 'login' ? (
              <div>
                {/* Method switcher */}
                <div className="method-tabs">
                  <button
                    type="button"
                    className={`method-tab-item ${loginMethod === 'password' ? 'active' : ''}`}
                    onClick={() => {
                      setLoginMethod('password');
                      setMessage(null);
                    }}
                  >
                    <Lock size={13} />
                    Password
                  </button>
                  <button
                    type="button"
                    className={`method-tab-item ${loginMethod === 'passkey' ? 'active' : ''}`}
                    onClick={() => {
                      setLoginMethod('passkey');
                      setMessage(null);
                    }}
                  >
                    <Fingerprint size={13} />
                    Passkey
                  </button>
                  <button
                    type="button"
                    className={`method-tab-item ${loginMethod === 'totp' ? 'active' : ''}`}
                    onClick={() => {
                      setLoginMethod('totp');
                      setMessage(null);
                    }}
                  >
                    <ShieldCheck size={13} />
                    TOTP Code
                  </button>
                </div>

                <div className="auth-header" style={{ marginBottom: '0.65rem' }}>
                  <h2>
                    {loginMethod === 'password'
                      ? 'Sign In with Password'
                      : loginMethod === 'passkey'
                      ? 'Sign In with Passkey'
                      : 'Sign In with TOTP Code'}
                  </h2>
                  <p className="subtitle">
                    {loginMethod === 'password'
                      ? 'Enter your email and password.'
                      : loginMethod === 'passkey'
                      ? 'Use your fingerprint, face, or security key.'
                      : 'Enter your email and 6-digit authenticator OTP.'}
                  </p>
                </div>

                {message && (
                  <div className={`message-banner ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{message.text}</span>
                  </div>
                )}

                {loginMethod === 'password' ? (
                  /* 1. Password Login Form -> POST /api/auth/password/login */
                  <form onSubmit={handlePasswordLogin} className="form-layout">
                    <div className="input-group">
                      <label htmlFor="login-email">Email Address</label>
                      <div className="input-with-icon">
                        <Mail size={16} className="input-icon" />
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
                        <Lock size={16} className="input-icon" />
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
                      {loading ? <Loader2 size={16} className="spinner" /> : <LogIn size={16} />}
                      Sign In with Password
                    </button>
                  </form>
                ) : loginMethod === 'passkey' ? (
                  /* 2. Passkey Login Form -> POST /api/auth/passkey/login */
                  <form onSubmit={handlePasskeyLogin} className="form-layout">
                    <div className="input-group">
                      <label htmlFor="passkey-email">Email Address</label>
                      <div className="input-with-icon">
                        <Mail size={16} className="input-icon" />
                        <input
                          id="passkey-email"
                          type="email"
                          required
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <button id="passkey-submit-btn" type="submit" className="btn btn-passkey" disabled={loading}>
                      {loading ? <Loader2 size={16} className="spinner" /> : <Fingerprint size={16} />}
                      Authenticate with Passkey
                    </button>
                  </form>
                ) : (
                  /* 3. Direct TOTP Login Form -> POST /api/auth/totp/login */
                  <form onSubmit={handleTotpLogin} className="form-layout">
                    <div className="input-group">
                      <label htmlFor="totp-email-input">Email Address</label>
                      <div className="input-with-icon">
                        <Mail size={16} className="input-icon" />
                        <input
                          id="totp-email-input"
                          type="email"
                          required
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label htmlFor="totp-direct-code">6-Digit Authenticator Code</label>
                      <div className="input-with-icon">
                        <KeyRound size={16} className="input-icon" />
                        <input
                          id="totp-direct-code"
                          type="text"
                          required
                          maxLength={6}
                          placeholder="123456"
                          className="font-mono text-center"
                          value={totpLoginCode}
                          onChange={(e) => setTotpLoginCode(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>

                    <button
                      id="totp-direct-submit-btn"
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading || !email.trim() || totpLoginCode.length !== 6}
                    >
                      {loading ? <Loader2 size={16} className="spinner" /> : <ShieldCheck size={16} />}
                      Sign In with TOTP
                    </button>
                  </form>
                )}

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
              </div>
            ) : (
              /* Register Form */
              <form onSubmit={handleRegister} className="form-layout">
                <div className="auth-header" style={{ marginBottom: '0.65rem' }}>
                  <h2>Create an Account</h2>
                  <p className="subtitle">Fill in your details to register a new user.</p>
                </div>

                {message && (
                  <div className={`message-banner ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{message.text}</span>
                  </div>
                )}

                <div className="input-group">
                  <label htmlFor="register-name">Full Name</label>
                  <div className="input-with-icon">
                    <UserIcon size={16} className="input-icon" />
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
                    <Mail size={16} className="input-icon" />
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
                    <Lock size={16} className="input-icon" />
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
                  {loading ? <Loader2 size={16} className="spinner" /> : <UserPlus size={16} />}
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
