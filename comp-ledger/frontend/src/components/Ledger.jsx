import React, { useState } from 'react';
import ClaimRow from './ClaimRow.jsx';

const GROUPS = [
  { key: 'high',   label: 'High Confidence',   min: 0.7,  max: 1.01, icon: 'verified',       color: 'var(--primary)',  bg: 'rgba(22,163,74,0.06)',   border: 'rgba(22,163,74,0.15)' },
  { key: 'medium', label: 'Limited Sourcing',   min: 0.4,  max: 0.7,  icon: 'help',            color: '#f97316',         bg: 'rgba(249,115,22,0.05)',  border: 'rgba(249,115,22,0.15)' },
  { key: 'low',    label: 'Widely Known',       min: 0,    max: 0.4,  icon: 'public',          color: 'var(--on-surface-variant)', bg: 'transparent', border: 'var(--outline-variant)' },
];

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="p-md"><div className="h-4 rounded-md bg-surface-container-high" style={{ width: '80%' }} /></td>
      <td className="p-md"><div className="h-4 rounded-md bg-surface-container-high" style={{ width: '60%' }} /></td>
      <td className="p-md"><div className="h-4 rounded-md bg-surface-container-high" style={{ width: '40%' }} /></td>
      <td className="p-md"><div className="h-4 rounded-md bg-surface-container-high" style={{ width: '50%' }} /></td>
      <td className="p-md"><div className="h-4 rounded-md bg-surface-container-high" style={{ width: '70%' }} /></td>
    </tr>
  );
}

function ClaimGroup({ group, claims, globalIndex }) {
  const [collapsed, setCollapsed] = useState(false);
  if (claims.length === 0) return null;

  return (
    <div className="glass-table overflow-hidden" style={{ border: `1px solid ${group.border}` }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-md py-sm flex items-center gap-sm hover:bg-surface-container-lowest transition-colors"
        style={{ background: group.bg }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: group.color }}>{group.icon}</span>
        <span className="text-label-md font-bold text-on-surface flex-1 text-left">{group.label}</span>
        <span className="px-sm py-px rounded-full text-label-sm font-bold"
          style={{ fontSize: 11, background: group.bg, color: group.color, border: `1px solid ${group.border}` }}>
          {claims.length}
        </span>
        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>
          {collapsed ? 'expand_more' : 'expand_less'}
        </span>
      </button>

      {!collapsed && (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: 'var(--surface-container-lowest)' }}>
                <th className="p-md text-label-md font-bold text-on-surface-variant border-b border-outline-variant" style={{ width: '38%' }}>Claim</th>
                <th className="p-md text-label-md font-bold text-on-surface-variant border-b border-outline-variant" style={{ width: '22%' }}>Exclusivity</th>
                <th className="p-md text-label-md font-bold text-on-surface-variant border-b border-outline-variant" style={{ width: '14%' }}>Sources</th>
                <th className="p-md text-label-md font-bold text-on-surface-variant border-b border-outline-variant" style={{ width: '12%' }}>Fingerprint</th>
                <th className="p-md text-label-md font-bold text-on-surface-variant border-b border-outline-variant" style={{ width: '14%' }}>Hash ID</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim, i) => (
                <ClaimRow key={claim.claim_id} claim={claim} index={globalIndex + i} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Ledger({ claims, status, total }) {
  if (status === 'idle') {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-md text-center p-xl" style={{ minHeight: 340 }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.12), rgba(74,222,128,0.06))', border: '1px solid rgba(22,163,74,0.2)' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>fact_check</span>
        </div>
        <div>
          <p className="text-body-md font-bold text-on-surface">No facts traced yet</p>
          <p className="text-body-sm text-on-surface-variant mt-xs">Pick Auto mode and ask a question, or paste an AI answer in Manual mode</p>
        </div>
      </div>
    );
  }

  if (status === 'error' && claims.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-md text-center p-xl" style={{ minHeight: 200 }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#ef4444' }}>error_outline</span>
        </div>
        <div>
          <p className="text-body-md font-bold text-on-surface">Trace failed</p>
          <p className="text-body-sm text-on-surface-variant mt-xs">The backend returned an error. Check that the server is running and the publisher has indexed content.</p>
        </div>
      </div>
    );
  }

  if (status === 'done' && claims.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-md text-center p-xl" style={{ minHeight: 200 }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#f59e0b' }}>info</span>
        </div>
        <div>
          <p className="text-body-md font-bold text-on-surface">No claims found</p>
          <p className="text-body-sm text-on-surface-variant mt-xs">The answer could not be decomposed into traceable claims. Try a longer or more specific answer.</p>
        </div>
      </div>
    );
  }

  // Group claims
  const grouped = GROUPS.map(g => ({
    group: g,
    claims: claims.filter(c => c.exclusivity_score >= g.min && c.exclusivity_score < g.max),
  }));

  let runningIndex = 0;

  return (
    <div className="flex flex-col gap-md">
      {/* Streaming skeletons — flat table while loading */}
      {status === 'streaming' && claims.length === 0 && (
        <div className="glass-table overflow-hidden">
          <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'rgba(22,163,74,0.03)' }}>
            <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 16 }}>pending</span>
            <span className="text-label-md font-bold text-on-surface">Tracing claims…</span>
            {total > 0 && <span className="text-body-sm text-on-surface-variant ml-auto">0 / {total}</span>}
          </div>
          <table className="w-full"><tbody>
            {Array.from({ length: Math.min(total || 5, 5) }, (_, i) => <SkeletonRow key={i} />)}
          </tbody></table>
        </div>
      )}

      {grouped.map(({ group, claims: groupClaims }) => {
        const start = runningIndex;
        runningIndex += groupClaims.length;
        return (
          <ClaimGroup key={group.key} group={group} claims={groupClaims} globalIndex={start} />
        );
      })}

      {/* Streaming — incoming claims appended as flat skeletons */}
      {status === 'streaming' && claims.length > 0 && claims.length < (total || 0) && (
        <div className="glass-table overflow-hidden">
          <table className="w-full"><tbody>
            {Array.from({ length: (total || 0) - claims.length }, (_, i) => <SkeletonRow key={i} />)}
          </tbody></table>
        </div>
      )}

      {status === 'done' && claims.length > 0 && (
        <div className="flex items-center justify-center py-sm">
          <span className="text-label-md text-on-surface-variant">{claims.length} claims traced</span>
        </div>
      )}
    </div>
  );
}
