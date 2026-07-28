import React, { useState, useRef } from 'react';
import Landing from './components/Landing.jsx';
import InputPanel from './components/InputPanel.jsx';
import Ledger from './components/Ledger.jsx';
import ExportButton from './components/ExportButton.jsx';
import Dashboard from './components/Dashboard.jsx';
import { Sidebar, TopBar, AppFooter } from './components/Shell.jsx';
import { useTrace } from './hooks/useTrace.js';
import Compare from './components/Compare.jsx';

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="bg-surface border border-outline-variant rounded-xl px-md py-md flex items-center gap-md hover:shadow-sm transition-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
        <span className="material-symbols-outlined text-on-primary" style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div>
        <p className="font-black text-on-surface leading-none" style={{ fontSize: 28 }}>{value}</p>
        <p className="text-label-md text-on-surface-variant mt-xs">{label}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [entered, setEntered] = useState(false);
  const { claims, status, total, startTrace } = useTrace();
  const [lastQuery, setLastQuery] = useState({ question: '', answer: '' });
  const [exportResult, setExportResult] = useState(null);
  const [activeTab, setActiveTab] = useState('claims');
  const historyRef = useRef([]);

  if (!entered) return <Landing onEnter={() => setEntered(true)} />;

  const handleTrace = (question, answer, mode) => {
    setLastQuery({ question, answer });
    setExportResult(null);
    startTrace(question, answer, mode);
  };

  // Track completed runs for dashboard
  if (status === 'done' && claims.length > 0) {
    const lastRun = historyRef.current[historyRef.current.length - 1];
    if (!lastRun || lastRun.claims !== claims) {
      historyRef.current = [...historyRef.current, { claims, question: lastQuery.question, answer: lastQuery.answer, timestamp: Date.now() }];
    }
  }

  const exclusive = claims.filter(c => c.exclusivity_score >= 0.7).length;
  const commodity = claims.filter(c => c.exclusivity_score < 0.4).length;
  const fingerprints = claims.filter(c => c.fingerprint?.detected).length;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <TopBar />

      <main className="flex flex-col gap-lg overflow-x-hidden" style={{ marginLeft: 260, paddingTop: 88, paddingLeft: 32, paddingRight: 32, paddingBottom: 40 }}>

        {activeTab === 'dashboard' && (
          <Dashboard history={historyRef.current} />
        )}

        {activeTab === 'compare' && <Compare />}

        {activeTab === 'claims' && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-4 gap-md">
              <StatCard icon="format_list_numbered" label="Total Facts" value={claims.length || '—'} accent="bg-primary" />
              <StatCard icon="verified" label="Unique" value={exclusive || '—'} accent="bg-primary" />
              <StatCard icon="public" label="Common" value={commodity || '—'} accent="bg-secondary" />
              <StatCard icon="fingerprint" label="Copied Markers" value={fingerprints || '—'} accent={fingerprints > 0 ? 'bg-error' : 'bg-secondary'} />
            </div>

            {/* Input + Ledger */}
            <div className="flex gap-lg items-start">
              <div className="flex flex-col gap-md" style={{ width: 340, flexShrink: 0 }}>
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

              <div className="flex-1 min-w-0">
                {exportResult ? (
                  <ExportSuccess result={exportResult} onBack={() => setExportResult(null)} />
                ) : (
                  <Ledger claims={claims} status={status} total={total} />
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <AppFooter />
    </div>
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
      <div className="bg-surface border border-outline-variant rounded-lg px-md py-sm flex items-center gap-md">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 24 }}>check_circle</span>
        <div>
          <p className="text-body-md font-bold text-on-surface">Record Stored</p>
          <p className="text-body-sm text-on-surface-variant">Immutable hash saved to permanent storage</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-md">
        <div className="col-span-8 bg-surface border border-outline-variant rounded-lg p-md">
          <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-widest mb-sm">Storage Path</p>
          <p className="font-code text-code text-primary break-all">{result.s3_uri ?? '—'}</p>
        </div>

        <div className="col-span-4 bg-surface border border-outline-variant rounded-lg p-md">
          <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-widest mb-sm">SHA-256</p>
          <p className="font-code text-code text-on-surface break-all">{result.sha256}</p>
        </div>

        <div className="col-span-12 bg-surface border border-outline-variant rounded-lg overflow-hidden">
          <div className="px-md py-sm bg-surface-container-low border-b border-outline-variant flex items-center gap-sm">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>data_object</span>
            <span className="text-label-md font-bold text-on-surface">Full Record (JSON)</span>
          </div>
          <pre
            className="p-md font-code text-code text-on-surface overflow-auto custom-scrollbar"
            style={{ maxHeight: 360, background: '#fafbff' }}
            dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonStr) }}
          />
        </div>
      </div>

      <div className="flex gap-md justify-end">
        <button
          onClick={onBack}
          className="px-md py-sm bg-surface border border-outline-variant rounded text-label-md font-bold text-on-surface hover:bg-surface-container-low transition-colors"
        >
          Back to Ledger
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(jsonStr)}
          className="px-md py-sm bg-primary text-on-primary rounded text-label-md font-bold hover:opacity-90 transition-opacity"
        >
          Copy JSON
        </button>
      </div>
    </div>
  );
}
