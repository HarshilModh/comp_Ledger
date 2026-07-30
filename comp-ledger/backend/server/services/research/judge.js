import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../../lib/bedrock.js';
import { RESEARCH_JUDGE_PROMPT } from '../../lib/prompts.js';

const MODEL_ID = process.env.RESEARCH_JUDGE_MODEL_ID ||
                 process.env.SCORE_MODEL_ID ||
                 'anthropic.claude-sonnet-4-20250514-v1:0';

export async function judgeEvidence(claim, publisher, sources, waybackResults) {
  const formattedSources = sources.length > 0
    ? sources.map((s, i) =>
        `[${i + 1}] ${s.sourceType} | ${s.domain} | ${s.publishedAt || 'date unknown'}\n    Title: ${s.title}\n    URL: ${s.url}\n    Snippet: ${s.snippet}`
      ).join('\n\n')
    : 'No sources found.';

  const waybackEvidence = waybackResults.length > 0
    ? waybackResults.map(w =>
        `URL: ${w.url}\n  First archived: ${w.archivedAt}\n  Wayback: ${w.waybackUrl}`
      ).join('\n')
    : 'No Wayback results.';

  const prompt = RESEARCH_JUDGE_PROMPT
    .replace('{claim_text}', claim)
    .replace('{publication}', publisher.publication)
    .replace('{domain}', publisher.domain)
    .replace('{formatted_sources}', formattedSources)
    .replace('{wayback_evidence}', waybackEvidence);

  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));
  const text = result.content[0].text;

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return {
      verdict: 'INSUFFICIENT_DATA',
      confidence: 0,
      reasoning: 'Failed to parse judge response',
      temporal_priority: false,
      earliest_publisher_date: null,
      publisher_url: null,
      alternative_sources_count: 0,
    };
  }
}
