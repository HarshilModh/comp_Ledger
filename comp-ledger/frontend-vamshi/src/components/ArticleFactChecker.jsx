import React, { useState } from 'react';
import { useArticleTrace } from '../hooks/useArticleTrace.js';

const DEMO_ARTICLE = `Prime Minister John Doe died Monday in a helicopter crash near the capital city of Verdania. He was 67 years old. The crash occurred at approximately 14:30 local time near Mount Kazbek while the helicopter was returning from an official state visit. Emergency services confirmed there were no survivors among the seven people on board. President Sarah Chen expressed deep condolences, calling Doe "an irreplaceable leader who devoted his life to public service." The opposition party leader described the news as a "national tragedy." Verdania's parliament is expected to convene an emergency session on Tuesday to address the constitutional succession process. Doe had served as Prime Minister for twelve years and was widely credited with steering the country through the 2018 economic crisis.`;

function VerdictBadge({ verdict }) {
  const config = {
    VERIFIED:          { color: '#16a34a', bg: 'rgba(22,163,74,0.1)',  icon: 'check_circle',     label: 'Verified' },
    UNVERIFIED:        { color: '#dc2626', bg: 'rgba(220,38,38,0.1)',  icon: 'cancel',           label: 'Unverified' },
    CONFLICTING:       { color: '#d97706', bg: 'rgba(217,119,6,0.1)',  icon: 'warning',          label: 'Conflicting' },
    INSUFFICIENT_DATA: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)',icon: 'help',             label: 'Insufficient Data' },
    SKIPPED:           { color: '#6b7280', bg: 'rgba(107,114,128,0.1)',icon: 'remove_circle',    label: 'Skipped' },
  };
  const c = config[verdict] || config.INSUFFICIENT_DATA;
  return (
    <span
      className="inline-flex items-center gap-xs px-sm py-xs rounded-lg text-label-md font-bold"
      style={{ color: c.color, background: c.bg, fontSize: 11 }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{c.icon}</span>
      {c.label}
    </span>
  );
}

function ExclusivityBar({ score }) {
  const pct = Math.round((score ?? 0) * 100);
  const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#6b7280';
  return (
    <div className="flex items-center gap-sm">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'var(--surface-container-high)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.6s ease' }} />
      </div>
      <span className="text-label-md font-bold" style={{ color, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function SourceList({ sources }) {
  if (!sources?.length) return <span className="text-body-sm text-on-surface-variant opacity-50">No sources</span>;
  return (
    <div className="flex flex-wrap gap-xs mt-xs">
      {sources.slice(0, 4).map((s, i) => (
        <a
          key={i}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={s.title}
          className="inline-flex items-center gap-xs px-sm py-xs rounded-lg text-label-md transition-all hover:opacity-80"
          style={{ background: s.source_type === 'WIKIPEDIA' ? 'rgba(59,130,246,0.1)' : 'rgba(22,163,74,0.1)', color: s.source_type === 'WIKIPEDIA' ? '#3b82f6' : '#16a34a', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: 11 }}>
            {s.source_type === 'WIKIPEDIA' ? 'menu_book' : 'newspaper'}
          </span>
          {s.domain || s.source_type}
        </a>
      ))}
      {sources.length > 4 && (
        <span className="text-label-md text-on-surface-variant" style={{ fontSize: 11, padding: '4px 8px' }}>+{sources.length - 4} more</span>
      )}
    </div>
  );
}

function ClaimCard({ claim, index }) {
  const [expanded, setExpanded] = useState(false);
  const live = claim.live_verification;
  const verdict = live?.verdict || 'INSUFFICIENT_DATA';
  const confidence = live?.confidence ?? 0;

  return (
    <div
      className="glass-card overflow-hidden transition-all duration-200"
      style={{ borderLeft: `3px solid ${verdict === 'VERIFIED' ? '#16a34a' : verdict === 'UNVERIFIED' ? '#dc2626' : verdict === 'CONFLICTING' ? '#d97706' : '#6b7280'}` }}
    >
      <div
        className="flex items-start gap-md p-md cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-label-md font-bold text-on-surface-variant shrink-0 w-6 text-right mt-xs">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-body-md text-on-surface mb-sm">{claim.claim_text}</p>
          <div className="flex flex-wrap items-center gap-md">
            <VerdictBadge verdict={verdict} />
            {live?.confidence != null && (
              <span className="text-label-md text-on-surface-variant" style={{ fontSize: 11 }}>
                {Math.round(confidence * 100)}% confidence
              </span>
            )}
            <div className="flex items-center gap-xs">
              <span className="text-label-md text-on-surface-variant" style={{ fontSize: 11 }}>Exclusivity</span>
              <div style={{ width: 80 }}><ExclusivityBar score={claim.exclusivity_score} /></div>
            </div>
            {live?.live_source_count > 0 && (
              <span className="inline-flex items-center gap-xs text-label-md text-on-surface-variant" style={{ fontSize: 11 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>language</span>
                {live.live_source_count} live source{live.live_source_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant shrink-0 transition-transform" style={{ fontSize: 18, transform: expanded ? 'rotate(180deg)' : 'none' }}>
          expand_more
        </span>
      </div>

      {expanded && (
        <div className="border-t border-outline-variant px-md pb-md pt-sm space-y-sm" style={{ marginLeft: 40 }}>
          {live?.reasoning && (
            <div>
              <p className="text-label-md font-bold text-on-surface-variant mb-xs">Reasoning</p>
              <p className="text-body-sm text-on-surface">{live.reasoning}</p>
            </div>
          )}
          {live?.sources?.length > 0 && (
            <div>
              <p className="text-label-md font-bold text-on-surface-variant mb-xs">Sources</p>
              <SourceList sources={live.sources} />
            </div>
          )}
          {claim.match?.found && (
            <div>
              <p className="text-label-md font-bold text-on-surface-variant mb-xs">Internal Corpus Match</p>
              <p className="text-body-sm text-on-surface-variant font-italic">"{claim.match.publisher_passage}"</p>
              <p className="text-label-md text-on-surface-variant mt-xs" style={{ fontSize: 11 }}>{claim.match.doc_id}</p>
            </div>
          )}
          {claim.scoring_failed && (
            <p className="text-body-sm text-on-surface-variant opacity-60">Scoring failed: {claim.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Summary({ claims }) {
  const verified = claims.filter(c => c.live_verification?.verdict === 'VERIFIED').length;
  const unverified = claims.filter(c => c.live_verification?.verdict === 'UNVERIFIED').length;
  const conflicting = claims.filter(c => c.live_verification?.verdict === 'CONFLICTING').length;
  const insufficient = claims.filter(c => !c.live_verification || c.live_verification.verdict === 'INSUFFICIENT_DATA').length;

  const stats = [
    { label: 'Verified', value: verified,     color: '#16a34a', icon: 'check_circle' },
    { label: 'Unverified', value: unverified, color: '#dc2626', icon: 'cancel' },
    { label: 'Conflicting', value: conflicting, color: '#d97706', icon: 'warning' },
    { label: 'Insufficient', value: insufficient, color: '#6b7280', icon: 'help' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
      {stats.map(({ label, value, color, icon }) => (
        <div key={label} className="glass-card p-md flex items-center gap-md">
          <span className="material-symbols-outlined" style={{ fontSize: 24, color }}>{icon}</span>
          <div>
            <p className="text-headline-md font-black text-on-surface">{value}</p>
            <p className="text-label-md text-on-surface-variant">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ArticleFactChecker() {
  const [articleText, setArticleText] = useState('');
  const [publisherName, setPublisherName] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const { claims, status, total, startTrace, reset } = useArticleTrace();

  const isLoading = status === 'streaming';

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!articleText.trim()) return;
    setErrorDetail('');
    startTrace(articleText.trim(), publisherName.trim() || 'Silicon Insider');
  };

  const handleReset = () => {
    setArticleText('');
    setPublisherName('');
    reset();
  };

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-headline-md font-black text-on-surface">Article Fact Checker</h2>
          <p className="text-body-sm text-on-surface-variant mt-xs">
            Paste your article before publishing. Every claim is verified against GDELT global news and Wikipedia in real time.
          </p>
        </div>
        {status !== 'idle' && (
          <button onClick={handleReset} className="btn-ghost text-label-md flex items-center gap-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            New Article
          </button>
        )}
      </div>

      {status === 'idle' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          <div className="glass-input flex flex-col overflow-hidden" style={{ height: 48 }}>
            <input
              value={publisherName}
              onChange={e => setPublisherName(e.target.value)}
              className="flex-1 px-md py-sm bg-transparent border-none focus:ring-0 text-body-md text-on-surface placeholder:text-on-surface-variant placeholder:opacity-50"
              placeholder="Publisher name (optional, defaults to Silicon Insider)"
            />
          </div>

          <div className="glass-input flex flex-col overflow-hidden" style={{ minHeight: 280 }}>
            <div className="px-md py-xs border-b border-outline-variant flex justify-between items-center" style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
              <span className="text-label-md font-bold text-on-surface">Article Text</span>
              <button
                type="button"
                onClick={() => setArticleText(DEMO_ARTICLE)}
                className="text-label-md text-primary hover:underline font-medium"
              >
                Load demo
              </button>
            </div>
            <textarea
              value={articleText}
              onChange={e => setArticleText(e.target.value)}
              className="flex-1 px-md py-sm bg-transparent border-none focus:ring-0 text-body-md text-on-surface resize-none placeholder:text-on-surface-variant placeholder:opacity-50 custom-scrollbar"
              style={{ minHeight: 240 }}
              placeholder="Paste your article text here..."
            />
          </div>

          <button
            type="submit"
            disabled={!articleText.trim()}
            className="btn-primary w-full text-label-md flex items-center justify-center gap-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>fact_check</span>
            Fact Check Article
          </button>
        </form>
      )}

      {status !== 'idle' && (
        <div className="flex flex-col gap-md">
          {status === 'streaming' && (
            <div className="glass-card px-md py-sm flex items-center gap-md" style={{ borderLeft: '3px solid var(--primary)' }}>
              <span className="material-symbols-outlined text-primary live-pulse" style={{ fontSize: 20 }}>pending</span>
              <div>
                <p className="text-body-md font-bold text-on-surface">
                  Checking {claims.length} of {total || '…'} claims
                </p>
                <p className="text-body-sm text-on-surface-variant">Querying GDELT and Wikipedia in real time…</p>
              </div>
            </div>
          )}

          {status === 'done' && <Summary claims={claims} />}

          {status === 'error' && (
            <div className="glass-card px-md py-sm flex flex-col gap-xs" style={{ borderLeft: '3px solid #dc2626' }}>
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#dc2626' }}>error</span>
                <p className="text-body-md text-on-surface">Backend error — check the browser console (F12) for details.</p>
              </div>
              {errorDetail && <p className="text-body-sm font-code text-on-surface-variant ml-xl">{errorDetail}</p>}
            </div>
          )}

          <div className="flex flex-col gap-sm">
            {claims.map((claim, i) => (
              <ClaimCard key={claim.claim_id ?? i} claim={claim} index={i} />
            ))}
            {status === 'streaming' && total > claims.length && (
              Array.from({ length: Math.min(3, total - claims.length) }, (_, i) => (
                <div key={`skel-${i}`} className="glass-card p-md animate-pulse">
                  <div className="h-4 rounded-md bg-surface-container-high" style={{ width: '70%' }} />
                  <div className="h-3 rounded-md bg-surface-container-high mt-sm" style={{ width: '40%' }} />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
