import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { detectFileType } from './types.js';
import { runTextDocAgent, type TextDocAgentOptions } from './text-doc-agent.js';
import { runImageAgent, type ImageAgentOptions } from './image-agent.js';
import { runConcurrent } from './concurrency.js';
import type { FileMetadata } from './types.js';

// Default concurrency limits — conservative to respect API rate limits
const DEFAULT_TEXT_CONCURRENCY  = 5;
const DEFAULT_IMAGE_CONCURRENCY = 3;

export interface ExtractOptions {
  openloomDir?: string;
  forceReextract?: boolean;
  ocrProvider?: 'online' | 'local';
  skipFaceDetection?: boolean;
  /** Max parallel TextDocAgent workers. Default: 5 */
  textConcurrency?: number;
  /** Max parallel ImageAgent workers. Default: 3 */
  imageConcurrency?: number;
  /** Called after each file completes (success or failure) */
  onProgress?: (update: ProgressUpdate) => void;
}

export interface ProgressUpdate {
  file: string;
  status: 'success' | 'error';
  error?: string;
  completed: number;
  total: number;
  textDone: number;
  imageDone: number;
}

export interface ExtractResult {
  succeeded: FileMetadata[];
  failed: Array<{ file: string; error: string }>;
  durationMs: number;
}

/**
 * Extract metadata from a single file.
 * Routes to TextDocAgent or ImageAgent based on file type.
 */
export async function extractFile(
  filePath: string,
  options: ExtractOptions = {},
): Promise<FileMetadata> {
  const ext = extname(filePath);
  const fileType = detectFileType(ext);

  if (!fileType) throw new Error(`Unsupported file type: ${ext}`);

  if (fileType === 'text_doc') {
    return runTextDocAgent(filePath, options as TextDocAgentOptions);
  } else {
    return runImageAgent(filePath, options as ImageAgentOptions);
  }
}

/**
 * Scan a directory recursively, collect all supported files,
 * then dispatch them to TextDocAgent / ImageAgent in parallel pools.
 *
 * TextDoc files and image files run in separate pools so they don't
 * compete for the same concurrency slots.
 */
export async function extractDirectory(
  dirPath: string,
  options: ExtractOptions = {},
): Promise<ExtractResult> {
  const start = Date.now();
  const textConcurrency  = options.textConcurrency  ?? DEFAULT_TEXT_CONCURRENCY;
  const imageConcurrency = options.imageConcurrency ?? DEFAULT_IMAGE_CONCURRENCY;

  // ── Collect all supported files ───────────────────────────────────────────
  const textFiles: string[] = [];
  const imageFiles: string[] = [];
  await collectFiles(dirPath, textFiles, imageFiles);

  const total = textFiles.length + imageFiles.length;
  let completed = 0;
  let textDone = 0;
  let imageDone = 0;

  const succeeded: FileMetadata[] = [];
  const failed: Array<{ file: string; error: string }> = [];

  // ── Helper: wrap single-file extraction with progress reporting ───────────
  const makeTask = (filePath: string, type: 'text_doc' | 'image') => async () => {
    const result = await extractFile(filePath, options);
    completed++;
    if (type === 'text_doc') textDone++; else imageDone++;
    options.onProgress?.({
      file: filePath,
      status: 'success',
      completed,
      total,
      textDone,
      imageDone,
    });
    return result;
  };

  // ── Dispatch both pools concurrently ──────────────────────────────────────
  const [textResults, imageResults] = await Promise.all([
    runConcurrent(
      textFiles.map((f) => makeTask(f, 'text_doc')),
      textConcurrency,
    ),
    runConcurrent(
      imageFiles.map((f) => makeTask(f, 'image')),
      imageConcurrency,
    ),
  ]);

  // ── Collect results ───────────────────────────────────────────────────────
  const allFiles = [...textFiles, ...imageFiles];
  const allResults = [...textResults, ...imageResults];

  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    if (r.status === 'fulfilled') {
      succeeded.push(r.value);
    } else {
      const errMsg = (r.reason as Error)?.message ?? String(r.reason);
      failed.push({ file: allFiles[i], error: errMsg });
      completed++;
      options.onProgress?.({
        file: allFiles[i],
        status: 'error',
        error: errMsg,
        completed,
        total,
        textDone,
        imageDone,
      });
    }
  }

  return { succeeded, failed, durationMs: Date.now() - start };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function collectFiles(
  dir: string,
  textFiles: string[],
  imageFiles: string[],
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      // Skip hidden files and .openloom directory
      if (entry.startsWith('.')) return;

      const fullPath = join(dir, entry);
      const info = await stat(fullPath).catch(() => null);
      if (!info) return;

      if (info.isDirectory()) {
        await collectFiles(fullPath, textFiles, imageFiles);
      } else if (info.isFile()) {
        const fileType = detectFileType(extname(entry));
        if (fileType === 'text_doc') textFiles.push(fullPath);
        else if (fileType === 'image') imageFiles.push(fullPath);
      }
    }),
  );
}
