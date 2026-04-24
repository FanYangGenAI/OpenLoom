import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import type { GeoPoint } from './types.js';

const execFileAsync = promisify(execFile);

const SKILL_SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../skills/exif-reader/scripts/extract.js',
);

export interface ExifData {
  created_at: string | null;
  location: GeoPoint | null;
  device: string | null;
  width: number | null;
  height: number | null;
  orientation: number | null;
}

/**
 * Extract EXIF metadata from an image file by running the exif-reader skill script.
 * Returns null fields for any data not present in the file.
 */
export async function extractExif(filePath: string): Promise<ExifData> {
  try {
    const { stdout } = await execFileAsync(process.execPath, [SKILL_SCRIPT, filePath], {
      timeout: 15_000,
    });

    const raw = JSON.parse(stdout.trim()) as {
      created_at?: string | null;
      location?: { lat: number; lng: number } | null;
      device?: string | null;
      width?: number | null;
      height?: number | null;
      orientation?: number | null;
    };

    return {
      created_at: raw.created_at ?? null,
      location: raw.location ? { lat: raw.location.lat, lng: raw.location.lng } : null,
      device: raw.device ?? null,
      width: raw.width ?? null,
      height: raw.height ?? null,
      orientation: raw.orientation ?? null,
    };
  } catch {
    // EXIF extraction is best-effort; return empty result on any failure
    return {
      created_at: null,
      location: null,
      device: null,
      width: null,
      height: null,
      orientation: null,
    };
  }
}

/**
 * Build a human-readable EXIF context string to pass as a hint to the vision LLM.
 */
export function buildExifContext(exif: ExifData): string {
  const lines: string[] = [];
  if (exif.created_at) lines.push(`Capture time: ${exif.created_at}`);
  if (exif.location) lines.push(`GPS: lat=${exif.location.lat}, lng=${exif.location.lng}`);
  if (exif.device) lines.push(`Device: ${exif.device}`);
  if (exif.width && exif.height) lines.push(`Resolution: ${exif.width}×${exif.height}`);
  return lines.join('\n');
}
