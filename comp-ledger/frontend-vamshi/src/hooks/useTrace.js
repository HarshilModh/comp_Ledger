import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export function useTrace() {
  const [claims, setClaims] = useState([]);
  const [status, setStatus] = useState('idle');
  const [total, setTotal] = useState(0);
  const { authHeaders } = useAuth();

  const startTrace = useCallback(async (question, answer, mode = 'audit') => {
    setClaims([]);
    setTotal(0);
    setStatus('streaming');

    try {
      const response = await fetch('/api/trace', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ question, answer, mode }),
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
              setClaims(prev =>
                [...prev, parsed].sort((a, b) => b.exclusivity_score - a.exclusivity_score)
              );
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
      setStatus('error');
    }
  }, [authHeaders]);

  const reset = useCallback(() => {
    setClaims([]);
    setStatus('idle');
    setTotal(0);
  }, []);

  return { claims, status, total, startTrace, reset };
}
