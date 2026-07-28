import React, { useEffect, useRef } from 'react';

export default function Landing({ onEnter }) {
  const sectionsRef = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('land-visible');
          }
        });
      },
      { threshold: 0.15 }
    );
    sectionsRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const addRef = (i) => (el) => { sectionsRef.current[i] = el; };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#ffffff' }}>
      {/* Animated background */}
      <div className="landing-bg">
        <div className="landing-aurora" />
        <div className="landing-aurora-2" />
        <div className="landing-blob landing-blob-1" />
        <div className="landing-blob landing-blob-2" />
        <div className="landing-blob landing-blob-3" />
        <div className="landing-blob landing-blob-4" />
        <div className="landing-blob landing-blob-5" />
        <div className="landing-grid" />
        <div className="landing-particles">
          <div className="landing-particle" />
          <div className="landing-particle" />
          <div className="landing-particle" />
          <div className="landing-particle" />
          <div className="landing-particle" />
          <div className="landing-particle" />
          <div className="landing-particle" />
          <div className="landing-particle" />
          <div className="landing-particle" />
          <div className="landing-particle" />
          <div className="landing-particle" />
          <div className="landing-particle" />
        </div>
        <div className="landing-streak landing-streak-1" />
        <div className="landing-streak landing-streak-2" />
        <div className="landing-streak landing-streak-3" />
        <div className="landing-vignette" />
        <div className="landing-noise" />
      </div>

      {/* Hero — two column */}
      <header className="relative z-10 px-md pt-xl pb-xl" style={{ paddingTop: 80, paddingBottom: 60, maxWidth: 1120, margin: '0 auto' }}>
        {/* Logo */}
        <div className="landing-fade-in flex items-center gap-sm mb-xl">
          <div className="landing-logo w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>verified</span>
          </div>
          <span className="text-label-md font-bold tracking-widest uppercase" style={{ color: '#141b2b' }}>CoMP Ledger</span>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          {/* Left — text + CTA */}
          <div>
            <h1 className="landing-fade-in landing-delay-1 font-black tracking-tight leading-tight" style={{ fontSize: 48, color: '#141b2b' }}>
              Prove AI uses your<br />
              <span className="landing-gradient-text">exclusive reporting</span>
            </h1>

            <p className="landing-fade-in landing-delay-2 text-body-lg mt-lg" style={{ color: '#4a4455', maxWidth: 480 }}>
              An evidence platform that decomposes AI-generated answers into atomic facts, then scores each one for uniqueness — tracing whether content originated from your archive or public knowledge.
            </p>

            <div className="landing-fade-in landing-delay-3 flex items-center gap-md mt-xl">
              <button
                onClick={onEnter}
                className="landing-btn-glow group relative inline-flex items-center gap-sm text-label-md font-bold rounded-lg text-white active:scale-[0.97] transition-all duration-200"
                style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
              >
                Start Analysis
                <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-1" style={{ fontSize: 18 }}>arrow_forward</span>
              </button>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-xs text-label-md font-bold rounded-lg transition-all duration-200 hover:border-purple-500"
                style={{ padding: '14px 20px', color: '#141b2b', border: '1px solid #d1d5db' }}
              >
                How it works
              </a>
            </div>

            {/* Pipeline strip */}
            <div className="landing-fade-in landing-delay-4 mt-xl" style={{ marginTop: 40 }}>
              <div className="landing-pipeline" style={{ justifyContent: 'flex-start', padding: '14px 20px' }}>
                {[
                  { icon: 'article', label: 'AI Answer' },
                  { icon: 'decompose', label: 'Facts' },
                  { icon: 'compare', label: 'Match' },
                  { icon: 'verified', label: 'Evidence' },
                ].map(({ icon, label }, i, arr) => (
                  <React.Fragment key={label}>
                    <div className="landing-pipeline-step">
                      <div className="landing-pipeline-icon" style={{ width: 38, height: 38 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#7c3aed' }}>{icon}</span>
                      </div>
                      <span className="text-body-sm font-bold" style={{ color: '#141b2b', fontSize: 12 }}>{label}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="landing-pipeline-arrow" style={{ padding: '0 8px' }}>
                        <div className="landing-pipeline-line" style={{ width: 16 }} />
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(124, 58, 237, 0.4)' }}>chevron_right</span>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Fact Ledger preview */}
          <div className="landing-fade-in landing-delay-5">
            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 20px 60px rgba(99, 14, 212, 0.08), 0 4px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '14px 20px', background: '#f9f9ff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#7c3aed' }}>fact_check</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#141b2b' }}>Fact Ledger</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#7b7487' }}>7 facts scored</span>
                </div>
              </div>

              {/* Column headers */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', borderBottom: '1px solid #f1f3ff', gap: 12 }}>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#7b7487', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Claim</span>
                <span style={{ width: 120, fontSize: 11, fontWeight: 600, color: '#7b7487', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Uniqueness</span>
                <span style={{ width: 40, fontSize: 11, fontWeight: 600, color: '#7b7487', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>FP</span>
              </div>

              {/* Rows */}
              <div style={{ padding: 0 }}>
                {[
                  { claim: 'Home purchase price was $133,363', score: 100, fp: false },
                  { claim: 'Indonesia trip cost exceeded $500,000', score: 71, fp: true },
                  { claim: 'Crow purchased Thomas\'s mother\'s home', score: 56, fp: false },
                  { claim: 'Tuition payments at Hidden Lake Academy', score: 38, fp: false },
                  { claim: 'Private jet travel from Harlan Crow', score: 29, fp: false },
                  { claim: 'Yacht cruises around the globe', score: 29, fp: false },
                ].map(({ claim, score, fp }, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #f5f5ff', transition: 'background 0.15s' }} className="hover:bg-surface-container-low">
                    <span style={{ flex: 1, fontSize: 13, color: '#141b2b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{claim}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 120, flexShrink: 0 }}>
                      <div style={{ flex: 1, height: 5, background: '#eef0ff', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          borderRadius: 3,
                          width: `${score}%`,
                          background: score >= 70 ? 'linear-gradient(90deg, #630ed4, #7c3aed)' : score >= 40 ? 'linear-gradient(90deg, #a15100, #c46200)' : '#9ca3af',
                          transition: 'width 0.8s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: score >= 70 ? '#630ed4' : score >= 40 ? '#a15100' : '#6b7280', fontWeight: 700, width: 32, textAlign: 'right' }}>{score}%</span>
                    </div>
                    <div style={{ width: 40, display: 'flex', justifyContent: 'center' }}>
                      {fp ? (
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#ba1a1a', color: '#fff', padding: '3px 8px', borderRadius: 9999, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>fingerprint</span>
                          FP
                        </span>
                      ) : (
                        <span style={{ color: '#d1d5db' }}>—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer summary */}
              <div style={{ padding: '12px 20px', background: '#f9f9ff', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#7b7487' }}>ProPublica Archive · Clarence Thomas Investigation</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#630ed4' }}>2 exclusive</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#ba1a1a' }}>1 fingerprint</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* The Problem */}
      <section ref={addRef(0)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm" style={{ color: '#7c3aed' }}>The Problem</p>
          <h2 className="text-headline-lg font-black text-on-surface landing-text-glow">AI models use your journalism without credit</h2>
          <p className="text-body-md mt-md mx-auto" style={{ maxWidth: 560, color: '#4a4455' }}>
            When an AI assistant answers a question using facts from your exclusive reporting, there's no attribution, no link, and no payment. Publishers invest millions — AI serves it for free.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-md">
          {[
            { icon: 'search_off', title: 'No Attribution', desc: 'AI strips bylines, sources, and any trace of where information originated', color: '#f472b6' },
            { icon: 'money_off', title: 'No Compensation', desc: 'Publishers invest in investigative reporting that AI serves for free', color: '#fbbf24' },
            { icon: 'shield_question', title: 'No Proof', desc: 'Without forensic evidence, licensing negotiations have no leverage', color: '#22d3ee' },
          ].map(({ icon, title, desc, color }) => (
            <div key={title} className="landing-card group">
              <span className="material-symbols-outlined mb-md block transition-transform duration-300 group-hover:scale-110" style={{ fontSize: 28, color }}>
                {icon}
              </span>
              <p className="text-label-md font-bold text-on-surface mb-xs">{title}</p>
              <p className="text-body-sm leading-relaxed" style={{ color: '#4a4455' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" ref={addRef(1)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm" style={{ color: '#7c3aed' }}>How It Works</p>
          <h2 className="text-headline-lg font-black text-on-surface landing-text-glow">Three-stage forensic pipeline</h2>
        </div>

        <div className="grid grid-cols-3 gap-lg">
          {[
            {
              step: '01',
              icon: 'decompose',
              title: 'Decompose',
              desc: 'Claude breaks the AI answer into atomic factual claims — each one independently verifiable.',
              detail: 'Uses Haiku for speed across dozens of facts per answer',
              color: '#a78bfa',
            },
            {
              step: '02',
              icon: 'compare',
              title: 'Compare',
              desc: 'Each fact is embedded and searched against your publisher archive and a public reference corpus.',
              detail: 'Titan Embed V2 for 512-dim vector similarity',
              color: '#22d3ee',
            },
            {
              step: '03',
              icon: 'score',
              title: 'Score',
              desc: 'A uniqueness score from 0–100% plus fingerprint detection reveals which facts are exclusively yours.',
              detail: 'Sonnet evaluates context, phrasing, and exclusivity signals',
              color: '#34d399',
            },
          ].map(({ step, icon, title, desc, detail, color }) => (
            <div key={step} className="landing-step-card group">
              <div className="flex items-center gap-sm mb-md">
                <span className="font-black" style={{ fontSize: 48, color: 'rgba(124, 58, 237, 0.08)' }}>{step}</span>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-md transition-colors duration-300" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color }}>{icon}</span>
              </div>
              <p className="text-label-md font-bold text-on-surface mb-xs">{title}</p>
              <p className="text-body-sm leading-relaxed mb-md" style={{ color: '#4a4455' }}>{desc}</p>
              <p className="text-body-sm italic" style={{ color: '#7b7487' }}>{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Uniqueness scale */}
      <section ref={addRef(2)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm" style={{ color: '#7c3aed' }}>Scoring</p>
          <h2 className="text-headline-lg font-black text-on-surface landing-text-glow">Uniqueness at a glance</h2>
          <p className="text-body-md mt-md mx-auto" style={{ maxWidth: 500, color: '#4a4455' }}>
            Each fact gets a score indicating how likely it originated from your archive versus public knowledge.
          </p>
        </div>

        <div className="landing-score-bar">
          <div className="landing-score-segment landing-score-exclusive">
            <span className="text-label-md font-bold">80–100%</span>
            <span className="text-body-sm">Publisher Exclusive</span>
          </div>
          <div className="landing-score-segment landing-score-partial">
            <span className="text-label-md font-bold">40–79%</span>
            <span className="text-body-sm">Partially Unique</span>
          </div>
          <div className="landing-score-segment landing-score-common">
            <span className="text-label-md font-bold">0–39%</span>
            <span className="text-body-sm">Widely Reported</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-md mt-lg">
          <div className="text-center">
            <p className="text-body-sm" style={{ color: '#555f6d' }}>Strong signal — AI used your exclusive content. Evidence for licensing claims.</p>
          </div>
          <div className="text-center">
            <p className="text-body-sm" style={{ color: '#555f6d' }}>Few public sources carry this. May originate from your reporting.</p>
          </div>
          <div className="text-center">
            <p className="text-body-sm" style={{ color: '#555f6d' }}>Multiple sources report independently. Common knowledge, no claim.</p>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section ref={addRef(3)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm" style={{ color: '#7c3aed' }}>Use Cases</p>
          <h2 className="text-headline-lg font-black text-on-surface landing-text-glow">Built for content rights teams</h2>
        </div>

        <div className="grid grid-cols-3 gap-md">
          {[
            { icon: 'edit_note', title: 'Publishers', desc: 'Track whether AI models surface your exclusive reporting without attribution or payment.', color: '#f472b6' },
            { icon: 'gavel', title: 'Legal Teams', desc: 'Generate SHA-256 hashed evidence records for licensing disputes and copyright claims.', color: '#fbbf24' },
            { icon: 'handshake', title: 'Licensing Teams', desc: 'Quantify the value your content provides to AI companies during deal negotiations.', color: '#34d399' },
          ].map(({ icon, title, desc, color }) => (
            <div key={title} className="landing-card group text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-md transition-all duration-300" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color }}>{icon}</span>
              </div>
              <p className="text-label-md font-bold text-on-surface mb-xs">{title}</p>
              <p className="text-body-sm leading-relaxed" style={{ color: '#4a4455' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo data info */}
      <section ref={addRef(4)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="landing-demo-banner">
          <div className="flex items-start gap-lg">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.15)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#7c3aed' }}>database</span>
            </div>
            <div>
              <p className="text-label-md font-bold text-on-surface mb-xs">Demo Dataset Included</p>
              <p className="text-body-sm leading-relaxed" style={{ color: '#4a4455' }}>
                Pre-loaded with <strong className="text-on-surface">30 investigative articles</strong> from NY Times across 6 beats (Trump finances, COVID origins, AI regulation, Supreme Court ethics, Ukraine, climate) plus a matched <strong className="text-on-surface">public reference corpus</strong> from Reuters, AP, BBC, and others covering the same stories.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section ref={addRef(5)} className="land-section relative z-10 px-md py-xl text-center" style={{ paddingBottom: 100 }}>
        <h2 className="text-headline-lg font-black text-on-surface landing-text-glow mb-md">Ready to trace your content?</h2>
        <p className="text-body-md mb-xl mx-auto" style={{ maxWidth: 400, color: '#4a4455' }}>
          Enter a question, paste an AI answer, and see exactly which facts came from your archive.
        </p>
        <button
          onClick={onEnter}
          className="landing-btn-glow group relative inline-flex items-center gap-sm text-label-md font-bold rounded-lg text-white active:scale-[0.97] transition-all duration-200"
          style={{ padding: '16px 40px', fontSize: 16, background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
        >
          Enter the Platform
          <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-1" style={{ fontSize: 18 }}>arrow_forward</span>
        </button>
        <p className="text-body-sm mt-lg" style={{ color: '#7b7487' }}>Built at a hackathon &middot; 3-hour build &middot; 4-minute demo</p>
      </section>
    </div>
  );
}
