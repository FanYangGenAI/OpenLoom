import { resolve } from 'path';
import type { FileAttrs } from './file-attrs.js';
import { persistMetadata } from './persist.js';
import type { FileMetadata } from './types.js';

function normPath(p: string): string {
  return resolve(p);
}

/**
 * When hash-skip hits but the file was moved or renamed (content unchanged),
 * refresh path fields and append to path_history without re-running LLM.
 *
 * @param preserveCreatedAt — for images, keep cached created_at (often from EXIF)
 */
export async function refreshMetadataIfLocationChanged(
  cached: FileMetadata,
  attrs: FileAttrs,
  openloomDir: string,
  preserveCreatedAt: boolean,
): Promise<FileMetadata> {
  if (normPath(cached.file_path) === normPath(attrs.file_path)) {
    return cached;
  }

  const entry = {
    file_path: cached.file_path,
    file_name: cached.file_name,
    parent_folder: cached.parent_folder,
    recorded_at: new Date().toISOString(),
  };
  const path_history = [...(cached.path_history ?? []), entry];

  const updated: FileMetadata = {
    ...cached,
    file_path: attrs.file_path,
    file_name: attrs.file_name,
    parent_folder: attrs.parent_folder,
    file_size: attrs.file_size,
    modified_at: attrs.modified_at,
    mime_type: attrs.mime_type,
    ...(preserveCreatedAt ? {} : { created_at: attrs.created_at }),
    path_history,
  };

  await persistMetadata(updated, openloomDir);
  return updated;
}
