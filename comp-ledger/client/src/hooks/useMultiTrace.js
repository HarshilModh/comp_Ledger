import { useState, useCallback } from 'react';

export function useMultiTrace() {
  const [models, setModels] = useState([]);
  const [results, setResults] = useState({}); // { modelId: { status, answer, claims } }
  const [status, setStatus] = useState('idle');

  const startMultiTrace = useCallback(async (question, modelIds) => {
    setModels([]);
    setResults({});
    setStatus('streaming');

    try {
      const response = await fetch('/api/multi-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, modelIds }),
      });

      if (!response.ok) { setStatus('error'); return; }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const block of parts) {
          if (!block.trim()) continue;
          const m = block.match(/^event:\s*(.+)\ndata:\s*(.+)$/ms);
          if (!m) continue;
          const [, type, raw] = m;

          try {
            const data = JSON.parse(raw);

            if (type === 'models') {
              setModels(data.models);
              setResults(Object.fromEntries(data.models.map(m => [m.id, { status: 'waiting', answer: null, claims: [] }])));
            } else if (type === 'model_start') {
              setResults(prev => ({ ...prev, [data.modelId]: { ...prev[data.modelId], status: 'generating' } }));
            } else if (type === 'model_answer') {
              setResults(prev => ({ ...prev, [data.modelId]: { ...prev[data.modelId], status: 'tracing', answer: data.answer } }));
            } else if (type === 'model_done') {
              setResults(prev => ({
                ...prev,
                [data.modelId]: { ...prev[data.modelId], status: 'done', claims: data.claims },
              }));
            } else if (type === 'model_error') {
              setResults(prev => ({ ...prev, [data.modelId]: { ...prev[data.modelId], status: 'error', error: data.error } }));
            } else if (type === 'done') {
              setStatus('done');
            }
          } catch (_) {}
        }
      }

      setStatus(prev => prev === 'streaming' ? 'done' : prev);
    } catch (_) {
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setModels([]);
    setResults({});
    setStatus('idle');
  }, []);

  return { models, results, status, startMultiTrace, reset };
}
