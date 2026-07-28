import React from 'react';

export function Sidebar({ activeTab, onTabChange }) {
  const navItems = [
    { icon: 'dashboard', label: 'Dashboard', key: 'dashboard' },
    { icon: 'description', label: 'Facts', key: 'claims' },
    { icon: 'compare', label: 'Compare', key: 'compare' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-sidebar-width bg-surface-container-low border-r border-outline-variant flex flex-col py-lg z-50">
      <div className="px-md mb-xl flex items-center gap-sm">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
          <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>verified</span>
        </div>
        <div>
          <h1 className="text-label-md font-black text-on-surface" style={{ fontSize: 16, lineHeight: '20px', letterSpacing: '-0.01em' }}>CoMP Ledger</h1>
          <p className="text-on-surface-variant" style={{ fontSize: 11 }}>Evidence Platform</p>
        </div>
      </div>
      <nav className="flex-1 space-y-xs px-sm">
        {navItems.map(({ icon, label, key }) => {
          const active = activeTab === key;
          return (
            <div
              key={label}
              onClick={() => onTabChange(key)}
              className={`flex items-center gap-md px-md py-sm rounded-lg cursor-pointer transition-all active:scale-[0.97] ${
                active
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
              <span className="text-label-md font-medium">{label}</span>
            </div>
          );
        })}
      </nav>
      <div className="mt-auto space-y-xs px-sm">
        {[
          { icon: 'help', label: 'Help' },
          { icon: 'logout', label: 'Logout' },
        ].map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-md text-on-surface-variant px-md py-sm rounded-lg hover:bg-surface-container-highest transition-all cursor-pointer active:scale-[0.97]">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
            <span className="text-label-md">{label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function TopBar() {
  return (
    <header className="fixed top-0 right-0 h-16 bg-surface border-b border-outline-variant flex justify-between items-center px-lg z-40" style={{ left: 260 }}>
      <nav className="flex items-center gap-md">
        <span className="text-body-md text-on-surface font-bold">Trace &amp; Score</span>
        <span className="text-body-sm text-on-surface-variant">Analyze AI answers for content usage</span>
      </nav>
      <div className="flex items-center gap-sm">
        <div className="flex items-center gap-xs px-sm py-xs rounded-lg bg-surface-container-low border border-outline-variant">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>circle</span>
          <span className="text-label-md text-on-surface-variant" style={{ fontSize: 12 }}>ProPublica Archive</span>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors" style={{ fontSize: 22 }}>notifications</span>
        <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors" style={{ fontSize: 22 }}>account_circle</span>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="bg-surface border-t border-outline-variant flex justify-between items-center py-md" style={{ marginLeft: 260, paddingLeft: 32, paddingRight: 32 }}>
      <p className="text-body-sm text-on-secondary-container">&copy; 2024 CoMP Ledger. All rights reserved.</p>
      <div className="flex gap-lg">
        <a className="text-body-sm text-on-secondary-container hover:text-primary underline" href="#">Privacy Policy</a>
        <a className="text-body-sm text-on-secondary-container hover:text-primary underline" href="#">Terms of Service</a>
      </div>
    </footer>
  );
}
