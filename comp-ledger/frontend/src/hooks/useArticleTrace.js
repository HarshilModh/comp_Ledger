import { useState, useCallback } from 'react';

export function useArticleTrace() {
  const [claims, setClaims] = useState([]);
  const [status, setStatus] = useState('idle');
  const [total, setTotal] = useState(0);

  const startTrace = useCallback(async (articleText, publisherName) => {
    setClaims([]);
    setTotal(0);
    setStatus('streaming');

    try {
      const response = await fetch('/api/article-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_text: articleText, publisher_name: publisherName }),
      });

      if (!response.ok) {
        setStatus('error');
        return;
      }

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
          const eventMatch = block.match(/^event:\s*(.+)\ndata:\s*(.+)$/ms);
          if (!eventMatch) continue;
          const [, eventType, data] = eventMatch;

          try {
            const parsed = JSON.parse(data);
            if (eventType === 'claims_count') {
              setTotal(parsed.total);
            } else if (eventType === 'claim_scored') {
              setClaims(prev => [...prev, parsed]);
            } else if (eventType === 'done') {
              setStatus('done');
            } else if (eventType === 'error') {
              setStatus('error');
            }
          } catch (_) {}
        }
      }

      setStatus(prev => prev === 'streaming' ? 'done' : prev);
    } catch (err) {
      console.error('[useArticleTrace] fetch failed:', err);
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setClaims([]);
    setStatus('idle');
    setTotal(0);
  }, []);

  return { claims, status, total, startTrace, reset };
}
