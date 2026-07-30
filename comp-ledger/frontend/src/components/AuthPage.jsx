import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';

export default function AuthPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    publication: '',
    domain: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    fetch('/api/auth/google/config')
      .then(r => r.json())
      .then(data => {
        if (data.enabled && data.client_id) {
          setGoogleEnabled(true);
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.onload = () => {
            setGoogleReady(true);
            window.google.accounts.id.initialize({
              client_id: data.client_id,
              callback: handleGoogleResponse,
            });
            window.google.accounts.id.renderButton(
              document.getElementById('google-signin-btn'),
              { theme: 'outline', size: 'large', width: '100%', text: 'continue_with' }
            );
          };
          document.head.appendChild(script);
        }
      })
      .catch(() => {});
  }, []);

  async function handleGoogleResponse(response) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google auth failed');
      login(data.token, data.publisher);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        login(data.token, data.publisher);
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            name: form.name,
            publication: form.publication,
            domain: form.domain.toLowerCase(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        login(data.token, data.publisher);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-lg">
      <div className="ambient-mesh" />
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-xl">
          <div className="inline-flex items-center gap-sm mb-md">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--primary), #4ade80)' }}>
              <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>fact_check</span>
            </div>
            <h1 className="text-headline-md font-black text-on-surface">CoMP Ledger</h1>
          </div>
          <p className="text-body-md text-on-surface-variant">
            {mode === 'login' ? 'Sign in to your publisher account' : 'Register your publication'}
          </p>
        </div>

        {/* Mode switcher */}
        <div className="flex gap-xs p-xs rounded-xl mb-lg mx-auto w-fit" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}>
          <button
            onClick={() => { setMode('login'); setError(null); }}
            className={`px-lg py-sm rounded-lg text-label-md font-medium transition-all ${
              mode === 'login' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('register'); setError(null); }}
            className={`px-lg py-sm rounded-lg text-label-md font-medium transition-all ${
              mode === 'register' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass-card p-lg flex flex-col gap-md">
          {mode === 'register' && (
            <>
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface-variant font-medium">Your Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  className="input-field"
                  placeholder="Jane Smith"
                />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface-variant font-medium">Publication Name</label>
                <input
                  type="text"
                  value={form.publication}
                  onChange={e => setForm(f => ({ ...f, publication: e.target.value }))}
                  required
                  className="input-field"
                  placeholder="The Daily Tribune"
                />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface-variant font-medium">Primary Domain</label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                  required
                  className="input-field"
                  placeholder="dailytribune.com"
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-xs">
            <label className="text-label-sm text-on-surface-variant font-medium">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              className="input-field"
              placeholder="you@publication.com"
            />
          </div>

          <div className="flex flex-col gap-xs">
            <label className="text-label-sm text-on-surface-variant font-medium">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              minLength={6}
              className="input-field"
              placeholder={mode === 'register' ? 'Min 6 characters' : 'Enter password'}
            />
          </div>

          {error && (
            <div className="flex items-center gap-sm px-md py-sm rounded-xl" style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
              <span className="material-symbols-outlined text-error" style={{ fontSize: 16 }}>error</span>
              <span className="text-body-sm text-error font-medium">{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary text-label-md flex items-center justify-center gap-sm w-full mt-sm" style={{ padding: '14px' }}>
            <span className={`material-symbols-outlined ${loading ? 'live-pulse' : ''}`} style={{ fontSize: 18 }}>
              {loading ? 'pending' : mode === 'login' ? 'login' : 'person_add'}
            </span>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <div className="flex items-center gap-md my-xs">
            <div className="flex-1 h-px" style={{ background: 'var(--outline-variant)' }} />
            <span className="text-label-sm text-on-surface-variant">or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--outline-variant)' }} />
          </div>

          {googleEnabled ? (
            <div id="google-signin-btn" className="flex justify-center min-h-[44px]" />
          ) : (
            <button
              type="button"
              disabled
              title="Add GOOGLE_CLIENT_ID to backend .env to enable"
              className="w-full flex items-center justify-center gap-sm px-md py-sm rounded-xl text-label-md font-medium transition-all opacity-50 cursor-not-allowed"
              style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
              <span className="text-body-sm opacity-60" style={{ fontSize: 10 }}>(not configured)</span>
            </button>
          )}
        </form>

        {/* Demo credentials hint */}
        <div className="mt-lg text-center">
          <p className="text-body-sm text-on-surface-variant opacity-60">
            Demo admin: <code className="font-code text-primary">admin@comp-ledger.com</code> / <code className="font-code text-primary">admin123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
