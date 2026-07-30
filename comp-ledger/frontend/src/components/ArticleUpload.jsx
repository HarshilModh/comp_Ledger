import React, { useState, useEffect } from 'react';
import SiteCrawl from './SiteCrawl.jsx';

const MODES = [
  { id: 'crawl', icon: 'travel_explore', label: 'Auto Crawl', beta: true },
  { id: 'single', icon: 'edit_note', label: 'Paste' },
  { id: 'url', icon: 'link', label: 'URL' },
  { id: 'bulk-url', icon: 'playlist_add', label: 'Bulk URLs' },
  { id: 'bulk', icon: 'upload_file', label: 'Bulk JSON' },
  { id: 'rss', icon: 'rss_feed', label: 'RSS' },
  { id: 'pull', icon: 'download', label: 'Pull API' },
  { id: 'push', icon: 'cloud_upload', label: 'Push API' },
];

export default function ArticleUpload({ publisherId, publisherDomain, onUploadComplete }) {
  const [mode, setMode] = useState('single');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  return (
    <div className="flex flex-col gap-md">
      <div className="flex gap-xs p-xs rounded-xl self-start flex-wrap" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}>
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setResult(null); }}
            className={`flex items-center gap-xs px-md py-xs rounded-lg text-label-sm font-medium transition-all ${
              mode === m.id
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
            style={mode === m.id ? { boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)' } : {}}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{m.icon}</span>
            {m.label}
            {m.beta && (
              <span className="px-xs py-px rounded font-bold"
                style={{ fontSize: 8, background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', lineHeight: '14px' }}>
                BETA
              </span>
            )}
          </button>
        ))}
      </div>

      {mode === 'crawl' && <SiteCrawl publisherId={publisherId} publisherDomain={publisherDomain} onComplete={onUploadComplete} />}
      {mode === 'single' && <SinglePanel publisherId={publisherId} onDone={onUploadComplete} setResult={setResult} loading={loading} setLoading={setLoading} />}
      {mode === 'url' && <UrlPanel publisherId={publisherId} onDone={onUploadComplete} setResult={setResult} loading={loading} setLoading={setLoading} />}
      {mode === 'bulk-url' && <BulkUrlPanel publisherId={publisherId} onDone={onUploadComplete} setResult={setResult} loading={loading} setLoading={setLoading} />}
      {mode === 'bulk' && <BulkPanel publisherId={publisherId} onDone={onUploadComplete} setResult={setResult} loading={loading} setLoading={setLoading} />}
      {mode === 'rss' && <RssPanel />}
      {mode === 'pull' && <PullPanel publisherId={publisherId} onDone={onUploadComplete} setResult={setResult} loading={loading} setLoading={setLoading} />}
      {mode === 'push' && <PushInfo publisherId={publisherId} />}

      {result && (
        <div className={`flex items-center gap-sm px-md py-sm rounded-xl row-animate ${result.success ? '' : ''}`} style={{ background: result.success ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)', border: `1px solid ${result.success ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)'}` }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: result.success ? 'var(--primary)' : 'var(--error)' }}>
            {result.success ? 'check_circle' : 'error'}
          </span>
          <span className={`text-body-sm font-medium ${result.success ? 'text-primary' : 'text-error'}`}>{result.message}</span>
        </div>
      )}
    </div>
  );
}

function SinglePanel({ publisherId, onDone, setResult, loading, setLoading }) {
  const [form, setForm] = useState({ title: '', body_text: '', url: '', byline: '', published_at: '' });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const res = await fetch(`/api/publishers/${publisherId}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        body_text: form.body_text,
        url: form.url || undefined,
        byline: form.byline || undefined,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setResult({ success: true, message: `"${data.title}" indexed (${data.chunks_count} chunks)` });
      setForm({ title: '', body_text: '', url: '', byline: '', published_at: '' });
      onDone?.();
    } else {
      setResult({ success: false, message: data.error?.fieldErrors ? JSON.stringify(data.error.fieldErrors) : 'Upload failed' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-lg flex flex-col gap-md">
      <div className="flex items-center gap-sm mb-xs">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>edit_note</span>
        <span className="text-label-md font-bold text-on-surface">Paste Article Content</span>
      </div>

      <div className="flex flex-col gap-xs">
        <label className="text-label-sm text-on-surface-variant font-medium">Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          required
          className="input-field"
          placeholder="Article headline"
        />
      </div>

      <div className="flex flex-col gap-xs">
        <label className="text-label-sm text-on-surface-variant font-medium">Article Body *</label>
        <textarea
          value={form.body_text}
          onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))}
          required
          rows={8}
          className="input-field font-code"
          style={{ fontSize: 12 }}
          placeholder="Paste the full article text here (min 50 characters)..."
        />
      </div>

      <div className="grid grid-cols-3 gap-md">
        <div className="flex flex-col gap-xs">
          <label className="text-label-sm text-on-surface-variant font-medium">URL</label>
          <input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="input-field" placeholder="https://..." />
        </div>
        <div className="flex flex-col gap-xs">
          <label className="text-label-sm text-on-surface-variant font-medium">Author</label>
          <input type="text" value={form.byline} onChange={e => setForm(f => ({ ...f, byline: e.target.value }))} className="input-field" placeholder="Author name" />
        </div>
        <div className="flex flex-col gap-xs">
          <label className="text-label-sm text-on-surface-variant font-medium">Published</label>
          <input type="date" value={form.published_at} onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))} className="input-field" />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary text-label-md flex items-center gap-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{loading ? 'pending' : 'upload'}</span>
          {loading ? 'Indexing...' : 'Upload & Index'}
        </button>
      </div>
    </form>
  );
}

function UrlPanel({ publisherId, onDone, setResult, loading, setLoading }) {
  const [urlInput, setUrlInput] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setLoading(true);
    setResult(null);

    const res = await fetch(`/api/publishers/${publisherId}/articles/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput.trim() }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setResult({ success: true, message: `"${data.title}" extracted & indexed (${data.chunks_count} chunks)` });
      setUrlInput('');
      onDone?.();
    } else {
      setResult({ success: false, message: data.error || 'Failed to extract article' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-lg flex flex-col gap-md">
      <div className="flex items-center gap-sm mb-xs">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>link</span>
        <span className="text-label-md font-bold text-on-surface">Extract from URL</span>
      </div>
      <p className="text-body-sm text-on-surface-variant" style={{ marginTop: -8 }}>
        We'll fetch the page, extract the article using Readability, and index it automatically.
      </p>

      <div className="flex flex-col gap-xs">
        <label className="text-label-sm text-on-surface-variant font-medium">Article URL</label>
        <input
          type="url"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          required
          className="input-field"
          placeholder="https://www.nytimes.com/2024/01/15/article..."
        />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={loading || !urlInput.trim()} className="btn-primary text-label-md flex items-center gap-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{loading ? 'pending' : 'auto_fix_high'}</span>
          {loading ? 'Fetching & Indexing...' : 'Extract & Index'}
        </button>
      </div>
    </form>
  );
}

function BulkPanel({ publisherId, onDone, setResult, loading, setLoading }) {
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [dragging, setDragging] = useState(false);

  async function processFile(file) {
    setBulkFile(file);
    setResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const articles = Array.isArray(data) ? data : data.articles;
      setBulkPreview(articles?.slice(0, 5) || []);
    } catch {
      setBulkPreview(null);
      setResult({ success: false, message: 'Invalid JSON file' });
    }
  }

  function handleBulkFile(e) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
      processFile(file);
    } else {
      setResult({ success: false, message: 'Please drop a .json file' });
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragging(false);
  }

  async function handleBulkSubmit() {
    if (!bulkFile) return;
    setLoading(true);
    setResult(null);

    const text = await bulkFile.text();
    const data = JSON.parse(text);
    const articles = Array.isArray(data) ? data : data.articles;

    const res = await fetch(`/api/publishers/${publisherId}/articles/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles }),
    });

    const responseData = await res.json();
    setLoading(false);

    if (res.ok) {
      setResult({ success: true, message: `Imported ${responseData.imported} articles (${responseData.failed} failed)` });
      setBulkFile(null);
      setBulkPreview(null);
      onDone?.();
    } else {
      setResult({ success: false, message: responseData.error ? JSON.stringify(responseData.error) : 'Bulk upload failed' });
    }
  }

  return (
    <div className="glass-card p-lg flex flex-col gap-md">
      <div className="flex items-center gap-sm mb-xs">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>upload_file</span>
        <span className="text-label-md font-bold text-on-surface">Bulk Import (JSON)</span>
      </div>
      <p className="text-body-sm text-on-surface-variant" style={{ marginTop: -8 }}>
        Upload a JSON file with an array of articles: <code className="font-code" style={{ fontSize: 11, background: 'var(--surface-container)', padding: '2px 6px', borderRadius: 4 }}>{`[{title, body_text, url?, byline?, published_at?}]`}</code>
      </p>

      <div className="flex flex-col gap-xs">
        <label
          className={`flex flex-col items-center justify-center gap-sm px-lg py-lg rounded-xl cursor-pointer transition-all ${dragging ? 'border-primary scale-[1.01]' : 'hover:border-primary'}`}
          style={{
            border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--outline-variant)'}`,
            background: dragging ? 'rgba(22, 163, 74, 0.04)' : 'var(--surface-container-low)',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <span className={`material-symbols-outlined ${dragging ? 'text-primary' : 'text-on-surface-variant'}`} style={{ fontSize: 32 }}>
            {dragging ? 'file_download' : 'cloud_upload'}
          </span>
          <span className={`text-body-sm font-medium ${dragging ? 'text-primary' : 'text-on-surface-variant'}`}>
            {bulkFile ? bulkFile.name : dragging ? 'Drop your JSON file here' : 'Drag & drop or click to choose a JSON file'}
          </span>
          {!bulkFile && (
            <span className="text-body-sm text-on-surface-variant opacity-50" style={{ fontSize: 11 }}>Supports .json files up to 100 articles</span>
          )}
          <input type="file" accept=".json" onChange={handleBulkFile} className="hidden" />
        </label>
      </div>

      {bulkPreview && (
        <div className="flex flex-col gap-xs rounded-lg p-md row-animate" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)' }}>
          <p className="text-label-sm text-on-surface-variant font-semibold">Preview ({bulkPreview.length} articles):</p>
          {bulkPreview.map((a, i) => (
            <div key={i} className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 12 }}>article</span>
              <span className="text-body-sm text-on-surface truncate">{a.title}</span>
              <span className="text-body-sm text-on-surface-variant ml-auto shrink-0" style={{ fontSize: 11 }}>{a.body_text?.length || 0} chars</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        {bulkFile && (
          <button onClick={() => { setBulkFile(null); setBulkPreview(null); }} className="btn-ghost text-label-sm text-on-surface-variant flex items-center gap-xs">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            Clear
          </button>
        )}
        <div className="ml-auto">
          <button onClick={handleBulkSubmit} disabled={loading || !bulkFile} className="btn-primary text-label-md flex items-center gap-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{loading ? 'pending' : 'playlist_add_check'}</span>
            {loading ? 'Importing...' : 'Import All'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkUrlPanel({ publisherId, onDone, setResult, loading, setLoading }) {
  const [urlText, setUrlText] = useState('');
  const [progress, setProgress] = useState(null);

  const urls = urlText.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));

  async function handleSubmit() {
    if (urls.length === 0) return;
    setLoading(true);
    setResult(null);
    setProgress({ current: 0, total: urls.length });

    const res = await fetch(`/api/publishers/${publisherId}/articles/bulk-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });

    const data = await res.json();
    setLoading(false);
    setProgress(null);

    if (res.ok) {
      setResult({
        success: data.imported > 0,
        message: `Extracted ${data.imported} articles${data.failed > 0 ? ` (${data.failed} failed)` : ''}`,
      });
      if (data.imported > 0) {
        setUrlText('');
        onDone?.();
      }
    } else {
      setResult({ success: false, message: data.error || 'Bulk URL extraction failed' });
    }
  }

  return (
    <div className="glass-card p-lg flex flex-col gap-md">
      <div className="flex items-center gap-sm mb-xs">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>playlist_add</span>
        <span className="text-label-md font-bold text-on-surface">Bulk URL Extraction</span>
      </div>
      <p className="text-body-sm text-on-surface-variant" style={{ marginTop: -8 }}>
        Paste multiple article URLs (one per line). We'll fetch each page, extract the content, and index them all.
      </p>

      <div className="flex flex-col gap-xs">
        <label className="text-label-sm text-on-surface-variant font-medium">Article URLs (one per line, max 20)</label>
        <textarea
          value={urlText}
          onChange={e => setUrlText(e.target.value)}
          rows={6}
          className="input-field font-code"
          style={{ fontSize: 12 }}
          placeholder={"https://www.example.com/article-one\nhttps://www.example.com/article-two\nhttps://www.example.com/article-three"}
        />
        <div className="flex items-center justify-between">
          <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>
            {urls.length > 0 ? (
              <span className={urls.length > 20 ? 'text-error' : 'text-primary'}>
                {urls.length} URL{urls.length !== 1 ? 's' : ''} detected
                {urls.length > 20 && ' (max 20)'}
              </span>
            ) : (
              'Paste URLs to get started'
            )}
          </span>
        </div>
      </div>

      {progress && (
        <div className="flex items-center gap-sm px-md py-sm rounded-xl" style={{ background: 'rgba(22, 163, 74, 0.06)', border: '1px solid rgba(22, 163, 74, 0.15)' }}>
          <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 16 }}>pending</span>
          <span className="text-body-sm text-on-surface-variant">Processing {progress.total} URLs...</span>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={loading || urls.length === 0 || urls.length > 20} className="btn-primary text-label-md flex items-center gap-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{loading ? 'pending' : 'auto_fix_high'}</span>
          {loading ? 'Extracting...' : `Extract & Index ${urls.length > 0 ? `(${urls.length})` : ''}`}
        </button>
      </div>
    </div>
  );
}

function RssPanel() {
  return (
    <div className="glass-card p-lg flex flex-col gap-md">
      <div className="flex items-center gap-sm mb-xs">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>rss_feed</span>
        <span className="text-label-md font-bold text-on-surface">RSS Feed Auto-Ingestion</span>
      </div>
      <p className="text-body-sm text-on-surface-variant">
        Configure an RSS feed URL in publisher settings. Articles are automatically polled every 30 minutes
        and indexed into the corpus.
      </p>
      <div className="flex items-center gap-sm px-md py-sm rounded-xl" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)' }}>
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>info</span>
        <span className="text-body-sm text-on-surface-variant">
          Set the RSS URL in the <strong>Settings</strong> tab, then use "Poll RSS" in the Articles tab to fetch immediately.
        </span>
      </div>
    </div>
  );
}

function PushInfo({ publisherId }) {
  const [apiKey, setApiKey] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [activeTab, setActiveTab] = useState('single');

  useEffect(() => {
    if (!publisherId) return;
    fetch(`/api/publishers/${publisherId}`)
      .then(r => r.json())
      .then(pub => { if (pub.api_key) setApiKey(pub.api_key); })
      .catch(() => {});
  }, [publisherId]);

  async function generateKey() {
    setGenerating(true);
    const res = await fetch(`/api/publishers/${publisherId}/api-key`, { method: 'POST' });
    const data = await res.json();
    setGenerating(false);
    if (data.api_key) setApiKey(data.api_key);
  }

  function copyText(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const baseUrl = window.location.origin;
  const singleEndpoint = `${baseUrl}/api/ingest`;
  const batchEndpoint = `${baseUrl}/api/ingest/batch`;
  const webhookEndpoint = `${baseUrl}/api/webhook/${publisherId}`;

  const curlSingle = `curl -X POST ${singleEndpoint} \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Breaking: New Discovery",
    "body_text": "Full article content here...",
    "url": "https://yoursite.com/article",
    "byline": "Jane Reporter",
    "published_at": "2024-01-15T10:00:00Z"
  }'`;

  const curlBatch = `curl -X POST ${batchEndpoint} \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "articles": [
      {"title": "Article 1", "body_text": "Content..."},
      {"title": "Article 2", "body_text": "Content..."}
    ]
  }'`;

  const curlWebhook = `curl -X POST ${webhookEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "article.published",
    "data": {
      "title": "New Article Title",
      "body_text": "Full article content...",
      "url": "https://yoursite.com/new-article"
    }
  }'`;

  const tabs = [
    { id: 'single', label: 'Single Article', icon: 'article' },
    { id: 'batch', label: 'Batch Import', icon: 'library_books' },
    { id: 'webhook', label: 'Webhook', icon: 'webhook' },
  ];

  return (
    <div className="flex flex-col gap-md">
      {/* API Key Section */}
      <div className="glass-card overflow-hidden">
        <div className="px-lg py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>key</span>
          <span className="text-label-md font-bold text-on-surface">API Key</span>
        </div>
        <div className="p-lg flex flex-col gap-md">
          {!publisherId ? (
            <div className="flex items-center gap-sm px-md py-sm rounded-xl" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)' }}>
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>info</span>
              <span className="text-body-sm text-on-surface-variant">Select a publisher first to manage API keys.</span>
            </div>
          ) : !apiKey ? (
            <div className="flex flex-col items-center gap-md py-md">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)' }}>
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 24 }}>key_off</span>
              </div>
              <div className="text-center">
                <p className="text-body-md font-bold text-on-surface">No API Key Generated</p>
                <p className="text-body-sm text-on-surface-variant mt-xs">Generate a key to start pushing articles via API or webhook.</p>
              </div>
              <button onClick={generateKey} disabled={generating} className="btn-primary text-label-md flex items-center gap-sm">
                <span className={`material-symbols-outlined ${generating ? 'live-pulse' : ''}`} style={{ fontSize: 16 }}>{generating ? 'pending' : 'vpn_key'}</span>
                {generating ? 'Generating...' : 'Generate API Key'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-sm">
              <div className="flex items-center gap-sm">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                <span className="text-label-sm text-primary font-medium">Active</span>
              </div>
              <div className="flex items-center gap-sm">
                <code className="flex-1 px-md py-sm rounded-lg font-code text-body-sm text-on-surface truncate" style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)', fontSize: 12 }}>
                  {apiKey.slice(0, 12)}{'*'.repeat(20)}
                </code>
                <button
                  onClick={() => copyText(apiKey, 'key')}
                  className="btn-ghost px-sm py-sm rounded-lg"
                  style={{ border: '1px solid var(--outline-variant)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{copied === 'key' ? 'check' : 'content_copy'}</span>
                </button>
              </div>
              <p className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>
                Include in requests as: <code className="font-code text-primary">Authorization: Bearer {apiKey.slice(0, 8)}...</code>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Endpoints & Examples */}
      {apiKey && (
        <div className="glass-card overflow-hidden">
          <div className="px-lg py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>integration_instructions</span>
            <span className="text-label-md font-bold text-on-surface">Integration Guide</span>
          </div>
          <div className="p-lg flex flex-col gap-lg">
            {/* Tab switcher */}
            <div className="flex gap-xs p-xs rounded-xl self-start" style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)' }}>
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-xs px-md py-xs rounded-lg text-label-sm font-medium transition-all ${
                    activeTab === t.id
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Endpoint info */}
            <div className="flex flex-col gap-sm">
              <div className="flex items-center gap-sm">
                <span className="px-sm py-xs rounded-md font-code text-body-sm font-bold text-primary" style={{ background: 'var(--primary-fixed)', fontSize: 11 }}>POST</span>
                <code className="text-body-sm text-on-surface font-code" style={{ fontSize: 12 }}>
                  {activeTab === 'single' && singleEndpoint}
                  {activeTab === 'batch' && batchEndpoint}
                  {activeTab === 'webhook' && webhookEndpoint}
                </code>
                <button
                  onClick={() => copyText(
                    activeTab === 'single' ? singleEndpoint : activeTab === 'batch' ? batchEndpoint : webhookEndpoint,
                    'endpoint'
                  )}
                  className="ml-auto btn-ghost px-xs py-xs rounded"
                >
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>{copied === 'endpoint' ? 'check' : 'content_copy'}</span>
                </button>
              </div>

              {activeTab === 'webhook' && (
                <div className="flex items-start gap-sm px-md py-sm rounded-lg" style={{ background: 'rgba(22, 163, 74, 0.06)', border: '1px solid rgba(22, 163, 74, 0.15)' }}>
                  <span className="material-symbols-outlined text-primary shrink-0 mt-px" style={{ fontSize: 14 }}>info</span>
                  <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 12 }}>
                    Webhooks don't require an API key — the publisher ID in the URL identifies the source. Perfect for CMS integrations that fire on publish.
                  </span>
                </div>
              )}
            </div>

            {/* Curl example */}
            <div className="flex flex-col gap-xs">
              <div className="flex items-center justify-between">
                <span className="text-label-sm text-on-surface-variant font-semibold">Example Request</span>
                <button
                  onClick={() => copyText(
                    activeTab === 'single' ? curlSingle : activeTab === 'batch' ? curlBatch : curlWebhook,
                    'curl'
                  )}
                  className="flex items-center gap-xs text-label-sm text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{copied === 'curl' ? 'check' : 'content_copy'}</span>
                  {copied === 'curl' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="rounded-xl p-md font-code text-body-sm overflow-x-auto" style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)', fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {activeTab === 'single' && curlSingle}
                {activeTab === 'batch' && curlBatch}
                {activeTab === 'webhook' && curlWebhook}
              </pre>
            </div>

            {/* Required fields */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--outline-variant)' }}>
              <div className="px-md py-xs border-b border-outline-variant" style={{ background: 'var(--surface-container)' }}>
                <span className="text-label-sm font-semibold text-on-surface-variant">
                  {activeTab === 'webhook' ? 'Webhook Payload' : 'Required Fields'}
                </span>
              </div>
              <div className="px-md py-sm flex flex-col gap-xs" style={{ background: 'var(--surface-container-lowest)' }}>
                {activeTab === 'webhook' ? (
                  <>
                    <div className="flex items-center gap-sm">
                      <code className="font-code text-primary" style={{ fontSize: 11, minWidth: 80 }}>data.title</code>
                      <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Article headline (required)</span>
                    </div>
                    <div className="flex items-center gap-sm">
                      <code className="font-code text-primary" style={{ fontSize: 11, minWidth: 80 }}>data.body_text</code>
                      <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Full article body, min 50 chars (required)</span>
                    </div>
                    <div className="flex items-center gap-sm">
                      <code className="font-code text-on-surface-variant" style={{ fontSize: 11, minWidth: 80 }}>data.url</code>
                      <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Canonical URL (optional)</span>
                    </div>
                    <div className="flex items-center gap-sm">
                      <code className="font-code text-on-surface-variant" style={{ fontSize: 11, minWidth: 80 }}>event</code>
                      <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Event type, e.g. "article.published" (optional, logged)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-sm">
                      <code className="font-code text-primary" style={{ fontSize: 11, minWidth: 80 }}>title</code>
                      <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Article headline (required, max 500 chars)</span>
                    </div>
                    <div className="flex items-center gap-sm">
                      <code className="font-code text-primary" style={{ fontSize: 11, minWidth: 80 }}>body_text</code>
                      <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Full article body (required, min 50 chars)</span>
                    </div>
                    <div className="flex items-center gap-sm">
                      <code className="font-code text-on-surface-variant" style={{ fontSize: 11, minWidth: 80 }}>url</code>
                      <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Canonical URL (optional)</span>
                    </div>
                    <div className="flex items-center gap-sm">
                      <code className="font-code text-on-surface-variant" style={{ fontSize: 11, minWidth: 80 }}>byline</code>
                      <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Author name (optional)</span>
                    </div>
                    <div className="flex items-center gap-sm">
                      <code className="font-code text-on-surface-variant" style={{ fontSize: 11, minWidth: 80 }}>published_at</code>
                      <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>ISO 8601 date (optional)</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PullPanel({ publisherId, onDone, setResult, loading, setLoading }) {
  const [step, setStep] = useState(1);
  const [removing, setRemoving] = useState(false);
  const [config, setConfig] = useState({
    url: '',
    method: 'GET',
    headers: '',
    response_path: '',
    mapping_title: 'title',
    mapping_body: 'content',
    mapping_url: 'url',
    mapping_byline: 'author',
    mapping_date: 'published_at',
    pagination_type: 'none',
    pagination_param: 'page',
    pagination_limit_param: 'per_page',
    pagination_limit: 20,
  });
  const [saved, setSaved] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testData, setTestData] = useState(null);

  useEffect(() => {
    fetch(`/api/publishers/${publisherId}`)
      .then(r => r.json())
      .then(pub => {
        if (pub.pull_config) {
          const c = pub.pull_config;
          setConfig({
            url: c.url || '',
            method: c.method || 'GET',
            headers: c.headers ? Object.entries(c.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : '',
            response_path: c.response_path || '',
            mapping_title: c.mapping?.title || 'title',
            mapping_body: c.mapping?.body_text || 'content',
            mapping_url: c.mapping?.url || 'url',
            mapping_byline: c.mapping?.byline || 'author',
            mapping_date: c.mapping?.published_at || 'published_at',
            pagination_type: c.pagination?.type || 'none',
            pagination_param: c.pagination?.param || 'page',
            pagination_limit_param: c.pagination?.limit_param || 'per_page',
            pagination_limit: c.pagination?.limit || 20,
          });
          setSaved(true);
          setStep(3);
        }
      })
      .catch(() => {});
  }, [publisherId]);

  function parseHeaders(str) {
    const headers = {};
    for (const line of str.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return headers;
  }

  async function saveConfig() {
    setLoading(true);
    setResult(null);

    const body = {
      url: config.url,
      method: config.method,
      headers: parseHeaders(config.headers),
      response_path: config.response_path,
      mapping: {
        title: config.mapping_title,
        body_text: config.mapping_body,
        url: config.mapping_url,
        byline: config.mapping_byline,
        published_at: config.mapping_date,
      },
      pagination: {
        type: config.pagination_type,
        param: config.pagination_param,
        limit_param: config.pagination_limit_param,
        limit: parseInt(config.pagination_limit) || 20,
      },
    };

    const res = await fetch(`/api/publishers/${publisherId}/pull-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setLoading(false);
    if (res.ok) {
      setSaved(true);
      setStep(3);
      setResult({ success: true, message: 'Configuration saved — ready to pull' });
    } else {
      const data = await res.json();
      setResult({ success: false, message: data.error ? JSON.stringify(data.error) : 'Save failed' });
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestData(null);

    // Save config first so the test endpoint can read it
    const body = {
      url: config.url,
      method: config.method,
      headers: parseHeaders(config.headers),
      response_path: config.response_path,
      mapping: {
        title: config.mapping_title,
        body_text: config.mapping_body,
        url: config.mapping_url,
        byline: config.mapping_byline,
        published_at: config.mapping_date,
      },
      pagination: {
        type: config.pagination_type,
        param: config.pagination_param,
        limit_param: config.pagination_limit_param,
        limit: parseInt(config.pagination_limit) || 20,
      },
    };

    await fetch(`/api/publishers/${publisherId}/pull-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await fetch(`/api/publishers/${publisherId}/pull-test`, { method: 'POST' });
    const data = await res.json();
    setTesting(false);
    setTestData(data);
    if (data.success) setSaved(true);
  }

  async function pullNow() {
    setPulling(true);
    setResult(null);

    const res = await fetch(`/api/publishers/${publisherId}/pull`, { method: 'POST' });
    const data = await res.json();
    setPulling(false);

    if (res.ok && data.success) {
      setResult({ success: true, message: `Pulled ${data.imported} new articles (${data.skipped} already existed, ${data.failed} failed)` });
      if (data.imported > 0) onDone?.();
    } else {
      setResult({ success: false, message: data.reason || data.error || 'Pull failed' });
    }
  }

  async function removeConfig() {
    setRemoving(true);
    setResult(null);
    const res = await fetch(`/api/publishers/${publisherId}/pull-config`, { method: 'DELETE' });
    setRemoving(false);
    if (res.ok) {
      setSaved(false);
      setStep(1);
      setConfig({
        url: '', method: 'GET', headers: '', response_path: '',
        mapping_title: 'title', mapping_body: 'content', mapping_url: 'url',
        mapping_byline: 'author', mapping_date: 'published_at',
        pagination_type: 'none', pagination_param: 'page',
        pagination_limit_param: 'per_page', pagination_limit: 20,
      });
      setResult({ success: true, message: 'Pull API configuration removed' });
    } else {
      setResult({ success: false, message: 'Failed to remove configuration' });
    }
  }

  const steps = [
    { num: 1, label: 'Connect', icon: 'link' },
    { num: 2, label: 'Map Fields', icon: 'schema' },
    { num: 3, label: 'Pull', icon: 'sync' },
  ];

  return (
    <div className="flex flex-col gap-md">
      {/* Step indicator */}
      <div className="glass-card px-lg py-md">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <React.Fragment key={s.num}>
              <button
                onClick={() => (s.num <= (saved ? 3 : step)) && setStep(s.num)}
                className={`flex items-center gap-sm px-md py-xs rounded-xl transition-all ${
                  step === s.num
                    ? 'bg-primary text-on-primary shadow-md'
                    : s.num < step || (saved && s.num <= 3)
                      ? 'text-primary cursor-pointer hover:bg-primary/10'
                      : 'text-on-surface-variant opacity-40 cursor-default'
                }`}
                style={step === s.num ? { boxShadow: '0 4px 16px rgba(22, 163, 74, 0.3)' } : {}}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{s.icon}</span>
                <span className="text-label-md font-bold">{s.label}</span>
              </button>
              {i < steps.length - 1 && (
                <div className="flex-1 mx-sm h-px" style={{ background: s.num < step || saved ? 'var(--primary)' : 'var(--outline-variant)', opacity: s.num < step || saved ? 0.5 : 0.3 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 1: Connect */}
      {step === 1 && (
        <div className="glass-card overflow-hidden">
          <div className="px-lg py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>link</span>
            <span className="text-label-md font-bold text-on-surface">Connect to Publisher's API</span>
          </div>
          <div className="p-lg flex flex-col gap-lg">
            <p className="text-body-sm text-on-surface-variant">
              Enter the API endpoint where we can fetch articles. This is the publisher's content API — we'll call it to pull their latest articles into our corpus.
            </p>

            <div className="flex flex-col gap-xs">
              <label className="text-label-sm text-on-surface-variant font-medium">API Endpoint URL</label>
              <div className="flex gap-sm">
                <input
                  type="url"
                  value={config.url}
                  onChange={e => setConfig(c => ({ ...c, url: e.target.value }))}
                  className="input-field flex-1"
                  placeholder="https://cms.publisher.com/api/articles"
                />
                <select value={config.method} onChange={e => setConfig(c => ({ ...c, method: e.target.value }))} className="input-field" style={{ width: 90 }}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <span className="text-body-sm text-on-surface-variant opacity-60" style={{ fontSize: 11 }}>The endpoint that returns a list of articles as JSON</span>
            </div>

            <div className="flex flex-col gap-xs">
              <label className="text-label-sm text-on-surface-variant font-medium">
                Authentication Headers
                <span className="opacity-50 font-normal ml-sm">(if their API requires auth)</span>
              </label>
              <textarea
                value={config.headers}
                onChange={e => setConfig(c => ({ ...c, headers: e.target.value }))}
                rows={2}
                className="input-field font-code"
                style={{ fontSize: 12 }}
                placeholder={"Authorization: Bearer their-api-key-here\nX-API-Version: 2"}
              />
              <span className="text-body-sm text-on-surface-variant opacity-60" style={{ fontSize: 11 }}>One header per line as "Key: Value" — credentials are stored securely</span>
            </div>

            <div className="flex flex-col gap-xs">
              <label className="text-label-sm text-on-surface-variant font-medium">
                Path to Articles Array
                <span className="opacity-50 font-normal ml-sm">(dot notation)</span>
              </label>
              <input
                type="text"
                value={config.response_path}
                onChange={e => setConfig(c => ({ ...c, response_path: e.target.value }))}
                className="input-field font-code"
                style={{ fontSize: 12 }}
                placeholder="data.articles"
              />
              <div className="flex items-start gap-sm px-md py-sm rounded-lg mt-xs" style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)' }}>
                <span className="material-symbols-outlined text-on-surface-variant shrink-0 mt-px" style={{ fontSize: 14 }}>help</span>
                <div className="text-body-sm text-on-surface-variant" style={{ fontSize: 11, lineHeight: 1.5 }}>
                  <p>If the API response looks like: <code className="font-code px-xs rounded" style={{ background: 'var(--surface-container-high)' }}>{`{"data":{"articles":[...]}}`}</code></p>
                  <p className="mt-xs">Enter: <code className="font-code px-xs rounded text-primary" style={{ background: 'var(--surface-container-high)' }}>data.articles</code></p>
                  <p className="mt-xs">Leave empty if the response IS the array: <code className="font-code px-xs rounded" style={{ background: 'var(--surface-container-high)' }}>{`[{...},{...}]`}</code></p>
                </div>
              </div>
            </div>

            {/* Test Connection Result */}
            {testData && (
              <div className={`rounded-xl p-md flex flex-col gap-sm row-animate`} style={{ background: testData.success ? 'rgba(22, 163, 74, 0.06)' : 'rgba(220, 38, 38, 0.06)', border: `1px solid ${testData.success ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)'}` }}>
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: testData.success ? 'var(--primary)' : 'var(--error)' }}>
                    {testData.success ? 'check_circle' : 'error'}
                  </span>
                  <span className={`text-body-sm font-bold ${testData.success ? 'text-primary' : 'text-error'}`}>
                    {testData.message}
                  </span>
                </div>
                {testData.preview && testData.preview.length > 0 && (
                  <div className="mt-sm flex flex-col gap-xs">
                    <span className="text-label-sm text-on-surface-variant font-semibold">Preview of mapped articles:</span>
                    {testData.preview.map((a, i) => (
                      <div key={i} className="flex items-center gap-sm px-sm py-xs rounded-lg" style={{ background: 'var(--surface-container)' }}>
                        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 12 }}>article</span>
                        <span className="text-body-sm text-on-surface truncate flex-1">{a.title}</span>
                        <span className="text-body-sm text-on-surface-variant shrink-0" style={{ fontSize: 11 }}>{a.body_length} chars</span>
                      </div>
                    ))}
                  </div>
                )}
                {testData.keys && (
                  <div className="mt-xs">
                    <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Available keys at root: <code className="font-code text-primary">{testData.keys.join(', ')}</code></span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={testConnection}
                disabled={!config.url || testing}
                className="btn-ghost text-label-md flex items-center gap-sm"
                style={{ padding: '10px 20px', border: '1px solid var(--outline-variant)' }}
              >
                <span className={`material-symbols-outlined ${testing ? 'live-pulse' : ''}`} style={{ fontSize: 16 }}>{testing ? 'pending' : 'wifi_tethering'}</span>
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!config.url}
                className="btn-primary text-label-md flex items-center gap-sm"
              >
                Next: Map Fields
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Map Fields */}
      {step === 2 && (
        <div className="glass-card overflow-hidden">
          <div className="px-lg py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>schema</span>
            <span className="text-label-md font-bold text-on-surface">Map Response Fields</span>
          </div>
          <div className="p-lg flex flex-col gap-lg">
            <p className="text-body-sm text-on-surface-variant">
              Tell us which field names the publisher uses. We'll map them to our format automatically.
            </p>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--outline-variant)' }}>
              <div className="grid grid-cols-3 px-md py-xs border-b border-outline-variant" style={{ background: 'var(--surface-container)' }}>
                <span className="text-label-sm font-semibold text-on-surface-variant">Our Field</span>
                <span className="text-label-sm font-semibold text-on-surface-variant text-center">Maps From</span>
                <span className="text-label-sm font-semibold text-on-surface-variant text-right">Example</span>
              </div>
              {[
                { label: 'Article Title', key: 'mapping_title', icon: 'title', example: '"headline", "title", "name"' },
                { label: 'Body Content', key: 'mapping_body', icon: 'article', example: '"content", "body", "text"' },
                { label: 'Article URL', key: 'mapping_url', icon: 'link', example: '"url", "link", "permalink"' },
                { label: 'Author Name', key: 'mapping_byline', icon: 'person', example: '"author", "byline", "writer"' },
                { label: 'Publish Date', key: 'mapping_date', icon: 'calendar_today', example: '"publishedAt", "date", "created"' },
              ].map((field, i) => (
                <div key={field.key} className={`grid grid-cols-3 items-center gap-md px-md py-sm ${i < 4 ? 'border-b border-outline-variant/50' : ''}`} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--surface-container-lowest)' }}>
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>{field.icon}</span>
                    <span className="text-body-sm font-medium text-on-surface">{field.label}</span>
                  </div>
                  <input
                    value={config[field.key]}
                    onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value }))}
                    className="input-field font-code text-center"
                    style={{ fontSize: 12, padding: '6px 10px' }}
                  />
                  <span className="text-body-sm text-on-surface-variant text-right opacity-60" style={{ fontSize: 11 }}>{field.example}</span>
                </div>
              ))}
            </div>

            {/* Advanced: Pagination */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors self-start"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{showAdvanced ? 'expand_less' : 'expand_more'}</span>
              Advanced: Pagination Settings
            </button>

            {showAdvanced && (
              <div className="rounded-xl p-md flex flex-col gap-md row-animate" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)' }}>
                <p className="text-body-sm text-on-surface-variant" style={{ fontSize: 12 }}>
                  If the API returns articles in pages, configure how to navigate through them.
                </p>
                <div className="grid grid-cols-4 gap-md">
                  <div className="flex flex-col gap-xs">
                    <label className="text-label-sm text-on-surface-variant font-medium" style={{ fontSize: 11 }}>Pagination</label>
                    <select value={config.pagination_type} onChange={e => setConfig(c => ({ ...c, pagination_type: e.target.value }))} className="input-field" style={{ fontSize: 12, padding: '8px 10px' }}>
                      <option value="none">No Pagination</option>
                      <option value="offset">Page Numbers</option>
                    </select>
                  </div>
                  {config.pagination_type !== 'none' && (
                    <>
                      <div className="flex flex-col gap-xs">
                        <label className="text-label-sm text-on-surface-variant font-medium" style={{ fontSize: 11 }}>Page Param</label>
                        <input value={config.pagination_param} onChange={e => setConfig(c => ({ ...c, pagination_param: e.target.value }))} className="input-field font-code" style={{ fontSize: 12, padding: '8px 10px' }} placeholder="page" />
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="text-label-sm text-on-surface-variant font-medium" style={{ fontSize: 11 }}>Limit Param</label>
                        <input value={config.pagination_limit_param} onChange={e => setConfig(c => ({ ...c, pagination_limit_param: e.target.value }))} className="input-field font-code" style={{ fontSize: 12, padding: '8px 10px' }} placeholder="per_page" />
                      </div>
                      <div className="flex flex-col gap-xs">
                        <label className="text-label-sm text-on-surface-variant font-medium" style={{ fontSize: 11 }}>Items/Page</label>
                        <input type="number" value={config.pagination_limit} onChange={e => setConfig(c => ({ ...c, pagination_limit: e.target.value }))} className="input-field font-code" style={{ fontSize: 12, padding: '8px 10px' }} placeholder="20" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button onClick={() => setStep(1)} className="btn-ghost text-label-md flex items-center gap-sm" style={{ padding: '10px 20px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                Back
              </button>
              <button onClick={saveConfig} disabled={loading || !config.url} className="btn-primary text-label-md flex items-center gap-sm">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{loading ? 'pending' : 'check'}</span>
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Pull */}
      {step === 3 && (
        <div className="glass-card overflow-hidden">
          <div className="px-lg py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>sync</span>
            <span className="text-label-md font-bold text-on-surface">Fetch Articles</span>
          </div>
          <div className="p-lg flex flex-col gap-lg">
            {/* Connection summary */}
            <div className="rounded-xl p-md flex flex-col gap-sm" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)' }}>
              <div className="flex items-center justify-between">
                <span className="text-label-sm font-semibold text-on-surface-variant">Connection</span>
                <div className="flex items-center gap-xs">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span className="text-label-sm text-primary font-medium">Configured</span>
                </div>
              </div>
              <div className="flex items-center gap-sm">
                <span className="px-sm py-xs rounded-md font-code text-body-sm font-bold text-primary" style={{ background: 'var(--primary-fixed)', fontSize: 11 }}>{config.method}</span>
                <span className="text-body-sm text-on-surface font-code truncate">{config.url}</span>
              </div>
              {config.headers && (
                <div className="flex items-center gap-xs mt-xs">
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 12 }}>lock</span>
                  <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>Authentication headers configured</span>
                </div>
              )}
            </div>

            {/* Pull action */}
            <div className="flex flex-col items-center gap-md py-md">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.12), rgba(74, 222, 128, 0.06))', border: '1px solid rgba(22, 163, 74, 0.2)' }}>
                <span className={`material-symbols-outlined text-primary ${pulling ? 'live-pulse' : ''}`} style={{ fontSize: 32 }}>{pulling ? 'sync' : 'cloud_download'}</span>
              </div>
              <div className="text-center">
                <p className="text-body-md font-bold text-on-surface">
                  {pulling ? 'Fetching articles...' : 'Ready to pull'}
                </p>
                <p className="text-body-sm text-on-surface-variant mt-xs">
                  {pulling ? 'Calling the publisher API and indexing new articles' : 'Click below to fetch and index new articles from the publisher\'s API'}
                </p>
              </div>
              <button
                onClick={pullNow}
                disabled={pulling}
                className="btn-primary text-label-md flex items-center gap-sm"
                style={{ padding: '14px 32px' }}
              >
                <span className={`material-symbols-outlined ${pulling ? 'live-pulse' : ''}`} style={{ fontSize: 18 }}>{pulling ? 'pending' : 'download'}</span>
                {pulling ? 'Pulling...' : 'Pull Articles Now'}
              </button>
            </div>

            {/* Edit config link */}
            <div className="flex items-center justify-between border-t border-outline-variant pt-md">
              <button
                onClick={removeConfig}
                disabled={removing}
                className="flex items-center gap-xs text-label-sm text-error hover:text-error transition-colors"
                style={{ opacity: removing ? 0.6 : 1 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{removing ? 'pending' : 'delete'}</span>
                {removing ? 'Removing...' : 'Remove Pull API'}
              </button>
              <div className="flex items-center gap-lg">
                <button onClick={() => setStep(1)} className="text-label-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                  Edit Connection
                </button>
                <button onClick={() => setStep(2)} className="text-label-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schema</span>
                  Edit Mapping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
