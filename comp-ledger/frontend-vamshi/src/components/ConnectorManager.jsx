import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * ConnectorManager component — allows publishers to configure external API
 * connectors that pull articles from their content systems (NYT API, WaPo API, etc.).
 *
 * Features:
 *   - Create new connectors with URL, auth, pagination, and field mapping config
 *   - Test connections before triggering a full sync
 *   - Trigger sync to bulk-ingest articles from publisher's API
 *   - Monitor sync progress and history
 *   - Delete connectors when no longer needed
 */
export default function ConnectorManager() {
  const { authHeaders } = useAuth();

  // List of connectors for this publisher
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state for the create form
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState(null); // connectorId being tested
  const [syncing, setSyncing] = useState(null); // connectorId being synced
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Sync job polling
  const [activeJobs, setActiveJobs] = useState({}); // connectorId -> job info

  // Form state for creating a new connector
  const [form, setForm] = useState({
    name: '',
    base_url: '',
    auth_type: 'API_KEY',
    auth_header: '',
    auth_value: '',
    list_endpoint: '',
    detail_endpoint: '',
    articles_json_path: '',
    pagination_type: 'PAGE',
    cursor_json_path: '',
    cursor_param: '',
    page_size: 50,
    max_articles: 0,
    field_title: '',
    field_body: '',
    field_url: '',
    field_id: '',
  });

  /** Fetches the list of connectors from the backend */
  const fetchConnectors = useCallback(async () => {
    try {
      const res = await fetch('/api/connectors', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConnectors(data.connectors || []);
      }
    } catch (e) {
      console.error('Failed to fetch connectors', e);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchConnectors(); }, [fetchConnectors]);

  /** Polls an active sync job for progress updates */
  useEffect(() => {
    const interval = setInterval(async () => {
      const jobEntries = Object.entries(activeJobs);
      if (jobEntries.length === 0) return;

      for (const [connectorId, jobInfo] of jobEntries) {
        try {
          const res = await fetch(`/api/connectors/${connectorId}/jobs/${jobInfo.id}`, {
            headers: authHeaders()
          });
          if (res.ok) {
            const job = await res.json();
            if (job.status === 'COMPLETED' || job.status === 'FAILED') {
              // Job finished — remove from active jobs and refresh connector list
              setActiveJobs(prev => {
                const next = { ...prev };
                delete next[connectorId];
                return next;
              });
              fetchConnectors();
              if (job.status === 'COMPLETED') {
                setSuccess(`Sync complete: ${job.articles_ingested} articles ingested`);
              } else {
                setError(`Sync failed: ${job.error_message}`);
              }
            } else {
              // Still running — update progress
              setActiveJobs(prev => ({ ...prev, [connectorId]: job }));
            }
          }
        } catch (e) {
          console.error('Error polling job status', e);
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [activeJobs, authHeaders, fetchConnectors]);

  /** Creates a new connector from the form state */
  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate required fields
    if (!form.name.trim() || !form.base_url.trim() || !form.list_endpoint.trim()) {
      setError('Name, base URL, and list endpoint are required.');
      return;
    }
    if (!form.field_title.trim() || !form.field_body.trim()) {
      setError('Field mappings for title and body are required.');
      return;
    }

    // Build the request body with field mappings restructured
    const body = {
      name: form.name.trim(),
      base_url: form.base_url.trim(),
      auth_type: form.auth_type,
      auth_header: form.auth_header.trim() || null,
      auth_value: form.auth_value.trim() || null,
      list_endpoint: form.list_endpoint.trim(),
      detail_endpoint: form.detail_endpoint.trim() || null,
      articles_json_path: form.articles_json_path.trim() || null,
      pagination_type: form.pagination_type,
      cursor_json_path: form.cursor_json_path.trim() || null,
      cursor_param: form.cursor_param.trim() || null,
      page_size: form.page_size || 50,
      max_articles: form.max_articles || 0,
      field_mappings: {
        title: form.field_title.trim(),
        body: form.field_body.trim(),
        url: form.field_url.trim() || undefined,
        id: form.field_id.trim() || undefined,
      }
    };

    try {
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create connector');
        return;
      }
      setSuccess(`Connector "${data.name}" created successfully.`);
      setShowForm(false);
      resetForm();
      fetchConnectors();
    } catch (e) {
      setError('Network error: ' + e.message);
    }
  };

  /** Tests a connector's configuration */
  const handleTest = async (connectorId) => {
    setTesting(connectorId);
    setTestResult(null);
    try {
      const res = await fetch(`/api/connectors/${connectorId}/test`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      setTestResult({ connectorId, ...data });
    } catch (e) {
      setTestResult({ connectorId, success: false, message: 'Network error: ' + e.message });
    } finally {
      setTesting(null);
    }
  };

  /** Triggers a sync for a connector */
  const handleSync = async (connectorId) => {
    setSyncing(connectorId);
    setError(null);
    try {
      const res = await fetch(`/api/connectors/${connectorId}/sync`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to start sync');
        return;
      }
      // Start polling this job for progress
      setActiveJobs(prev => ({
        ...prev,
        [connectorId]: { id: data.job_id, status: 'RUNNING', progress_message: 'Starting...' }
      }));
      setSuccess('Sync started! Monitoring progress...');
    } catch (e) {
      setError('Network error: ' + e.message);
    } finally {
      setSyncing(null);
    }
  };

  /** Deletes a connector after confirmation */
  const handleDelete = async (connectorId, connectorName) => {
    if (!confirm(`Delete connector "${connectorName}"? Sync history will be lost. Already-ingested articles are preserved.`)) return;
    try {
      const res = await fetch(`/api/connectors/${connectorId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        setConnectors(prev => prev.filter(c => c.id !== connectorId));
        setSuccess(`"${connectorName}" deleted.`);
      }
    } catch (e) {
      setError('Delete failed: ' + e.message);
    }
  };

  /** Resets the form to default values */
  const resetForm = () => {
    setForm({
      name: '', base_url: '', auth_type: 'API_KEY', auth_header: '', auth_value: '',
      list_endpoint: '', detail_endpoint: '', articles_json_path: '',
      pagination_type: 'PAGE', cursor_json_path: '', cursor_param: '',
      page_size: 50, max_articles: 0, field_title: '', field_body: '', field_url: '', field_id: '',
    });
  };

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-md">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>cable</span>
          <div>
            <h2 className="text-headline-sm font-black text-on-surface">API Connectors</h2>
            <p className="text-body-sm text-on-surface-variant">Connect to your content API to bulk-ingest articles automatically</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-label-md flex items-center gap-sm"
          style={{ padding: '8px 16px' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cancel' : 'New Connector'}
        </button>
      </div>

      {/* Alert messages */}
      {error && (
        <Alert type="error" message={error} onDismiss={() => setError(null)} />
      )}
      {success && (
        <Alert type="success" message={success} onDismiss={() => setSuccess(null)} />
      )}

      {/* Create Form */}
      {showForm && (
        <div className="glass-card p-lg">
          <h3 className="text-title-md font-bold text-on-surface mb-md">Configure API Connection</h3>
          <form onSubmit={handleCreate} className="flex flex-col gap-md">
            {/* Basic info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <FormField label="Connector Name *" placeholder="e.g. NYT Archive API" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
              <FormField label="Base URL *" placeholder="https://api.nytimes.com/svc" value={form.base_url} onChange={v => setForm(f => ({ ...f, base_url: v }))} />
            </div>

            {/* Authentication */}
            <fieldset className="rounded-xl p-md" style={{ border: '1px solid var(--outline-variant)' }}>
              <legend className="text-label-md font-bold text-on-surface-variant px-sm">Authentication</legend>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                <div>
                  <label className="text-label-sm text-on-surface-variant block mb-xs">Auth Type</label>
                  <select
                    value={form.auth_type}
                    onChange={e => setForm(f => ({ ...f, auth_type: e.target.value }))}
                    className="w-full px-md py-sm rounded-xl text-body-md text-on-surface"
                    style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)' }}
                  >
                    <option value="API_KEY">API Key</option>
                    <option value="BEARER">Bearer Token</option>
                    <option value="BASIC">Basic Auth</option>
                    <option value="NONE">None</option>
                  </select>
                </div>
                {form.auth_type !== 'NONE' && (
                  <>
                    <FormField
                      label={form.auth_type === 'API_KEY' ? 'Header Name' : 'N/A'}
                      placeholder={form.auth_type === 'API_KEY' ? 'api-key' : 'Authorization'}
                      value={form.auth_header}
                      onChange={v => setForm(f => ({ ...f, auth_header: v }))}
                      disabled={form.auth_type !== 'API_KEY'}
                    />
                    <FormField
                      label={form.auth_type === 'BASIC' ? 'username:password' : 'API Key / Token'}
                      placeholder="your-secret-key"
                      value={form.auth_value}
                      onChange={v => setForm(f => ({ ...f, auth_value: v }))}
                      type="password"
                    />
                  </>
                )}
              </div>
            </fieldset>

            {/* Endpoints */}
            <fieldset className="rounded-xl p-md" style={{ border: '1px solid var(--outline-variant)' }}>
              <legend className="text-label-md font-bold text-on-surface-variant px-sm">Endpoints</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <FormField label="List Endpoint *" placeholder="/v2/articles?page={page}" value={form.list_endpoint} onChange={v => setForm(f => ({ ...f, list_endpoint: v }))} hint="Supports: {page}, {offset}, {pageSize}" />
                <FormField label="Detail Endpoint (optional)" placeholder="/v2/articles/{articleId}" value={form.detail_endpoint} onChange={v => setForm(f => ({ ...f, detail_endpoint: v }))} hint="If list doesn't return full body" />
                <FormField label="Articles JSON Path" placeholder="response.docs" value={form.articles_json_path} onChange={v => setForm(f => ({ ...f, articles_json_path: v }))} hint="Dot-path to the array in response" />
              </div>
            </fieldset>

            {/* Pagination */}
            <fieldset className="rounded-xl p-md" style={{ border: '1px solid var(--outline-variant)' }}>
              <legend className="text-label-md font-bold text-on-surface-variant px-sm">Pagination</legend>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
                <div>
                  <label className="text-label-sm text-on-surface-variant block mb-xs">Type</label>
                  <select
                    value={form.pagination_type}
                    onChange={e => setForm(f => ({ ...f, pagination_type: e.target.value }))}
                    className="w-full px-md py-sm rounded-xl text-body-md text-on-surface"
                    style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)' }}
                  >
                    <option value="PAGE">Page Number</option>
                    <option value="OFFSET">Offset</option>
                    <option value="CURSOR">Cursor</option>
                    <option value="NONE">None (single page)</option>
                  </select>
                </div>
                <FormField label="Page Size" type="number" value={form.page_size} onChange={v => setForm(f => ({ ...f, page_size: parseInt(v) || 50 }))} />
                <FormField label="Max Articles (0=all)" type="number" value={form.max_articles} onChange={v => setForm(f => ({ ...f, max_articles: parseInt(v) || 0 }))} />
                {form.pagination_type === 'CURSOR' && (
                  <>
                    <FormField label="Cursor JSON Path" placeholder="meta.next_cursor" value={form.cursor_json_path} onChange={v => setForm(f => ({ ...f, cursor_json_path: v }))} />
                    <FormField label="Cursor Param" placeholder="cursor" value={form.cursor_param} onChange={v => setForm(f => ({ ...f, cursor_param: v }))} />
                  </>
                )}
              </div>
            </fieldset>

            {/* Field Mappings */}
            <fieldset className="rounded-xl p-md" style={{ border: '1px solid var(--outline-variant)' }}>
              <legend className="text-label-md font-bold text-on-surface-variant px-sm">Field Mappings (dot-notation JSON paths)</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <FormField label="Title Path *" placeholder="headline.main" value={form.field_title} onChange={v => setForm(f => ({ ...f, field_title: v }))} hint="Path to article title in response" />
                <FormField label="Body Path *" placeholder="full_text" value={form.field_body} onChange={v => setForm(f => ({ ...f, field_body: v }))} hint="Path to full article text" />
                <FormField label="URL Path" placeholder="web_url" value={form.field_url} onChange={v => setForm(f => ({ ...f, field_url: v }))} hint="Path to article URL (optional)" />
                <FormField label="ID Path" placeholder="_id" value={form.field_id} onChange={v => setForm(f => ({ ...f, field_id: v }))} hint="Used for detail endpoint {articleId}" />
              </div>
            </fieldset>

            <div className="flex justify-end gap-md">
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="btn-ghost text-label-md">Cancel</button>
              <button type="submit" className="btn-primary text-label-md flex items-center gap-sm">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                Create Connector
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Connectors List */}
      {loading ? (
        <div className="flex items-center justify-center py-xl">
          <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 24 }}>progress_activity</span>
        </div>
      ) : connectors.length === 0 && !showForm ? (
        <div className="glass-card p-xl flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-on-surface-variant mb-md" style={{ fontSize: 56, opacity: 0.3 }}>cloud_download</span>
          <h3 className="text-title-md font-bold text-on-surface mb-xs">No API Connectors</h3>
          <p className="text-body-md text-on-surface-variant mb-md">
            Connect your content API to automatically pull and index all your articles.
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-label-md flex items-center gap-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Configure Your First Connector
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {connectors.map(connector => (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              onTest={() => handleTest(connector.id)}
              onSync={() => handleSync(connector.id)}
              onDelete={() => handleDelete(connector.id, connector.name)}
              testing={testing === connector.id}
              syncing={syncing === connector.id || connector.status === 'SYNCING'}
              testResult={testResult?.connectorId === connector.id ? testResult : null}
              activeJob={activeJobs[connector.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ConnectorCard — displays a single connector's status and controls.
 * Shows sync status, last sync info, and action buttons (test, sync, delete).
 */
function ConnectorCard({ connector, onTest, onSync, onDelete, testing, syncing, testResult, activeJob }) {
  // Determine the status indicator color
  const statusColors = {
    ACTIVE: 'var(--primary)',
    SYNCING: '#f59e0b',
    ERROR: 'var(--error, #ef4444)',
    PAUSED: 'var(--outline-variant)',
  };
  const statusColor = statusColors[connector.status] || 'var(--outline-variant)';

  return (
    <div className="glass-card p-md">
      <div className="flex items-start gap-md">
        {/* Status indicator */}
        <div className="shrink-0 mt-xs">
          <div className="w-3 h-3 rounded-full" style={{ background: statusColor }} />
        </div>

        {/* Connector info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm mb-xs">
            <h4 className="text-title-sm font-bold text-on-surface">{connector.name}</h4>
            <span className="text-label-sm px-sm py-xs rounded-lg" style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>
              {connector.auth_type}
            </span>
            <span className="text-label-sm px-sm py-xs rounded-lg" style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>
              {connector.pagination_type}
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant truncate">{connector.base_url}{connector.list_endpoint}</p>

          {/* Last sync info */}
          <div className="flex items-center gap-md mt-sm flex-wrap">
            {connector.last_sync_at && (
              <span className="text-label-sm text-on-surface-variant flex items-center gap-xs">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>schedule</span>
                Last sync: {new Date(connector.last_sync_at).toLocaleString()}
              </span>
            )}
            {connector.last_sync_count > 0 && (
              <span className="text-label-sm text-on-surface-variant flex items-center gap-xs">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>article</span>
                {connector.last_sync_count} articles
              </span>
            )}
            {connector.last_error && (
              <span className="text-label-sm flex items-center gap-xs" style={{ color: 'var(--error, #ef4444)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>
                {connector.last_error.substring(0, 60)}
              </span>
            )}
          </div>

          {/* Active job progress */}
          {activeJob && (
            <div className="mt-sm px-sm py-xs rounded-lg flex items-center gap-sm" style={{ background: 'var(--surface-container-high)' }}>
              <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 14 }}>progress_activity</span>
              <span className="text-label-sm text-on-surface">
                {activeJob.progress_message || `Ingested: ${activeJob.articles_ingested || 0} | Skipped: ${activeJob.articles_skipped || 0}`}
              </span>
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div className="mt-sm px-sm py-xs rounded-lg flex items-center gap-sm" style={{
              background: testResult.success ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${testResult.success ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: testResult.success ? '#4ade80' : '#ef4444' }}>
                {testResult.success ? 'check_circle' : 'cancel'}
              </span>
              <span className="text-label-sm text-on-surface">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-xs shrink-0">
          <button
            onClick={onTest}
            disabled={testing}
            className="px-sm py-xs rounded-lg text-label-sm flex items-center gap-xs hover:bg-surface-container-high transition-all"
            title="Test connection"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{testing ? 'progress_activity' : 'wifi_tethering'}</span>
            Test
          </button>
          <button
            onClick={onSync}
            disabled={syncing}
            className="px-sm py-xs rounded-lg text-label-sm flex items-center gap-xs hover:bg-surface-container-high transition-all text-primary"
            title="Start sync"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{syncing ? 'progress_activity' : 'sync'}</span>
            Sync
          </button>
          <button
            onClick={onDelete}
            className="px-sm py-xs rounded-lg text-label-sm flex items-center gap-xs hover:bg-surface-container-high transition-all"
            title="Delete connector"
            style={{ color: 'var(--error, #ef4444)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Reusable form field component */
function FormField({ label, placeholder, value, onChange, type = 'text', hint, disabled }) {
  return (
    <div>
      <label className="text-label-sm text-on-surface-variant block mb-xs">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-md py-sm rounded-xl text-body-md text-on-surface transition-all"
        style={{ background: 'var(--surface-container)', border: '1px solid var(--outline-variant)', opacity: disabled ? 0.5 : 1 }}
      />
      {hint && <p className="text-label-sm text-on-surface-variant opacity-60 mt-xs">{hint}</p>}
    </div>
  );
}

/** Alert component for error/success messages */
function Alert({ type, message, onDismiss }) {
  const isError = type === 'error';
  return (
    <div className="glass-card px-md py-sm flex items-center gap-sm" style={{ borderLeft: `3px solid ${isError ? 'var(--error, #ef4444)' : 'var(--primary)'}` }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18, color: isError ? 'var(--error, #ef4444)' : 'var(--primary)' }}>
        {isError ? 'error' : 'check_circle'}
      </span>
      <span className={`text-body-md ${isError ? '' : 'text-on-surface'}`} style={isError ? { color: 'var(--error, #ef4444)' } : {}}>
        {message}
      </span>
      <button onClick={onDismiss} className="ml-auto text-on-surface-variant hover:text-on-surface">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
      </button>
    </div>
  );
}
