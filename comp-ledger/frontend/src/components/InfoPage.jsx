import React, { useState } from 'react';

const FEATURES = [
  {
    icon: 'auto_awesome',
    title: 'Auto Fact-Check',
    desc: 'Ask any question — CoMP Ledger picks a model, generates an answer, then traces every claim against the publisher corpus. No copy-paste required.',
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.08)',
    border: 'rgba(22,163,74,0.18)',
    badge: null,
  },
  {
    icon: 'edit_note',
    title: 'Manual Trace',
    desc: 'Paste any existing AI-generated response to audit. Claims are decomposed, embedded, and matched against indexed publisher content.',
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.08)',
    border: 'rgba(14,165,233,0.18)',
    badge: null,
  },
  {
    icon: 'compare',
    title: 'Multi-Model Compare',
    desc: 'Run the same question through up to 5 AI models simultaneously. See which models cite publisher content, which fabricate, and where they agree.',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.08)',
    border: 'rgba(124,58,237,0.18)',
    badge: null,
  },
  {
    icon: 'travel_explore',
    title: 'Deep Research',
    desc: 'Multi-step research agent that decomposes complex topics, searches the web, synthesizes evidence, and produces a fully cited report.',
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.08)',
    border: 'rgba(14,165,233,0.18)',
    badge: null,
  },
  {
    icon: 'fingerprint',
    title: 'Fingerprint Detection',
    desc: 'Identifies when AI output contains distinctive phrasing, unique data points, or stylistic markers that trace back to a specific original source.',
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.08)',
    border: 'rgba(220,38,38,0.18)',
    badge: null,
  },
  {
    icon: 'apartment',
    title: 'Publisher Registry',
    desc: 'Publishers register their domain and content. CoMP Ledger indexes their articles as vector embeddings and attributes AI citations back to them in real time.',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.18)',
    badge: null,
  },
  {
    icon: 'radar',
    title: 'Auto Site Crawl',
    desc: 'Enter a domain — CoMP Ledger probes for sitemaps and RSS feeds, then automatically extracts and indexes up to 100 articles with no manual input.',
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.08)',
    border: 'rgba(22,163,74,0.18)',
    badge: 'BETA',
  },
  {
    icon: 'analytics',
    title: 'Attribution Analytics',
    desc: 'Every publisher sees which of their articles were cited by AI, across which traces and models, and how citation frequency trends over time.',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.08)',
    border: 'rgba(124,58,237,0.18)',
    badge: null,
  },
];

const PIPELINE = [
  {
    step: 1, title: 'Question In', icon: 'input',
    detail: 'User submits a question (Auto mode) or pastes an existing AI-generated answer (Manual mode). Presets are available for common fact-check topics.',
  },
  {
    step: 2, title: 'Answer Generation', icon: 'smart_toy',
    detail: 'In Auto mode, the selected model (Claude Haiku, Claude Sonnet, Nova Micro, Nova Lite, or Llama 3.1 8B) is called via AWS Bedrock to generate a factual response.',
  },
  {
    step: 3, title: 'Claim Decomposition', icon: 'format_list_bulleted',
    detail: 'Claude Haiku 4.5 atomises the answer into discrete, independently verifiable factual claims — stripping hedging language and filler sentences.',
  },
  {
    step: 4, title: 'Semantic Matching', icon: 'hub',
    detail: 'Each claim is embedded with Amazon Titan Embed v2 and searched via cosine similarity against the publisher corpus stored in PostgreSQL with pgvector.',
  },
  {
    step: 5, title: 'Exclusivity Scoring', icon: 'score',
    detail: 'Claude Sonnet 4 scores each matched claim: how many independent sources cover this fact? The fewer the sources, the higher the exclusivity score (0–100%).',
  },
  {
    step: 6, title: 'Fingerprint Detection', icon: 'fingerprint',
    detail: 'When a match is found, the model compares phrasing between the AI output and publisher original — flagging distinctive wording or unique data that indicates direct copying.',
  },
  {
    step: 7, title: 'Claims Grouped & Displayed', icon: 'leaderboard',
    detail: 'Results are streamed live and grouped into three tiers: High Confidence (≥70%), Limited Sourcing (40–70%), and Widely Known (<40%). Each claim is expandable for full source detail.',
  },
  {
    step: 8, title: 'Attribution Logged', icon: 'receipt_long',
    detail: 'Every completed trace is persisted to the database. Publishers see their citations in real time on their Analytics dashboard, ranked by article and frequency.',
  },
];

const INGESTION = [
  { icon: 'radar',        label: 'Auto Site Crawl',   desc: 'Probe sitemap/RSS and auto-index up to 100 articles', badge: 'BETA' },
  { icon: 'edit_note',    label: 'Paste',              desc: 'Manually enter title, body, author, and date' },
  { icon: 'link',         label: 'URL Extract',        desc: 'Paste a URL — Readability extracts and indexes automatically' },
  { icon: 'playlist_add', label: 'Bulk URLs',          desc: 'Paste up to 20 URLs, extracted in parallel' },
  { icon: 'upload_file',  label: 'Bulk JSON',          desc: 'Upload a JSON array of articles with drag & drop' },
  { icon: 'rss_feed',     label: 'RSS Auto-poll',      desc: 'Auto-import new articles every 30 minutes' },
  { icon: 'cloud_upload', label: 'Push API',           desc: 'POST from any CMS via REST API or webhook' },
  { icon: 'download',     label: 'Pull API',           desc: 'CoMP Ledger pulls from your content API on a schedule' },
];

const STACK = [
  { label: 'React 18',              icon: 'web',         category: 'Frontend' },
  { label: 'Vite 5',                icon: 'bolt',        category: 'Frontend' },
  { label: 'Tailwind CSS',          icon: 'palette',     category: 'Frontend' },
  { label: 'Fastify 4',             icon: 'api',         category: 'Backend' },
  { label: 'PostgreSQL + pgvector', icon: 'database',    category: 'Backend' },
  { label: 'JWT + bcrypt Auth',     icon: 'lock',        category: 'Backend' },
  { label: '@fastify/rate-limit',   icon: 'shield',      category: 'Backend' },
  { label: 'AWS Bedrock',           icon: 'cloud',       category: 'AI' },
  { label: 'Amazon Titan Embed v2', icon: 'hub',         category: 'AI' },
  { label: 'Claude Haiku 4.5',      icon: 'smart_toy',   category: 'AI' },
  { label: 'Claude Sonnet 4',       icon: 'psychology',  category: 'AI' },
  { label: 'Nova Micro / Lite',     icon: 'bolt',        category: 'AI' },
  { label: 'Llama 3.1 8B',         icon: 'memory',      category: 'AI' },
  { label: 'Amazon S3',             icon: 'folder',      category: 'Infra' },
  { label: 'Node.js ESM',           icon: 'terminal',    category: 'Infra' },
  { label: 'RSS Poller (cron)',      icon: 'schedule',    category: 'Infra' },
];

const CATEGORY_COLORS = {
  Frontend: { bg: 'rgba(14,165,233,0.08)',  text: '#0ea5e9', border: 'rgba(14,165,233,0.2)' },
  Backend:  { bg: 'rgba(249,115,22,0.08)',  text: '#f97316', border: 'rgba(249,115,22,0.2)' },
  AI:       { bg: 'rgba(22,163,74,0.08)',   text: '#16a34a', border: 'rgba(22,163,74,0.2)'  },
  Infra:    { bg: 'rgba(124,58,237,0.08)',  text: '#7c3aed', border: 'rgba(124,58,237,0.2)' },
};

export default function InfoPage() {
  const [activeStep, setActiveStep] = useState(null);

  return (
    <div className="flex flex-col gap-xl max-w-4xl">

      {/* Hero */}
      <div className="glass-card overflow-hidden" style={{ borderLeft: '3px solid var(--primary)' }}>
        <div className="p-lg">
          <div className="flex items-center gap-md mb-md">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 20px rgba(22,163,74,0.35)' }}>
              <span className="material-symbols-outlined text-white" style={{ fontSize: 28 }}>fact_check</span>
            </div>
            <div>
              <h1 className="text-headline-lg font-black text-on-surface">CoMP Ledger</h1>
              <p className="text-body-md text-on-surface-variant">Content Origin &amp; Manipulation Protection</p>
            </div>
            <span className="ml-auto px-md py-xs rounded-full text-label-md font-bold text-primary"
              style={{ background: 'var(--primary-fixed)', border: '1px solid rgba(22,163,74,0.2)', fontSize: 11 }}>
              v1.0
            </span>
          </div>
          <p className="text-body-md text-on-surface leading-relaxed mb-md">
            CoMP Ledger is an AI transparency platform that traces AI-generated answers back to their original publisher sources.
            It scores every factual claim for exclusivity, detects copied content fingerprints, and gives publishers real-time
            visibility into how their journalism is being used — and potentially exploited — by AI systems.
          </p>
          <div className="flex flex-wrap gap-sm">
            {[
              { icon: 'fact_check',    label: 'Fact Tracing' },
              { icon: 'compare',       label: 'Model Comparison' },
              { icon: 'travel_explore',label: 'Deep Research' },
              { icon: 'apartment',     label: 'Publisher Registry' },
              { icon: 'radar',         label: 'Auto Crawl', beta: true },
            ].map(tag => (
              <span key={tag.label} className="flex items-center gap-xs px-sm py-xs rounded-lg text-label-sm font-medium text-on-surface-variant"
                style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)' }}>
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>{tag.icon}</span>
                {tag.label}
                {tag.beta && (
                  <span className="px-xs py-px rounded font-bold"
                    style={{ fontSize: 8, background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }}>
                    BETA
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div>
        <h2 className="text-label-md font-bold text-on-surface-variant uppercase tracking-widest mb-md" style={{ fontSize: 11, letterSpacing: '0.08em' }}>
          Core Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {FEATURES.map(f => (
            <div key={f.title} className="glass-card p-md flex gap-md"
              style={{ border: `1px solid ${f.border}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: f.bg, border: `1px solid ${f.border}` }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: f.color }}>{f.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-sm mb-xs">
                  <h3 className="text-label-md font-bold text-on-surface">{f.title}</h3>
                  {f.badge && (
                    <span className="px-xs py-px rounded font-bold"
                      style={{ fontSize: 8, background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }}>
                      {f.badge}
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-on-surface-variant leading-relaxed" style={{ fontSize: 12 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline */}
      <div>
        <h2 className="text-label-md font-bold text-on-surface-variant uppercase tracking-widest mb-md" style={{ fontSize: 11, letterSpacing: '0.08em' }}>
          Trace Pipeline
        </h2>
        <div className="glass-card overflow-hidden">
          {PIPELINE.map((step, i) => (
            <button
              key={step.step}
              onClick={() => setActiveStep(activeStep === step.step ? null : step.step)}
              className={`w-full flex items-start gap-md px-lg py-md text-left transition-all hover:bg-surface-container-lowest ${
                i < PIPELINE.length - 1 ? 'border-b border-outline-variant' : ''
              } ${activeStep === step.step ? 'bg-surface-container-lowest' : ''}`}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-on-primary"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', fontSize: 12, marginTop: 2 }}>
                {step.step}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>{step.icon}</span>
                  <p className="text-body-sm font-bold text-on-surface">{step.title}</p>
                </div>
                {activeStep === step.step && (
                  <p className="text-body-sm text-on-surface-variant mt-xs leading-relaxed row-animate" style={{ fontSize: 12 }}>
                    {step.detail}
                  </p>
                )}
              </div>
              <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{ fontSize: 16, marginTop: 4 }}>
                {activeStep === step.step ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Publisher ingestion methods */}
      <div>
        <h2 className="text-label-md font-bold text-on-surface-variant uppercase tracking-widest mb-md" style={{ fontSize: 11, letterSpacing: '0.08em' }}>
          Publisher Ingestion Methods
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
          {INGESTION.map(m => (
            <div key={m.label} className="glass-card p-md flex flex-col items-center gap-sm text-center">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.15)' }}>
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>{m.icon}</span>
              </div>
              <div>
                <div className="flex items-center justify-center gap-xs mb-xs">
                  <p className="text-label-sm font-bold text-on-surface" style={{ fontSize: 11 }}>{m.label}</p>
                  {m.badge && (
                    <span className="px-xs py-px rounded font-bold"
                      style={{ fontSize: 7, background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }}>
                      {m.badge}
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-on-surface-variant" style={{ fontSize: 10, lineHeight: 1.4 }}>{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* For publishers */}
      <div className="glass-card p-lg overflow-hidden" style={{ border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.02)' }}>
        <div className="flex items-center gap-sm mb-md">
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#f97316' }}>apartment</span>
          <h2 className="text-body-md font-bold text-on-surface">For Publishers</h2>
        </div>
        <p className="text-body-sm text-on-surface-variant leading-relaxed mb-md" style={{ fontSize: 13 }}>
          Register your publication domain and CoMP Ledger indexes your corpus automatically — via the new auto-crawl feature
          (probes your sitemap and RSS), manual upload, bulk JSON, or a direct API integration.
          From that point on, every AI trace that matches your content is attributed to you and logged.
          Your Analytics dashboard shows total citations, top-cited articles, traces matched, and ingestion history.
        </p>
        <div className="grid grid-cols-3 gap-md">
          {[
            { icon: 'radar',           label: 'One-click crawl',        sub: 'Sitemap + RSS auto-discovery', beta: true },
            { icon: 'format_quote',    label: 'Real-time citations',     sub: 'See every AI usage of your work' },
            { icon: 'lock',            label: 'Secure publisher login',  sub: 'JWT auth + per-account scoping' },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center gap-xs text-center p-sm rounded-xl"
              style={{ background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)' }}>
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 22 }}>{item.icon}</span>
              <div>
                <div className="flex items-center justify-center gap-xs mb-xs">
                  <p className="text-label-sm font-bold text-on-surface" style={{ fontSize: 11 }}>{item.label}</p>
                  {item.beta && (
                    <span className="px-xs py-px rounded font-bold"
                      style={{ fontSize: 7, background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }}>
                      BETA
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-on-surface-variant" style={{ fontSize: 10 }}>{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech stack */}
      <div>
        <h2 className="text-label-md font-bold text-on-surface-variant uppercase tracking-widest mb-md" style={{ fontSize: 11, letterSpacing: '0.08em' }}>
          Tech Stack
        </h2>
        <div className="glass-card p-md">
          <div className="flex flex-wrap gap-sm">
            {STACK.map(t => {
              const c = CATEGORY_COLORS[t.category];
              return (
                <span key={t.label} className="flex items-center gap-xs px-sm py-xs rounded-lg text-label-sm font-medium"
                  style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{t.icon}</span>
                  {t.label}
                </span>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-md mt-md pt-md border-t border-outline-variant">
            {Object.entries(CATEGORY_COLORS).map(([cat, c]) => (
              <span key={cat} className="flex items-center gap-xs text-label-sm text-on-surface-variant" style={{ fontSize: 11 }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.text }} />
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
