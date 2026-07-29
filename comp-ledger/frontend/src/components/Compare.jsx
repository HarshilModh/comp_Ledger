import React, { useState } from 'react';
import { useMultiTrace } from '../hooks/useMultiTrace.js';

const STATUS_LABEL = { waiting: 'Waiting…', generating: 'Generating…', tracing: 'Tracing…', done: 'Done', error: 'Error' };

function ScorePill({ score }) {
  const pct = Math.round((score || 0) * 100);
  const bg = pct >= 70
    ? 'linear-gradient(135deg, #16a34a, #15803d)'
    : pct >= 40
    ? 'linear-gradient(135deg, #f97316, #fb923c)'
    : 'var(--surface-container-high)';
  const text = pct >= 40 ? '#fff' : 'var(--on-surface-variant)';
  return (
    <span
      className="inline-block text-label-md font-bold px-sm py-xs rounded-lg"
      style={{ fontSize: 11, minWidth: 36, textAlign: 'center', background: bg, color: text, boxShadow: pct >= 70 ? '0 2px 8px rgba(22, 163, 74, 0.3)' : 'none' }}
    >
      {pct}%
    </span>
  );
}

function ModelCard({ model, result }) {
  const [expanded, setExpanded] = useState(false);
  const exclusive = (result?.claims || []).filter(c => c.exclusivity_score >= 0.7).length;
  const fingerprints = (result?.claims || []).filter(c => c.fingerprint?.detected).length;

  return (
    <div className="glass-card flex flex-col overflow-hidden p-0" style={{ minWidth: 0 }}>
      <div className="px-md py-sm border-b border-outline-variant flex items-center justify-between gap-sm" style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
        <div className="flex items-center gap-sm min-w-0">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>smart_toy</span>
          <span className="text-label-md font-bold text-on-surface truncate">{model.label}</span>
        </div>
        <span className={`text-label-md font-medium ${result?.status === 'done' ? 'text-primary' : result?.status === 'error' ? 'text-error' : 'text-on-surface-variant'}`}>
          {STATUS_LABEL[result?.status || 'waiting']}
        </span>
      </div>

      {result?.status === 'done' && (
        <div className="flex gap-md px-md py-sm border-b border-outline-variant">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>format_list_numbered</span>
            <span className="text-label-md text-on-surface-variant">{result.claims.length} claims</span>
          </div>
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>verified</span>
            <span className="text-label-md text-on-surface-variant">{exclusive} exclusive</span>
          </div>
          {fingerprints > 0 && (
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>fingerprint</span>
              <span className="text-label-md text-error font-bold">{fingerprints} copied</span>
            </div>
          )}
        </div>
      )}

      {(result?.status === 'generating' || result?.status === 'tracing') && (
        <div className="px-md py-md flex items-center gap-sm">
          <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 18 }}>pending</span>
          <span className="text-body-sm text-on-surface-variant">{STATUS_LABEL[result.status]}</span>
        </div>
      )}

      {result?.answer && (
        <div className="px-md py-sm border-b border-outline-variant">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-xs">Generated Answer</p>
          <p className={`text-body-sm text-on-surface leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>{result.answer}</p>
          {result.answer.length > 180 && (
            <button onClick={() => setExpanded(e => !e)} className="text-label-md text-primary hover:underline mt-xs">
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {result?.status === 'done' && result.claims.length > 0 && (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: 320 }}>
          {result.claims
            .slice()
            .sort((a, b) => b.exclusivity_score - a.exclusivity_score)
            .map((claim, i) => (
              <div key={claim.claim_id || i} className="px-md py-sm border-b border-outline-variant last:border-0 flex gap-sm items-start hover:bg-surface-container-high transition-colors">
                <ScorePill score={claim.exclusivity_score} />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-on-surface leading-snug">{claim.claim_text}</p>
                  {claim.match?.found && (
                    <p className="text-label-md text-on-surface-variant mt-xs truncate">
                      Source: {claim.match.doc_id} §{claim.match.chunk_idx}
                    </p>
                  )}
                  {claim.fingerprint?.detected && (
                    <span className="fp-badge fp-badge-error mt-xs">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>fingerprint</span>
                      Fingerprint
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {result?.status === 'error' && (
        <div className="px-md py-md text-body-sm text-error">{result.error || 'Unknown error'}</div>
      )}
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

  return (
    <div className="glass-table">
      <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>grid_on</span>
        <span className="text-label-md font-bold text-on-surface">Source Attribution Matrix</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr>
              <th className="text-left px-md py-sm text-label-md font-bold text-on-surface-variant border-b border-outline-variant">Source</th>
              {models.map(m => (
                <th key={m.id} className="text-center px-md py-sm text-label-md font-bold text-on-surface-variant border-b border-outline-variant whitespace-nowrap">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map(src => (
              <tr key={src} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-high transition-colors">
                <td className="px-md py-sm font-code text-on-surface text-label-md">{src}</td>
                {models.map(m => {
                  const hits = matrix[src][m.id];
                  return (
                    <td key={m.id} className="px-md py-sm text-center">
                      {hits > 0
                        ? <span className="inline-block text-label-md font-bold rounded-lg px-sm py-xs text-on-primary" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', minWidth: 28, boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)' }}>{hits}</span>
                        : <span className="text-on-surface-variant opacity-30">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ALL_MODELS = [
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
  { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4' },
  { id: 'us.amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
  { id: 'us.amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
  { id: 'us.meta.llama3-1-8b-instruct-v1:0', label: 'Llama 3.1 8B' },
];

const DEMO_QUESTION = 'How much did Trump pay in federal income taxes?';

export default function Compare() {
  const { models, results, status, startMultiTrace, reset } = useMultiTrace();
  const [question, setQuestion] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState(
    ALL_MODELS.slice(0, 2).map(m => m.id)
  );

  const toggleModel = (id) => {
    setSelectedModelIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || selectedModelIds.length === 0) return;
    startMultiTrace(question, selectedModelIds);
  };

  const activeModels = models.length > 0 ? models : [];
  const doneCount = Object.values(results).filter(r => r.status === 'done').length;
  const anyResults = activeModels.length > 0;

  return (
    <div className="flex flex-col gap-lg">
      <form onSubmit={handleSubmit} className="glass-card overflow-hidden p-0">
        <div className="px-md py-sm border-b border-outline-variant flex items-center justify-between" style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>compare</span>
            <span className="text-label-md font-bold text-on-surface">Multi-Model Compare</span>
          </div>
          <button
            type="button"
            onClick={() => setQuestion(DEMO_QUESTION)}
            className="text-label-md text-primary hover:underline font-medium"
          >
            Load demo
          </button>
        </div>

        <div className="p-md flex flex-col gap-md">
          <div className="glass-input">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              className="w-full bg-transparent px-md py-sm text-body-md text-on-surface placeholder:text-on-surface-variant placeholder:opacity-50 focus:outline-none"
              placeholder="Enter a question to ask all selected models simultaneously…"
            />
          </div>

          <div>
            <p className="text-label-md font-bold text-on-surface-variant mb-sm">Select models to compare</p>
            <div className="flex flex-wrap gap-sm">
              {ALL_MODELS.map(m => {
                const selected = selectedModelIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModel(m.id)}
                    className={`flex items-center gap-xs px-md py-xs rounded-xl text-label-md font-medium transition-all active:scale-95 ${
                      selected
                        ? 'text-on-primary'
                        : 'text-on-surface-variant hover:text-primary'
                    }`}
                    style={selected
                      ? { background: 'linear-gradient(135deg, #16a34a, #14532d)', boxShadow: '0 2px 10px rgba(22, 163, 74, 0.3)', border: 'none' }
                      : { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(8px)' }
                    }
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{selected ? 'check' : 'add'}</span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-md">
            <button
              type="submit"
              disabled={status === 'streaming' || !question.trim() || selectedModelIds.length === 0}
              className="btn-primary flex-1 text-label-md flex items-center justify-center gap-sm"
            >
              {status === 'streaming' ? (
                <>
                  <span className="material-symbols-outlined live-pulse" style={{ fontSize: 18 }}>pending</span>
                  Running {doneCount}/{selectedModelIds.length}…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>
                  Compare Models
                </>
              )}
            </button>
            {anyResults && (
              <button
                type="button"
                onClick={reset}
                className="btn-ghost text-label-md"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </form>

      {anyResults && (
        <div
          className="grid gap-md"
          style={{ gridTemplateColumns: `repeat(${activeModels.length}, minmax(0, 1fr))` }}
        >
          {activeModels.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              result={results[model.id]}
            />
          ))}
        </div>
      )}

      {status === 'done' && (
        <SourceMatrix models={activeModels} results={results} />
      )}
    </div>
  );
}
