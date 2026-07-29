import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function CorpusManager() {
  const { authHeaders } = useAuth();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [text, setText] = useState('');

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch('/api/corpus/articles', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
      }
    } catch (e) {
      console.error('Failed to fetch articles', e);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const handleIngest = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim() || !text.trim()) {
      setError('Title and article text are required.');
      return;
    }
    if (text.length > 100000) {
      setError('Article text exceeds 100,000 character limit.');
      return;
    }

    setIngesting(true);
    try {
      const body = { title: title.trim(), text: text.trim() };
      if (sourceUrl.trim()) body.source_url = sourceUrl.trim();

      const res = await fetch('/api/corpus/ingest', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ingestion failed');
        return;
      }
      setSuccess(`"${data.title}" ingested — ${data.chunk_count} chunk${data.chunk_count !== 1 ? 's' : ''} indexed.`);
      setTitle('');
      setSourceUrl('');
      setText('');
      fetchArticles();
    } catch (e) {
      setError('Network error: ' + e.message);
    } finally {
      setIngesting(false);
    }
  };

  const handleDelete = async (articleId, articleTitle) => {
    if (!confirm(`Delete "${articleTitle}"? This cannot be undone.`)) return;
    setDeleting(articleId);
    try {
      const res = await fetch(`/api/corpus/articles/${articleId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        setArticles(prev => prev.filter(a => a.id !== articleId));
        setSuccess(`"${articleTitle}" deleted.`);
      } else {
        const data = await res.json();
        setError(data.error || 'Delete failed');
      }
    } catch (e) {
      setError('Network error: ' + e.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.(txt|md|html?)$/i, ''));
    }
    e.target.value = '';
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center gap-md">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>library_books</span>
        <div>
          <h2 className="text-headline-sm font-black text-on-surface">Corpus Manager</h2>
          <p className="text-body-sm text-on-surface-variant">Ingest and manage your publisher articles for claim matching</p>
        </div>
      </div>

      {error && (
        <div className="glass-card px-md py-sm flex items-center gap-sm" style={{ borderLeft: '3px solid var(--error, #ef4444)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--error, #ef4444)' }}>error</span>
          <span className="text-body-md" style={{ color: 'var(--error, #ef4444)' }}>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>
      )}

      {success && (
        <div className="glass-card px-md py-sm flex items-center gap-sm" style={{ borderLeft: '3px solid var(--primary)' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>check_circle</span>
          <span className="text-body-md text-on-surface">{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Ingest Form */}
        <div className="glass-card p-lg flex flex-col gap-md">
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>upload_file</span>
            <h3 className="text-title-md font-bold text-on-surface">Ingest Article</h3>
          </div>

          <form onSubmit={handleIngest} className="flex flex-col gap-md">
            <div>
              <label className="text-label-md text-on-surface-variant block mb-xs">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Trump Tax Returns Investigation"
                className="w-full px-md py-sm rounded-xl text-body-md text-on-surface transition-all"
                style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)' }}
              />
            </div>

            <div>
              <label className="text-label-md text-on-surface-variant block mb-xs">Source URL (optional)</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full px-md py-sm rounded-xl text-body-md text-on-surface transition-all"
                style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)' }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-xs">
                <label className="text-label-md text-on-surface-variant">Article Text *</label>
                <label className="text-label-sm text-primary cursor-pointer hover:underline flex items-center gap-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>attach_file</span>
                  Upload .txt
                  <input type="file" accept=".txt,.md,.html" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Paste or upload the full article text..."
                rows={12}
                className="w-full px-md py-sm rounded-xl text-body-md text-on-surface transition-all resize-y custom-scrollbar"
                style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)', minHeight: 200 }}
              />
              <div className="flex justify-between mt-xs">
                <span className="text-label-sm text-on-surface-variant">{wordCount.toLocaleString()} words</span>
                <span className={`text-label-sm ${charCount > 100000 ? 'text-error' : 'text-on-surface-variant'}`}>
                  {charCount.toLocaleString()} / 100,000 chars
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={ingesting || !title.trim() || !text.trim()}
              className="btn-primary text-label-md flex items-center justify-center gap-sm py-sm"
              style={{ opacity: ingesting || !title.trim() || !text.trim() ? 0.5 : 1 }}
            >
              {ingesting ? (
                <>
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                  Ingesting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cloud_upload</span>
                  Ingest Article
                </>
              )}
            </button>
          </form>
        </div>

        {/* Articles List */}
        <div className="glass-card p-lg flex flex-col gap-md">
          <div className="flex items-center justify-between mb-xs">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>folder_open</span>
              <h3 className="text-title-md font-bold text-on-surface">Your Corpus</h3>
            </div>
            <span className="text-label-md text-on-surface-variant">{articles.length} article{articles.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-xl">
              <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 24 }}>progress_activity</span>
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-xl text-center">
              <span className="material-symbols-outlined text-on-surface-variant mb-sm" style={{ fontSize: 48, opacity: 0.3 }}>article</span>
              <p className="text-body-md text-on-surface-variant">No articles ingested yet.</p>
              <p className="text-body-sm text-on-surface-variant opacity-70">Upload your first article to start building your corpus.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-sm overflow-y-auto custom-scrollbar" style={{ maxHeight: 500 }}>
              {articles.map(article => (
                <div
                  key={article.id}
                  className="flex items-start gap-md px-md py-sm rounded-xl transition-all hover:bg-surface-container-high"
                  style={{ border: '1px solid var(--outline-variant)' }}
                >
                  <span className="material-symbols-outlined text-on-surface-variant shrink-0 mt-xs" style={{ fontSize: 18 }}>description</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md font-bold text-on-surface truncate">{article.title}</p>
                    <div className="flex items-center gap-md mt-xs flex-wrap">
                      <span className="text-label-sm text-on-surface-variant flex items-center gap-xs">
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>data_array</span>
                        {article.chunk_count} chunk{article.chunk_count !== 1 ? 's' : ''}
                      </span>
                      {article.source_url && (
                        <a href={article.source_url} target="_blank" rel="noopener" className="text-label-sm text-primary hover:underline truncate" style={{ maxWidth: 150 }}>
                          {new URL(article.source_url).hostname}
                        </a>
                      )}
                      {article.ingested_at && (
                        <span className="text-label-sm text-on-surface-variant">
                          {new Date(article.ingested_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(article.id, article.title)}
                    disabled={deleting === article.id}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container transition-all"
                    style={{ opacity: deleting === article.id ? 0.4 : 0.7 }}
                    title="Delete article"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--error, #ef4444)' }}>
                      {deleting === article.id ? 'progress_activity' : 'delete'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
