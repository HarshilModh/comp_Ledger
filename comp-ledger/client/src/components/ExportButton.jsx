import React, { useState } from 'react';

export default function ExportButton({ claims, question, answer, onResult }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claims, question, answer }),
      });
      const data = await res.json();
      onResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-sm">
      <button
        onClick={handleExport}
        disabled={loading || claims.length === 0}
        className="w-full py-sm bg-surface border border-primary text-primary text-label-md font-bold rounded-lg hover:bg-surface-container-low active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-sm"
      >
        {loading ? (
          <>
            <span className="material-symbols-outlined live-pulse" style={{ fontSize: 18 }}>pending</span>
            Exporting…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload</span>
            Save & Export Record
          </>
        )}
      </button>
      {error && (
        <p className="text-body-sm text-error">{error}</p>
      )}
    </div>
  );
}
