import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [publisher, setPublisher] = useState(() => {
    const stored = localStorage.getItem('comp-ledger-publisher');
    return stored ? JSON.parse(stored) : null;
  });

  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('comp-ledger-api-key') || null;
  });

  const login = useCallback((publisherData, key) => {
    setPublisher(publisherData);
    setApiKey(key);
    localStorage.setItem('comp-ledger-publisher', JSON.stringify(publisherData));
    localStorage.setItem('comp-ledger-api-key', key);
  }, []);

  const logout = useCallback(() => {
    setPublisher(null);
    setApiKey(null);
    localStorage.removeItem('comp-ledger-publisher');
    localStorage.removeItem('comp-ledger-api-key');
  }, []);

  const authHeaders = useCallback(() => {
    if (!apiKey) return { 'Content-Type': 'application/json' };
    return { 'Content-Type': 'application/json', 'X-API-Key': apiKey };
  }, [apiKey]);

  return (
    <AuthContext.Provider value={{ publisher, apiKey, login, logout, authHeaders, isAuthenticated: !!apiKey }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
