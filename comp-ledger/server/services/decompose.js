import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../lib/bedrock.js';
import { DECOMPOSE_PROMPT } from '../lib/prompts.js';

const MODEL_ID = process.env.DECOMPOSE_MODEL_ID || 'anthropic.claude-haiku-4-5-20251001-v1:0';

export async function decompose(question, answer) {
  const prompt = DECOMPOSE_PROMPT
    .replace('{question}', question)
    .replace('{answer}', answer);

  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));
  const text = result.content[0].text;

  try {
    const claims = JSON.parse(text);
    if (!Array.isArray(claims)) throw new Error('Not an array');
    return claims.map((c, i) => ({
      id: c.id || i + 1,
      text: c.text,
    }));
  } catch (e) {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const claims = JSON.parse(match[0]);
      return claims.map((c, i) => ({
        id: c.id || i + 1,
        text: c.text,
      }));
    }
    throw new Error(`Failed to parse claims: ${e.message}`);
  }
}
