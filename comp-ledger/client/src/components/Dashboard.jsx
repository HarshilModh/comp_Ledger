import React from 'react';

function StatCard({ icon, label, value, accent, sub }) {
  return (
    <div className="bg-surface border border-outline-variant rounded-lg p-md flex flex-col gap-sm">
      <div className="flex items-center gap-sm">
        <div className={`w-8 h-8 rounded flex items-center justify-center ${accent}`}>
          <span className="material-symbols-outlined text-on-primary" style={{ fontSize: 18 }}>{icon}</span>
        </div>
        <span className="text-label-md text-on-surface-variant">{label}</span>
      </div>
      <p className="text-headline-md font-black text-on-surface">{value}</p>
      {sub && <p className="text-body-sm text-on-surface-variant">{sub}</p>}
    </div>
  );
}

function ScoreBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-md">
      <span className="text-label-md text-on-surface-variant w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-outline-variant rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: 'width 500ms ease' }} />
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
      <div className="flex flex-col items-center justify-center py-xl gap-md text-center">
        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 64, opacity: 0.2 }}>monitoring</span>
        <p className="text-body-md font-bold text-on-surface">No analysis runs yet</p>
        <p className="text-body-sm text-on-surface-variant">Switch to Facts and run an analysis to populate the dashboard</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-md">
        <StatCard icon="labs" label="Total Runs" value={totalRuns} accent="bg-primary" />
        <StatCard icon="format_list_numbered" label="Facts Scored" value={totalClaims} accent="bg-primary" sub={`${avgScore}% avg uniqueness`} />
        <StatCard icon="verified" label="Unique" value={exclusive.length} accent="bg-primary" sub={`${totalClaims > 0 ? ((exclusive.length / totalClaims) * 100).toFixed(0) : 0}% of total`} />
        <StatCard icon="fingerprint" label="Copied Markers" value={fingerprinted.length} accent="bg-error" sub={fingerprinted.length > 0 ? 'Evidence of copying' : 'None detected'} />
      </div>

      {/* Score distribution + top claims */}
      <div className="grid grid-cols-12 gap-md">
        {/* Distribution card */}
        <div className="col-span-5 bg-surface border border-outline-variant rounded-lg p-md flex flex-col gap-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>bar_chart</span>
            <span className="text-label-md font-bold text-on-surface">Score Distribution</span>
          </div>
          <div className="flex flex-col gap-sm">
            <ScoreBar label="Unique" count={exclusive.length} total={totalClaims} color="bg-primary" />
            <ScoreBar label="Limited" count={limited.length} total={totalClaims} color="bg-tertiary-container" />
            <ScoreBar label="Common" count={commodity.length} total={totalClaims} color="bg-secondary" />
          </div>
          <div className="border-t border-outline-variant pt-sm mt-sm">
            <div className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">Uniqueness ratio</span>
              <span className="font-bold text-primary">{totalClaims > 0 ? ((exclusive.length / totalClaims) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        </div>

        {/* Top exclusive claims */}
        <div className="col-span-7 bg-surface border border-outline-variant rounded-lg overflow-hidden">
          <div className="px-md py-sm bg-surface-container-low border-b border-outline-variant flex items-center gap-sm">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>trophy</span>
            <span className="text-label-md font-bold text-on-surface">Top Unique Facts</span>
          </div>
          <div className="divide-y divide-outline-variant">
            {topExclusive.length === 0 && (
              <p className="px-md py-sm text-body-sm text-on-surface-variant">No unique facts found yet</p>
            )}
            {topExclusive.map((claim, i) => (
              <div key={i} className="px-md py-sm flex items-center gap-md">
                <span className="font-code text-code text-primary font-bold w-8">{Math.round(claim.exclusivity_score * 100)}%</span>
                <p className="text-body-sm text-on-surface flex-1 line-clamp-1">{claim.claim_text}</p>
                {claim.fingerprint?.detected && (
                  <span className="inline-flex items-center gap-xs px-sm py-xs bg-error text-on-error rounded-full text-label-md font-bold" style={{ fontSize: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 10 }}>fingerprint</span>
                    CM
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent fingerprints */}
      {recentFingerprints.length > 0 && (
        <div className="bg-surface border border-outline-variant rounded-lg overflow-hidden">
          <div className="px-md py-sm bg-surface-container-low border-b border-outline-variant flex items-center gap-sm">
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
