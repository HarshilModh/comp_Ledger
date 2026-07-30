import React, { useState, useEffect } from 'react';
import { useArticleCheck } from '../hooks/useArticleCheck.js';
import Ledger from './Ledger.jsx';
import ResizablePanel from './ResizablePanel.jsx';

export default function ArticleCheck() {
  const { claims, status, total, startCheck, reset } = useArticleCheck();
  const [publishers, setPublishers] = useState([]);
  const [selectedPublisher, setSelectedPublisher] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    fetch('/api/publishers').then(r => r.json()).then(setPublishers).catch(() => {});
  }, []);

  function handleSubmit(e) {
    e?.preventDefault();
    if (!selectedPublisher || !question.trim() || !answer.trim()) return;
    startCheck(question, answer, selectedPublisher);
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  const isLoading = status === 'streaming';
  const exclusive = claims.filter(c => c.exclusivity_score >= 0.7).length;
  const matched = claims.filter(c => c.match?.found).length;
  const fingerprints = claims.filter(c => c.fingerprint?.detected).length;

  return (
    <div className="flex flex-col gap-lg">
      {claims.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
          <StatCard icon="format_list_numbered" label="Claims Found" value={claims.length} glow />
          <StatCard icon="verified" label="Exclusive" value={`${exclusive}/${claims.length}`} glow />
          <StatCard icon="link" label="Matched" value={`${matched}/${claims.length}`} />
          <StatCard icon="fingerprint" label="Fingerprints" value={fingerprints || '0'} />
        </div>
      )}

      <ResizablePanel
        defaultLeftPercent={35}
        minLeft={300}
        minRight={360}
        left={
          <form onSubmit={handleSubmit} className="flex flex-col gap-md">
            <div className="flex items-center justify-between">
              <div className="flex gap-xs p-xs rounded-xl" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}>
                <div className="px-md py-xs rounded-lg text-label-md font-medium bg-primary text-on-primary shadow-sm" style={{ boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)' }}>
                  Article Check
                </div>
              </div>
              {status === 'done' && (
                <button type="button" onClick={reset} className="text-label-md text-primary hover:underline font-medium">
                  Reset
                </button>
              )}
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

            <div className="glass-input flex flex-col overflow-hidden" style={{ height: 200 }}>
              <div className="px-md py-xs border-b border-outline-variant flex justify-between items-center" style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
                <span className="text-label-md font-bold text-on-surface">AI Answer</span>
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16, opacity: 0.5 }}>smart_toy</span>
              </div>
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-md py-sm bg-transparent border-none focus:ring-0 text-body-md text-on-surface resize-none placeholder:text-on-surface-variant placeholder:opacity-50 custom-scrollbar"
                placeholder="Paste the AI-generated answer to check against your corpus..."
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
                  Checking Claims...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>fact_check</span>
                  Run Article Check
                </>
              )}
            </button>
          </form>
        }
        right={
          <div className="min-w-0">
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
