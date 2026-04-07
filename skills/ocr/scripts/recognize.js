#!/usr/bin/env node
/**
 * ocr skill script
 * Extracts text from images using DeepSeek vision model.
 * Supports online (DeepSeek API) and local (Ollama) providers.
 *
 * Usage: node recognize.js "<image-path>" [--provider=online|local]
 * Output: JSON to stdout
 *
 * Environment variables:
 *   DEEPSEEK_API_KEY   - required for online provider
 *   OLLAMA_BASE_URL    - optional, default http://localhost:11434
 *   OCR_PROVIDER       - fallback provider if --provider not given
 */

import { readFileSync } from 'fs';
import { resolve, extname } from 'path';

const filePath = process.argv[2];
const providerArg = process.argv.find((a) => a.startsWith('--provider='));
const provider = providerArg?.split('=')[1] ?? process.env.OCR_PROVIDER ?? 'online';

if (!filePath) {
  console.error(JSON.stringify({ error: 'Usage: node recognize.js "<image-path>" [--provider=online|local]' }));
  process.exit(1);
}

const absolutePath = resolve(filePath);
const ext = extname(absolutePath).toLowerCase().replace('.', '');
const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', webp: 'image/webp' };
const mimeType = mimeMap[ext] ?? 'image/jpeg';

const imageData = readFileSync(absolutePath);
const base64Image = imageData.toString('base64');

const OCR_PROMPT = 'Please extract ALL text visible in this image. Return only the extracted text, preserving the original layout as much as possible. If there is no text in the image, return an empty string.';

async function recognizeOnline() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY environment variable is not set');

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-vl2',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            { type: 'text', text: OCR_PROMPT },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

async function recognizeLocal() {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-vl2:7b',
      stream: false,
      messages: [
        {
          role: 'user',
          content: OCR_PROMPT,
          images: [base64Image],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.message?.content?.trim() ?? '';
}

(async () => {
  try {
    const text = provider === 'local' ? await recognizeLocal() : await recognizeOnline();
    console.log(JSON.stringify({ provider, text, confidence: 'high' }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
})();
