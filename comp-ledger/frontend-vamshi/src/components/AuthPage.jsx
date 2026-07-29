import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [registeredKey, setRegisteredKey] = useState(null);
  const [registeredData, setRegisteredData] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/publishers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      setRegisteredKey(data.api_key);
      setRegisteredData({ id: data.id, name: data.name, email: data.email, created_at: data.created_at });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    login(registeredData, registeredKey);
  };

  const handleCopyKey = () => {
    navigator.clipboard?.writeText(registeredKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/publishers/me', {
        headers: { 'X-API-Key': apiKeyInput },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid API key');
        return;
      }
      login(data, apiKeyInput);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="ambient-mesh" />
      <div className="glass-card p-lg relative z-10" style={{ width: '100%', maxWidth: 420 }}>
        <div className="flex items-center gap-sm mb-lg">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>shield</span>
          <h1 className="text-headline-md font-black text-on-surface">CoMP Ledger</h1>
        </div>

        <div className="flex gap-sm mb-md">
          <button
            onClick={() => { setMode('register'); setError(null); }}
            className={`flex-1 py-sm px-md rounded-lg text-label-md font-bold transition-all ${mode === 'register' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
          >
            Register
          </button>
          <button
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 py-sm px-md rounded-lg text-label-md font-bold transition-all ${mode === 'login' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
          >
            Sign In
          </button>
        </div>

        {mode === 'register' ? (
          <form onSubmit={handleRegister} className="flex flex-col gap-md">
            <div>
              <label className="text-label-md text-on-surface-variant mb-xs block">Publisher Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. New York Times"
                required
                className="w-full px-md py-sm rounded-lg bg-surface-container border border-outline-variant text-on-surface text-body-md focus:border-primary focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-label-md text-on-surface-variant mb-xs block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="dev@publisher.com"
                required
                className="w-full px-md py-sm rounded-lg bg-surface-container border border-outline-variant text-on-surface text-body-md focus:border-primary focus:outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-label-md py-sm disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Publisher Account'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-md">
            <div>
              <label className="text-label-md text-on-surface-variant mb-xs block">API Key</label>
              <input
                type="text"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="cl_..."
                required
                className="w-full px-md py-sm rounded-lg bg-surface-container border border-outline-variant text-on-surface text-body-md font-code focus:border-primary focus:outline-none transition-colors"
              />
              <p className="text-body-sm text-on-surface-variant mt-xs">Enter the API key you received during registration</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-label-md py-sm disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Sign In with API Key'}
            </button>
          </form>
        )}

        {registeredKey && (
          <div className="mt-md p-md rounded-lg border border-primary" style={{ background: 'var(--surface-container-low)' }}>
            <div className="flex items-center gap-sm mb-sm">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>key</span>
              <span className="text-label-md font-bold text-on-surface">Your API Key</span>
            </div>
            <p className="text-body-sm text-on-surface-variant mb-sm">Save this key — you'll need it to sign in again. It won't be shown again.</p>
            <div className="flex items-center gap-sm mb-md">
              <code className="flex-1 px-sm py-xs rounded bg-surface-container text-body-sm font-code text-primary break-all">
                {registeredKey}
              </code>
              <button onClick={handleCopyKey} className="btn-ghost px-sm py-xs text-label-md">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{copied ? 'check' : 'content_copy'}</span>
              </button>
            </div>
            <button
              onClick={handleContinue}
              className="btn-primary w-full text-label-md py-sm flex items-center justify-center gap-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
              I've saved my key — Continue to App
            </button>
          </div>
        )}

        {error && (
          <div className="mt-md px-md py-sm rounded-lg bg-error-container text-on-error-container text-body-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
