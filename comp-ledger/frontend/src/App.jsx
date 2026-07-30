import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './components/Landing.jsx';
import InputPanel from './components/InputPanel.jsx';
import Ledger from './components/Ledger.jsx';
import ExportButton from './components/ExportButton.jsx';
import Dashboard from './components/Dashboard.jsx';
import { Sidebar, TopBar, AppFooter, SIDEBAR_FULL, SIDEBAR_COLLAPSED } from './components/Shell.jsx';
import { useTrace } from './hooks/useTrace.js';
import Compare from './components/Compare.jsx';
import ResizablePanel from './components/ResizablePanel.jsx';
import DeepResearch from './components/DeepResearch.jsx';
import PublisherDashboard from './components/PublisherDashboard.jsx';
import PublisherOnboard from './components/PublisherOnboard.jsx';
import AuthPage from './components/AuthPage.jsx';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

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

function AnswerPanel({ answer, generating, modelLabel }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!answer && !generating) return null;
  return (
    <div className="glass-card overflow-hidden row-animate">
      <div className="px-md py-sm border-b border-outline-variant flex items-center justify-between"
        style={{ background: 'rgba(22,163,74,0.03)' }}>
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>smart_toy</span>
          <span className="text-label-md font-bold text-on-surface">Generated Answer</span>
          {modelLabel && (
            <span className="px-sm py-px rounded-full text-label-sm font-medium text-on-surface-variant"
              style={{ fontSize: 10, background: 'var(--surface-container)' }}>
              {modelLabel}
            </span>
          )}
        </div>
        {answer && (
          <button onClick={() => setCollapsed(c => !c)}
            className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {collapsed ? 'expand_more' : 'expand_less'}
            </span>
          </button>
        )}
      </div>
      {generating && !answer ? (
        <div className="px-md py-md flex items-center gap-sm">
          <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 16 }}>pending</span>
          <span className="text-body-sm text-on-surface-variant">Asking the model…</span>
        </div>
      ) : !collapsed && (
        <div className="px-md py-md">
          <p className="text-body-sm text-on-surface leading-relaxed" style={{ fontSize: 13 }}>{answer}</p>
        </div>
      )}
    </div>
  );
}

function ClaimsPage({ claims, status, total, handleTrace, lastQuery, exportResult, setExportResult, generatedAnswer, generating }) {
  const exclusive = claims.filter(c => c.exclusivity_score >= 0.7).length;
  const fingerprints = claims.filter(c => c.fingerprint?.detected).length;
  const matchedSources = claims.filter(c => c.match?.found).length;
  const totalClaims = claims.length;

  const displayAnswer = generatedAnswer || lastQuery.answer;
  const modelLabel = lastQuery.modelLabel;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
        <StatCard icon="format_list_numbered" label="Active Claims" value={totalClaims || '—'} glow tooltip="Total factual claims extracted from the AI answer" />
        <StatCard icon="verified" label="Avg Exclusivity" value={exclusive ? `${Math.round((exclusive / (totalClaims || 1)) * 100)}%` : '—'} glow tooltip="Percentage of claims scoring 70%+ uniqueness" />
        <StatCard icon="public" label="Source Nodes" value={totalClaims > 0 ? `${matchedSources}/${totalClaims}` : '0/0'} tooltip="Claims matched to publisher sources vs total claims" />
        <StatCard icon="fingerprint" label="Integrity Score" value={fingerprints > 0 ? 'Review' : totalClaims > 0 ? 'AA+' : '—'} tooltip="Overall content integrity rating based on fingerprint detection" />
      </div>

      <ResizablePanel
        defaultLeftPercent={35}
        minLeft={300}
        minRight={360}
        left={
          <div className="flex flex-col gap-md pr-0">
            <InputPanel onTrace={handleTrace} status={status} generating={generating} />
            {status === 'done' && claims.length > 0 && (
              <ExportButton
                claims={claims}
                question={lastQuery.question}
                answer={displayAnswer}
                onResult={setExportResult}
              />
            )}
          </div>
        }
        right={
          <div className="min-w-0 pl-0 flex flex-col gap-md">
            <AnswerPanel answer={generatedAnswer} generating={generating} modelLabel={modelLabel} />
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
  const { claims, status, total, generatedAnswer, generating, startTrace } = useTrace();
  const { user, logout, isAdmin } = useAuth();
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

  const handleTrace = (question, answer, mode, auto = false, modelId = null) => {
    const AUTO_MODELS = [
      { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
      { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4' },
      { id: 'us.amazon.nova-micro-v1:0', label: 'Nova Micro' },
      { id: 'us.amazon.nova-lite-v1:0', label: 'Nova Lite' },
      { id: 'us.meta.llama3-1-8b-instruct-v1:0', label: 'Llama 3.1 8B' },
    ];
    const modelLabel = modelId ? (AUTO_MODELS.find(m => m.id === modelId)?.label || '') : '';
    setLastQuery({ question, answer, modelLabel });
    setExportResult(null);
    startTrace(question, answer, mode, auto, modelId);
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
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} user={user} onLogout={logout} />
      <TopBar sidebarWidth={sidebarWidth} user={user} onLogout={logout} />

      <main className="relative z-10 flex flex-col gap-lg transition-all duration-300" style={{ marginLeft: sidebarWidth, paddingTop: 88, paddingLeft: 32, paddingRight: 32, paddingBottom: 72 }}>
        <ErrorBoundary>
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
                generatedAnswer={generatedAnswer}
                generating={generating}
              />
            } />
            <Route path="/compare" element={<Compare />} />
            <Route path="/deep-research" element={<DeepResearch />} />
            <Route path="/publishers" element={
              isAdmin ? <PublisherOnboard /> : <Navigate to={`/publisher/${user?.id}`} replace />
            } />
            <Route path="/publisher/:id" element={<PublisherDashboard />} />
            <Route path="*" element={<Navigate to="/facts" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <AppFooter sidebarWidth={sidebarWidth} />
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="ambient-mesh" />
        <div className="relative z-10 flex flex-col items-center gap-md">
          <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 40 }}>pending</span>
          <p className="text-body-md text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/about" element={<Landing />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
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
