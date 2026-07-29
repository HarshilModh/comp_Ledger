import React, { useState } from 'react';
import ClaimDetail from './ClaimDetail.jsx';

const SOURCE_ICONS = ['book', 'public', 'article', 'science', 'school'];

function ExclusivityMeter({ score }) {
  const pct = Math.round((score ?? 0) * 100);
  let fillClass = 'score-bar-fill-low';
  let label = 'Common';
  let labelColor = 'text-on-surface-variant';
  if (pct >= 70) { fillClass = 'score-bar-fill-high'; label = 'Unique'; labelColor = 'text-primary'; }
  else if (pct >= 40) { fillClass = 'score-bar-fill-mid'; label = 'Limited'; labelColor = 'text-tertiary'; }

  return (
    <div>
      <div className="score-bar-track" style={{ width: '100%' }}>
        <div className={fillClass} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-label-md font-medium mt-1 inline-block ${labelColor}`}>
        {pct}% {label}
      </span>
    </div>
  );
}

function SourceIcons({ count }) {
  const n = Math.min(count ?? 0, 5);
  if (n === 0) {
    return <span className="font-code text-code text-on-surface-variant opacity-40">—</span>;
  }
  return (
    <div className="flex -space-x-2">
      {Array.from({ length: Math.min(n, 3) }).map((_, i) => (
        <div
          key={i}
          className="w-7 h-7 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)', backdropFilter: 'blur(4px)' }}
        >
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 12 }}>{SOURCE_ICONS[i % SOURCE_ICONS.length]}</span>
        </div>
      ))}
      {n > 3 && (
        <div
          className="w-7 h-7 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: 'var(--glass-border)', background: 'var(--surface-container)' }}
        >
          <span className="text-[9px] font-bold text-on-surface-variant">+{n - 3}</span>
        </div>
      )}
    </div>
  );
}

export default function ClaimRow({ claim, index }) {
  const [open, setOpen] = useState(false);
  const srcCount = claim.exclusivity?.independent_source_count ?? 0;
  const hashShort = claim.claim_id ? `0x${String(claim.claim_id).slice(0, 4)}…${String(claim.claim_id).slice(-4)}` : '—';

  return (
    <>
      <tr
        className="border-b border-outline-variant hover:bg-surface-container-high transition-all duration-200 cursor-pointer group row-animate"
        style={{ animationDelay: `${index * 60}ms` }}
        onClick={() => setOpen(!open)}
      >
        <td className="p-md">
          <p className="text-body-sm text-on-surface line-clamp-2 group-hover:text-primary transition-colors">{claim.claim_text}</p>
        </td>

        <td className="p-md">
          <ExclusivityMeter score={claim.exclusivity_score} />
        </td>

        <td className="p-md">
          <SourceIcons count={srcCount} />
        </td>

        <td className="p-md">
          {claim.fingerprint?.detected ? (
            <span className="fp-badge fp-badge-error">
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>fingerprint</span>
              DETECTED
            </span>
          ) : (
            <span className="fp-badge">CLEAN</span>
          )}
        </td>

        <td className="p-md">
          <code className="font-code text-on-surface-variant opacity-60" style={{ fontSize: 11 }}>{hashShort}</code>
        </td>
      </tr>

      {open && (
        <tr style={{ background: 'var(--surface-container-low)' }}>
          <td colSpan={5} className="px-md py-md border-b border-outline-variant">
            <ClaimDetail claim={claim} />
          </td>
        </tr>
      )}
    </>
  );
}
