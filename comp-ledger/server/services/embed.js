import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../lib/bedrock.js';

const MODEL_ID = process.env.EMBED_MODEL_ID || 'amazon.titan-embed-text-v2:0';

export async function embedText(text) {
  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text.slice(0, 8000),
      dimensions: 512,
      normalize: true,
    }),
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.embedding;
}

export async function embedBatch(texts) {
  const results = [];
  const BATCH_SIZE = 10;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await Promise.all(batch.map(embedText));
    results.push(...embeddings);
  }
  return results;
}
