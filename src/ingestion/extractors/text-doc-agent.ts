import { join } from 'path';
import { extractFileAttrs, findExistingMetadata } from './file-attrs.js';
import { readTextContent } from './text-reader.js';
import { extractTextSemantics } from './llm-client.js';
import { refreshMetadataIfLocationChanged } from './location-refresh.js';
import { persistMetadata } from './persist.js';
import type { FileMetadata } from './types.js';

const EXTRACTOR_VERSION = '0.1.0';

export interface TextDocAgentOptions {
  /** Root directory where .openloom/ will be created. Defaults to process.cwd() */
  openloomDir?: string;
  /** Skip hash-check and re-extract even if metadata already exists */
  forceReextract?: boolean;
}

/**
 * TextDocAgent: full metadata extraction pipeline for text documents.
 *
 * Handles: .txt, .md, .markdown, .docx, .doc
 *
 * Steps:
 *   1. File attributes (OS metadata + SHA-256)
 *   2. Hash-skip (return cached if content unchanged; refresh path if file moved/renamed)
 *   3. Text content reading (plain text or mammoth for docx)
 *   4. AI semantic extraction (Gemini 2.5 Pro, Structured Output)
 *   5. Persist to .openloom/metadata/text_docs/{hash}.md
 */
export async function runTextDocAgent(
  filePath: string,
  options: TextDocAgentOptions = {},
): Promise<FileMetadata> {
  const openloomDir = options.openloomDir ?? join(process.cwd(), '.openloom');
  const errors: string[] = [];

  // ── Step 1: File attributes ────────────────────────────────────────────────
  const attrs = await extractFileAttrs(filePath);

  // ── Step 2: Hash-skip ──────────────────────────────────────────────────────
  if (!options.forceReextract) {
    const existing = findExistingMetadata(attrs.hash, 'text_doc', openloomDir);
    if (existing) {
      const { readMetadata } = await import('./persist.js');
      const cached = await readMetadata(attrs.hash, 'text_doc', openloomDir);
      if (cached) {
        return refreshMetadataIfLocationChanged(cached, attrs, openloomDir, false);
      }
    }
  }

  // ── Step 3: Read text content ──────────────────────────────────────────────
  let textResult: Awaited<ReturnType<typeof readTextContent>>;
  try {
    textResult = await readTextContent(filePath);
  } catch (err) {
    errors.push(`text-reader: ${(err as Error).message}`);
    textResult = { text: '' };
  }

  // ── Step 4: AI semantic extraction ────────────────────────────────────────
  let semantic: Awaited<ReturnType<typeof extractTextSemantics>>;
  try {
    semantic = await extractTextSemantics(textResult.text, attrs.file_name);
  } catch (err) {
    errors.push(`llm-client: ${(err as Error).message}`);
    semantic = {
      summary: '',
      author_inferred: null,
      tags: { keywords: [], entities: { persons: [], places: [], orgs: [], other: [] } },
      spatiotemporal: [],
      web_search_needed: [],
    };
  }

  // Web enrichment is intentionally disabled in current development stage.
  const enrichedTags = semantic.tags;

  // ── Resolve author: docx properties > AI inference ────────────────────────
  const author = textResult.author ?? semantic.author_inferred ?? undefined;

  // ── Assemble FileMetadata ──────────────────────────────────────────────────
  const metadata: FileMetadata = {
    // File attributes
    file_path:     attrs.file_path,
    file_name:     attrs.file_name,
    file_type:     'text_doc',
    mime_type:     attrs.mime_type,
    file_size:     attrs.file_size,
    created_at:    attrs.created_at,
    modified_at:   attrs.modified_at,
    hash:          attrs.hash,
    parent_folder: attrs.parent_folder,

    // Optional attributes
    ...(author !== undefined && { author }),

    // Content semantics
    summary:        semantic.summary,
    tags:           enrichedTags,
    spatiotemporal: semantic.spatiotemporal,

    // Processing metadata
    extracted_at:      new Date().toISOString(),
    extractor_version: EXTRACTOR_VERSION,
    agent_used:        'TextDocAgent',
    model_used:        'gemini-2.5-pro',
    extraction_errors: errors,
  };

  // ── Step 5: Persist ────────────────────────────────────────────────────────
  await persistMetadata(metadata, openloomDir);

  return metadata;
}
