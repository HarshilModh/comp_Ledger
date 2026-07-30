import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ArticleUpload from './ArticleUpload.jsx';

function getTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function OnboardingGuide({ publisher, onDismiss, onNavigate }) {
  const steps = [
    {
      id: 'ingest',
      icon: 'travel_explore',
      title: 'Auto-Crawl Your Site',
      desc: 'Let CoMP Ledger discover your sitemap or RSS feed and index up to 100 articles automatically.',
      action: 'Start Crawling',
      tab: 'upload',
      done: false,
    },
    {
      id: 'rss',
      icon: 'rss_feed',
      title: 'Connect RSS Feed',
      desc: 'Auto-import new articles as they publish. Set your RSS URL in settings.',
      action: 'Configure RSS',
      tab: 'settings',
      done: !!publisher.rss_url,
    },
    {
      id: 'api',
      icon: 'key',
      title: 'Set Up API Access',
      desc: 'Generate an API key for programmatic ingestion from your CMS or pipeline.',
      action: 'Get API Key',
      tab: 'api',
      done: !!publisher.api_key,
    },
    {
      id: 'pull',
      icon: 'download',
      title: 'Configure Pull API',
      desc: 'Let CoMP Ledger pull articles from your content API on a schedule.',
      action: 'Set Up Pull',
      tab: 'upload',
      done: !!publisher.pull_config,
    },
  ];

  const completedCount = steps.filter(s => s.done).length;

  return (
    <div className="glass-card overflow-hidden" style={{ border: '1px solid rgba(22, 163, 74, 0.2)', background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.03), transparent)' }}>
      <div className="px-md py-sm border-b border-outline-variant flex items-center justify-between" style={{ background: 'rgba(22, 163, 74, 0.04)' }}>
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>rocket_launch</span>
          <span className="text-label-md font-bold text-on-surface">Getting Started</span>
          <span className="px-sm py-px rounded-full text-primary font-bold" style={{ fontSize: 10, background: 'var(--primary-fixed)' }}>
            {completedCount}/{steps.length} done
          </span>
        </div>
        <button onClick={onDismiss} className="text-on-surface-variant hover:text-on-surface transition-colors" title="Dismiss">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>
      <div className="p-md">
        <p className="text-body-md text-on-surface-variant mb-md">
          Welcome to CoMP Ledger! Follow these steps to register your content and start tracking AI citations.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {steps.map(step => (
            <div
              key={step.id}
              className="flex items-start gap-md p-md rounded-xl transition-all hover:shadow-sm cursor-pointer"
              style={{ background: step.done ? 'rgba(22, 163, 74, 0.04)' : 'var(--surface-container-low)', border: step.done ? '1px solid rgba(22, 163, 74, 0.15)' : '1px solid var(--outline-variant)' }}
              onClick={() => onNavigate(step.tab)}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${step.done ? '' : ''}`} style={{ background: step.done ? 'var(--primary-fixed)' : 'var(--surface-container)' }}>
                <span className={`material-symbols-outlined ${step.done ? 'text-primary' : 'text-on-surface-variant'}`} style={{ fontSize: 20 }}>
                  {step.done ? 'check_circle' : step.icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-label-md font-bold ${step.done ? 'text-primary' : 'text-on-surface'}`}>{step.title}</h4>
                <p className="text-body-sm text-on-surface-variant mt-xs" style={{ fontSize: 12 }}>{step.desc}</p>
                {!step.done && (
                  <span className="inline-flex items-center gap-xs text-label-sm text-primary font-bold mt-sm hover:underline">
                    {step.action}
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_forward</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, glow, sub }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-sm mb-sm">
        <span className={`material-symbols-outlined ${glow ? 'text-primary' : 'text-on-surface-variant'}`} style={{ fontSize: 18 }}>{icon}</span>
        <span className="text-label-md text-on-surface-variant flex-1">{label}</span>
      </div>
      <h3 className="text-headline-md font-black text-on-surface">{value}</h3>
      {sub && <p className="text-body-sm text-on-surface-variant mt-xs opacity-70">{sub}</p>}
    </div>
  );
}

function ApiWebhookPanel({ publisherId, apiKey, onKeyChange }) {
  const [key, setKey] = useState(apiKey || '');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState('');

  async function generateKey() {
    setGenerating(true);
    const res = await fetch(`/api/publishers/${publisherId}/api-key`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setKey(data.api_key);
      onKeyChange?.();
    }
    setGenerating(false);
  }

  async function revokeKey() {
    await fetch(`/api/publishers/${publisherId}/api-key`, { method: 'DELETE' });
    setKey('');
    onKeyChange?.();
  }

  function copy(text, label) {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  const baseUrl = window.location.origin;
  const ingestEndpoint = `${baseUrl}/api/ingest`;
  const batchEndpoint = `${baseUrl}/api/ingest/batch`;
  const webhookEndpoint = `${baseUrl}/api/webhook/${publisherId}`;

  return (
    <div className="flex flex-col gap-lg">
      <div className="glass-card overflow-hidden">
        <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>key</span>
          <span className="text-label-md font-bold text-on-surface">API Key</span>
        </div>
        <div className="p-md flex flex-col gap-md">
          {key ? (
            <>
              <div className="flex items-center gap-md">
                <code className="flex-1 px-md py-sm rounded-lg font-code text-body-sm text-on-surface break-all" style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)' }}>
                  {key}
                </code>
                <button onClick={() => copy(key, 'key')} className="btn-ghost text-label-sm flex items-center gap-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{copied === 'key' ? 'check' : 'content_copy'}</span>
                  {copied === 'key' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="flex gap-sm">
                <button onClick={generateKey} disabled={generating} className="btn-ghost text-label-sm text-on-surface-variant">
                  Regenerate
                </button>
                <button onClick={revokeKey} className="btn-ghost text-label-sm text-error">
                  Revoke
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-md py-md">
              <p className="text-body-sm text-on-surface-variant">No API key generated yet. Create one to enable programmatic article ingestion.</p>
              <button onClick={generateKey} disabled={generating} className="btn-primary text-label-md flex items-center gap-sm">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                {generating ? 'Generating...' : 'Generate API Key'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <div className="glass-card overflow-hidden">
          <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>api</span>
            <span className="text-label-md font-bold text-on-surface">Push API</span>
          </div>
          <div className="p-md flex flex-col gap-md">
            <p className="text-body-sm text-on-surface-variant">
              Call our API from your CMS or pipeline to ingest articles automatically.
            </p>
            <div className="flex flex-col gap-xs">
              <span className="text-label-sm text-on-surface-variant font-semibold">Single Article</span>
              <div className="flex items-center gap-sm">
                <code className="flex-1 px-sm py-xs rounded text-body-sm font-code text-on-surface truncate" style={{ background: 'var(--surface-container)' }}>
                  POST {ingestEndpoint}
                </code>
                <button onClick={() => copy(ingestEndpoint, 'single')} className="shrink-0 text-on-surface-variant hover:text-primary">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{copied === 'single' ? 'check' : 'content_copy'}</span>
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-xs">
              <span className="text-label-sm text-on-surface-variant font-semibold">Batch (up to 50)</span>
              <div className="flex items-center gap-sm">
                <code className="flex-1 px-sm py-xs rounded text-body-sm font-code text-on-surface truncate" style={{ background: 'var(--surface-container)' }}>
                  POST {batchEndpoint}
                </code>
                <button onClick={() => copy(batchEndpoint, 'batch')} className="shrink-0 text-on-surface-variant hover:text-primary">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{copied === 'batch' ? 'check' : 'content_copy'}</span>
                </button>
              </div>
            </div>
            <div className="rounded-lg p-md font-code text-body-sm overflow-x-auto custom-scrollbar" style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)', fontSize: 11 }}>
              <pre className="text-on-surface-variant whitespace-pre">{`curl -X POST ${ingestEndpoint} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Article Title",
    "body_text": "Full article content...",
    "url": "https://...",
    "byline": "Author",
    "published_at": "2024-01-15T10:00:00Z"
  }'`}</pre>
            </div>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>webhook</span>
            <span className="text-label-md font-bold text-on-surface">Webhook</span>
          </div>
          <div className="p-md flex flex-col gap-md">
            <p className="text-body-sm text-on-surface-variant">
              Configure this URL in your CMS webhook settings to auto-ingest on publish.
            </p>
            <div className="flex flex-col gap-xs">
              <span className="text-label-sm text-on-surface-variant font-semibold">Webhook URL</span>
              <div className="flex items-center gap-sm">
                <code className="flex-1 px-sm py-xs rounded text-body-sm font-code text-on-surface truncate" style={{ background: 'var(--surface-container)' }}>
                  {webhookEndpoint}
                </code>
                <button onClick={() => copy(webhookEndpoint, 'webhook')} className="shrink-0 text-on-surface-variant hover:text-primary">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{copied === 'webhook' ? 'check' : 'content_copy'}</span>
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-xs">
              <span className="text-label-sm text-on-surface-variant font-semibold">Auth Header</span>
              <code className="px-sm py-xs rounded text-body-sm font-code text-on-surface-variant" style={{ background: 'var(--surface-container)' }}>
                X-Webhook-Secret: YOUR_API_KEY
              </code>
            </div>
            <div className="flex items-center gap-sm px-sm py-xs rounded-lg" style={{ background: 'rgba(22, 163, 74, 0.05)', border: '1px solid rgba(22, 163, 74, 0.15)' }}>
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>check_circle</span>
              <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>
                WordPress, Ghost, Strapi, Contentful, and any CMS with webhooks.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ publisher, onUpdate }) {
  const [schedule, setSchedule] = useState(publisher.pull_schedule || '');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState(null);
  const [rssUrl, setRssUrl] = useState(publisher.rss_url || '');
  const [savingRss, setSavingRss] = useState(false);
  const [rssMsg, setRssMsg] = useState(null);

  async function saveRss() {
    setSavingRss(true);
    setRssMsg(null);
    const res = await fetch(`/api/publishers/${publisher.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rss_url: rssUrl.trim() || null }),
    });
    setSavingRss(false);
    if (res.ok) {
      setRssMsg({ ok: true, text: rssUrl.trim() ? 'RSS feed saved' : 'RSS feed removed' });
      onUpdate?.();
    } else {
      const data = await res.json();
      setRssMsg({ ok: false, text: data.error?.fieldErrors?.rss_url?.[0] || 'Failed to save' });
    }
  }

  async function saveSchedule(val) {
    setSchedule(val);
    setSavingSchedule(true);
    setScheduleMsg(null);
    const res = await fetch(`/api/publishers/${publisher.id}/pull-schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: val || null }),
    });
    setSavingSchedule(false);
    if (res.ok) {
      setScheduleMsg({ ok: true, text: val ? `Auto-pull set to ${val}` : 'Auto-pull disabled' });
      onUpdate?.();
    } else {
      setScheduleMsg({ ok: false, text: 'Failed to save' });
    }
  }

  return (
    <div className="grid grid-cols-12 gap-lg">
      <div className="col-span-6 glass-card overflow-hidden">
        <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>person</span>
          <span className="text-label-md font-bold text-on-surface">Contact Info</span>
        </div>
        <div className="p-md flex flex-col gap-md">
          <div className="grid grid-cols-2 gap-md">
            <div>
              <p className="text-label-sm text-on-surface-variant mb-xs">Name</p>
              <p className="text-body-md text-on-surface font-medium">{publisher.name}</p>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant mb-xs">Email</p>
              <p className="text-body-md text-on-surface font-medium">{publisher.email}</p>
            </div>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant mb-xs">Domains</p>
            <div className="flex gap-xs flex-wrap">
              <span className="px-sm py-xs rounded-md text-body-sm font-medium text-primary" style={{ background: 'var(--primary-fixed)' }}>{publisher.domain}</span>
              {publisher.alt_domains?.map(d => (
                <span key={d} className="px-sm py-xs rounded-md text-body-sm text-on-surface-variant" style={{ background: 'var(--surface-container)' }}>{d}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-6 flex flex-col gap-lg">
        <div className="glass-card overflow-hidden">
          <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>rss_feed</span>
            <span className="text-label-md font-bold text-on-surface">RSS Feed</span>
            {publisher.rss_url && (
              <span className="ml-auto flex items-center gap-xs text-primary" style={{ fontSize: 11 }}>
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>Active
              </span>
            )}
          </div>
          <div className="p-md flex flex-col gap-md">
            <p className="text-body-sm text-on-surface-variant" style={{ fontSize: 12 }}>
              Articles are auto-polled every 30 minutes. Leave blank to disable.
            </p>
            <div className="flex gap-sm">
              <input
                type="url"
                value={rssUrl}
                onChange={e => { setRssUrl(e.target.value); setRssMsg(null); }}
                className="input-field flex-1"
                placeholder="https://feeds.example.com/rss.xml"
              />
              <button
                onClick={saveRss}
                disabled={savingRss || rssUrl === (publisher.rss_url || '')}
                className="btn-primary text-label-md flex items-center gap-xs shrink-0"
                style={{ padding: '8px 16px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{savingRss ? 'pending' : 'save'}</span>
                {savingRss ? 'Saving…' : 'Save'}
              </button>
            </div>
            {rssMsg && (
              <span className={`text-body-sm font-medium ${rssMsg.ok ? 'text-primary' : 'text-error'}`} style={{ fontSize: 12 }}>
                {rssMsg.text}
              </span>
            )}
          </div>
        </div>

        {publisher.pull_config && (
          <div className="glass-card overflow-hidden">
            <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>schedule</span>
              <span className="text-label-md font-bold text-on-surface">Scheduled Pulls</span>
            </div>
            <div className="p-md flex flex-col gap-md">
              <p className="text-body-sm text-on-surface-variant">
                Automatically pull new articles from the publisher's API on a schedule.
              </p>
              <div className="flex items-center gap-md">
                <div className="flex gap-xs">
                  {[
                    { val: '', label: 'Off', icon: 'block' },
                    { val: 'hourly', label: 'Hourly', icon: 'hourglass_top' },
                    { val: 'daily', label: 'Daily', icon: 'today' },
                    { val: 'weekly', label: 'Weekly', icon: 'date_range' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => saveSchedule(opt.val)}
                      disabled={savingSchedule}
                      className={`flex items-center gap-xs px-md py-xs rounded-lg text-label-sm font-medium transition-all ${
                        schedule === opt.val
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                      }`}
                      style={schedule === opt.val ? { boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)' } : { border: '1px solid var(--outline-variant)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {scheduleMsg && (
                <span className={`text-body-sm font-medium ${scheduleMsg.ok ? 'text-primary' : 'text-error'}`}>
                  {scheduleMsg.text}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublisherDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [publisher, setPublisher] = useState(null);
  const [articles, setArticles] = useState([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [tab, setTab] = useState('articles');
  const [loading, setLoading] = useState(true);
  const [pollResult, setPollResult] = useState(null);
  const [polling, setPolling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activityLog, setActivityLog] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const PAGE_SIZE = 30;

  useEffect(() => {
    loadPublisher();
    loadArticles();
    loadActivity();
    loadStats();
  }, [id]);

  async function loadPublisher() {
    const res = await fetch(`/api/publishers/${id}`);
    if (res.ok) setPublisher(await res.json());
    setLoading(false);
  }

  async function loadArticles(search = '', pageNum = 0) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageNum * PAGE_SIZE) });
    if (search) params.set('search', search);
    const res = await fetch(`/api/publishers/${id}/articles?${params}`);
    if (res.ok) {
      const data = await res.json();
      setArticles(data.articles);
      setArticleTotal(data.total);
    }
  }

  async function loadStats() {
    const res = await fetch(`/api/publishers/${id}/stats`);
    if (res.ok) setStats(await res.json());
  }

  async function loadActivity() {
    const res = await fetch(`/api/publishers/${id}/activity`);
    if (res.ok) {
      const data = await res.json();
      setActivityLog(data.entries);
    }
  }

  async function handlePollRss() {
    setPolling(true);
    setPollResult(null);
    const res = await fetch(`/api/publishers/${id}/rss/poll`, { method: 'POST' });
    const data = await res.json();
    setPollResult(data);
    setPolling(false);
    if (data.new_articles > 0) loadArticles();
  }

  async function handleDeleteArticle(articleId) {
    const res = await fetch(`/api/publishers/${id}/articles/${articleId}`, { method: 'DELETE' });
    if (res.ok) loadArticles();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-xl">
        <span className="material-symbols-outlined live-pulse text-primary" style={{ fontSize: 32 }}>pending</span>
      </div>
    );
  }

  if (!publisher) {
    return (
      <div className="glass-card p-lg text-center">
        <span className="material-symbols-outlined text-error mb-sm block" style={{ fontSize: 40 }}>error</span>
        <p className="text-body-md text-on-surface">Publisher not found</p>
        <button onClick={() => navigate('/publishers')} className="btn-ghost text-label-md mt-md">Back to Publishers</button>
      </div>
    );
  }

  const ingestionMethods = [
    publisher.rss_url && 'RSS',
    publisher.api_key && 'Push API',
    publisher.pull_config && 'Pull API',
  ].filter(Boolean);

  const tabs = [
    { id: 'articles', icon: 'article', label: 'Articles' },
    { id: 'analytics', icon: 'analytics', label: 'Analytics' },
    { id: 'upload', icon: 'upload_file', label: 'Ingest' },
    { id: 'activity', icon: 'history', label: 'Activity' },
    { id: 'api', icon: 'key', label: 'API & Webhook' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-md">
          <button onClick={() => navigate('/publishers')} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>arrow_back</span>
          </button>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--primary-fixed)' }}>
            <span className="text-primary font-black" style={{ fontSize: 16 }}>
              {publisher.publication.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-headline-md font-black text-on-surface">{publisher.publication}</h2>
            <div className="flex items-center gap-sm mt-xs">
              <span className="text-body-sm text-on-surface-variant">{publisher.domain}</span>
              {publisher.alt_domains?.length > 0 && (
                <span className="text-body-sm text-on-surface-variant opacity-60">+ {publisher.alt_domains.length} alt</span>
              )}
            </div>
          </div>
        </div>
        <span className={`px-sm py-xs rounded-full text-label-sm font-bold ${publisher.status === 'active' ? 'text-primary' : 'text-error'}`} style={{ background: publisher.status === 'active' ? 'var(--primary-fixed)' : 'var(--error-container)' }}>
          {publisher.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-md">
        <StatCard icon="article" label="Articles" value={articleTotal} glow sub={stats ? `${stats.embeddings} chunks indexed` : ''} />
        <StatCard icon="format_quote" label="AI Citations" value={stats?.total_citations || 0} glow sub={stats?.traces_with_citations ? `across ${stats.traces_with_citations} traces` : 'Not yet cited'} />
        <StatCard icon="sync" label="Ingestion" value={ingestionMethods.length > 0 ? ingestionMethods.join(', ') : 'Manual'} sub={ingestionMethods.length > 0 ? `${ingestionMethods.length} method${ingestionMethods.length > 1 ? 's' : ''}` : 'Upload only'} />
        <StatCard icon="key" label="API Key" value={publisher.api_key ? 'Active' : 'None'} />
        <StatCard icon="calendar_today" label="Registered" value={new Date(publisher.created_at).toLocaleDateString()} />
      </div>

      {showOnboarding && articleTotal === 0 && (
        <OnboardingGuide
          publisher={publisher}
          onDismiss={() => setShowOnboarding(false)}
          onNavigate={t => setTab(t)}
        />
      )}

      <div className="flex gap-xs p-xs rounded-xl self-start" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-xs px-md py-xs rounded-lg text-label-md font-medium transition-all ${
              tab === t.id
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
            style={tab === t.id ? { boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)' } : {}}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'articles' && (
        <div className="glass-card overflow-hidden">
          <div className="px-md py-sm border-b border-outline-variant flex items-center justify-between" style={{ background: 'var(--surface-container-low)' }}>
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>library_books</span>
              <span className="text-label-md font-bold text-on-surface">Article Corpus</span>
            </div>
            <div className="flex items-center gap-md">
              {publisher.rss_url && (
                <button
                  onClick={handlePollRss}
                  disabled={polling}
                  className="text-label-sm text-primary font-medium hover:underline flex items-center gap-xs"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{polling ? 'pending' : 'rss_feed'}</span>
                  {polling ? 'Polling...' : 'Poll RSS'}
                </button>
              )}
              {pollResult && (
                <span className="text-body-sm text-on-surface-variant">{pollResult.new_articles || 0} new</span>
              )}
              <span className="font-code text-on-surface-variant" style={{ fontSize: 11 }}>{articleTotal} total</span>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-lowest)' }}>
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                loadArticles(e.target.value);
              }}
              placeholder="Search articles by title, URL, or author..."
              className="flex-1 bg-transparent text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant/50"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); loadArticles(''); }} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            )}
          </div>

          {articles.length === 0 ? (
            <div className="p-xl text-center">
              <span className="material-symbols-outlined text-on-surface-variant mb-sm block" style={{ fontSize: 40, opacity: 0.3 }}>{searchQuery ? 'search_off' : 'article'}</span>
              <p className="text-body-md text-on-surface-variant">
                {searchQuery ? `No articles match "${searchQuery}"` : 'No articles in corpus yet.'}
              </p>
              {!searchQuery && (
                <button onClick={() => setTab('upload')} className="text-label-md text-primary font-bold hover:underline mt-sm">
                  Ingest your first article &rarr;
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center border-b border-outline-variant px-md py-xs gap-md" style={{ background: 'var(--surface-container-lowest)' }}>
                <span className="flex-1 text-label-sm font-semibold text-on-surface-variant uppercase" style={{ letterSpacing: '0.05em' }}>Title</span>
                <span className="text-label-sm font-semibold text-on-surface-variant uppercase" style={{ width: 100, letterSpacing: '0.05em' }}>Published</span>
                <span className="text-label-sm font-semibold text-on-surface-variant uppercase" style={{ width: 100, letterSpacing: '0.05em' }}>Ingested</span>
                <span style={{ width: 32 }}></span>
              </div>
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {articles.map((article, i) => (
                  <div key={article.id} className="flex items-center gap-md px-md py-sm border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-low/50 transition-colors row-animate" style={{ animationDelay: `${i * 20}ms` }}>
                    <div className="flex-1 min-w-0">
                      <span className="text-body-sm text-on-surface font-medium truncate block">{article.title}</span>
                      {article.url && <span className="text-body-sm text-on-surface-variant truncate block" style={{ fontSize: 11 }}>{article.url}</span>}
                    </div>
                    <span className="text-body-sm text-on-surface-variant shrink-0" style={{ width: 100 }}>
                      {article.published_at ? new Date(article.published_at).toLocaleDateString() : '—'}
                    </span>
                    <span className="text-body-sm text-on-surface-variant shrink-0" style={{ width: 100 }}>
                      {new Date(article.ingested_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleDeleteArticle(article.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container transition-colors shrink-0"
                      title="Archive"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {articleTotal > PAGE_SIZE && (
                <div className="px-md py-sm border-t border-outline-variant flex items-center justify-between" style={{ background: 'var(--surface-container-lowest)' }}>
                  <span className="text-body-sm text-on-surface-variant">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, articleTotal)} of {articleTotal}
                  </span>
                  <div className="flex items-center gap-xs">
                    <button
                      onClick={() => { setPage(p => p - 1); loadArticles(searchQuery, page - 1); }}
                      disabled={page === 0}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high disabled:opacity-30 transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
                    </button>
                    <span className="text-label-sm text-on-surface-variant font-medium px-sm">
                      Page {page + 1} of {Math.ceil(articleTotal / PAGE_SIZE)}
                    </span>
                    <button
                      onClick={() => { setPage(p => p + 1); loadArticles(searchQuery, page + 1); }}
                      disabled={(page + 1) * PAGE_SIZE >= articleTotal}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high disabled:opacity-30 transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="flex flex-col gap-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <div className="glass-card p-md flex flex-col items-center gap-sm text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.12), rgba(74, 222, 128, 0.06))', border: '1px solid rgba(22, 163, 74, 0.2)' }}>
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>format_quote</span>
              </div>
              <h3 className="text-headline-md font-black text-on-surface">{stats?.total_citations || 0}</h3>
              <p className="text-label-md text-on-surface-variant">Total AI Citations</p>
              <p className="text-body-sm text-on-surface-variant opacity-60">Times your content was used by AI models</p>
            </div>
            <div className="glass-card p-md flex flex-col items-center gap-sm text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(147, 197, 253, 0.06))', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'rgb(59, 130, 246)' }}>travel_explore</span>
              </div>
              <h3 className="text-headline-md font-black text-on-surface">{stats?.traces_with_citations || 0}</h3>
              <p className="text-label-md text-on-surface-variant">Traces Matched</p>
              <p className="text-body-sm text-on-surface-variant opacity-60">Distinct fact-check queries that referenced you</p>
            </div>
            <div className="glass-card p-md flex flex-col items-center gap-sm text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(216, 180, 254, 0.06))', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'rgb(168, 85, 247)' }}>hub</span>
              </div>
              <h3 className="text-headline-md font-black text-on-surface">{stats?.embeddings || 0}</h3>
              <p className="text-label-md text-on-surface-variant">Content Chunks</p>
              <p className="text-body-sm text-on-surface-variant opacity-60">Searchable vector embeddings in the index</p>
            </div>
          </div>

          {/* Top cited articles */}
          <div className="glass-card overflow-hidden">
            <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>trending_up</span>
              <span className="text-label-md font-bold text-on-surface">Most Cited Articles</span>
            </div>
            {(!stats?.top_cited || stats.top_cited.length === 0) ? (
              <div className="p-lg text-center">
                <span className="material-symbols-outlined text-on-surface-variant mb-sm block" style={{ fontSize: 32, opacity: 0.3 }}>insights</span>
                <p className="text-body-md text-on-surface-variant">No citations yet.</p>
                <p className="text-body-sm text-on-surface-variant mt-xs opacity-60">
                  When AI fact-check traces match your articles, they'll appear here ranked by frequency.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/50">
                {stats.top_cited.map((item, i) => (
                  <div key={item.slug} className="flex items-center gap-md px-md py-sm row-animate" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary-fixed)' }}>
                      <span className="text-primary font-black" style={{ fontSize: 12 }}>#{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-body-sm text-on-surface font-medium truncate block">{item.slug.replace(/-/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-xs shrink-0">
                      <span className="text-label-md font-bold text-primary">{item.citations}</span>
                      <span className="text-body-sm text-on-surface-variant">citation{item.citations !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity summary */}
          {stats?.recent_activity?.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="px-md py-sm border-b border-outline-variant flex items-center gap-sm" style={{ background: 'var(--surface-container-low)' }}>
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>update</span>
                <span className="text-label-md font-bold text-on-surface">Recent Ingestion</span>
              </div>
              <div className="divide-y divide-outline-variant/50">
                {stats.recent_activity.map((a, i) => (
                  <div key={i} className="flex items-center gap-md px-md py-sm">
                    <span className="text-label-sm text-on-surface-variant font-medium" style={{ width: 80 }}>{a.method}</span>
                    <span className="text-body-sm text-primary font-bold">+{a.articles_imported}</span>
                    <span className="text-body-sm text-on-surface-variant ml-auto" style={{ fontSize: 11 }}>{getTimeAgo(new Date(a.created_at))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <ArticleUpload publisherId={id} publisherDomain={publisher.domain} onUploadComplete={loadArticles} />
      )}

      {tab === 'activity' && (
        <div className="glass-card overflow-hidden">
          <div className="px-md py-sm border-b border-outline-variant flex items-center justify-between" style={{ background: 'var(--surface-container-low)' }}>
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>history</span>
              <span className="text-label-md font-bold text-on-surface">Ingestion Activity</span>
            </div>
            <button onClick={loadActivity} className="text-label-sm text-on-surface-variant hover:text-primary flex items-center gap-xs">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
              Refresh
            </button>
          </div>

          {activityLog.length === 0 ? (
            <div className="p-xl text-center">
              <span className="material-symbols-outlined text-on-surface-variant mb-sm block" style={{ fontSize: 40, opacity: 0.3 }}>hourglass_empty</span>
              <p className="text-body-md text-on-surface-variant">No ingestion activity yet.</p>
              <p className="text-body-sm text-on-surface-variant mt-xs opacity-70">Activity will appear here as you ingest articles via any method.</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              {activityLog.map((entry, i) => {
                const methodIcons = {
                  'manual': 'edit_note',
                  'url': 'link',
                  'bulk-json': 'upload_file',
                  'bulk-url': 'link',
                  'rss': 'rss_feed',
                  'pull-api': 'download',
                  'push-api': 'cloud_upload',
                  'push-api-batch': 'cloud_upload',
                  'webhook': 'webhook',
                };
                const methodLabels = {
                  'manual': 'Manual Paste',
                  'url': 'URL Extract',
                  'bulk-json': 'Bulk JSON',
                  'bulk-url': 'Bulk URL',
                  'rss': 'RSS Poll',
                  'pull-api': 'Pull API',
                  'push-api': 'Push API',
                  'push-api-batch': 'Push API (Batch)',
                  'webhook': 'Webhook',
                };
                const total = (entry.articles_imported || 0) + (entry.articles_skipped || 0) + (entry.articles_failed || 0);
                const date = new Date(entry.created_at);
                const timeAgo = getTimeAgo(date);

                return (
                  <div key={entry.id} className="flex items-center gap-md px-md py-sm border-b border-outline-variant/50 last:border-0 row-animate" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary-fixed)' }}>
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>{methodIcons[entry.method] || 'sync'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-sm">
                        <span className="text-body-sm font-bold text-on-surface">{methodLabels[entry.method] || entry.method}</span>
                        {entry.articles_imported > 0 && (
                          <span className="px-xs py-px rounded text-primary font-bold" style={{ fontSize: 10, background: 'rgba(22, 163, 74, 0.1)' }}>
                            +{entry.articles_imported}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-md mt-xs">
                        <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>
                          {entry.articles_imported} imported
                          {entry.articles_skipped > 0 && ` · ${entry.articles_skipped} skipped`}
                          {entry.articles_failed > 0 && ` · ${entry.articles_failed} failed`}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>{timeAgo}</span>
                      <span className="text-body-sm text-on-surface-variant opacity-50" style={{ fontSize: 10 }}>{date.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'api' && (
        <ApiWebhookPanel publisherId={id} apiKey={publisher.api_key} onKeyChange={loadPublisher} />
      )}

      {tab === 'settings' && (
        <SettingsPanel publisher={publisher} onUpdate={loadPublisher} />
      )}
    </div>
  );
}
