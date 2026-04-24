import { execFile } from 'child_process';
import { promisify } from 'util';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractFileAttrs, findExistingMetadata } from './file-attrs.js';
import { extractExif, buildExifContext } from './exif-extractor.js';
import { extractImageSemantics } from './llm-client.js';
import { detectFaces } from './face-detector.js';
import { refreshMetadataIfLocationChanged } from './location-refresh.js';
import { persistMetadata } from './persist.js';
import type { FileMetadata, GeoPoint } from './types.js';

const execFileAsync = promisify(execFile);

const OCR_SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../skills/ocr/scripts/recognize.js',
);

const EXTRACTOR_VERSION = '0.1.0';

// Image types that commonly contain text and benefit from OCR
const OCR_LIKELY_MIME = new Set(['image/png', 'image/webp']);

export interface ImageAgentOptions {
  /** Root directory where .openloom/ will be created. Defaults to process.cwd() */
  openloomDir?: string;
  /** Skip hash-check and re-extract even if metadata already exists */
  forceReextract?: boolean;
  /** OCR provider: 'online' (DeepSeek API) | 'local' (Ollama). Default: 'online' */
  ocrProvider?: 'online' | 'local';
  /** Disable face detection (useful if TF native bindings not installed) */
  skipFaceDetection?: boolean;
}

/**
 * ImageAgent: full metadata extraction pipeline for image files.
 *
 * Handles: .jpg, .jpeg, .png, .heic, .webp
 *
 * Steps:
 *   1. File attributes (OS metadata + SHA-256)
 *   2. Hash-skip (return cached if content unchanged; refresh path if file moved/renamed)
 *   3. EXIF extraction (capture time, GPS, device)
 *   4. OCR (optional, for images likely containing text)
 *   5. AI multi-modal analysis (Gemini 2.5 Pro Vision, Structured Output)
 *   6. Face detection + crop saving
 *   7. Persist to .openloom/metadata/images/{hash}.md
 */
export async function runImageAgent(
  filePath: string,
  options: ImageAgentOptions = {},
): Promise<FileMetadata> {
  const openloomDir = options.openloomDir ?? join(process.cwd(), '.openloom');
  const ocrProvider = options.ocrProvider ?? 'online';
  const errors: string[] = [];

  // ── Step 1: File attributes ────────────────────────────────────────────────
  const attrs = await extractFileAttrs(filePath);

  // ── Step 2: Hash-skip ──────────────────────────────────────────────────────
  if (!options.forceReextract) {
    const existing = findExistingMetadata(attrs.hash, 'image', openloomDir);
    if (existing) {
      const { readMetadata } = await import('./persist.js');
      const cached = await readMetadata(attrs.hash, 'image', openloomDir);
      if (cached) {
        return refreshMetadataIfLocationChanged(cached, attrs, openloomDir, true);
      }
    }
  }

  // ── Step 3: EXIF extraction ────────────────────────────────────────────────
  const exif = await extractExif(filePath);
  const exifContext = buildExifContext(exif);

  // Prefer EXIF capture time over OS birthtime
  const createdAt = exif.created_at ?? attrs.created_at;

  // ── Step 4: OCR (optional) ─────────────────────────────────────────────────
  let ocrText: string | undefined;
  if (OCR_LIKELY_MIME.has(attrs.mime_type) || shouldRunOcr(filePath)) {
    try {
      const { stdout } = await execFileAsync(
        process.execPath,
        [OCR_SCRIPT, filePath, `--provider=${ocrProvider}`],
        { timeout: 30_000 },
      );
      const ocrResult = JSON.parse(stdout.trim()) as { text?: string };
      if (ocrResult.text?.trim()) {
        ocrText = ocrResult.text.trim();
      }
    } catch (err) {
      errors.push(`ocr: ${(err as Error).message}`);
    }
  }

  // ── Step 5: AI multi-modal analysis ───────────────────────────────────────
  let semantic: Awaited<ReturnType<typeof extractImageSemantics>>;
  try {
    semantic = await extractImageSemantics({
      imagePath: filePath,
      mimeType: attrs.mime_type,
      fileName: attrs.file_name,
      exifContext: exifContext || undefined,
      ocrText,
    });
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

  // ── Step 6: Face detection ─────────────────────────────────────────────────
  let faces: FileMetadata['faces'];
  if (!options.skipFaceDetection) {
    const faceResult = await detectFaces(filePath, openloomDir);
    if (faceResult.error) {
      errors.push(`face-detector: ${faceResult.error}`);
    }
    if (faceResult.faces.length > 0) {
      faces = faceResult.faces;
    }
  }

  // ── Resolve location: EXIF GPS > AI inference ──────────────────────────────
  let location: GeoPoint | undefined;
  if (exif.location) {
    location = exif.location;
    // Enrich with reverse-geocoded place name if AI inferred one for the same coords
    const aiPlace = semantic.spatiotemporal.find((e) => e.place)?.place;
    if (aiPlace && !location.place_name) {
      location = { ...location, place_name: aiPlace };
    }
  } else if (semantic.spatiotemporal.length > 0) {
    // Use AI-inferred location from spatio-temporal data (lower confidence)
    const firstWithPlace = semantic.spatiotemporal.find((e) => e.place);
    if (firstWithPlace?.place) {
      location = { lat: 0, lng: 0, place_name: firstWithPlace.place };
    }
  }

  // ── Assemble FileMetadata ──────────────────────────────────────────────────
  const metadata: FileMetadata = {
    // File attributes
    file_path:     attrs.file_path,
    file_name:     attrs.file_name,
    file_type:     'image',
    mime_type:     attrs.mime_type,
    file_size:     attrs.file_size,
    created_at:    createdAt,
    modified_at:   attrs.modified_at,
    hash:          attrs.hash,
    parent_folder: attrs.parent_folder,

    // Optional attributes
    ...(location !== undefined && { location }),
    ...(exif.device !== null && { device: exif.device }),
    ...(semantic.author_inferred && { author: semantic.author_inferred }),

    // Content semantics
    summary:        semantic.summary,
    tags:           enrichedTags,
    spatiotemporal: semantic.spatiotemporal,
    ...(faces !== undefined && { faces }),

    // Processing metadata
    extracted_at:      new Date().toISOString(),
    extractor_version: EXTRACTOR_VERSION,
    agent_used:        'ImageAgent',
    model_used:        'gemini-2.5-pro',
    extraction_errors: errors,
  };

  // ── Step 7: Persist ────────────────────────────────────────────────────────
  await persistMetadata(metadata, openloomDir);

  return metadata;
}

/**
 * Heuristic: run OCR if the filename suggests a document/screenshot.
 */
function shouldRunOcr(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('screenshot') ||
    lower.includes('scan') ||
    lower.includes('document') ||
    lower.includes('certificate') ||
    lower.includes('证') ||
    lower.includes('截图') ||
    lower.includes('扫描')
  );
}
