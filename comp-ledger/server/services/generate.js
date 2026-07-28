import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../lib/bedrock.js';

export const AVAILABLE_MODELS = [
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
  { id: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4' },
  { id: 'us.amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
  { id: 'us.amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
  { id: 'us.meta.llama3-1-8b-instruct-v1:0', label: 'Llama 3.1 8B' },
];

const PROMPT = (question) =>
  `Answer the following question with specific, factual details in 3-6 sentences. Include any known figures, dates, names, or amounts.\n\nQuestion: ${question}`;

export async function generateAnswer(question, modelId) {
  let body;

  const isAnthropic = modelId.includes('anthropic.');
  const isNova = modelId.includes('amazon.nova');
  const isLlama = modelId.includes('meta.llama');
  const isMistral = modelId.includes('mistral.');

  if (isAnthropic) {
    body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [{ role: 'user', content: PROMPT(question) }],
    };
  } else if (isNova) {
    body = {
      messages: [{ role: 'user', content: [{ text: PROMPT(question) }] }],
      inferenceConfig: { maxTokens: 1024 },
    };
  } else if (isLlama) {
    body = {
      prompt: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n${PROMPT(question)}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n`,
      max_gen_len: 512,
      temperature: 0.5,
    };
  } else if (isMistral) {
    body = {
      prompt: `<s>[INST] ${PROMPT(question)} [/INST]`,
      max_tokens: 512,
      temperature: 0.5,
    };
  } else {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(body),
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));

  if (isAnthropic) return result.content[0].text.trim();
  if (isNova) return (result.output?.message?.content?.[0]?.text || '').trim();
  if (isLlama) return (result.generation || '').trim();
  if (isMistral) return (result.outputs?.[0]?.text || '').trim();
  return '';
}
