import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PublisherOnboard() {
  const navigate = useNavigate();
  const [publishers, setPublishers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    publication: '',
    domain: '',
    alt_domains: '',
    rss_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/publishers').then(r => r.json()).then(setPublishers).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const body = {
        name: form.name,
        email: form.email,
        publication: form.publication,
        domain: form.domain.toLowerCase(),
        alt_domains: form.alt_domains ? form.alt_domains.split(',').map(d => d.trim()).filter(Boolean) : [],
        rss_url: form.rss_url || null,
      };

      const res = await fetch('/api/publishers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.fieldErrors?.domain?.[0] || 'Registration failed');
      }

      const publisher = await res.json();
      setPublishers(prev => [publisher, ...prev]);
      setForm({ name: '', email: '', publication: '', domain: '', alt_domains: '', rss_url: '' });
      setShowForm(false);
      navigate(`/publisher/${publisher.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-headline-md font-black text-on-surface mb-xs">Publishers</h2>
          <p className="text-body-md text-on-surface-variant">
            Manage publications and their article corpus for AI attribution tracking.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-label-md flex items-center gap-sm"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cancel' : 'Add Publisher'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-lg">
          <div className="grid grid-cols-12 gap-md">
            <div className="col-span-6 flex flex-col gap-md">
              <div className="grid grid-cols-2 gap-md">
                <div className="flex flex-col gap-xs">
                  <label className="text-label-sm text-on-surface-variant">Contact Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                    className="input-field"
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="text-label-sm text-on-surface-variant">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                    className="input-field"
                    placeholder="jane@nytimes.com"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface-variant">Publication Name</label>
                <input
                  type="text"
                  value={form.publication}
                  onChange={e => setForm(f => ({ ...f, publication: e.target.value }))}
                  required
                  className="input-field"
                  placeholder="The New York Times"
                />
              </div>
            </div>
            <div className="col-span-6 flex flex-col gap-md">
              <div className="grid grid-cols-2 gap-md">
                <div className="flex flex-col gap-xs">
                  <label className="text-label-sm text-on-surface-variant">Primary Domain</label>
                  <input
                    type="text"
                    value={form.domain}
                    onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                    required
                    className="input-field"
                    placeholder="nytimes.com"
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="text-label-sm text-on-surface-variant">Alt Domains (comma-sep)</label>
                  <input
                    type="text"
                    value={form.alt_domains}
                    onChange={e => setForm(f => ({ ...f, alt_domains: e.target.value }))}
                    className="input-field"
                    placeholder="nyt.com, nyti.ms"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-xs">
                <label className="text-label-sm text-on-surface-variant">RSS Feed URL <span className="opacity-50">(optional)</span></label>
                <input
                  type="url"
                  value={form.rss_url}
                  onChange={e => setForm(f => ({ ...f, rss_url: e.target.value }))}
                  className="input-field"
                  placeholder="https://feeds.nytimes.com/nyt/rss/..."
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-sm px-md py-sm rounded-xl mt-md" style={{ background: 'var(--error-container)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--error)' }}>error</span>
              <span className="text-body-sm" style={{ color: 'var(--on-error-container)' }}>{error}</span>
            </div>
          )}

          <div className="flex justify-end mt-md">
            <button type="submit" disabled={loading} className="btn-primary text-label-md flex items-center gap-sm">
              {loading ? (
                <><span className="material-symbols-outlined live-pulse" style={{ fontSize: 16 }}>pending</span> Registering...</>
              ) : (
                <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span> Register Publisher</>
              )}
            </button>
          </div>
        </form>
      )}

      {publishers.length === 0 ? (
        <div className="glass-card p-xl text-center">
          <span className="material-symbols-outlined text-on-surface-variant mb-md block" style={{ fontSize: 48, opacity: 0.3 }}>newspaper</span>
          <p className="text-body-lg font-bold text-on-surface">No publishers registered yet</p>
          <p className="text-body-md text-on-surface-variant mt-xs">Add your first publisher to start building a content corpus for attribution.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {publishers.map((pub, i) => (
            <div
              key={pub.id}
              className="glass-card overflow-hidden hover:shadow-lg transition-all cursor-pointer group row-animate"
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => navigate(`/publisher/${pub.id}`)}
            >
              <div className="p-md flex flex-col gap-sm">
                <div className="flex items-start gap-md">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--primary-fixed)' }}>
                    <span className="text-primary font-black" style={{ fontSize: 13 }}>
                      {pub.publication.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md font-bold text-on-surface truncate group-hover:text-primary transition-colors">{pub.publication}</p>
                    <p className="text-body-sm text-on-surface-variant">{pub.domain}</p>
                  </div>
                </div>

                <div className="flex items-center gap-xs flex-wrap mt-xs">
                  {pub.rss_url && (
                    <span className="inline-flex items-center gap-xs px-sm py-px rounded-full text-on-surface-variant" style={{ fontSize: 11, background: 'var(--surface-container)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>rss_feed</span> RSS
                    </span>
                  )}
                  {pub.api_key && (
                    <span className="inline-flex items-center gap-xs px-sm py-px rounded-full text-on-surface-variant" style={{ fontSize: 11, background: 'var(--surface-container)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>key</span> API
                    </span>
                  )}
                  {pub.pull_config && (
                    <span className="inline-flex items-center gap-xs px-sm py-px rounded-full text-on-surface-variant" style={{ fontSize: 11, background: 'var(--surface-container)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>download</span> Pull
                    </span>
                  )}
                  {pub.alt_domains?.length > 0 && (
                    <span className="inline-flex items-center gap-xs px-sm py-px rounded-full text-on-surface-variant" style={{ fontSize: 11, background: 'var(--surface-container)' }}>
                      +{pub.alt_domains.length} domains
                    </span>
                  )}
                </div>
              </div>

              <div className="px-md py-xs border-t border-outline-variant/50 flex items-center justify-between" style={{ background: 'var(--surface-container-lowest)' }}>
                <span className="text-body-sm text-on-surface-variant" style={{ fontSize: 11 }}>
                  Registered {new Date(pub.created_at).toLocaleDateString()}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" style={{ fontSize: 16 }}>arrow_forward</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
