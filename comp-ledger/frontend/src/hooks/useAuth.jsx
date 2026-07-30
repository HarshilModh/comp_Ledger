import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('comp-token'));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error('Invalid');
        return r.json();
      })
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('comp-token');
        setToken(null);
        setUser(null);
        setLoading(false);
      });
  }, [token]);

  function login(tokenStr, userData) {
    localStorage.setItem('comp-token', tokenStr);
    setToken(tokenStr);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('comp-token');
    setToken(null);
    setUser(null);
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }

  function authFetch(url, opts = {}) {
    const headers = { ...opts.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { ...opts, headers });
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, authFetch, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
