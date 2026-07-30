import { useState, useCallback } from 'react';

export function useDeepTrace() {
  const [claims, setClaims] = useState([]);
  const [status, setStatus] = useState('idle');
  const [total, setTotal] = useState(0);
  const [researchSources, setResearchSources] = useState({});

  const startTrace = useCallback(async (question, answer, publisherId) => {
    setClaims([]);
    setTotal(0);
    setStatus('streaming');
    setResearchSources({});

    try {
      const response = await fetch('/api/deep-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer, publisher_id: publisherId }),
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

          let eventType = '';
          let dataStr = '';

          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataStr += line.slice(5).trim();
            }
          }

          if (!eventType || !dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);

            if (eventType === 'claims_count') {
              setTotal(parsed.total);
            } else if (eventType === 'research_start') {
              setResearchSources(prev => ({
                ...prev,
                [parsed.claim_id]: { sources: [], domain: parsed.publisher_domain },
              }));
            } else if (eventType === 'research_source') {
              setResearchSources(prev => ({
                ...prev,
                [parsed.claim_id]: {
                  ...prev[parsed.claim_id],
                  sources: [...(prev[parsed.claim_id]?.sources || []), parsed.source],
                },
              }));
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
  }, []);

  const reset = useCallback(() => {
    setClaims([]);
    setStatus('idle');
    setTotal(0);
    setResearchSources({});
  }, []);

  return { claims, status, total, researchSources, startTrace, reset };
}
