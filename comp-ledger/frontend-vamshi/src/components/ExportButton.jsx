import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

function generateMarkdown(claims, question, answer) {
  let md = `# CoMP Ledger Report\n\n`;
  md += `## Query\n${question}\n\n`;
  md += `## Answer\n${answer}\n\n`;
  md += `## Claims (${claims.length})\n\n`;
  md += `| # | Claim | Exclusivity | Fingerprint |\n|---|-------|-------------|-------------|\n`;
  claims.forEach((c, i) => {
    const score = Math.round((c.exclusivity_score || 0) * 100);
    const fp = c.fingerprint?.detected ? 'Detected' : 'Clean';
    md += `| ${i + 1} | ${c.claim_text?.replace(/\|/g, '\\|') || ''} | ${score}% | ${fp} |\n`;
  });
  return md;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportButton({ claims, question, answer, onResult }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { authHeaders } = useAuth();

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: authHeaders(),
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

  const handleMarkdown = () => {
    const md = generateMarkdown(claims, question, answer);
    downloadFile(md, 'comp-ledger-report.md', 'text/markdown');
  };

  const handlePDF = () => {
    var style = 'body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#14231a;line-height:1.6}h1{color:#16a34a;border-bottom:2px solid #16a34a;padding-bottom:8px}h2{color:#3d5a47;margin-top:2em}table{width:100%;border-collapse:collapse;margin:1em 0;font-size:14px}th,td{border:1px solid #dceee3;padding:8px 12px;text-align:left}th{background:#f0faf3;font-weight:600}tr:nth-child(even){background:#f7faf8}';
    var rows = claims.map(function(c, i) {
      var score = Math.round((c.exclusivity_score || 0) * 100);
      var fp = c.fingerprint && c.fingerprint.detected ? 'Detected' : 'Clean';
      var text = (c.claim_text || '').replace(/</g, '&lt;');
      return '<tr><td>' + (i + 1) + '</td><td>' + text + '</td><td>' + score + '%</td><td>' + fp + '</td></tr>';
    }).join('');
    var body = '<h1>CoMP Ledger Report</h1>' +
      '<h2>Query</h2><p>' + question.replace(/</g, '&lt;') + '</p>' +
      '<h2>Answer</h2><p>' + answer.replace(/</g, '&lt;') + '</p>' +
      '<h2>Claims (' + claims.length + ')</h2>' +
      '<table><thead><tr><th>#</th><th>Claim</th><th>Exclusivity</th><th>Fingerprint</th></tr></thead><tbody>' +
      rows + '</tbody></table>';
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CoMP Ledger Report</title><style>' + style + '</style></head><body>' + body + '</body></html>';
    var win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(function() { win.print(); }, 300);
  };

  return (
    <div className="flex flex-col gap-sm">
      <button
        onClick={handleExport}
        disabled={loading || claims.length === 0}
        className="btn-ghost w-full text-label-md text-primary border-primary flex items-center justify-center gap-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
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
      <div className="flex gap-sm">
        <button
          onClick={handleMarkdown}
          disabled={claims.length === 0}
          className="btn-ghost flex-1 text-label-md flex items-center justify-center gap-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ padding: '8px 12px' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>description</span>
          Markdown
        </button>
        <button
          onClick={handlePDF}
          disabled={claims.length === 0}
          className="btn-ghost flex-1 text-label-md flex items-center justify-center gap-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ padding: '8px 12px' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>picture_as_pdf</span>
          PDF
        </button>
      </div>
      {error && (
        <p className="text-body-sm text-error">{error}</p>
      )}
    </div>
  );
}
