import { GoogleGenerativeAI, type Part, SchemaType } from '@google/generative-ai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';
import { SemanticOutputSchema } from './types.js';

const MODEL_TEXT = 'gemini-2.5-pro';
const MODEL_VISION = 'gemini-2.5-pro';

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Convert a Zod schema to the response_schema format Gemini expects.
 * Gemini requires the root schema to be of type OBJECT.
 */
function toGeminiSchema(zodSchema: ZodTypeAny) {
  // Generate OpenAPI3 JSON schema from Zod first.
  const jsonSchema = zodToJsonSchema(zodSchema, { target: 'openApi3' }) as Record<string, unknown>;
  return sanitizeForGeminiResponseSchema(jsonSchema);
}

/**
 * Gemini responseSchema only supports a subset of OpenAPI/JSON Schema fields.
 * Strip unsupported fields (notably additionalProperties) recursively.
 */
function sanitizeForGeminiResponseSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeForGeminiResponseSchema);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(obj)) {
      if (
        key === '$schema' ||
        key === 'additionalProperties' ||
        key === 'unevaluatedProperties' ||
        key === 'patternProperties'
      ) {
        continue;
      }
      out[key] = sanitizeForGeminiResponseSchema(child);
    }
    return out;
  }
  return value;
}

// ─── Text semantic extraction ─────────────────────────────────────────────────

const TEXT_SYSTEM_PROMPT = `You are a document metadata extraction expert. Your job is to analyze the content of a document and extract structured metadata from it.

Be thorough when extracting spatio-temporal information — look for any mentions of dates, time periods, locations, and events. For personal documents like resumes or diaries, extract the full life timeline if present.

For entities that you are uncertain about (ambiguous names, unknown organizations, unclear place names), mark them in web_search_needed so they can be verified.`;

export async function extractTextSemantics(
  text: string,
  fileName: string,
): Promise<typeof SemanticOutputSchema._type> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_TEXT,
    systemInstruction: TEXT_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(SemanticOutputSchema) as never,
    },
  });

  // Truncate to ~32k characters to stay within context limits
  const truncatedText = text.length > 32000 ? text.slice(0, 32000) + '\n[... content truncated ...]' : text;

  const prompt = `File name: ${fileName}\n\nDocument content:\n\n${truncatedText}`;
  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  return SemanticOutputSchema.parse(JSON.parse(raw));
}

// ─── Image semantic extraction ────────────────────────────────────────────────

const IMAGE_SYSTEM_PROMPT = `You are an image metadata extraction expert. Your job is to analyze images and extract structured metadata.

For photos, describe what you see: people count, setting, mood, and any identifiable locations or objects. If you can infer a location from visual cues (landmarks, signs, scenery), include it in spatiotemporal with an appropriate confidence score.

If the image contains text (via OCR), use that text to enrich the metadata — especially for documents, certificates, or images with visible text content.

For entities that you are uncertain about, mark them in web_search_needed.`;

export interface ImageSemanticInput {
  imagePath: string;
  mimeType: string;
  fileName: string;
  exifContext?: string;  // Optional: pre-extracted EXIF info as text hint
  ocrText?: string;      // Optional: OCR-extracted text from the image
}

export async function extractImageSemantics(
  input: ImageSemanticInput,
): Promise<typeof SemanticOutputSchema._type> {
  const { imagePath, mimeType, fileName, exifContext, ocrText } = input;

  const { readFileSync } = await import('fs');
  const imageData = readFileSync(imagePath).toString('base64');

  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_VISION,
    systemInstruction: IMAGE_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(SemanticOutputSchema) as never,
    },
  });

  const parts: Part[] = [
    { inlineData: { mimeType, data: imageData } },
  ];

  let textHint = `File name: ${fileName}\n`;
  if (exifContext) textHint += `\nEXIF metadata:\n${exifContext}\n`;
  if (ocrText) textHint += `\nText extracted from image (OCR):\n${ocrText}\n`;
  textHint += '\nPlease analyze this image and extract the metadata.';

  parts.push({ text: textHint });

  const result = await model.generateContent(parts);
  const raw = result.response.text();

  return SemanticOutputSchema.parse(JSON.parse(raw));
}
