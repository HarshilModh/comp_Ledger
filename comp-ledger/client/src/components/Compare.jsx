import React, { useState, useEffect } from 'react';
import { useMultiTrace } from '../hooks/useMultiTrace.js';

const STATUS_LABEL = { waiting: 'Waiting…', generating: 'Generating answer…', tracing: 'Tracing sources…', done: 'Done', error: 'Error' };
const STATUS_COLOR = { waiting: 'text-on-surface-variant', generating: 'text-primary', tracing: 'text-secondary', done: 'text-success', error: 'text-error' };

function ScorePill({ score }) {
  const pct = Math.round((score || 0) * 100);
  const bg = pct >= 70 ? 'bg-error' : pct >= 40 ? 'bg-warning' : 'bg-secondary';
  const text = pct >= 70 ? 'text-on-primary' : pct >= 40 ? 'text-on-primary' : 'text-on-surface-variant';
  return (
    <span className={`inline-block text-label-md font-bold px-sm py-xs rounded-full ${bg} ${text}`} style={{ fontSize: 11, minWidth: 36, textAlign: 'center' }}>
      {pct}%
    </span>
  );
}

function ModelCard({ model, result }) {
  const [expanded, setExpanded] = useState(false);
  const exclusive = (result?.claims || []).filter(c => c.exclusivity_score >= 0.7).length;
  const fingerprints = (result?.claims || []).filter(c => c.fingerprint?.detected).length;

  return (
    <div className="bg-surface border border-outline-variant rounded-xl flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
      {/* Header */}
      <div className="px-md py-sm bg-surface-container-low border-b border-outline-variant flex items-center justify-between gap-sm">
        <div className="flex items-center gap-sm min-w-0">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>smart_toy</span>
          <span className="text-label-md font-bold text-on-surface truncate">{model.label}</span>
        </div>
        <span className={`text-label-md font-medium ${STATUS_COLOR[result?.status || 'waiting']}`}>
          {STATUS_LABEL[result?.status || 'waiting']}
        </span>
      </div>

      {/* Stats row */}
      {result?.status === 'done' && (
        <div className="flex gap-sm px-md py-sm border-b border-outline-variant bg-surface-container">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>format_list_numbered</span>
            <span className="text-label-md text-on-surface-variant">{result.claims.length} claims</span>
          </div>
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-error" style={{ fontSize: 14 }}>verified</span>
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

      {/* Loading pulse */}
      {(result?.status === 'generating' || result?.status === 'tracing') && (
        <div className="px-md py-md flex items-center gap-sm">
          <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 18 }}>pending</span>
          <span className="text-body-sm text-on-surface-variant">{STATUS_LABEL[result.status]}</span>
        </div>
      )}

      {/* Answer */}
      {result?.answer && (
        <div className="px-md py-sm border-b border-outline-variant">
          <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-widest mb-xs" style={{ fontSize: 10 }}>Generated Answer</p>
          <p className={`text-body-sm text-on-surface leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>{result.answer}</p>
          {result.answer.length > 180 && (
            <button onClick={() => setExpanded(e => !e)} className="text-label-md text-primary hover:underline mt-xs">
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Claims list */}
      {result?.status === 'done' && result.claims.length > 0 && (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: 320 }}>
          {result.claims
            .slice()
            .sort((a, b) => b.exclusivity_score - a.exclusivity_score)
            .map((claim, i) => (
              <div key={claim.claim_id || i} className="px-md py-sm border-b border-outline-variant last:border-0 flex gap-sm items-start">
                <ScorePill score={claim.exclusivity_score} />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-on-surface leading-snug">{claim.claim_text}</p>
                  {claim.match?.found && (
                    <p className="text-label-md text-on-surface-variant mt-xs truncate">
                      Source: {claim.match.doc_id} §{claim.match.chunk_idx}
                    </p>
                  )}
                  {claim.fingerprint?.detected && (
                    <span className="inline-flex items-center gap-xs text-label-md text-error font-bold mt-xs">
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>fingerprint</span>
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
  // Collect all unique publisher doc_ids across all models
  const allSources = new Set();
  for (const r of Object.values(results)) {
    for (const c of r.claims || []) {
      if (c.match?.found && c.match?.doc_id) allSources.add(c.match.doc_id);
    }
  }
  const sources = [...allSources].sort();
  if (sources.length === 0) return null;

  // For each source × model: count exclusive hits
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
    <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
      <div className="px-md py-sm bg-surface-container-low border-b border-outline-variant flex items-center gap-sm">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>grid_on</span>
        <span className="text-label-md font-bold text-on-surface">Source Attribution Matrix</span>
        <span className="text-label-md text-on-surface-variant">— exclusive claim hits per source per model</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="bg-surface-container">
              <th className="text-left px-md py-sm text-label-md font-bold text-on-surface-variant border-b border-outline-variant">Source Document</th>
              {models.map(m => (
                <th key={m.id} className="text-center px-md py-sm text-label-md font-bold text-on-surface-variant border-b border-outline-variant whitespace-nowrap">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map(src => (
              <tr key={src} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors">
                <td className="px-md py-sm font-code text-on-surface text-label-md">{src}</td>
                {models.map(m => {
                  const hits = matrix[src][m.id];
                  return (
                    <td key={m.id} className="px-md py-sm text-center">
                      {hits > 0
                        ? <span className="inline-block bg-error text-on-primary text-label-md font-bold rounded-full px-sm py-xs" style={{ minWidth: 28 }}>{hits}</span>
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
      {/* Input */}
      <form onSubmit={handleSubmit} className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-md py-sm bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
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
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface placeholder:text-on-surface-variant placeholder:opacity-50 focus:outline-none focus:border-primary"
            placeholder="Enter a question to ask all selected models simultaneously…"
          />

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
                    className={`flex items-center gap-xs px-md py-xs rounded-full text-label-md font-medium border transition-all ${
                      selected
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
                    }`}
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
              className="flex-1 text-on-primary text-label-md font-bold rounded-xl hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-sm"
              style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #630ed4, #7c3aed)' }}
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
                className="px-md py-sm bg-surface border border-outline-variant rounded-xl text-label-md font-bold text-on-surface hover:bg-surface-container-low transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Model columns */}
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

      {/* Source attribution matrix */}
      {status === 'done' && (
        <SourceMatrix models={activeModels} results={results} />
      )}
    </div>
  );
}
