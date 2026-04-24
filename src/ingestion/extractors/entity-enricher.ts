import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import type { Tags } from './types.js';

const execFileAsync = promisify(execFile);

// Path to the claude-web-search skill script directory
const SKILL_DIR = resolve(
  fileURLToPath(import.meta.url),
  '../../../../skills/claude-web-search',
);

export interface WebSearchNeeded {
  entity: string;
  reason: string;
  query: string;
}

export interface EnrichResult {
  entity_original: string;
  entity_verified: string;
  type: 'person' | 'place' | 'organization' | 'other';
  description: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * For each entity flagged by the LLM as needing web search,
 * call the claude-web-search skill and return enrichment results.
 *
 * Uses the Anthropic SDK with web_search_20260209 tool directly,
 * following the claude-web-search SKILL.md instructions.
 */
export async function enrichEntities(
  needed: WebSearchNeeded[],
): Promise<Map<string, EnrichResult>> {
  const results = new Map<string, EnrichResult>();
  if (needed.length === 0) return results;

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Process entities sequentially to respect rate limits
  for (const item of needed) {
    try {
      const result = await searchEntity(client, item);
      results.set(item.entity, result);
    } catch (err) {
      // Non-fatal: if search fails, we skip enrichment for this entity
      console.warn(`[entity-enricher] search failed for "${item.entity}":`, (err as Error).message);
    }
  }

  return results;
}

async function searchEntity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  item: WebSearchNeeded,
): Promise<EnrichResult> {
  const prompt = `Verify the following entity extracted from a document:

Entity: ${item.entity}
Context: ${item.reason}

Search for this entity and return a JSON object with these exact fields:
{
  "entity_original": "${item.entity}",
  "entity_verified": "<corrected or confirmed name>",
  "type": "<person | place | organization | other>",
  "description": "<brief 1-2 sentence description>",
  "confidence": "<high | medium | low>"
}

Return only the JSON object, no other text.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',  // Use faster/cheaper model for entity lookup
    max_tokens: 512,
    tools: [
      {
        type: 'web_search_20260209',
        name: 'web_search',
        max_uses: 2,
      },
    ],
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract the final text response (after tool use)
  const textBlock = response.content
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { type: string; text: string }) => b.text)
    .join('');

  // Parse JSON from response
  const jsonMatch = textBlock.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  return JSON.parse(jsonMatch[0]) as EnrichResult;
}

/**
 * Apply enrichment results back into a Tags object.
 * Replaces uncertain entity names with their verified versions.
 */
export function applyEnrichment(tags: Tags, enrichments: Map<string, EnrichResult>): Tags {
  if (enrichments.size === 0) return tags;

  const replaceInList = (list: string[]) =>
    list.map((name) => {
      const enriched = enrichments.get(name);
      if (enriched && enriched.confidence !== 'low') {
        return enriched.entity_verified;
      }
      return name;
    });

  return {
    keywords: tags.keywords,
    entities: {
      persons: replaceInList(tags.entities.persons),
      places:  replaceInList(tags.entities.places),
      orgs:    replaceInList(tags.entities.orgs),
      other:   replaceInList(tags.entities.other),
    },
  };
}
