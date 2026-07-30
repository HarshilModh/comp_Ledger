import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';

const SIDEBAR_FULL = 260;
const SIDEBAR_COLLAPSED = 64;

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { icon: 'description', label: 'Facts', path: '/facts' },
  { icon: 'compare', label: 'Compare', path: '/compare' },
  { icon: 'travel_explore', label: 'Deep Research', path: '/deep-research' },
  { icon: 'apartment', label: 'Publishers', path: '/publishers' },
];

export function Sidebar({ collapsed, onToggle, user, onLogout }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const w = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL;

  return (
    <aside
      className="fixed left-0 top-0 h-full glass-sidebar flex flex-col py-lg z-50 transition-all duration-300"
      style={{ width: w }}
    >
      <div className={`px-md mb-xl flex items-center ${collapsed ? 'justify-center' : 'gap-sm'}`}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #0f4a2c, #0a3320)' }}>
          <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #4ade80, #16a34a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CL</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-black text-on-surface whitespace-nowrap" style={{ fontSize: 16, lineHeight: '20px', letterSpacing: '-0.02em' }}>CoMP Ledger</h1>
            <p className="text-on-surface-variant whitespace-nowrap" style={{ fontSize: 11, opacity: 0.7 }}>Evidence Platform</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-xs px-sm">
        {navItems.map(({ icon, label, path }) => {
          const active = pathname === path;
          return (
            <div
              key={path}
              onClick={() => navigate(path)}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-md px-md py-sm cursor-pointer transition-all duration-200 rounded-xl active:scale-95 ${collapsed ? 'justify-center' : ''} ${
                active
                  ? 'nav-active text-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20 }}>{icon}</span>
              {!collapsed && <span className="text-label-md whitespace-nowrap">{label}</span>}
            </div>
          );
        })}
      </nav>

      <div className={`mt-auto space-y-xs px-sm border-t border-outline-variant pt-md ${collapsed ? '' : 'mx-sm'}`}>
        {/* User info */}
        {user && !collapsed && (
          <div className="flex items-center gap-sm px-md py-sm mb-xs rounded-xl" style={{ background: 'var(--surface-container-low)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary-fixed)' }}>
              <span className="text-primary font-black" style={{ fontSize: 10 }}>
                {(user.publication || user.name || 'U').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-label-sm font-bold text-on-surface truncate" style={{ fontSize: 11 }}>{user.publication || user.name}</p>
              <p className="text-on-surface-variant truncate" style={{ fontSize: 10 }}>{user.role === 'admin' ? 'Admin' : 'Publisher'}</p>
            </div>
          </div>
        )}
        {user && collapsed && (
          <div
            title={user.publication || user.name}
            className="flex items-center justify-center px-md py-sm mb-xs"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-fixed)' }}>
              <span className="text-primary font-black" style={{ fontSize: 10 }}>
                {(user.publication || user.name || 'U').slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
        )}

        <ThemeToggleItem collapsed={collapsed} />
        <div
          onClick={() => navigate('/about')}
          title={collapsed ? 'About' : undefined}
          className={`flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high hover:text-on-surface transition-all duration-200 cursor-pointer rounded-xl active:scale-95 ${collapsed ? 'justify-center' : ''}`}
        >
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20 }}>auto_awesome</span>
          {!collapsed && <span className="text-label-md whitespace-nowrap">About</span>}
        </div>
        {onLogout && (
          <div
            onClick={onLogout}
            title={collapsed ? 'Sign Out' : undefined}
            className={`flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high hover:text-error transition-all duration-200 cursor-pointer rounded-xl active:scale-95 ${collapsed ? 'justify-center' : ''}`}
          >
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20 }}>logout</span>
            {!collapsed && <span className="text-label-md whitespace-nowrap">Sign Out</span>}
          </div>
        )}
        <div
          onClick={onToggle}
          title={collapsed ? 'Expand' : 'Collapse'}
          className={`flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high hover:text-on-surface transition-all duration-200 cursor-pointer rounded-xl active:scale-95 ${collapsed ? 'justify-center' : ''}`}
        >
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20 }}>
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
          {!collapsed && <span className="text-label-md whitespace-nowrap">Collapse</span>}
        </div>
      </div>
    </aside>
  );
}

function ThemeToggleItem({ collapsed }) {
  const { theme, toggle } = useTheme();
  return (
    <div
      onClick={toggle}
      title={collapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
      className={`flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high hover:text-on-surface transition-all duration-200 cursor-pointer rounded-xl active:scale-95 ${collapsed ? 'justify-center' : ''}`}
    >
      <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20 }}>
        {theme === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
      {!collapsed && (
        <>
          <span className="text-label-md flex-1 whitespace-nowrap">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </span>
          <div className="theme-toggle" />
        </>
      )}
    </div>
  );
}

export function TopBar({ sidebarWidth, user, onLogout }) {
  return (
    <header className="fixed top-0 right-0 h-16 glass-topbar flex justify-between items-center px-lg z-40 transition-all duration-300" style={{ left: sidebarWidth }}>
      <div className="flex items-center gap-xl">
        <nav className="flex gap-md">
          <span className="text-body-md text-primary font-bold cursor-pointer transition-colors" style={{ borderBottom: '2px solid var(--primary)', paddingBottom: 2 }}>Trace & Score</span>
          <span className="text-body-md text-on-surface-variant font-medium hover:text-primary transition-colors cursor-pointer">Registry</span>
          <span className="text-body-md text-on-surface-variant font-medium hover:text-primary transition-colors cursor-pointer">Archives</span>
        </nav>
      </div>
      <div className="flex items-center gap-md">
        <button className="btn-primary text-label-md flex items-center gap-sm" style={{ padding: '8px 16px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Create Claim
        </button>
        <div className="flex items-center gap-xs">
          <button className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container-high transition-all" style={{ backdropFilter: 'blur(8px)' }}>
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>notifications</span>
          </button>
          {user && (
            <div className="flex items-center gap-sm ml-sm px-sm py-xs rounded-xl" style={{ background: 'var(--surface-container)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-fixed)' }}>
                <span className="text-primary font-black" style={{ fontSize: 10 }}>
                  {(user.name || 'U').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <span className="text-label-sm text-on-surface font-medium">{user.name || user.email}</span>
              {user.role === 'admin' && (
                <span className="px-xs py-px rounded text-primary font-bold" style={{ fontSize: 9, background: 'var(--primary-fixed)' }}>ADMIN</span>
              )}
              <button
                onClick={onLogout}
                title="Sign Out"
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-container-high hover:text-error transition-all ml-xs"
              >
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppFooter({ sidebarWidth }) {
  const year = new Date().getFullYear();
  return (
    <footer className="fixed bottom-0 right-0 border-t border-outline-variant flex justify-between items-center py-md transition-all duration-300 z-30" style={{ left: sidebarWidth, paddingLeft: 32, paddingRight: 32, background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center gap-md">
        <span className="text-label-md font-bold text-on-surface">CoMP Ledger</span>
        <span className="text-body-sm text-on-surface-variant">&copy; {year} CoMP Ledger. All rights reserved.</span>
      </div>
      <div className="flex items-center gap-lg">
        <span className="text-body-sm text-on-surface-variant">v1.0.0</span>
        <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy Policy</a>
        <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Terms of Service</a>
        <a className="text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Licensing Agreement</a>
      </div>
    </footer>
  );
}

export { SIDEBAR_FULL, SIDEBAR_COLLAPSED };
