import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';
import {
  ClaimExtractionOutputSchema,
  ConflictResolutionOutputSchema,
  type ClaimExtractionOutput,
  type ConflictResolutionOutput,
} from './types.js';
import { PROFILE_CLAIM_SYSTEM_PROMPT, PROFILE_CONFLICT_SYSTEM_PROMPT } from './prompts.js';

const MODEL = 'gemini-2.5-pro';

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
  return new GoogleGenerativeAI(apiKey);
}

function sanitizeForGeminiResponseSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForGeminiResponseSchema);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
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

function toGeminiSchema(zodSchema: ZodTypeAny): unknown {
  const jsonSchema = zodToJsonSchema(zodSchema, { target: 'openApi3' }) as Record<string, unknown>;
  return sanitizeForGeminiResponseSchema(jsonSchema);
}

function modelFor(systemInstruction: string, schema: ZodTypeAny) {
  const client = getClient();
  return client.getGenerativeModel({
    model: MODEL,
    systemInstruction,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(schema) as {
        type?: SchemaType;
      },
    },
  });
}

export async function extractClaimsFromMetadata(input: {
  metadataHash: string;
  metadataFilePath: string;
  frontmatterYaml: string;
  summary: string;
}): Promise<ClaimExtractionOutput> {
  const model = modelFor(PROFILE_CLAIM_SYSTEM_PROMPT, ClaimExtractionOutputSchema);
  const prompt = [
    `metadata_hash: ${input.metadataHash}`,
    `metadata_file_path: ${input.metadataFilePath}`,
    '',
    'frontmatter_yaml:',
    input.frontmatterYaml,
    '',
    'summary:',
    input.summary,
    '',
    'Return ClaimExtractionOutput JSON only.',
  ].join('\n');

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  return ClaimExtractionOutputSchema.parse(JSON.parse(raw));
}

export async function resolveClaimConflicts(input: {
  runId: string;
  claimsJson: string;
}): Promise<ConflictResolutionOutput> {
  const model = modelFor(PROFILE_CONFLICT_SYSTEM_PROMPT, ConflictResolutionOutputSchema);
  const prompt = [
    `run_id: ${input.runId}`,
    '',
    'claims_json:',
    input.claimsJson,
    '',
    'Return ConflictResolutionOutput JSON only.',
  ].join('\n');

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  return ConflictResolutionOutputSchema.parse(JSON.parse(raw));
}
