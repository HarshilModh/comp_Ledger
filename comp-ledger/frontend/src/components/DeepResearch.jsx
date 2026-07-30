import React, { useState, useEffect } from 'react';
import { useDeepTrace } from '../hooks/useDeepTrace.js';
import Ledger from './Ledger.jsx';
import ResizablePanel from './ResizablePanel.jsx';

function VerdictChip({ verdict }) {
  const styles = {
    CONFIRMED: { bg: 'rgba(22, 163, 74, 0.12)', color: 'var(--primary)', border: 'rgba(22, 163, 74, 0.3)' },
    LIKELY: { bg: 'rgba(59, 130, 246, 0.10)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
    UNCONFIRMED: { bg: 'rgba(245, 158, 11, 0.10)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
    INSUFFICIENT_DATA: { bg: 'var(--surface-container)', color: 'var(--on-surface-variant)', border: 'var(--outline-variant)' },
  };
  const s = styles[verdict] || styles.INSUFFICIENT_DATA;
  return (
    <span className="inline-flex items-center px-sm py-xs rounded-md text-label-sm font-bold" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {verdict?.replace('_', ' ')}
    </span>
  );
}

function SourceTypeIcon({ type }) {
  const icons = { WIKIPEDIA: 'language', GDELT: 'public', GOOGLE_CSE: 'search', WAYBACK: 'history', OPENALEX: 'school', WEB_SEARCH: 'travel_explore' };
  return <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icons[type] || 'link'}</span>;
}

function ResearchFeed({ researchSources, claims }) {
  const entries = Object.entries(researchSources);
  if (entries.length === 0) return null;

  const allSources = entries.flatMap(([claimId, data]) =>
    (data.sources || []).map(s => ({ ...s, claimId }))
  );

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-md py-sm border-b border-outline-variant flex items-center justify-between" style={{ background: 'var(--surface-container-low)' }}>
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary live-pulse" style={{ fontSize: 14 }}>travel_explore</span>
          <span className="text-label-md font-bold text-on-surface">Live Research Feed</span>
        </div>
        <span className="font-code text-on-surface-variant" style={{ fontSize: 11 }}>{allSources.length} sources</span>
      </div>
      <div className="max-h-64 overflow-y-auto custom-scrollbar">
        {allSources.length === 0 ? (
          <div className="p-md text-center">
            <span className="text-body-sm text-on-surface-variant opacity-60">Searching...</span>
          </div>
        ) : (
          allSources.slice(-15).reverse().map((source, i) => (
            <div key={i} className="flex items-start gap-sm px-md py-xs border-b border-outline-variant/30 last:border-0 row-animate" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 mt-px" style={{ background: 'var(--surface-container-high)' }}>
                <SourceTypeIcon type={source.sourceType} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm text-on-surface font-medium truncate">{source.title || source.url}</p>
                <div className="flex items-center gap-sm">
                  <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>{source.domain}</span>
                  {source.publishedAt && (
                    <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>&middot; {source.publishedAt.slice(0, 10)}</span>
                  )}
                </div>
              </div>
              {source.isPublisherDomain && (
                <span className="shrink-0 px-xs py-px rounded text-primary font-bold" style={{ fontSize: 9, background: 'var(--primary-fixed)' }}>MATCH</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function DeepResearch() {
  const { claims, status, total, researchSources, startTrace, reset } = useDeepTrace();
  const [publishers, setPublishers] = useState([]);
  const [selectedPublisher, setSelectedPublisher] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    fetch('/api/publishers').then(r => r.json()).then(data => {
      setPublishers(data);
      if (data.length > 0 && !selectedPublisher) setSelectedPublisher(data[0].id);
    }).catch(() => {});
  }, []);

  function loadDemo() {
    if (publishers.length > 0) setSelectedPublisher(publishers[0].id);
    setQuestion('What evidence exists about COVID-19 origins related to the Wuhan lab?');
    setAnswer('Three researchers at the Wuhan Institute of Virology sought hospital care in November 2019. The institute\'s viral database of 22,257 bat coronavirus entries was taken offline in September 2019. The Energy Department assessed with low confidence that a lab leak was the most likely origin, while four other agencies favored natural spillover from animals at the Huanan Seafood Market, where raccoon dog DNA was found mixed with SARS-CoV-2 RNA.');
  }

  function handleSubmit(e) {
    e?.preventDefault();
    if (!selectedPublisher || !question.trim() || !answer.trim()) return;
    startTrace(question, answer, selectedPublisher);
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  const isLoading = status === 'streaming';
  const confirmed = claims.filter(c => c.research?.verdict === 'CONFIRMED').length;
  const likely = claims.filter(c => c.research?.verdict === 'LIKELY').length;
  const totalSources = Object.values(researchSources).reduce((sum, d) => sum + (d.sources?.length || 0), 0);

  return (
    <div className="flex flex-col gap-lg">
      {claims.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
          <StatCard icon="verified" label="Confirmed" value={confirmed} glow />
          <StatCard icon="thumb_up" label="Likely" value={likely} />
          <StatCard icon="travel_explore" label="Sources Found" value={totalSources} />
          <StatCard icon="format_list_numbered" label="Total Claims" value={claims.length} />
        </div>
      )}

      <ResizablePanel
        defaultLeftPercent={35}
        minLeft={300}
        minRight={360}
        left={
          <div className="flex flex-col gap-md">
            <form onSubmit={handleSubmit} className="flex flex-col gap-md">
              <div className="flex items-center justify-between">
                <div className="flex gap-xs p-xs rounded-xl" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}>
                  <div className="px-md py-xs rounded-lg text-label-md font-medium bg-primary text-on-primary shadow-sm" style={{ boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)' }}>
                    Deep Research
                  </div>
                </div>
                <div className="flex items-center gap-sm">
                  {status === 'idle' && (
                    <button type="button" onClick={loadDemo} className="text-label-sm text-on-surface-variant hover:text-primary font-medium transition-colors">
                      Load Demo
                    </button>
                  )}
                  {status === 'done' && (
                    <button type="button" onClick={reset} className="text-label-md text-primary hover:underline font-medium">
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="glass-input flex flex-col overflow-hidden" style={{ height: 56 }}>
                <div className="px-md py-xs border-b border-outline-variant flex justify-between items-center" style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
                  <span className="text-label-md font-bold text-on-surface">Publisher</span>
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16, opacity: 0.5 }}>apartment</span>
                </div>
                <select
                  value={selectedPublisher}
                  onChange={e => setSelectedPublisher(e.target.value)}
                  required
                  className="flex-1 px-md bg-transparent border-none focus:ring-0 text-body-md text-on-surface"
                >
                  <option value="">Select publisher...</option>
                  {publishers.map(p => (
                    <option key={p.id} value={p.id}>{p.publication} ({p.domain})</option>
                  ))}
                </select>
              </div>

              <div className="glass-input flex flex-col overflow-hidden" style={{ height: 100 }}>
                <div className="px-md py-xs border-b border-outline-variant flex justify-between items-center" style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
                  <span className="text-label-md font-bold text-on-surface">Question Asked to AI</span>
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16, opacity: 0.5 }}>help_outline</span>
                </div>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 px-md py-sm bg-transparent border-none focus:ring-0 text-body-md text-on-surface resize-none placeholder:text-on-surface-variant placeholder:opacity-50"
                  placeholder="What question was asked to the AI model?"
                />
              </div>

              <div className="glass-input flex flex-col overflow-hidden" style={{ height: 160 }}>
                <div className="px-md py-xs border-b border-outline-variant flex justify-between items-center" style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
                  <span className="text-label-md font-bold text-on-surface">AI Answer</span>
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16, opacity: 0.5 }}>smart_toy</span>
                </div>
                <textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 px-md py-sm bg-transparent border-none focus:ring-0 text-body-md text-on-surface resize-none placeholder:text-on-surface-variant placeholder:opacity-50 custom-scrollbar"
                  placeholder="Paste the AI-generated answer..."
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !selectedPublisher || !question.trim() || !answer.trim()}
                className="btn-primary w-full text-label-md flex items-center justify-center gap-sm"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined live-pulse" style={{ fontSize: 18 }}>pending</span>
                    Researching...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>travel_explore</span>
                    Run Deep Research
                  </>
                )}
              </button>
            </form>

            <ResearchFeed researchSources={researchSources} claims={claims} />
          </div>
        }
        right={
          <div className="min-w-0 flex flex-col gap-md">
            {status === 'done' && claims.length > 0 && (
              <div className="glass-card px-md py-sm flex items-center gap-md" style={{ borderLeft: '3px solid var(--primary)' }}>
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>analytics</span>
                <div className="flex-1">
                  <p className="text-body-sm font-bold text-on-surface">
                    {confirmed + likely}/{claims.length} claims attributed to publisher
                  </p>
                </div>
                <div className="flex gap-xs">
                  {confirmed > 0 && <VerdictChip verdict="CONFIRMED" />}
                  {likely > 0 && <VerdictChip verdict="LIKELY" />}
                </div>
              </div>
            )}
            <Ledger claims={claims} status={status} total={total} />
          </div>
        }
      />
    </div>
  );
}

function StatCard({ icon, label, value, glow }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-sm mb-sm">
        <span className={`material-symbols-outlined ${glow ? 'text-primary' : 'text-on-surface-variant'}`} style={{ fontSize: 18 }}>{icon}</span>
        <span className="text-label-md text-on-surface-variant flex-1">{label}</span>
      </div>
      <h3 className="text-headline-md font-black text-on-surface">{value}</h3>
    </div>
  );
}
