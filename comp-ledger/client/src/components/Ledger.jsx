import React from 'react';
import ClaimRow from './ClaimRow.jsx';

export default function Ledger({ claims, status, total }) {
  if (status === 'idle') {
    return (
      <div className="bg-surface border border-outline-variant rounded-xl flex flex-col items-center justify-center gap-md text-center" style={{ minHeight: 320 }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124, 58, 237, 0.06)' }}>
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
    <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
      {/* Title bar */}
      <div className="flex items-center justify-between px-md py-sm bg-surface-container-low border-b border-outline-variant">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>fact_check</span>
          <span className="text-label-md font-bold text-on-surface">Fact Ledger</span>
        </div>
        {status === 'streaming' && (
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 16 }}>fiber_manual_record</span>
            <span className="font-code text-code text-on-surface-variant">{claims.length}/{total}</span>
          </div>
        )}
        {status === 'done' && (
          <span className="font-code text-code text-on-surface-variant">{claims.length} facts</span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-lg px-md py-xs border-b border-outline-variant bg-surface">
        <span className="text-body-sm text-on-surface-variant">Uniqueness scale:</span>
        <div className="flex items-center gap-sm">
          <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
          <span className="text-body-sm text-on-surface-variant">80–100% Publisher exclusive</span>
        </div>
        <div className="flex items-center gap-sm">
          <span className="w-2 h-2 rounded-full bg-tertiary-container inline-block"></span>
          <span className="text-body-sm text-on-surface-variant">40–79% Partially unique</span>
        </div>
        <div className="flex items-center gap-sm">
          <span className="w-2 h-2 rounded-full bg-secondary inline-block"></span>
          <span className="text-body-sm text-on-surface-variant">0–39% Widely reported</span>
        </div>
      </div>

      {/* Single table for aligned columns */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 600 }}>
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low">
              <th className="text-left px-md py-xs text-label-md font-bold text-on-surface-variant" style={{ width: '38%' }}>Fact</th>
              <th className="text-left px-md py-xs text-label-md font-bold text-on-surface-variant" style={{ width: '22%' }} title="100% = only found in this publisher's work. Lower = widely reported elsewhere.">Uniqueness ⓘ</th>
              <th className="text-left px-md py-xs text-label-md font-bold text-on-surface-variant" style={{ width: '14%' }}>Public Matches</th>
              <th className="text-left px-md py-xs text-label-md font-bold text-on-surface-variant" style={{ width: '12%' }}>Copied Marker</th>
              <th className="text-left px-md py-xs text-label-md font-bold text-on-surface-variant" style={{ width: '14%' }}>ID</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim, i) => (
              <ClaimRow key={claim.claim_id} claim={claim} index={i} />
            ))}
            {status === 'streaming' && claims.length < total && (
              <tr>
                <td colSpan={5} className="px-md py-sm">
                  <div className="h-0.5 bg-outline-variant rounded overflow-hidden">
                    <div
                      className="h-full bg-primary rounded transition-all duration-500"
                      style={{ width: `${total > 0 ? (claims.length / total) * 100 : 0}%` }}
                    />
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
