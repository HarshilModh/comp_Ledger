import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function Landing({ onEnter }) {
  const { theme, toggle } = useTheme();

  const handleEnter = onEnter || (() => {
    window.location.href = '/facts';
  });
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
    <div className="min-h-screen relative overflow-hidden bg-background transition-colors duration-300">
      <div className="landing-bg">
        <div className="landing-aurora" />
        <div className="landing-aurora-2" />
        <div className="landing-blob landing-blob-1" />
        <div className="landing-blob landing-blob-2" />
        <div className="landing-blob landing-blob-3" />
        <div className="landing-grid" />
        <div className="landing-particles">
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

      <header className="relative z-10 px-md" style={{ paddingTop: 80, paddingBottom: 60, maxWidth: 1120, margin: '0 auto' }}>
        <div className="landing-fade-in flex items-center justify-between mb-xl">
          <div className="flex items-center gap-sm">
            <div className="landing-logo w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f4a2c, #0a3320)' }}>
              <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #4ade80, #16a34a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CL</span>
            </div>
            <span className="text-label-md font-bold tracking-widest uppercase text-on-surface">CoMP Ledger</span>
          </div>
          <button
            onClick={toggle}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface-container-high transition-colors border border-outline-variant"
          >
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div>
            <h1 className="landing-fade-in landing-delay-1 font-black tracking-tight leading-tight text-on-surface" style={{ fontSize: 48 }}>
              Prove AI uses your<br />
              <span className="landing-gradient-text">exclusive reporting</span>
            </h1>

            <p className="landing-fade-in landing-delay-2 text-body-lg mt-lg text-on-surface-variant" style={{ maxWidth: 480 }}>
              An evidence platform that decomposes AI-generated answers into atomic facts, then scores each one for uniqueness — tracing whether content originated from your archive or public knowledge.
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
              <a
                href="#how-it-works"
                className="btn-ghost inline-flex items-center gap-xs text-label-md font-bold"
                style={{ padding: '14px 20px' }}
              >
                How it works
              </a>
            </div>

            <div className="landing-fade-in landing-delay-4" style={{ marginTop: 40 }}>
              <div className="landing-pipeline" style={{ justifyContent: 'flex-start', padding: '14px 20px', display: 'inline-flex' }}>
                {[
                  { icon: 'article', label: 'AI Answer' },
                  { icon: 'decompose', label: 'Facts' },
                  { icon: 'compare', label: 'Match' },
                  { icon: 'verified', label: 'Evidence' },
                ].map(({ icon, label }, i, arr) => (
                  <React.Fragment key={label}>
                    <div className="landing-pipeline-step">
                      <div className="landing-pipeline-icon" style={{ width: 38, height: 38 }}>
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>{icon}</span>
                      </div>
                      <span className="text-body-sm font-bold text-on-surface" style={{ fontSize: 12 }}>{label}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="landing-pipeline-arrow" style={{ padding: '0 8px' }}>
                        <div className="landing-pipeline-line" style={{ width: 16 }} />
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--outline)' }}>chevron_right</span>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="landing-fade-in landing-delay-5">
            <div className="card overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)' }}>
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
                        <div className="h-full rounded-full" style={{
                          width: `${score}%`,
                          background: score >= 70 ? 'var(--primary)' : score >= 40 ? 'var(--tertiary)' : 'var(--secondary)',
                          transition: 'width 0.7s ease',
                        }} />
                      </div>
                      <span className="font-code font-bold" style={{ fontSize: 11, width: 32, textAlign: 'right', color: score >= 70 ? 'var(--primary)' : score >= 40 ? 'var(--tertiary)' : 'var(--secondary)' }}>{score}%</span>
                    </div>
                    <div style={{ width: 40, display: 'flex', justifyContent: 'center' }}>
                      {fp ? (
                        <span className="inline-flex items-center gap-xs rounded-md font-bold" style={{ fontSize: 9, padding: '2px 6px', background: 'var(--error-container)', color: 'var(--on-error-container)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 9 }}>fingerprint</span>
                          FP
                        </span>
                      ) : (
                        <span className="text-on-surface-variant" style={{ opacity: 0.3 }}>—</span>
                      )}
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

      <section ref={addRef(0)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">The Problem</p>
          <h2 className="text-headline-lg font-black text-on-surface">AI models use your journalism without credit</h2>
          <p className="text-body-md mt-md mx-auto text-on-surface-variant" style={{ maxWidth: 560 }}>
            When an AI assistant answers a question using facts from your exclusive reporting, there's no attribution, no link, and no payment.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-md">
          {[
            { icon: 'search_off', title: 'No Attribution', desc: 'AI strips bylines, sources, and any trace of where information originated' },
            { icon: 'money_off', title: 'No Compensation', desc: 'Publishers invest in investigative reporting that AI serves for free' },
            { icon: 'shield_question', title: 'No Proof', desc: 'Without forensic evidence, licensing negotiations have no leverage' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="landing-card">
              <span className="material-symbols-outlined text-primary mb-md block" style={{ fontSize: 28 }}>{icon}</span>
              <p className="text-label-md font-bold text-on-surface mb-xs">{title}</p>
              <p className="text-body-sm leading-relaxed text-on-surface-variant">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" ref={addRef(1)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">How It Works</p>
          <h2 className="text-headline-lg font-black text-on-surface">Three-stage forensic pipeline</h2>
        </div>

        <div className="grid grid-cols-3 gap-lg">
          {[
            { step: '01', icon: 'decompose', title: 'Decompose', desc: 'Claude breaks the AI answer into atomic factual claims — each one independently verifiable.', detail: 'Uses Haiku for speed across dozens of facts' },
            { step: '02', icon: 'compare', title: 'Compare', desc: 'Each fact is embedded and searched against your publisher archive and a public reference corpus.', detail: 'Titan Embed V2 for 512-dim vector similarity' },
            { step: '03', icon: 'score', title: 'Score', desc: 'A uniqueness score from 0-100% plus fingerprint detection reveals which facts are exclusively yours.', detail: 'Sonnet evaluates context and exclusivity' },
          ].map(({ step, icon, title, desc, detail }) => (
            <div key={step} className="landing-step-card">
              <span className="font-black text-on-surface" style={{ fontSize: 48, opacity: 0.06 }}>{step}</span>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-md bg-primary-fixed">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>{icon}</span>
              </div>
              <p className="text-label-md font-bold text-on-surface mb-xs">{title}</p>
              <p className="text-body-sm leading-relaxed text-on-surface-variant mb-md">{desc}</p>
              <p className="text-body-sm italic text-on-surface-variant" style={{ opacity: 0.6 }}>{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section ref={addRef(2)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">Scoring</p>
          <h2 className="text-headline-lg font-black text-on-surface">Uniqueness at a glance</h2>
          <p className="text-body-md mt-md mx-auto text-on-surface-variant" style={{ maxWidth: 500 }}>
            Each fact gets a score indicating how likely it originated from your archive versus public knowledge.
          </p>
        </div>

        <div className="landing-score-bar">
          <div className="landing-score-segment landing-score-exclusive">
            <span className="text-label-md font-bold">80-100%</span>
            <span className="text-body-sm">Publisher Exclusive</span>
          </div>
          <div className="landing-score-segment landing-score-partial">
            <span className="text-label-md font-bold">40-79%</span>
            <span className="text-body-sm">Partially Unique</span>
          </div>
          <div className="landing-score-segment landing-score-common">
            <span className="text-label-md font-bold">0-39%</span>
            <span className="text-body-sm">Widely Reported</span>
          </div>
        </div>
      </section>

      <section ref={addRef(3)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="text-center mb-xl">
          <p className="text-label-md font-bold tracking-widest uppercase mb-sm text-primary">Use Cases</p>
          <h2 className="text-headline-lg font-black text-on-surface">Built for content rights teams</h2>
        </div>

        <div className="grid grid-cols-3 gap-md">
          {[
            { icon: 'edit_note', title: 'Publishers', desc: 'Track whether AI models surface your exclusive reporting without attribution or payment.' },
            { icon: 'gavel', title: 'Legal Teams', desc: 'Generate SHA-256 hashed evidence records for licensing disputes and copyright claims.' },
            { icon: 'handshake', title: 'Licensing Teams', desc: 'Quantify the value your content provides to AI companies during deal negotiations.' },
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

      <section ref={addRef(4)} className="land-section relative z-10 px-md py-xl" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="landing-demo-banner">
          <div className="flex items-start gap-lg">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary-fixed">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>database</span>
            </div>
            <div>
              <p className="text-label-md font-bold text-on-surface mb-xs">Demo Dataset Included</p>
              <p className="text-body-sm leading-relaxed text-on-surface-variant">
                Pre-loaded with <strong className="text-on-surface">30 investigative articles</strong> from NY Times across 6 beats plus a matched <strong className="text-on-surface">public reference corpus</strong> from Reuters, AP, BBC, and others.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section ref={addRef(5)} className="land-section relative z-10 px-md py-xl text-center" style={{ paddingBottom: 100 }}>
        <h2 className="text-headline-lg font-black text-on-surface mb-md">Ready to trace your content?</h2>
        <p className="text-body-md mb-xl mx-auto text-on-surface-variant" style={{ maxWidth: 400 }}>
          Enter a question, paste an AI answer, and see exactly which facts came from your archive.
        </p>
        <button
          onClick={handleEnter}
          className="landing-btn-glow group relative inline-flex items-center gap-sm text-label-md font-bold rounded-xl text-white active:scale-[0.97] transition-all duration-200"
          style={{ padding: '16px 40px', fontSize: 16, background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
        >
          Enter the Platform
          <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-1" style={{ fontSize: 18 }}>arrow_forward</span>
        </button>
        <p className="text-body-sm mt-lg text-on-surface-variant" style={{ opacity: 0.5 }}>Built at a hackathon &middot; 3-hour build &middot; 4-minute demo</p>
      </section>
    </div>
  );
}
