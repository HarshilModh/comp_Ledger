import React, { useState, useMemo } from 'react';
import { useMultiTrace } from '../hooks/useMultiTrace.js';

const PRESET_QUESTIONS = [
  { icon: 'gavel', label: 'Trump taxes', q: 'How much did Trump pay in federal income taxes?' },
  { icon: 'vaccines', label: 'Vaccine safety', q: 'Are mRNA COVID vaccines safe and effective?' },
  { icon: 'factory', label: 'Climate jobs', q: 'How many jobs has the Inflation Reduction Act created?' },
  { icon: 'groups', label: 'Border crossings', q: 'How many migrants crossed the southern border in 2023?' },
];

const ALL_MODELS = [
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5', provider: 'Anthropic' },
  { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'us.amazon.nova-micro-v1:0', label: 'Nova Micro', provider: 'Amazon' },
  { id: 'us.amazon.nova-lite-v1:0', label: 'Nova Lite', provider: 'Amazon' },
  { id: 'us.meta.llama3-1-8b-instruct-v1:0', label: 'Llama 3.1 8B', provider: 'Meta' },
];

const PROVIDER_COLORS = {
  Anthropic: { bg: 'rgba(124, 58, 237, 0.1)', border: 'rgba(124, 58, 237, 0.25)', text: '#7c3aed' },
  Amazon: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)', text: '#d97706' },
  Meta: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.25)', text: '#2563eb' },
};

const STATUS_CONFIG = {
  waiting:    { label: 'Waiting',    icon: 'hourglass_empty', color: 'var(--on-surface-variant)', bg: 'var(--surface-container)' },
  generating: { label: 'Generating', icon: 'pending',         color: '#f97316',                   bg: 'rgba(249, 115, 22, 0.1)', pulse: true },
  tracing:    { label: 'Tracing',    icon: 'search',          color: '#3b82f6',                   bg: 'rgba(59, 130, 246, 0.1)', pulse: true },
  done:       { label: 'Done',       icon: 'check_circle',    color: 'var(--primary)',             bg: 'var(--primary-fixed)' },
  error:      { label: 'Error',      icon: 'error',           color: 'var(--error)',               bg: 'var(--error-container)' },
};

function scoreColor(pct) {
  if (pct >= 70) return { bg: 'linear-gradient(135deg, #16a34a, #15803d)', text: '#fff', shadow: '0 2px 8px rgba(22,163,74,0.3)' };
  if (pct >= 40) return { bg: 'linear-gradient(135deg, #f97316, #ea580c)', text: '#fff', shadow: '0 2px 8px rgba(249,115,22,0.25)' };
  return { bg: 'var(--surface-container-high)', text: 'var(--on-surface-variant)', shadow: 'none' };
}

function ScorePill({ score }) {
  const pct = Math.round((score || 0) * 100);
  const { bg, text, shadow } = scoreColor(pct);
  return (
    <span className="inline-block text-label-md font-black px-sm py-xs rounded-lg shrink-0"
      style={{ fontSize: 11, minWidth: 36, textAlign: 'center', background: bg, color: text, boxShadow: shadow }}>
      {pct}%
    </span>
  );
}

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status || 'waiting'];
  return (
    <span className="inline-flex items-center gap-xs px-sm py-xs rounded-full text-label-md font-bold"
      style={{ background: cfg.bg, color: cfg.color, fontSize: 11 }}>
      <span className={`material-symbols-outlined ${cfg.pulse ? 'live-pulse' : ''}`} style={{ fontSize: 12 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function parseDocId(docId) {
  if (!docId) return { domain: '—', slug: '' };
  const parts = docId.split('/');
  const domain = parts[0]?.replace(/-/g, '.') || docId;
  const slug = parts.slice(1).join('/').replace(/-/g, ' ').slice(0, 60) || '';
  return { domain, slug };
}

function ModelCard({ model, result }) {
  const [expanded, setExpanded] = useState(false);
  const claims = result?.claims || [];
  const exclusive = claims.filter(c => c.exclusivity_score >= 0.7).length;
  const fingerprints = claims.filter(c => c.fingerprint?.detected).length;
  const avgScore = claims.length > 0
    ? Math.round(claims.reduce((s, c) => s + (c.exclusivity_score || 0), 0) / claims.length * 100)
    : null;
  const providerStyle = PROVIDER_COLORS[model.provider] || {};

  return (
    <div className="glass-card flex flex-col overflow-hidden p-0">
      <div className="px-md py-sm border-b border-outline-variant flex items-center justify-between gap-sm"
        style={{ background: 'var(--surface-container-lowest)' }}>
        <div className="flex items-center gap-sm min-w-0">
          <span className="text-label-md font-bold px-sm py-xs rounded-lg shrink-0"
            style={{ fontSize: 10, background: providerStyle.bg, color: providerStyle.text, border: `1px solid ${providerStyle.border}` }}>
            {model.provider}
          </span>
          <span className="text-label-md font-bold text-on-surface truncate">{model.label}</span>
        </div>
        <StatusPill status={result?.status} />
      </div>

      {result?.status === 'done' && (
        <div className="grid grid-cols-3 border-b border-outline-variant divide-x divide-outline-variant">
          <div className="flex flex-col items-center py-sm gap-xs">
            <span className="text-headline-sm font-black text-on-surface">{claims.length}</span>
            <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 10 }}>Claims</span>
          </div>
          <div className="flex flex-col items-center py-sm gap-xs">
            <span className="text-headline-sm font-black text-primary">{exclusive}</span>
            <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 10 }}>Sourced</span>
          </div>
          <div className="flex flex-col items-center py-sm gap-xs">
            {avgScore !== null
              ? <span className="text-headline-sm font-black" style={{ color: avgScore >= 70 ? 'var(--primary)' : avgScore >= 40 ? '#f97316' : 'var(--on-surface-variant)' }}>{avgScore}%</span>
              : <span className="text-headline-sm font-black text-on-surface-variant">—</span>}
            <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 10 }}>Avg Score</span>
          </div>
        </div>
      )}

      {(result?.status === 'generating' || result?.status === 'tracing') && (
        <div className="px-md py-md flex items-center gap-sm">
          <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 16 }}>pending</span>
          <span className="text-body-sm text-on-surface-variant">
            {result.status === 'generating' ? 'Asking the model…' : 'Tracing claims against corpus…'}
          </span>
        </div>
      )}

      {result?.answer && (
        <div className="px-md py-sm border-b border-outline-variant">
          <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest mb-xs" style={{ fontSize: 9, letterSpacing: '0.08em' }}>Answer</p>
          <p className={`text-body-sm text-on-surface leading-relaxed ${!expanded ? 'line-clamp-4' : ''}`}
            style={{ fontSize: 12 }}>{result.answer}</p>
          {result.answer.length > 200 && (
            <button onClick={() => setExpanded(e => !e)} className="text-label-sm text-primary hover:underline mt-xs font-medium" style={{ fontSize: 11 }}>
              {expanded ? 'Show less' : 'Read full answer'}
            </button>
          )}
        </div>
      )}

      {result?.status === 'done' && claims.length > 0 && (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: 280 }}>
          {claims.slice().sort((a, b) => b.exclusivity_score - a.exclusivity_score).map((claim, i) => {
            const { domain, slug } = parseDocId(claim.match?.doc_id);
            return (
              <div key={claim.claim_id || i}
                className="px-md py-sm border-b border-outline-variant last:border-0 flex gap-sm items-start hover:bg-surface-container-lowest transition-colors">
                <ScorePill score={claim.exclusivity_score} />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-on-surface leading-snug" style={{ fontSize: 12 }}>{claim.claim_text}</p>
                  {claim.match?.found && (
                    <p className="text-label-sm text-primary mt-xs font-medium truncate" style={{ fontSize: 10 }}>
                      {domain}{slug ? ` · ${slug}` : ''}
                    </p>
                  )}
                  {claim.fingerprint?.detected && (
                    <span className="inline-flex items-center gap-xs mt-xs px-xs py-px rounded text-error font-bold" style={{ fontSize: 9, background: 'var(--error-container)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>fingerprint</span>Copied
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {result?.status === 'error' && (
        <div className="px-md py-md text-body-sm text-error flex items-center gap-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
          {result.error || 'Model unavailable'}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ models, results }) {
  const total = models.length;
  const done = Object.values(results).filter(r => r.status === 'done' || r.status === 'error').length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  return (
    <div className="glass-card px-md py-sm flex items-center gap-md">
      <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 16 }}>sync</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-xs">
          <span className="text-label-sm text-on-surface font-bold">Running comparison…</span>
          <span className="text-label-sm text-on-surface-variant">{done}/{total} complete</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--outline-variant)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #16a34a, #4ade80)' }} />
        </div>
      </div>
      <span className="text-label-md font-black text-primary">{pct}%</span>
    </div>
  );
}

function SummaryTable({ models, results }) {
  const rows = models.map(m => {
    const r = results[m.id];
    const claims = r?.claims || [];
    const exclusive = claims.filter(c => c.exclusivity_score >= 0.7).length;
    const fps = claims.filter(c => c.fingerprint?.detected).length;
    const avg = claims.length > 0
      ? Math.round(claims.reduce((s, c) => s + (c.exclusivity_score || 0), 0) / claims.length * 100)
      : null;
    return { model: m, claims: claims.length, exclusive, fps, avg };
  }).sort((a, b) => (b.avg || 0) - (a.avg || 0));

  const best = rows[0];

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-lowest)' }}>
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>leaderboard</span>
        <span className="text-label-md font-bold text-on-surface">Comparison Summary</span>
        <span className="text-body-sm text-on-surface-variant ml-auto" style={{ fontSize: 11 }}>Ranked by avg sourcing score</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: 'var(--surface-container-lowest)' }}>
              <th className="text-left px-md py-sm text-label-sm font-bold text-on-surface-variant border-b border-outline-variant" style={{ letterSpacing: '0.04em' }}>Model</th>
              <th className="text-center px-md py-sm text-label-sm font-bold text-on-surface-variant border-b border-outline-variant" style={{ letterSpacing: '0.04em' }}>Claims</th>
              <th className="text-center px-md py-sm text-label-sm font-bold text-on-surface-variant border-b border-outline-variant" style={{ letterSpacing: '0.04em' }}>Sourced</th>
              <th className="text-center px-md py-sm text-label-sm font-bold text-on-surface-variant border-b border-outline-variant" style={{ letterSpacing: '0.04em' }}>Avg Score</th>
              <th className="text-center px-md py-sm text-label-sm font-bold text-on-surface-variant border-b border-outline-variant" style={{ letterSpacing: '0.04em' }}>Fingerprints</th>
              <th className="text-center px-md py-sm text-label-sm font-bold text-on-surface-variant border-b border-outline-variant" style={{ letterSpacing: '0.04em' }}>Score Bar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ model, claims, exclusive, fps, avg }, i) => {
              const isTop = model.id === best.model.id && avg !== null;
              const providerStyle = PROVIDER_COLORS[model.provider] || {};
              return (
                <tr key={model.id}
                  className="border-b border-outline-variant last:border-0 transition-colors"
                  style={{ background: isTop ? 'rgba(22, 163, 74, 0.03)' : 'transparent' }}>
                  <td className="px-md py-sm">
                    <div className="flex items-center gap-sm">
                      {isTop && <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>emoji_events</span>}
                      <span className="text-label-sm font-bold px-xs py-px rounded"
                        style={{ fontSize: 9, background: providerStyle.bg, color: providerStyle.text }}>
                        {model.provider}
                      </span>
                      <span className="text-body-sm font-medium text-on-surface">{model.label}</span>
                    </div>
                  </td>
                  <td className="px-md py-sm text-center text-body-sm font-bold text-on-surface">{claims}</td>
                  <td className="px-md py-sm text-center">
                    <span className="text-body-sm font-bold text-primary">{exclusive}</span>
                    {claims > 0 && <span className="text-body-sm text-on-surface-variant ml-xs" style={{ fontSize: 10 }}>({Math.round(exclusive/claims*100)}%)</span>}
                  </td>
                  <td className="px-md py-sm text-center">
                    {avg !== null ? <ScorePill score={avg / 100} /> : <span className="text-on-surface-variant opacity-40">—</span>}
                  </td>
                  <td className="px-md py-sm text-center">
                    {fps > 0
                      ? <span className="text-label-sm font-bold text-error">{fps}</span>
                      : <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>check</span>}
                  </td>
                  <td className="px-md py-sm" style={{ minWidth: 120 }}>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--outline-variant)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${avg || 0}%`, background: avg >= 70 ? 'linear-gradient(90deg, #16a34a, #4ade80)' : avg >= 40 ? 'linear-gradient(90deg, #f97316, #fb923c)' : 'var(--outline-variant)' }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConsensusSection({ models, results }) {
  const consensus = useMemo(() => {
    const claimMap = {};
    for (const m of models) {
      const r = results[m.id];
      for (const c of r?.claims || []) {
        if (!c.match?.found || !c.match?.doc_id) continue;
        const key = `${c.match.doc_id}:${c.match.chunk_idx}`;
        if (!claimMap[key]) claimMap[key] = { docId: c.match.doc_id, chunkIdx: c.match.chunk_idx, models: [], claims: [] };
        claimMap[key].models.push(m.label);
        claimMap[key].claims.push(c.claim_text);
      }
    }
    return Object.values(claimMap).filter(x => x.models.length >= 2).sort((a, b) => b.models.length - a.models.length);
  }, [models, results]);

  if (consensus.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-lowest)' }}>
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>hub</span>
        <span className="text-label-md font-bold text-on-surface">Consensus Sources</span>
        <span className="px-sm py-px rounded-full text-primary font-bold ml-sm" style={{ fontSize: 10, background: 'var(--primary-fixed)' }}>
          {consensus.length} shared
        </span>
        <span className="text-body-sm text-on-surface-variant ml-auto" style={{ fontSize: 11 }}>Sources cited by 2+ models</span>
      </div>
      <div className="divide-y divide-outline-variant/50">
        {consensus.slice(0, 8).map((item, i) => {
          const { domain, slug } = parseDocId(item.docId);
          return (
            <div key={i} className="px-md py-sm flex items-start gap-md hover:bg-surface-container-lowest transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary-fixed)' }}>
                <span className="text-primary font-black" style={{ fontSize: 12 }}>{item.models.length}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-sm flex-wrap mb-xs">
                  <span className="text-label-sm font-bold text-on-surface">{domain}</span>
                  {slug && <span className="text-body-sm text-on-surface-variant truncate" style={{ fontSize: 11 }}>{slug}</span>}
                </div>
                <div className="flex gap-xs flex-wrap">
                  {item.models.map(ml => (
                    <span key={ml} className="px-xs py-px rounded text-primary font-medium" style={{ fontSize: 10, background: 'var(--primary-fixed)' }}>{ml}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourceMatrix({ models, results }) {
  const allSources = new Set();
  for (const r of Object.values(results)) {
    for (const c of r.claims || []) {
      if (c.match?.found && c.match?.doc_id) allSources.add(c.match.doc_id);
    }
  }
  const sources = [...allSources].sort();
  if (sources.length === 0) return null;

  const matrix = {};
  for (const src of sources) {
    matrix[src] = {};
    for (const m of models) {
      const r = results[m.id];
      const hits = (r?.claims || []).filter(c => c.match?.found && c.match?.doc_id === src && c.exclusivity_score >= 0.5).length;
      matrix[src][m.id] = hits;
    }
  }

  const maxHits = Math.max(...sources.flatMap(s => models.map(m => matrix[s][m.id])), 1);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-lowest)' }}>
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>grid_on</span>
        <span className="text-label-md font-bold text-on-surface">Source Attribution Matrix</span>
        <span className="text-body-sm text-on-surface-variant ml-auto" style={{ fontSize: 11 }}>High-confidence citations (≥50%)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr style={{ background: 'var(--surface-container-lowest)' }}>
              <th className="text-left px-md py-sm text-label-sm font-bold text-on-surface-variant border-b border-outline-variant">Source</th>
              {models.map(m => (
                <th key={m.id} className="text-center px-md py-sm text-label-sm font-bold text-on-surface-variant border-b border-outline-variant whitespace-nowrap">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map(src => {
              const { domain, slug } = parseDocId(src);
              const rowTotal = models.reduce((s, m) => s + (matrix[src][m.id] || 0), 0);
              return (
                <tr key={src} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-lowest transition-colors">
                  <td className="px-md py-sm">
                    <p className="text-label-sm font-bold text-on-surface">{domain}</p>
                    {slug && <p className="text-body-sm text-on-surface-variant" style={{ fontSize: 10 }}>{slug}</p>}
                  </td>
                  {models.map(m => {
                    const hits = matrix[src][m.id];
                    const intensity = hits / maxHits;
                    return (
                      <td key={m.id} className="px-md py-sm text-center">
                        {hits > 0
                          ? <span className="inline-block text-label-md font-black rounded-lg px-sm py-xs"
                              style={{ minWidth: 28, background: `rgba(22, 163, 74, ${0.15 + intensity * 0.65})`, color: intensity > 0.5 ? '#fff' : 'var(--primary)', boxShadow: intensity > 0.7 ? '0 2px 6px rgba(22,163,74,0.3)' : 'none' }}>
                              {hits}
                            </span>
                          : <span className="text-on-surface-variant opacity-20">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExportButton({ question, models, results }) {
  const [copied, setCopied] = useState(false);

  function exportMarkdown() {
    const lines = [`# Compare: ${question}`, '', `*${new Date().toLocaleString()}*`, ''];
    for (const m of models) {
      const r = results[m.id];
      if (r?.status !== 'done') continue;
      lines.push(`## ${m.label}`);
      if (r.answer) lines.push('', r.answer);
      const claims = r.claims || [];
      if (claims.length > 0) {
        lines.push('', '**Claims:**');
        for (const c of claims.sort((a, b) => b.exclusivity_score - a.exclusivity_score)) {
          const pct = Math.round((c.exclusivity_score || 0) * 100);
          const src = c.match?.found ? ` *(${parseDocId(c.match.doc_id).domain})*` : '';
          lines.push(`- [${pct}%] ${c.claim_text}${src}`);
        }
      }
      lines.push('');
    }
    navigator.clipboard?.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button onClick={exportMarkdown} className="btn-ghost text-label-md flex items-center gap-xs"
      style={{ border: '1px solid var(--outline-variant)' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{copied ? 'check' : 'content_copy'}</span>
      {copied ? 'Copied!' : 'Export MD'}
    </button>
  );
}

export default function Compare() {
  const { models, results, status, startMultiTrace, reset } = useMultiTrace();
  const [question, setQuestion] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState(ALL_MODELS.slice(0, 2).map(m => m.id));

  const toggleModel = (id) => setSelectedModelIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || selectedModelIds.length === 0) return;
    startMultiTrace(question, selectedModelIds);
  };

  const activeModels = models.length > 0 ? models : [];
  const doneCount = Object.values(results).filter(r => r.status === 'done' || r.status === 'error').length;
  const allDone = status === 'done';
  const isRunning = status === 'streaming';

  const byProvider = ALL_MODELS.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-lg">
      {/* Input panel */}
      <form onSubmit={handleSubmit} className="glass-card overflow-hidden p-0">
        <div className="px-md py-sm border-b border-outline-variant flex items-center justify-between"
          style={{ background: 'var(--surface-container-lowest)' }}>
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>compare</span>
            <span className="text-label-md font-bold text-on-surface">Multi-Model Compare</span>
          </div>
          <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>
            Ask all models simultaneously — compare their sourcing
          </span>
        </div>

        <div className="p-md flex flex-col gap-md">
          {/* Preset questions */}
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold mb-sm" style={{ fontSize: 11 }}>Try a preset</p>
            <div className="flex flex-wrap gap-xs">
              {PRESET_QUESTIONS.map(p => (
                <button key={p.q} type="button" onClick={() => setQuestion(p.q)}
                  className={`flex items-center gap-xs px-sm py-xs rounded-lg text-label-sm font-medium transition-all hover:bg-surface-container-high ${question === p.q ? 'text-primary' : 'text-on-surface-variant'}`}
                  style={{ border: `1px solid ${question === p.q ? 'var(--primary)' : 'var(--outline-variant)'}`, background: question === p.q ? 'var(--primary-fixed)' : 'transparent' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question input */}
          <div className="flex flex-col gap-xs">
            <label className="text-label-sm text-on-surface-variant font-medium" style={{ fontSize: 11 }}>Your question</label>
            <div className="glass-input">
              <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
                className="w-full bg-transparent px-md py-sm text-body-md text-on-surface placeholder:text-on-surface-variant placeholder:opacity-50 focus:outline-none"
                placeholder="Enter any claim or question to fact-check across models…" />
            </div>
          </div>

          {/* Model selector */}
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold mb-sm" style={{ fontSize: 11 }}>
              Select models ({selectedModelIds.length} selected)
            </p>
            <div className="flex flex-col gap-sm">
              {Object.entries(byProvider).map(([provider, providerModels]) => {
                const style = PROVIDER_COLORS[provider] || {};
                return (
                  <div key={provider} className="flex items-center gap-sm flex-wrap">
                    <span className="text-label-sm font-bold px-sm py-xs rounded-lg shrink-0"
                      style={{ fontSize: 10, background: style.bg, color: style.text, border: `1px solid ${style.border}`, minWidth: 68, textAlign: 'center' }}>
                      {provider}
                    </span>
                    {providerModels.map(m => {
                      const selected = selectedModelIds.includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => toggleModel(m.id)}
                          className={`flex items-center gap-xs px-md py-xs rounded-xl text-label-sm font-medium transition-all active:scale-95 ${selected ? 'text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}
                          style={selected
                            ? { background: 'linear-gradient(135deg, #16a34a, #14532d)', boxShadow: '0 2px 10px rgba(22,163,74,0.3)', border: 'none' }
                            : { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(8px)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{selected ? 'check' : 'add'}</span>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-md items-center">
            <button type="submit"
              disabled={isRunning || !question.trim() || selectedModelIds.length === 0}
              className="btn-primary flex-1 text-label-md flex items-center justify-center gap-sm">
              {isRunning ? (
                <>
                  <span className="material-symbols-outlined live-pulse" style={{ fontSize: 18 }}>pending</span>
                  Running {doneCount}/{selectedModelIds.length}…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>
                  Compare {selectedModelIds.length} Model{selectedModelIds.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
            {activeModels.length > 0 && (
              <>
                {allDone && <ExportButton question={question} models={activeModels} results={results} />}
                <button type="button" onClick={reset} className="btn-ghost text-label-md">Clear</button>
              </>
            )}
          </div>
        </div>
      </form>

      {/* Live progress bar */}
      {isRunning && activeModels.length > 0 && (
        <ProgressBar models={activeModels} results={results} />
      )}

      {/* Model cards grid */}
      {activeModels.length > 0 && (
        <div className="grid gap-md"
          style={{ gridTemplateColumns: `repeat(${Math.min(activeModels.length, 3)}, minmax(0, 1fr))` }}>
          {activeModels.map(model => (
            <ModelCard key={model.id} model={model} result={results[model.id]} />
          ))}
        </div>
      )}

      {/* Summary + consensus + matrix — only when all done */}
      {allDone && activeModels.length > 1 && (
        <>
          <SummaryTable models={activeModels} results={results} />
          <ConsensusSection models={activeModels} results={results} />
          <SourceMatrix models={activeModels} results={results} />
        </>
      )}
    </div>
  );
}
