import React from 'react';

export default function ClaimDetail({ claim }) {
  return (
    <div className="grid grid-cols-2 gap-md">

      {claim.match?.found && (
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md">
          <div className="flex items-center gap-sm mb-sm">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>menu_book</span>
            <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-widest">Original Source</p>
          </div>
          <p className="text-body-sm text-on-surface italic leading-relaxed">
            "{claim.match.publisher_passage}"
          </p>
          <p className="font-code text-code text-primary mt-sm" style={{ fontSize: 11 }}>{claim.match.doc_id}</p>
        </div>
      )}

      {claim.fingerprint?.detected && (
        <div className="bg-error-container border rounded-xl p-md" style={{ borderColor: 'rgba(186,26,26,0.2)' }}>
          <div className="flex items-center gap-sm mb-sm">
            <span className="material-symbols-outlined text-error" style={{ fontSize: 16 }}>fingerprint</span>
            <p className="text-label-md font-bold text-error uppercase tracking-widest">Copied Marker</p>
            <span className="inline-flex items-center gap-xs px-sm py-xs bg-error text-on-error rounded-full text-label-md font-bold">
              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>fingerprint</span>
              {claim.fingerprint.type?.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex flex-col gap-sm">
            <div>
              <p className="text-label-md text-on-surface-variant mb-xs">Original wording</p>
              <p className="text-body-sm text-error font-medium leading-relaxed">"{claim.fingerprint.publisher_version}"</p>
            </div>
            <div>
              <p className="text-label-md text-on-surface-variant mb-xs">AI's version</p>
              <p className="text-body-sm text-on-surface leading-relaxed">"{claim.fingerprint.ai_version}"</p>
            </div>
          </div>
          {claim.fingerprint.explanation && (
            <p className="text-body-sm text-on-surface-variant mt-sm leading-relaxed">{claim.fingerprint.explanation}</p>
          )}
        </div>
      )}

      {claim.exclusivity?.reasoning && (
        <div
          className="bg-surface-container-low border border-outline-variant rounded-xl p-md"
          style={{ gridColumn: (claim.match?.found && claim.fingerprint?.detected) ? '1 / -1' : 'auto' }}
        >
          <div className="flex items-center gap-sm mb-sm">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>lightbulb</span>
            <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-widest">Why it's unique</p>
          </div>
          <p className="text-body-sm text-on-surface leading-relaxed">{claim.exclusivity.reasoning}</p>
          {claim.exclusivity.sources?.length > 0 && (
            <div className="flex flex-wrap gap-xs mt-sm">
              {claim.exclusivity.sources.map((s, i) => (
                <span key={i} className="font-code text-code text-on-surface-variant bg-surface border border-outline-variant rounded px-sm py-xs">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
