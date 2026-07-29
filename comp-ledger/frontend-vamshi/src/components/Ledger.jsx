import React from 'react';
import ClaimRow from './ClaimRow.jsx';

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

export default function Ledger({ claims, status, total }) {
  if (status === 'idle') {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-md text-center p-xl" style={{ minHeight: 380 }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.12), rgba(74, 222, 128, 0.06))', border: '1px solid rgba(22, 163, 74, 0.2)' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>fact_check</span>
        </div>
        <div>
          <p className="text-body-md font-bold text-on-surface">No facts scored yet</p>
          <p className="text-body-sm text-on-surface-variant mt-xs">Paste an AI answer and click Run Analysis to see the ledger populate</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-table">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ background: 'rgba(22, 163, 74, 0.03)' }}>
              <th className="p-md text-label-md font-bold text-on-surface-variant border-b border-outline-variant" style={{ width: '38%' }}>Claim Content</th>
              <th className="p-md text-label-md font-bold text-on-surface-variant border-b border-outline-variant" style={{ width: '22%' }}>Exclusivity</th>
              <th className="p-md text-label-md font-bold text-on-surface-variant border-b border-outline-variant" style={{ width: '14%' }}>Sources</th>
              <th className="p-md text-label-md font-bold text-on-surface-variant border-b border-outline-variant" style={{ width: '12%' }}>Fingerprint</th>
              <th className="p-md text-label-md font-bold text-on-surface-variant border-b border-outline-variant" style={{ width: '14%' }}>Hash ID</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim, i) => (
              <ClaimRow key={claim.claim_id} claim={claim} index={i} />
            ))}
            {status === 'streaming' && (
              <>
                {Array.from({ length: Math.max(1, (total || 5) - claims.length) }, (_, i) => (
                  <SkeletonRow key={`skel-${i}`} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
      {status === 'done' && claims.length > 0 && (
        <div className="px-md py-sm flex justify-center border-t border-outline-variant" style={{ background: 'rgba(22, 163, 74, 0.02)' }}>
          <span className="text-label-md text-on-surface-variant">{claims.length} facts scored</span>
        </div>
      )}
    </div>
  );
}
