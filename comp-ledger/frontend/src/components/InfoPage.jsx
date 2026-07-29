import React from 'react';

export default function InfoPage() {
  return (
    <div className="flex flex-col gap-lg max-w-4xl">
      <div className="glass-card p-lg overflow-hidden" style={{ borderLeft: '3px solid var(--primary)' }}>
        <div className="flex items-center gap-md mb-md">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 16px rgba(22, 163, 74, 0.3)' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: 24 }}>shield</span>
          </div>
          <div>
            <h1 className="text-headline-md font-black text-on-surface">CoMP Ledger</h1>
            <p className="text-body-sm text-on-surface-variant">Content Origin & Manipulation Protection</p>
          </div>
        </div>
        <p className="text-body-md text-on-surface leading-relaxed">
          CoMP Ledger is an evidence platform that traces AI-generated answers back to their original publisher sources.
          It scores each factual claim for exclusivity — how unique the information is to a specific publisher — and detects
          potential fingerprint markers that indicate direct content copying.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        <div className="glass-card p-md flex flex-col gap-sm">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(22, 163, 74, 0.1)', border: '1px solid rgba(22, 163, 74, 0.2)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>search</span>
          </div>
          <h3 className="text-body-md font-bold text-on-surface">Trace</h3>
          <p className="text-body-sm text-on-surface-variant">
            Decompose AI answers into atomic claims and match each against publisher archives using semantic search.
          </p>
        </div>

        <div className="glass-card p-md flex flex-col gap-sm">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(22, 163, 74, 0.1)', border: '1px solid rgba(22, 163, 74, 0.2)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>score</span>
          </div>
          <h3 className="text-body-md font-bold text-on-surface">Score</h3>
          <p className="text-body-sm text-on-surface-variant">
            Rate each claim 0–100% for exclusivity based on source scarcity, specificity, and independent corroboration.
          </p>
        </div>

        <div className="glass-card p-md flex flex-col gap-sm">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(22, 163, 74, 0.1)', border: '1px solid rgba(22, 163, 74, 0.2)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>fingerprint</span>
          </div>
          <h3 className="text-body-md font-bold text-on-surface">Detect</h3>
          <p className="text-body-sm text-on-surface-variant">
            Identify copied markers — distinctive phrasing, unique data points, or stylistic fingerprints from the original.
          </p>
        </div>
      </div>

      <div className="glass-card p-lg overflow-hidden">
        <h2 className="text-body-md font-bold text-on-surface mb-md flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>architecture</span>
          How It Works
        </h2>
        <div className="space-y-md">
          <div className="flex gap-md items-start">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-label-md font-bold text-on-primary" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', fontSize: 12 }}>1</div>
            <div>
              <p className="text-body-sm font-bold text-on-surface">Claim Extraction</p>
              <p className="text-body-sm text-on-surface-variant">LLM decomposes the AI answer into discrete, verifiable factual claims.</p>
            </div>
          </div>
          <div className="flex gap-md items-start">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-label-md font-bold text-on-primary" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', fontSize: 12 }}>2</div>
            <div>
              <p className="text-body-sm font-bold text-on-surface">Semantic Matching</p>
              <p className="text-body-sm text-on-surface-variant">Each claim is embedded and searched against a vector store of publisher content chunks.</p>
            </div>
          </div>
          <div className="flex gap-md items-start">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-label-md font-bold text-on-primary" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', fontSize: 12 }}>3</div>
            <div>
              <p className="text-body-sm font-bold text-on-surface">Exclusivity Scoring</p>
              <p className="text-body-sm text-on-surface-variant">Claims found in few sources score high; widely-available facts score low.</p>
            </div>
          </div>
          <div className="flex gap-md items-start">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-label-md font-bold text-on-primary" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', fontSize: 12 }}>4</div>
            <div>
              <p className="text-body-sm font-bold text-on-surface">Fingerprint Detection</p>
              <p className="text-body-sm text-on-surface-variant">LLM compares matched content for distinctive phrasing that suggests direct copying.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-md overflow-hidden">
        <h2 className="text-body-md font-bold text-on-surface mb-sm flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>dataset</span>
          Demo Dataset
        </h2>
        <p className="text-body-sm text-on-surface-variant">
          This demo uses a curated archive of New York Times investigative articles (2020–2023) covering topics like Trump tax returns,
          COVID-19 origins, climate investigations, and Supreme Court ethics. Run the "Load demo" preset on the Facts page to see it in action.
        </p>
      </div>

      <div className="glass-card p-md overflow-hidden">
        <h2 className="text-body-md font-bold text-on-surface mb-sm flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>code</span>
          Tech Stack
        </h2>
        <div className="flex flex-wrap gap-sm">
          {['React 18', 'Vite 5', 'Tailwind CSS', 'Fastify', 'AWS Bedrock', 'FAISS', 'S3'].map(tech => (
            <span key={tech} className="px-md py-xs rounded-xl text-label-md font-medium text-on-surface-variant" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(8px)' }}>
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
