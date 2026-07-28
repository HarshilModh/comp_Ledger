import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../lib/bedrock.js';
import { SCORE_PROMPT } from '../lib/prompts.js';

const MODEL_ID = process.env.SCORE_MODEL_ID || 'anthropic.claude-sonnet-4-20250514-v1:0';

export function computeExclusivityScore(independentSourceCount, fingerprintDetected) {
  const baseScore = Math.max(0.05, 1.0 / (1 + independentSourceCount * 0.8));
  const bonus = fingerprintDetected ? 0.15 : 0;
  return Math.min(1.0, Math.round((baseScore + bonus) * 100) / 100);
}

export async function scoreClaim(claimText, publisherHits, referenceHits) {
  const publisherCandidates = publisherHits
    .map((h, i) => `[${i + 1}] (${h.doc_id}, paragraph ${h.chunk_idx}): "${h.text}"`)
    .join('\n');

  const referenceCandidates = referenceHits
    .map((h, i) => `[${i + 1}] (${h.doc_id}): "${h.text}"`)
    .join('\n');

  const prompt = SCORE_PROMPT
    .replace('{claim_text}', claimText)
    .replace('{publisher_candidates}', publisherCandidates || 'No candidates found.')
    .replace('{reference_candidates}', referenceCandidates || 'No candidates found.');

  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));
  const text = result.content[0].text;

  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return {
      match: { found: false },
      exclusivity: { independent_source_count: 0, sources: [], reasoning: 'Scoring failed' },
      fingerprint: { detected: false },
    };
  }
}
