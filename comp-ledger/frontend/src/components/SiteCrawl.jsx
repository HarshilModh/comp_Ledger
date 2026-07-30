import React, { useState, useRef } from 'react';

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-md">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--outline-variant)' }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #16a34a, #4ade80)' }} />
      </div>
      <span className="text-label-sm font-bold text-primary shrink-0" style={{ minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

export default function SiteCrawl({ publisherId, publisherDomain, onComplete }) {
  const [phase, setPhase] = useState('idle'); // idle | probing | crawling | done | error
  const [statusMsg, setStatusMsg] = useState('');
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(0);
  const [currentUrl, setCurrentUrl] = useState('');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [log, setLog] = useState([]);
  const abortRef = useRef(null);

  function appendLog(msg) {
    setLog(prev => [...prev.slice(-49), msg]);
  }

  async function startCrawl() {
    setPhase('probing');
    setStatusMsg('');
    setTotal(0);
    setCurrent(0);
    setCurrentUrl('');
    setResult(null);
    setErrorMsg('');
    setLog([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/publishers/${publisherId}/crawl`, {
        method: 'POST',
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Crawl failed');
        setPhase('error');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const block of parts) {
          if (!block.trim()) continue;
          const m = block.match(/^event:\s*(.+)\ndata:\s*(.+)$/ms);
          if (!m) continue;
          const [, type, raw] = m;
          try {
            const data = JSON.parse(raw);
            if (type === 'status') {
              setStatusMsg(data.message);
              appendLog(data.message);
            } else if (type === 'discovered') {
              setTotal(data.total);
              setPhase('crawling');
              appendLog(`Discovered ${data.total} article URLs — starting extraction…`);
            } else if (type === 'progress') {
              setCurrent(data.current);
              setTotal(data.total);
              setCurrentUrl(data.url);
            } else if (type === 'done') {
              setResult(data);
              setPhase('done');
              onComplete?.();
            } else if (type === 'error') {
              setErrorMsg(data.message);
              setPhase('error');
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message || 'Connection lost');
        setPhase('error');
      }
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setPhase('idle');
  }

  return (
    <div className="flex flex-col gap-md">
      {/* Header */}
      <div className="flex items-start gap-md p-md rounded-xl"
        style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.05), transparent)', border: '1px solid rgba(22,163,74,0.15)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>travel_explore</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-sm mb-xs">
            <h3 className="text-label-md font-bold text-on-surface">Auto Site Crawl</h3>
            <span className="px-sm py-px rounded-full text-label-sm font-bold"
              style={{ fontSize: 9, background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }}>
              BETA
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant" style={{ fontSize: 12 }}>
            CoMP Ledger will probe <strong className="text-on-surface">{publisherDomain}</strong> for sitemaps and RSS feeds,
            then extract and index up to 100 articles automatically.
          </p>
        </div>
      </div>

      {/* Idle state */}
      {phase === 'idle' && (
        <button onClick={startCrawl} className="btn-primary text-label-md flex items-center justify-center gap-sm" style={{ padding: '12px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>travel_explore</span>
          Crawl {publisherDomain}
        </button>
      )}

      {/* Probing */}
      {phase === 'probing' && (
        <div className="glass-card p-md flex flex-col gap-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 18 }}>radar</span>
            <span className="text-body-sm font-bold text-on-surface">Probing site…</span>
          </div>
          <p className="text-body-sm text-on-surface-variant" style={{ fontSize: 12 }}>{statusMsg || `Checking sitemap.xml, sitemap_index.xml, RSS feeds…`}</p>
          <button onClick={cancel} className="btn-ghost text-label-sm text-error self-start" style={{ padding: '4px 12px' }}>Cancel</button>
        </div>
      )}

      {/* Crawling */}
      {phase === 'crawling' && (
        <div className="glass-card overflow-hidden">
          <div className="px-md py-sm border-b border-outline-variant flex items-center justify-between"
            style={{ background: 'rgba(22,163,74,0.03)' }}>
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 16 }}>sync</span>
              <span className="text-label-md font-bold text-on-surface">Crawling articles…</span>
            </div>
            <div className="flex items-center gap-md">
              <span className="text-body-sm text-on-surface-variant">{current} / {total}</span>
              <button onClick={cancel} className="text-label-sm text-error hover:underline">Stop</button>
            </div>
          </div>
          <div className="p-md flex flex-col gap-md">
            <ProgressBar value={current} max={total} />
            {currentUrl && (
              <p className="text-body-sm text-on-surface-variant truncate" style={{ fontSize: 11 }}>
                <span className="text-on-surface-variant opacity-50 mr-xs">↳</span>{currentUrl}
              </p>
            )}
            {/* Mini log */}
            {log.length > 0 && (
              <div className="rounded-lg p-sm max-h-24 overflow-y-auto custom-scrollbar"
                style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)' }}>
                {log.slice(-8).map((l, i) => (
                  <p key={i} className="text-body-sm text-on-surface-variant" style={{ fontSize: 10, lineHeight: 1.6 }}>{l}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && result && (
        <div className="glass-card overflow-hidden" style={{ border: '1px solid rgba(22,163,74,0.2)' }}>
          <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm"
            style={{ background: 'rgba(22,163,74,0.04)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>check_circle</span>
            <span className="text-label-md font-bold text-primary">Crawl complete</span>
          </div>
          <div className="p-md">
            <div className="grid grid-cols-3 gap-md mb-md">
              <div className="flex flex-col items-center gap-xs p-sm rounded-xl"
                style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)' }}>
                <span className="text-headline-sm font-black text-primary">{result.imported}</span>
                <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Indexed</span>
              </div>
              <div className="flex flex-col items-center gap-xs p-sm rounded-xl"
                style={{ background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)' }}>
                <span className="text-headline-sm font-black text-on-surface-variant">{result.skipped}</span>
                <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Skipped</span>
              </div>
              <div className="flex flex-col items-center gap-xs p-sm rounded-xl"
                style={{ background: result.failed > 0 ? 'rgba(220,38,38,0.06)' : 'var(--surface-container-low)', border: `1px solid ${result.failed > 0 ? 'rgba(220,38,38,0.15)' : 'var(--outline-variant)'}` }}>
                <span className={`text-headline-sm font-black ${result.failed > 0 ? 'text-error' : 'text-on-surface-variant'}`}>{result.failed}</span>
                <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Failed</span>
              </div>
            </div>
            <p className="text-body-sm text-on-surface-variant mb-md" style={{ fontSize: 12 }}>
              {result.imported > 0
                ? `${result.imported} articles are now indexed and searchable. Citations will appear in Analytics as AI models reference this content.`
                : 'No new articles were indexed. They may already exist or content could not be extracted.'}
            </p>
            <div className="flex gap-sm">
              {result.imported > 0 && (
                <button onClick={() => setPhase('idle')} className="btn-ghost text-label-sm flex items-center gap-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                  Crawl again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="glass-card p-md flex flex-col gap-md" style={{ border: '1px solid rgba(220,38,38,0.2)' }}>
          <div className="flex items-start gap-sm">
            <span className="material-symbols-outlined text-error shrink-0" style={{ fontSize: 18 }}>error</span>
            <div>
              <p className="text-body-sm font-bold text-error">Crawl failed</p>
              <p className="text-body-sm text-on-surface-variant mt-xs" style={{ fontSize: 12 }}>{errorMsg}</p>
            </div>
          </div>
          <div className="flex gap-sm">
            <button onClick={startCrawl} className="btn-primary text-label-sm flex items-center gap-xs" style={{ padding: '8px 16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
              Try again
            </button>
            <button onClick={() => setPhase('idle')} className="btn-ghost text-label-sm">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}
