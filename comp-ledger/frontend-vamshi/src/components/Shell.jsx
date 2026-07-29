import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const SIDEBAR_FULL = 260;
const SIDEBAR_COLLAPSED = 64;

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { icon: 'description', label: 'Facts', path: '/facts' },
  { icon: 'compare', label: 'Compare', path: '/compare' },
  { icon: 'library_books', label: 'Corpus', path: '/corpus' },
  { icon: 'cable', label: 'Connectors', path: '/connectors' },
  { icon: 'group', label: 'Team', path: '/team' },
];

export function Sidebar({ collapsed, onToggle }) {
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
        <ThemeToggleItem collapsed={collapsed} />
        <div
          onClick={() => navigate('/about')}
          title={collapsed ? 'About' : undefined}
          className={`flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high hover:text-on-surface transition-all duration-200 cursor-pointer rounded-xl active:scale-95 ${collapsed ? 'justify-center' : ''}`}
        >
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20 }}>auto_awesome</span>
          {!collapsed && <span className="text-label-md whitespace-nowrap">About</span>}
        </div>
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

export function TopBar({ sidebarWidth }) {
  const { publisher, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

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
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="h-9 rounded-xl flex items-center gap-sm px-sm hover:bg-surface-container-high transition-all"
              style={{ backdropFilter: 'blur(8px)' }}
            >
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>account_circle</span>
              {publisher && <span className="text-label-md text-on-surface-variant hidden md:inline">{publisher.name}</span>}
            </button>
            {showMenu && (
              <div
                className="absolute right-0 top-full mt-xs rounded-xl shadow-lg border border-outline-variant overflow-hidden"
                style={{ background: 'var(--surface-container)', minWidth: 200, zIndex: 100 }}
              >
                {publisher && (
                  <div className="px-md py-sm border-b border-outline-variant">
                    <p className="text-label-md font-bold text-on-surface">{publisher.name}</p>
                    <p className="text-body-sm text-on-surface-variant">{publisher.email}</p>
                  </div>
                )}
                <button
                  onClick={() => { setShowMenu(false); logout(); }}
                  className="w-full flex items-center gap-sm px-md py-sm text-left text-body-md text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
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
