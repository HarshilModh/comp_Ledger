import React, { useState } from 'react';
import ClaimDetail from './ClaimDetail.jsx';

const SOURCE_COLORS = [
  'bg-primary', 'bg-secondary', 'bg-tertiary',
  'bg-error', 'bg-surface-container-highest',
];

function ExclusivityMeter({ score }) {
  const pct = Math.round((score ?? 0) * 100);
  let barColor = 'bg-secondary';
  if (pct >= 70) barColor = 'bg-primary';
  else if (pct >= 40) barColor = 'bg-tertiary-container';

  return (
    <div className="flex items-center gap-sm">
      <div className="flex-1 h-1.5 bg-outline-variant rounded-full overflow-hidden" style={{ maxWidth: 100 }}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-code text-code text-on-surface-variant shrink-0">
        {pct}%
      </span>
    </div>
  );
}

function SourceIcons({ count }) {
  const n = Math.min(count ?? 0, 5);
  if (n === 0) {
    return <span className="font-code text-code text-on-surface-variant">—</span>;
  }
  return (
    <div className="flex items-center">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className={`w-5 h-5 rounded-full border-2 border-surface flex items-center justify-center text-on-primary font-bold ${SOURCE_COLORS[i % SOURCE_COLORS.length]}`}
          style={{ fontSize: 8, marginLeft: i > 0 ? -4 : 0 }}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
}

export default function ClaimRow({ claim, index }) {
  const [open, setOpen] = useState(false);
  const srcCount = claim.exclusivity?.independent_source_count ?? 0;
  const hashShort = String(claim.claim_id ?? '—');

  return (
    <>
      <tr
        className="border-t border-outline-variant hover:bg-surface-container-low transition-colors cursor-pointer row-animate"
        style={{ animationDelay: `${index * 60}ms` }}
        onClick={() => setOpen(!open)}
      >
        <td className="px-md py-sm" style={{ width: '38%' }}>
          <p className="text-body-sm text-on-surface line-clamp-2">{claim.claim_text}</p>
        </td>

        <td className="px-md py-sm" style={{ width: '22%' }}>
          <ExclusivityMeter score={claim.exclusivity_score} />
        </td>

        <td className="px-md py-sm" style={{ width: '14%' }}>
          <SourceIcons count={srcCount} />
        </td>

        <td className="px-md py-sm" style={{ width: '12%' }}>
          {claim.fingerprint?.detected ? (
            <span className="inline-flex items-center gap-xs px-sm py-xs bg-error text-on-error rounded-full text-label-md font-bold" style={{ fontSize: 11 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>fingerprint</span>
              CM
            </span>
          ) : (
            <span className="text-body-sm text-on-surface-variant opacity-30">—</span>
          )}
        </td>

        <td className="px-md py-sm" style={{ width: '14%' }}>
          <div className="flex items-center gap-xs">
            <span className="font-code text-code text-on-surface-variant">#{hashShort}</span>
            <span
              className="material-symbols-outlined text-on-surface-variant"
              style={{ fontSize: 14, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
            >chevron_right</span>
          </div>
        </td>
      </tr>

      {open && (
        <tr className="border-t border-outline-variant bg-surface-container-low">
          <td colSpan={5} className="px-md py-md">
            <ClaimDetail claim={claim} />
          </td>
        </tr>
      )}
    </>
  );
}
