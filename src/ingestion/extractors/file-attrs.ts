import { createHash } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { stat } from 'fs/promises';
import { basename, dirname, extname } from 'path';
import { fileTypeFromFile } from 'file-type';
import { detectFileType, type FileType } from './types.js';

export interface FileAttrs {
  file_path: string;
  file_name: string;
  file_type: FileType;
  mime_type: string;
  file_size: number;
  created_at: string;   // ISO 8601 from OS birthtime
  modified_at: string;  // ISO 8601
  hash: string;         // SHA-256
  parent_folder: string;
}

/**
 * Compute SHA-256 hash of a file by streaming its contents.
 */
export function computeHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Extract OS-level file attributes and compute SHA-256 hash.
 * Throws if the file does not exist or the file type is unsupported.
 */
export async function extractFileAttrs(filePath: string): Promise<FileAttrs> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = extname(filePath);
  const fileType = detectFileType(ext);
  if (!fileType) {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  const [stats, hash, detectedType] = await Promise.all([
    stat(filePath),
    computeHash(filePath),
    fileTypeFromFile(filePath),
  ]);

  // Use detected MIME type, fall back to extension-based guess
  const mimeType = detectedType?.mime ?? extensionMime(ext);

  // OS birthtime is unreliable on some systems (returns mtime as fallback).
  // We prefer it here; extractors may override with EXIF time later.
  const createdAt = (stats.birthtime > stats.mtime ? stats.mtime : stats.birthtime).toISOString();

  return {
    file_path: filePath,
    file_name: basename(filePath),
    file_type: fileType,
    mime_type: mimeType,
    file_size: stats.size,
    created_at: createdAt,
    modified_at: stats.mtime.toISOString(),
    hash,
    parent_folder: dirname(filePath),
  };
}

/**
 * Check if a metadata file already exists for a given hash (hash-skip).
 * Returns the path to the existing metadata file, or null if not found.
 */
export function findExistingMetadata(
  hash: string,
  fileType: FileType,
  openloomDir: string,
): string | null {
  const subdir = fileType === 'text_doc' ? 'text_docs' : 'images';
  const metaPath = `${openloomDir}/metadata/${subdir}/${hash}.md`;
  return existsSync(metaPath) ? metaPath : null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extensionMime(ext: string): string {
  const map: Record<string, string> = {
    '.txt':      'text/plain',
    '.md':       'text/markdown',
    '.markdown': 'text/markdown',
    '.docx':     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc':      'application/msword',
    '.jpg':      'image/jpeg',
    '.jpeg':     'image/jpeg',
    '.png':      'image/png',
    '.heic':     'image/heic',
    '.webp':     'image/webp',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}
