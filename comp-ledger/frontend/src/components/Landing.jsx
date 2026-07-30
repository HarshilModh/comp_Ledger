import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

const STEPS = [
  {
    step: 1, icon: 'input', title: 'Question In', autoOnly: false, manualOnly: false,
    auto:   'Enter a question or pick a preset topic. CoMP Ledger will generate the AI answer for you.',
    manual: 'Paste the full text of any AI-generated response you want to audit.',
    tech: null,
  },
  {
    step: 2, icon: 'smart_toy', title: 'Answer Generation', autoOnly: true, manualOnly: false,
    auto:   'The model you chose (Claude Haiku 4.5, Sonnet 4, Nova Micro, Nova Lite, or Llama 3.1 8B) is called via AWS Bedrock. The response streams back live before tracing begins.',
    manual: null,
    tech: 'AWS Bedrock · 5 models available',
  },
  {
    step: 3, icon: 'format_list_bulleted', title: 'Claim Decomposition', autoOnly: false, manualOnly: false,
    auto:   'Claude Haiku 4.5 atomises the answer into discrete, independently verifiable factual claims — stripping hedging language, opinions, and filler sentences.',
    manual: 'Same decomposition runs on the pasted response. Typically yields 5–20 atomic claims per paragraph.',
    tech: 'Claude Haiku 4.5 · ~500ms',
  },
  {
    step: 4, icon: 'hub', title: 'Semantic Embedding', autoOnly: false, manualOnly: false,
    auto:   'Each claim is encoded into a 512-dimensional vector using Amazon Titan Embed v2.',
    manual: 'Each claim is encoded into a 512-dimensional vector using Amazon Titan Embed v2.',
    tech: 'Amazon Titan Embed v2 · pgvector cosine search',
  },
  {
    step: 5, icon: 'manage_search', title: 'Corpus Search', autoOnly: false, manualOnly: false,
    auto:   'The vector is searched against all publisher articles indexed in PostgreSQL + pgvector. Top-k nearest neighbours are retrieved per claim.',
    manual: 'Same vector search — publisher corpus and public reference corpus are both queried.',
    tech: 'PostgreSQL + pgvector · top-5 per claim',
  },
  {
    step: 6, icon: 'score', title: 'Exclusivity Scoring', autoOnly: false, manualOnly: false,
    auto:   'Claude Sonnet 4 reads each claim alongside its matched sources and scores 0–100%: how many independent outlets cover this exact fact? Fewer = more exclusive.',
    manual: 'Same scoring. A 100% score means only one publisher has this specific information.',
    tech: 'Claude Sonnet 4 · streamed live',
  },
  {
    step: 7, icon: 'fingerprint', title: 'Fingerprint Detection', autoOnly: false, manualOnly: false,
    auto:   'Beyond factual matching, phrasing is compared between the AI output and the publisher original. Distinctive wording or unique data copied verbatim is flagged.',
    manual: 'Especially powerful in manual mode — directly compares pasted AI text against publisher originals.',
    tech: 'Claude Sonnet 4 · FP badge in results',
  },
  {
    step: 8, icon: 'leaderboard', title: 'Claims Grouped & Streamed', autoOnly: false, manualOnly: false,
    auto:   'Results stream to the UI in real time, grouped into three tiers: High Confidence (≥70%), Limited Sourcing (40–69%), Widely Known (<40%). Each claim is expandable to show matched sources.',
    manual: 'Same grouping and streaming. Every matched source is shown with title, publisher, and similarity score.',
    tech: 'SSE streaming · three-tier grouping',
  },
  {
    step: 9, icon: 'receipt_long', title: 'Attribution Logged', autoOnly: false, manualOnly: false,
    auto:   'Every completed trace is persisted to the database. Publishers see which of their articles were cited, how many times, and across which models — updated in real time on their Analytics dashboard.',
    manual: 'Same logging. Manual traces are recorded with mode = "manual" so publishers can distinguish them.',
    tech: 'PostgreSQL · publisher analytics',
  },
];

function Pipeline() {
  const [mode, setMode] = useState('auto');
  const [active, setActive] = useState(1);

  const activeStep = STEPS.find(s => s.step === active);
  const isVisible = (s) => mode === 'auto' ? !s.manualOnly : !s.autoOnly;

  return (
    <div className="flex flex-col gap-lg">
      {/* Mode toggle */}
      <div className="flex items-center justify-center gap-sm">
        <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 12 }}>Mode:</span>
        <div className="flex rounded-xl overflow-hidden border border-outline-variant" style={{ background: 'var(--surface-container)' }}>
          {['auto', 'manual'].map(m => (
            <button key={m} onClick={() => { setMode(m); setActive(m === 'auto' ? 1 : 1); }}
              className="px-lg py-xs text-label-sm font-bold transition-all capitalize"
              style={{
                background: mode === m ? 'linear-gradient(135deg, #16a34a, #15803d)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--on-surface-variant)',
              }}>
              {m === 'auto' ? '⚡ Auto' : '✏️ Manual'}
            </button>
          ))}
        </div>
        <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11, opacity: 0.6 }}>
          {mode === 'auto' ? 'CoMP generates the answer then traces it' : 'Paste any AI response to audit it'}
        </span>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>

        {/* Step list */}
        <div className="relative flex flex-col">
          {/* Vertical connector line */}
          <div className="absolute left-5 top-5 bottom-5 w-px" style={{ background: 'var(--outline-variant)', zIndex: 0 }} />
          {STEPS.map(s => {
            const visible = isVisible(s);
            const isActive = active === s.step;
            return (
              <button key={s.step} onClick={() => visible && setActive(s.step)}
                className="relative flex items-center gap-md px-sm py-sm rounded-xl text-left transition-all"
                style={{
                  opacity: visible ? 1 : 0.3,
                  cursor: visible ? 'pointer' : 'default',
                  background: isActive ? 'var(--surface-container-low)' : 'transparent',
                  zIndex: 1,
                }}>
                {/* Node */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black transition-all"
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, #16a34a, #15803d)'
                      : visible ? 'var(--surface-container-high)' : 'var(--surface-container)',
                    color: isActive ? '#fff' : 'var(--on-surface-variant)',
                    fontSize: 13,
                    boxShadow: isActive ? '0 4px 14px rgba(22,163,74,0.35)' : 'none',
                    border: isActive ? 'none' : '1px solid var(--outline-variant)',
                  }}>
                  {s.step}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-label-sm font-bold truncate ${isActive ? 'text-primary' : 'text-on-surface'}`} style={{ fontSize: 12 }}>
                    {s.title}
                  </p>
                  {s.autoOnly && (
                    <span className="text-label-sm" style={{ fontSize: 9, color: '#16a34a', fontWeight: 700 }}>AUTO ONLY</span>
                  )}
                </div>
                {isActive && <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 16 }}>chevron_right</span>}
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        {activeStep && (
          <div className="card p-lg flex flex-col gap-md" style={{ border: '1px solid rgba(22,163,74,0.2)', background: 'linear-gradient(135deg, rgba(22,163,74,0.03), transparent)' }}>
            <div className="flex items-center gap-md">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 20px rgba(22,163,74,0.3)' }}>
                <span className="material-symbols-outlined text-white" style={{ fontSize: 24 }}>{activeStep.icon}</span>
              </div>
              <div>
                <div className="flex items-center gap-sm">
                  <span className="text-label-sm text-primary font-bold" style={{ fontSize: 11 }}>Step {activeStep.step}</span>
                  {activeStep.autoOnly && (
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(22,163,74,0.12)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)', fontWeight: 800 }}>AUTO ONLY</span>
                  )}
                </div>
                <h3 className="text-body-lg font-black text-on-surface">{activeStep.title}</h3>
              </div>
            </div>

            <div className="rounded-xl p-md" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)' }}>
              <div className="flex items-center gap-xs mb-sm">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>
                  {mode === 'auto' ? 'auto_awesome' : 'edit_note'}
                </span>
                <span className="text-label-sm font-bold text-primary uppercase" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                  {mode === 'auto' ? 'Auto mode' : 'Manual mode'}
                </span>
              </div>
              <p className="text-body-sm text-on-surface leading-relaxed" style={{ fontSize: 13 }}>
                {mode === 'auto' ? activeStep.auto : (activeStep.manual || activeStep.auto)}
              </p>
            </div>

            {activeStep.tech && (
              <div className="flex items-center gap-sm flex-wrap">
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 13 }}>memory</span>
                <span className="text-label-sm text-on-surface-variant" style={{ fontSize: 11 }}>{activeStep.tech}</span>
              </div>
            )}

            {/* Next step hint */}
            {active < STEPS.length && (
              <button onClick={() => {
                const next = STEPS.find(s => s.step > active && isVisible(s));
                if (next) setActive(next.step);
              }} className="flex items-center gap-xs text-label-sm text-primary hover:underline self-start mt-auto" style={{ fontSize: 12 }}>
                Next: {STEPS.find(s => s.step > active && isVisible(s))?.title}
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(o => !o)}
      className="w-full text-left rounded-xl px-lg py-md transition-all hover:bg-surface-container-low"
      style={{ background: open ? 'var(--surface-container-low)' : 'var(--surface-container)', border: '1px solid var(--outline-variant)' }}
    >
      <div className="flex items-center justify-between gap-md">
        <p className="text-body-md font-bold text-on-surface">{q}</p>
        <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{ fontSize: 20 }}>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </div>
      {open && (
        <p className="text-body-sm text-on-surface-variant mt-sm leading-relaxed" style={{ fontSize: 13 }}>{a}</p>
      )}
    </button>
  );
}

export default function Landing({ onEnter }) {
  const { theme, toggle } = useTheme();
  const [activeStep, setActiveStep] = useState(null);

  const handleEnter = onEnter || (() => { window.location.href = '/facts'; });
  const sectionsRef = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('land-visible'); }),
      { threshold: 0.1 }
    );
    sectionsRef.current.forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const addRef = (i) => (el) => { sectionsRef.current[i] = el; };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background transition-colors duration-300">
      {/* Background effects */}
      <div className="landing-bg">
        <div className="landing-aurora" />
        <div className="landing-aurora-2" />
        <div className="landing-blob landing-blob-1" />
        <div className="landing-blob landing-blob-2" />
        <div className="landing-blob landing-blob-3" />
        <div className="landing-grid" />
        <div className="landing-particles">
          {[...Array(6)].map((_, i) => <div key={i} className="landing-particle" />)}
        </div>
        <div className="landing-streak landing-streak-1" />
        <div className="landing-streak landing-streak-2" />
        <div className="landing-streak landing-streak-3" />
        <div className="landing-vignette" />
        <div className="landing-noise" />
      </div>

      {/* Nav */}
      <header className="relative z-10 px-md" style={{ paddingTop: 80, paddingBottom: 60, maxWidth: 1120, margin: '0 auto' }}>
        <div className="landing-fade-in flex items-center justify-between mb-xl">
          <div className="flex items-center gap-sm">
            <div className="landing-logo w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f4a2c, #0a3320)' }}>
              <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #4ade80, #16a34a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CL</span>
            </div>
            <span className="text-label-md font-bold tracking-widest uppercase text-on-surface">CoMP Ledger</span>
          </div>
          <div className="flex items-center gap-md">
            <span className="px-md py-xs rounded-full text-label-sm font-bold text-primary" style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)', fontSize: 11 }}>v1.0</span>
            <button onClick={toggle} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface-container-high transition-colors border border-outline-variant">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
            </button>
          </div>
        </div>

        {/* Hero */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div>
            <h1 className="landing-fade-in landing-delay-1 font-black tracking-tight leading-tight text-on-surface" style={{ fontSize: 48 }}>
              Prove AI uses your<br />
              <span className="landing-gradient-text">exclusive reporting</span>
            </h1>
            <p className="landing-fade-in landing-delay-2 text-body-lg mt-lg text-on-surface-variant" style={{ maxWidth: 480 }}>
              An evidence platform that decomposes AI-generated answers into atomic facts, scores each one for exclusivity, and traces every claim back to its original publisher source.
            </p>
            <div className="landing-fade-in landing-delay-3 flex items-center gap-md mt-xl">
              <button
                onClick={handleEnter}
                className="landing-btn-glow group relative inline-flex items-center gap-sm text-label-md font-bold rounded-xl text-white active:scale-[0.97] transition-all duration-200"
                style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
              >
                Start Analysis
                <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-1" style={{ fontSize: 18 }}>arrow_forward</span>
              </button>
              <a href="#features" className="btn-ghost inline-flex items-center gap-xs text-label-md font-bold" style={{ padding: '14px 20px' }}>
                See all features
              </a>
            </div>
            <div className="landing-fade-in landing-delay-4 flex flex-wrap gap-sm mt-xl">
              {[
                { icon: 'auto_awesome',   label: 'Auto Fact-Check' },
                { icon: 'compare',        label: 'Multi-Model Compare' },
                { icon: 'travel_explore', label: 'Deep Research' },
                { icon: 'radar',          label: 'Auto Crawl', beta: true },
              ].map(tag => (
                <span key={tag.label} className="flex items-center gap-xs px-sm py-xs rounded-lg text-label-sm font-medium text-on-surface-variant"
                  style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)', fontSize: 11 }}>
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>{tag.icon}</span>
                  {tag.label}
                  {tag.beta && (
                    <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', fontWeight: 800 }}>BETA</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Hero card */}
          <div className="landing-fade-in landing-delay-5">
            <div className="card overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}>
              <div className="px-md py-sm bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>fact_check</span>
                  <span className="text-label-md font-bold text-on-surface">Fact Ledger</span>
                </div>
                <div className="flex items-center gap-xs">
                  <span className="w-1.5 h-1.5 rounded-full inline-block bg-primary" />
                  <span className="font-code text-on-surface-variant" style={{ fontSize: 11 }}>7 facts scored</span>
                </div>
              </div>
              <div className="flex items-center border-b border-outline-variant px-md py-xs gap-md">
                <span className="flex-1 text-label-md font-semibold text-on-surface-variant uppercase" style={{ fontSize: 10, letterSpacing: '0.05em' }}>Claim</span>
                <span className="text-label-md font-semibold text-on-surface-variant uppercase" style={{ width: 120, fontSize: 10, letterSpacing: '0.05em' }}>Uniqueness</span>
                <span className="text-label-md font-semibold text-on-surface-variant uppercase text-center" style={{ width: 40, fontSize: 10, letterSpacing: '0.05em' }}>FP</span>
              </div>
              <div>
                {[
                  { claim: 'Home purchase price was $133,363', score: 100, fp: false },
                  { claim: 'Indonesia trip cost exceeded $500,000', score: 71, fp: true },
                  { claim: "Crow purchased Thomas's mother's home", score: 56, fp: false },
                  { claim: 'Tuition payments at Hidden Lake Academy', score: 38, fp: false },
                  { claim: 'Private jet travel from Harlan Crow', score: 29, fp: false },
                  { claim: 'Yacht cruises around the globe', score: 29, fp: false },
                ].map(({ claim, score, fp }, i) => (
                  <div key={i} className="flex items-center gap-md px-md py-sm border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors">
                    <span className="flex-1 text-body-sm text-on-surface font-medium truncate">{claim}</span>
                    <div className="flex items-center gap-sm" style={{ width: 120, flexShrink: 0 }}>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-container-high">
                        <div className="h-full rounded-full" style={{ width: `${score}%`, background: score >= 70 ? 'var(--primary)' : score >= 40 ? 'var(--tertiary)' : 'var(--secondary)', transition: 'width 0.7s ease' }} />
                      </div>
                      <span className="font-code font-bold" style={{ fontSize: 11, width: 32, textAlign: 'right', color: score >= 70 ? 'var(--primary)' : score >= 40 ? 'var(--tertiary)' : 'var(--secondary)' }}>{score}%</span>
                    </div>
                    <div style={{ width: 40, display: 'flex', justifyContent: 'center' }}>
                      {fp ? (
                        <span className="inline-flex items-center gap-xs rounded-md font-bold" style={{ fontSize: 9, padding: '2px 6px', background: 'var(--error-container)', color: 'var(--on-error-container)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 9 }}>fingerprint</span>FP
                        </span>
                      ) : <span className="text-on-surface-variant" style={{ opacity: 0.3 }}>—</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-md py-sm bg-surface-container-low border-t border-outline-variant flex justify-between items-center">
                <span className="text-on-surface-variant" style={{ fontSize: 11 }}>ProPublica Archive</span>
                <div className="flex gap-md">
                  <span className="text-primary font-bold" style={{ fontSize: 11 }}>2 exclusive</span>
                  <span className="text-error font-bold" style={{ fontSize: 11 }}>1 fingerprint</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Problem */}
      <section ref={addRef(0)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">The Problem</p>
          <h2 className="text-headline-lg font-black text-on-surface">AI models use your journalism without credit</h2>
          <p className="text-body-md mt-md mx-auto text-on-surface-variant" style={{ maxWidth: 560 }}>
            When an AI assistant answers a question using facts from your exclusive reporting, there's no attribution, no link, and no payment.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-md">
          {[
            { icon: 'search_off',       title: 'No Attribution',   desc: 'AI strips bylines, sources, and any trace of where information originated' },
            { icon: 'money_off',        title: 'No Compensation',  desc: 'Publishers invest in investigative reporting that AI serves for free' },
            { icon: 'shield_question',  title: 'No Proof',         desc: 'Without forensic evidence, licensing negotiations have no leverage' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="landing-card">
              <span className="material-symbols-outlined text-primary mb-md block" style={{ fontSize: 28 }}>{icon}</span>
              <p className="text-label-md font-bold text-on-surface mb-xs">{title}</p>
              <p className="text-body-sm leading-relaxed text-on-surface-variant">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" ref={addRef(1)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">Features</p>
          <h2 className="text-headline-lg font-black text-on-surface">Everything you need to trace AI content</h2>
        </div>
        <div className="grid grid-cols-2 gap-md">
          {[
            { icon: 'auto_awesome',   color: '#16a34a', title: 'Auto Fact-Check',       desc: 'Ask a question — CoMP Ledger picks a model, generates an answer, and traces every claim automatically. No copy-paste.', badge: null },
            { icon: 'edit_note',      color: '#0ea5e9', title: 'Manual Trace',           desc: 'Paste any existing AI-generated response. Claims are decomposed, embedded, and matched against publisher content.', badge: null },
            { icon: 'compare',        color: '#7c3aed', title: 'Multi-Model Compare',    desc: 'Run the same question through up to 5 AI models. See which cite publishers, which fabricate, and where they agree.', badge: null },
            { icon: 'travel_explore', color: '#0ea5e9', title: 'Deep Research',          desc: 'Multi-step research agent that decomposes topics, searches the web, and produces a fully cited report.', badge: null },
            { icon: 'radar',          color: '#16a34a', title: 'Auto Site Crawl',        desc: 'Enter a domain — CoMP Ledger probes sitemaps and RSS, then indexes up to 100 articles with no manual input.', badge: 'BETA' },
            { icon: 'fingerprint',    color: '#dc2626', title: 'Fingerprint Detection',  desc: 'Identifies distinctive phrasing or unique data points in AI output that trace back to a specific original source.', badge: null },
            { icon: 'apartment',      color: '#f97316', title: 'Publisher Registry',     desc: 'Publishers register their domain and content. Citations are attributed back to them in real time.', badge: null },
            { icon: 'analytics',      color: '#7c3aed', title: 'Attribution Analytics',  desc: 'See which articles were cited by AI, across which traces and models, with citation frequency over time.', badge: null },
          ].map(f => (
            <div key={f.title} className="landing-card flex gap-md" style={{ borderLeft: `2px solid ${f.color}22` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${f.color}14`, border: `1px solid ${f.color}28` }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: f.color }}>{f.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-sm mb-xs">
                  <p className="text-label-md font-bold text-on-surface">{f.title}</p>
                  {f.badge && (
                    <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', fontWeight: 800 }}>{f.badge}</span>
                  )}
                </div>
                <p className="text-body-sm leading-relaxed text-on-surface-variant" style={{ fontSize: 12 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section id="how-it-works" ref={addRef(2)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">How It Works</p>
          <h2 className="text-headline-lg font-black text-on-surface">The forensic trace pipeline</h2>
        </div>
        <Pipeline />
      </section>

      {/* Scoring */}
      <section ref={addRef(3)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">Scoring</p>
          <h2 className="text-headline-lg font-black text-on-surface">Claim tiers at a glance</h2>
          <p className="text-body-md mt-md mx-auto text-on-surface-variant" style={{ maxWidth: 500 }}>
            Every traced claim is grouped by how uniquely it traces to publisher content versus widely known public knowledge.
          </p>
        </div>
        <div className="landing-score-bar">
          <div className="landing-score-segment landing-score-exclusive">
            <span className="text-label-md font-bold">≥ 70%</span>
            <span className="text-body-sm">High Confidence</span>
            <span className="text-body-sm" style={{ opacity: 0.6, fontSize: 11 }}>Strongly publisher-sourced</span>
          </div>
          <div className="landing-score-segment landing-score-partial">
            <span className="text-label-md font-bold">40–69%</span>
            <span className="text-body-sm">Limited Sourcing</span>
            <span className="text-body-sm" style={{ opacity: 0.6, fontSize: 11 }}>Partially unique</span>
          </div>
          <div className="landing-score-segment landing-score-common">
            <span className="text-label-md font-bold">&lt; 40%</span>
            <span className="text-body-sm">Widely Known</span>
            <span className="text-body-sm" style={{ opacity: 0.6, fontSize: 11 }}>Public knowledge</span>
          </div>
        </div>
      </section>

      {/* Publisher ingestion */}
      <section ref={addRef(4)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">For Publishers</p>
          <h2 className="text-headline-lg font-black text-on-surface">8 ways to get your content indexed</h2>
          <p className="text-body-md mt-md mx-auto text-on-surface-variant" style={{ maxWidth: 520 }}>
            Register your domain and choose any ingestion method. Every article indexed becomes traceable across AI models in real time.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-md">
          {[
            { icon: 'radar',        label: 'Auto Crawl',   desc: 'Sitemap + RSS auto-discovery', beta: true },
            { icon: 'edit_note',    label: 'Paste',        desc: 'Enter title, body, author, date' },
            { icon: 'link',         label: 'URL Extract',  desc: 'Paste a URL, we extract it' },
            { icon: 'playlist_add', label: 'Bulk URLs',    desc: 'Up to 20 URLs in parallel' },
            { icon: 'upload_file',  label: 'Bulk JSON',    desc: 'Drag & drop JSON array' },
            { icon: 'rss_feed',     label: 'RSS Poll',     desc: 'Auto-import every 30 min' },
            { icon: 'cloud_upload', label: 'Push API',     desc: 'POST from any CMS or webhook' },
            { icon: 'download',     label: 'Pull API',     desc: 'We pull from your content API' },
          ].map(m => (
            <div key={m.label} className="landing-card flex flex-col items-center gap-sm text-center p-md">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.15)' }}>
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>{m.icon}</span>
              </div>
              <div>
                <div className="flex items-center justify-center gap-xs mb-xs">
                  <p className="text-label-sm font-bold text-on-surface" style={{ fontSize: 11 }}>{m.label}</p>
                  {m.beta && (
                    <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', fontWeight: 800 }}>BETA</span>
                  )}
                </div>
                <p className="text-body-sm text-on-surface-variant" style={{ fontSize: 10, lineHeight: 1.4 }}>{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section ref={addRef(5)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">Use Cases</p>
          <h2 className="text-headline-lg font-black text-on-surface">Built for content rights teams</h2>
        </div>
        <div className="grid grid-cols-3 gap-md">
          {[
            { icon: 'edit_note',   title: 'Publishers',       desc: 'Track whether AI models surface your exclusive reporting without attribution or payment.' },
            { icon: 'gavel',       title: 'Legal Teams',      desc: 'Generate hashed evidence records for licensing disputes and copyright claims.' },
            { icon: 'handshake',   title: 'Licensing Teams',  desc: 'Quantify the value your content provides to AI companies during deal negotiations.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="landing-card text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-md bg-primary-fixed">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 24 }}>{icon}</span>
              </div>
              <p className="text-label-md font-bold text-on-surface mb-xs">{title}</p>
              <p className="text-body-sm leading-relaxed text-on-surface-variant">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section ref={addRef(6)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">Tech Stack</p>
          <h2 className="text-headline-lg font-black text-on-surface">Built on best-in-class infrastructure</h2>
        </div>
        <div className="landing-card">
          <div className="flex flex-wrap gap-sm">
            {[
              { label: 'React 18',               cat: 'Frontend',  icon: 'web' },
              { label: 'Vite 5',                 cat: 'Frontend',  icon: 'bolt' },
              { label: 'Tailwind CSS',           cat: 'Frontend',  icon: 'palette' },
              { label: 'Fastify 4',              cat: 'Backend',   icon: 'api' },
              { label: 'PostgreSQL + pgvector',  cat: 'Backend',   icon: 'database' },
              { label: 'JWT Auth',               cat: 'Backend',   icon: 'lock' },
              { label: 'Google Sign-In',         cat: 'Backend',   icon: 'login' },
              { label: 'AWS Bedrock',            cat: 'AI',        icon: 'cloud' },
              { label: 'Amazon Titan Embed v2',  cat: 'AI',        icon: 'hub' },
              { label: 'Claude Haiku 4.5',       cat: 'AI',        icon: 'smart_toy' },
              { label: 'Claude Sonnet 4',        cat: 'AI',        icon: 'psychology' },
              { label: 'Nova Micro / Lite',      cat: 'AI',        icon: 'bolt' },
              { label: 'Llama 3.1 8B',          cat: 'AI',        icon: 'memory' },
              { label: 'Amazon S3',              cat: 'Infra',     icon: 'folder' },
              { label: 'RSS Poller',             cat: 'Infra',     icon: 'schedule' },
              { label: 'SSE Streaming',          cat: 'Infra',     icon: 'stream' },
            ].map(t => {
              const colors = {
                Frontend: { bg: 'rgba(14,165,233,0.08)',  text: '#0ea5e9', border: 'rgba(14,165,233,0.2)' },
                Backend:  { bg: 'rgba(249,115,22,0.08)',  text: '#f97316', border: 'rgba(249,115,22,0.2)' },
                AI:       { bg: 'rgba(22,163,74,0.08)',   text: '#16a34a', border: 'rgba(22,163,74,0.2)'  },
                Infra:    { bg: 'rgba(124,58,237,0.08)',  text: '#7c3aed', border: 'rgba(124,58,237,0.2)' },
              }[t.cat];
              return (
                <span key={t.label} className="flex items-center gap-xs px-sm py-xs rounded-lg text-label-sm font-medium"
                  style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, fontSize: 11 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{t.icon}</span>
                  {t.label}
                </span>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-md mt-md pt-md border-t border-outline-variant">
            {[['Frontend','#0ea5e9'],['Backend','#f97316'],['AI','#16a34a'],['Infra','#7c3aed']].map(([cat, color]) => (
              <span key={cat} className="flex items-center gap-xs text-label-sm text-on-surface-variant" style={{ fontSize: 11 }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />{cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Demo dataset */}
      <section ref={addRef(7)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="landing-demo-banner">
          <div className="flex items-start gap-lg">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary-fixed">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>database</span>
            </div>
            <div>
              <p className="text-label-md font-bold text-on-surface mb-xs">Demo Dataset Included</p>
              <p className="text-body-sm leading-relaxed text-on-surface-variant">
                Pre-loaded with <strong className="text-on-surface">30 investigative articles</strong> from NY Times across 6 beats plus a matched <strong className="text-on-surface">public reference corpus</strong> from Reuters, AP, BBC, and others.
                Try Auto Fact-Check with any preset question to see the full pipeline in action.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section ref={addRef(8)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">FAQ</p>
          <h2 className="text-headline-lg font-black text-on-surface">Frequently asked questions</h2>
        </div>
        <div className="flex flex-col gap-sm">
          {[
            {
              q: 'Do I need an AI API key to use CoMP Ledger?',
              a: 'No. The platform runs entirely on the server using AWS Bedrock. Publishers and analysts just log in and use the interface — no personal API keys required.',
            },
            {
              q: 'How does Auto Fact-Check differ from Manual Trace?',
              a: 'Auto mode generates the AI answer for you using a model you select, then immediately traces every claim. Manual mode lets you paste any existing AI-generated response to audit. Both use the same decompose → embed → score pipeline.',
            },
            {
              q: 'What is the Auto Site Crawl (BETA) feature?',
              a: 'Enter your domain and CoMP Ledger probes for sitemaps and RSS feeds, then extracts and indexes up to 100 articles automatically. No copy-paste or file upload needed. It\'s in beta because success depends on how each site structures its sitemap/RSS.',
            },
            {
              q: 'What does the exclusivity score mean?',
              a: 'It measures how uniquely a claimed fact traces to publisher content versus public knowledge. A score ≥70% means few independent sources cover that fact — it likely originated from that publisher\'s reporting. <40% means it\'s widely reported across many outlets.',
            },
            {
              q: 'What is fingerprint detection?',
              a: 'Beyond matching facts, CoMP Ledger checks whether distinctive phrasing, unique data points, or stylistic patterns in the AI output match the publisher\'s original text — indicating possible direct copying rather than independent knowledge.',
            },
            {
              q: 'Can I compare multiple AI models at once?',
              a: 'Yes. The Compare page runs the same question through up to 5 models simultaneously via SSE streaming. You get a live leaderboard, consensus sources cited by 2+ models, a source heat-map, and an export button.',
            },
            {
              q: 'How do publishers get their content indexed?',
              a: 'Publishers register their domain and choose from 8 ingestion methods: Auto Crawl (BETA), paste, URL extract, bulk URLs, bulk JSON, RSS auto-poll, Push API, or Pull API. All methods produce the same vector-indexed result.',
            },
            {
              q: 'Does CoMP Ledger work without AWS?',
              a: 'Yes — see FREE_ALTERNATIVES.md in the repo for a full migration guide. Groq and Gemini Flash cover LLM calls for free, Ollama nomic-embed-text handles embeddings locally, and PostgreSQL + pgvector stays the same.',
            },
          ].map(({ q, a }, i) => (
            <FaqItem key={i} q={q} a={a} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section ref={addRef(9)} className="land-section relative z-10 px-md py-xl text-center" style={{ paddingBottom: 100 }}>
        <h2 className="text-headline-lg font-black text-on-surface mb-md">Ready to trace your content?</h2>
        <p className="text-body-md mb-xl mx-auto text-on-surface-variant" style={{ maxWidth: 400 }}>
          Enter a question, pick a model, and see exactly which claims came from your archive.
        </p>
        <button
          onClick={handleEnter}
          className="landing-btn-glow group relative inline-flex items-center gap-sm text-label-md font-bold rounded-xl text-white active:scale-[0.97] transition-all duration-200"
          style={{ padding: '16px 40px', fontSize: 16, background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
        >
          Enter the Platform
          <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-1" style={{ fontSize: 18 }}>arrow_forward</span>
        </button>
        <p className="text-body-sm mt-lg text-on-surface-variant" style={{ opacity: 0.5 }}>Built on AWS Bedrock &middot; pgvector &middot; Claude</p>
      </section>
    </div>
  );
}
