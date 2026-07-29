import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Landing from './components/Landing.jsx';
import InputPanel from './components/InputPanel.jsx';
import Ledger from './components/Ledger.jsx';
import ExportButton from './components/ExportButton.jsx';
import Dashboard from './components/Dashboard.jsx';
import { Sidebar, TopBar, AppFooter, SIDEBAR_FULL, SIDEBAR_COLLAPSED } from './components/Shell.jsx';
import { useTrace } from './hooks/useTrace.js';
import Compare from './components/Compare.jsx';
import ResizablePanel from './components/ResizablePanel.jsx';

function StatCard({ icon, label, value, glow, tooltip }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="stat-card relative" style={{ overflow: 'visible' }}>
      <div className="flex items-center gap-sm mb-sm">
        <span className={`material-symbols-outlined ${glow ? 'text-primary' : 'text-on-surface-variant'}`} style={{ fontSize: 18 }}>{icon}</span>
        <span className="text-label-md text-on-surface-variant flex-1">{label}</span>
        {tooltip && (
          <span
            className="relative"
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            <span className="material-symbols-outlined text-on-surface-variant opacity-50 hover:opacity-100 transition-opacity cursor-help" style={{ fontSize: 16 }}>info</span>
            {showTip && (
              <span className="stat-tooltip stat-tooltip-visible">{tooltip}</span>
            )}
          </span>
        )}
      </div>
      <h3 className="text-headline-md font-black text-on-surface">{value}</h3>
    </div>
  );
}

function ClaimsPage({ claims, status, total, handleTrace, lastQuery, exportResult, setExportResult }) {
  const exclusive = claims.filter(c => c.exclusivity_score >= 0.7).length;
  const fingerprints = claims.filter(c => c.fingerprint?.detected).length;
  const matchedSources = claims.filter(c => c.match?.found).length;
  const totalClaims = claims.length;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
        <StatCard icon="format_list_numbered" label="Active Claims" value={totalClaims || '—'} glow tooltip="Total factual claims extracted from the AI answer" />
        <StatCard icon="verified" label="Avg Exclusivity" value={exclusive ? `${Math.round((exclusive / (totalClaims || 1)) * 100)}%` : '—'} glow tooltip="Percentage of claims scoring 70%+ uniqueness" />
        <StatCard icon="public" label="Source Nodes" value={totalClaims > 0 ? `${matchedSources}/${totalClaims}` : '0/0'} tooltip="Claims matched to publisher sources vs total claims" />
        <StatCard icon="fingerprint" label="Integrity Score" value={fingerprints > 0 ? 'Review' : 'AA+'} tooltip="Overall content integrity rating based on fingerprint detection" />
      </div>

      <ResizablePanel
        defaultLeftPercent={35}
        minLeft={300}
        minRight={360}
        left={
          <div className="flex flex-col gap-md pr-0">
            <InputPanel onTrace={handleTrace} status={status} />
            {status === 'done' && claims.length > 0 && (
              <ExportButton
                claims={claims}
                question={lastQuery.question}
                answer={lastQuery.answer}
                onResult={setExportResult}
              />
            )}
          </div>
        }
        right={
          <div className="min-w-0 pl-0">
            {exportResult ? (
              <ExportSuccess result={exportResult} onBack={() => setExportResult(null)} />
            ) : (
              <Ledger claims={claims} status={status} total={total} />
            )}
          </div>
        }
      />
    </>
  );
}

function AppShell() {
  const { claims, status, total, startTrace } = useTrace();
  const [lastQuery, setLastQuery] = useState({ question: '', answer: '' });
  const [exportResult, setExportResult] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch('/api/traces')
      .then(res => res.json())
      .then(data => {
        const mapped = (data.traces || []).map(t => ({
          claims: t.claims,
          question: t.question,
          answer: t.answer,
          timestamp: new Date(t.created_at).getTime(),
        }));
        setHistory(mapped);
      })
      .catch(() => {});
  }, []);

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL;

  const handleTrace = (question, answer, mode) => {
    setLastQuery({ question, answer });
    setExportResult(null);
    startTrace(question, answer, mode);
  };

  useEffect(() => {
    if (status === 'done' && claims.length > 0) {
      fetch('/api/traces')
        .then(res => res.json())
        .then(data => {
          const mapped = (data.traces || []).map(t => ({
            claims: t.claims,
            question: t.question,
            answer: t.answer,
            timestamp: new Date(t.created_at).getTime(),
          }));
          setHistory(mapped);
        })
        .catch(() => {});
    }
  }, [status, claims]);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <div className="ambient-mesh" />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      <TopBar sidebarWidth={sidebarWidth} />

      <main className="relative z-10 flex flex-col gap-lg transition-all duration-300" style={{ marginLeft: sidebarWidth, paddingTop: 88, paddingLeft: 32, paddingRight: 32, paddingBottom: 72 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/facts" replace />} />
          <Route path="/dashboard" element={<Dashboard history={history} />} />
          <Route path="/facts" element={
            <ClaimsPage
              claims={claims}
              status={status}
              total={total}
              handleTrace={handleTrace}
              lastQuery={lastQuery}
              exportResult={exportResult}
              setExportResult={setExportResult}
            />
          } />
          <Route path="/compare" element={<Compare />} />
          <Route path="*" element={<Navigate to="/facts" replace />} />
        </Routes>
      </main>

      <AppFooter sidebarWidth={sidebarWidth} />
    </div>
  );
}

export default function App() {
  const [entered, setEntered] = useState(() => {
    return sessionStorage.getItem('comp-ledger-entered') === 'true';
  });

  const handleEnter = () => {
    sessionStorage.setItem('comp-ledger-entered', 'true');
    setEntered(true);
  };

  if (!entered) return <Landing onEnter={handleEnter} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/about" element={<Landing />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}

function ExportSuccess({ result, onBack }) {
  const jsonStr = JSON.stringify(result.record ?? result, null, 2);

  function syntaxHighlight(str) {
    return str.replace(/("[\w_]+")\s*:/g, '<span class="json-key">$1</span>:')
              .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="json-string">$1</span>')
              .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>');
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="glass-card px-md py-sm flex items-center gap-md" style={{ borderLeft: '3px solid var(--primary)' }}>
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 24 }}>check_circle</span>
        <div>
          <p className="text-body-md font-bold text-on-surface">Record Stored</p>
          <p className="text-body-sm text-on-surface-variant">Immutable hash saved to permanent storage</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-md">
        <div className="col-span-8 glass-card p-md">
          <p className="text-label-md text-on-surface-variant mb-xs">Storage Path</p>
          <p className="font-code text-code text-primary break-all">{result.s3_uri ?? '—'}</p>
        </div>

        <div className="col-span-4 glass-card p-md">
          <p className="text-label-md text-on-surface-variant mb-xs">SHA-256</p>
          <p className="font-code text-code text-on-surface break-all">{result.sha256}</p>
        </div>

        <div className="col-span-12 glass-card overflow-hidden p-0">
          <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>data_object</span>
            <span className="text-label-md font-bold text-on-surface">Full Record (JSON)</span>
          </div>
          <pre
            className="p-md font-code text-code text-on-surface overflow-auto custom-scrollbar"
            style={{ maxHeight: 360 }}
            dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonStr) }}
          />
        </div>
      </div>

      <div className="flex gap-md justify-end">
        <button onClick={onBack} className="btn-ghost text-label-md">Back to Ledger</button>
        <button onClick={() => navigator.clipboard?.writeText(jsonStr)} className="btn-primary text-label-md">Copy JSON</button>
      </div>
    </div>
  );
}
