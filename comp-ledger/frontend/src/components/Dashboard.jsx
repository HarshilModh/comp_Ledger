import React from 'react';

function StatCard({ label, value, sub, glow }) {
  return (
    <div className="stat-card">
      <p className="text-label-md text-on-surface-variant">{label}</p>
      <h3 className={`text-headline-md font-black mt-xs ${glow ? 'gradient-text' : 'text-on-surface'}`}>{value}</h3>
      {sub && <p className="text-body-sm text-on-surface-variant mt-xs">{sub}</p>}
    </div>
  );
}

function ScoreBar({ label, count, total, type }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const fillClass = type === 'high' ? 'score-bar-fill-high' : type === 'mid' ? 'score-bar-fill-mid' : 'score-bar-fill-low';
  return (
    <div className="flex items-center gap-md">
      <span className="text-label-md text-on-surface-variant w-16 shrink-0">{label}</span>
      <div className="flex-1 score-bar-track">
        <div className={fillClass} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-code text-code text-on-surface-variant w-8 text-right">{count}</span>
    </div>
  );
}

export default function Dashboard({ history }) {
  const allClaims = history.flatMap(run => run.claims);
  const totalRuns = history.length;
  const totalClaims = allClaims.length;
  const exclusive = allClaims.filter(c => c.exclusivity_score >= 0.7);
  const limited = allClaims.filter(c => c.exclusivity_score >= 0.4 && c.exclusivity_score < 0.7);
  const commodity = allClaims.filter(c => c.exclusivity_score < 0.4);
  const fingerprinted = allClaims.filter(c => c.fingerprint?.detected);

  const avgScore = totalClaims > 0
    ? (allClaims.reduce((s, c) => s + c.exclusivity_score, 0) / totalClaims * 100).toFixed(1)
    : '0.0';

  const topExclusive = exclusive
    .sort((a, b) => b.exclusivity_score - a.exclusivity_score)
    .slice(0, 5);

  const recentFingerprints = fingerprinted.slice(-3).reverse();

  if (totalRuns === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-xl gap-lg text-center" style={{ minHeight: 400 }}>
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.10), rgba(74, 222, 128, 0.05))', border: '1px solid rgba(22, 163, 74, 0.15)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 48, opacity: 0.5 }}>monitoring</span>
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>hourglass_empty</span>
          </div>
        </div>
        <div className="max-w-sm">
          <p className="text-body-md font-bold text-on-surface">No analysis runs yet</p>
          <p className="text-body-sm text-on-surface-variant mt-xs">Run your first trace in the Facts tab to see score distributions, unique claims, and integrity markers here.</p>
        </div>
        <div className="flex gap-md mt-sm opacity-40">
          <div className="stat-card" style={{ width: 120, padding: 12 }}>
            <div className="h-3 w-12 rounded bg-surface-container-high mb-xs" />
            <div className="h-5 w-8 rounded bg-surface-container-highest" />
          </div>
          <div className="stat-card" style={{ width: 120, padding: 12 }}>
            <div className="h-3 w-10 rounded bg-surface-container-high mb-xs" />
            <div className="h-5 w-6 rounded bg-surface-container-highest" />
          </div>
          <div className="stat-card" style={{ width: 120, padding: 12 }}>
            <div className="h-3 w-14 rounded bg-surface-container-high mb-xs" />
            <div className="h-5 w-10 rounded bg-surface-container-highest" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
        <StatCard label="Total Runs" value={totalRuns} glow />
        <StatCard label="Facts Scored" value={totalClaims} sub={`${avgScore}% avg uniqueness`} glow />
        <StatCard label="Unique Facts" value={exclusive.length} sub={`${totalClaims > 0 ? ((exclusive.length / totalClaims) * 100).toFixed(0) : 0}% of total`} />
        <StatCard label="Copied Markers" value={fingerprinted.length} sub={fingerprinted.length > 0 ? 'Evidence of copying' : 'None detected'} />
      </div>

      <div className="grid grid-cols-12 gap-lg">
        <div className="col-span-12 lg:col-span-5 glass-card p-md flex flex-col gap-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>bar_chart</span>
            <span className="text-label-md font-bold text-on-surface">Score Distribution</span>
          </div>
          <div className="flex flex-col gap-sm">
            <ScoreBar label="Unique" count={exclusive.length} total={totalClaims} type="high" />
            <ScoreBar label="Limited" count={limited.length} total={totalClaims} type="mid" />
            <ScoreBar label="Common" count={commodity.length} total={totalClaims} type="low" />
          </div>
          <div className="border-t border-outline-variant pt-sm mt-sm">
            <div className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">Uniqueness ratio</span>
              <span className="font-bold text-primary">{totalClaims > 0 ? ((exclusive.length / totalClaims) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 glass-card overflow-hidden p-0">
          <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>trophy</span>
            <span className="text-label-md font-bold text-on-surface">Top Unique Facts</span>
          </div>
          <div className="divide-y divide-outline-variant">
            {topExclusive.length === 0 && (
              <p className="px-md py-sm text-body-sm text-on-surface-variant">No unique facts found yet</p>
            )}
            {topExclusive.map((claim, i) => (
              <div key={i} className="px-md py-sm flex items-center gap-md hover:bg-surface-container-high transition-colors">
                <span className="font-code text-primary font-bold w-10" style={{ fontSize: 13 }}>{Math.round(claim.exclusivity_score * 100)}%</span>
                <p className="text-body-sm text-on-surface flex-1 line-clamp-1">{claim.claim_text}</p>
                {claim.fingerprint?.detected && (
                  <span className="fp-badge fp-badge-error">
                    <span className="material-symbols-outlined" style={{ fontSize: 10 }}>fingerprint</span>
                    CM
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {recentFingerprints.length > 0 && (
        <div className="glass-card overflow-hidden p-0">
          <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'rgba(220, 38, 38, 0.03)' }}>
            <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>fingerprint</span>
            <span className="text-label-md font-bold text-on-surface">Recent Copied Markers</span>
          </div>
          <div className="divide-y divide-outline-variant">
            {recentFingerprints.map((claim, i) => (
              <div key={i} className="px-md py-sm flex flex-col gap-xs">
                <p className="text-body-sm font-bold text-on-surface">{claim.claim_text}</p>
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <p className="text-label-md text-on-surface-variant">Original wording</p>
                    <p className="text-body-sm text-primary italic">"{claim.fingerprint.publisher_version}"</p>
                  </div>
                  <div>
                    <p className="text-label-md text-on-surface-variant">AI's version</p>
                    <p className="text-body-sm text-on-surface italic">"{claim.fingerprint.ai_version}"</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
