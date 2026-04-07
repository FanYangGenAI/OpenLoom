import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { stringify as yamlStringify } from 'yaml';
import type { FileMetadata } from './types.js';

/**
 * Write a FileMetadata object to .openloom/metadata/{type}/{hash}.md
 * Format: YAML frontmatter (structured fields) + Markdown body (summary).
 *
 * Returns the path to the written file.
 */
export async function persistMetadata(
  metadata: FileMetadata,
  openloomDir: string,
): Promise<string> {
  const subdir = metadata.file_type === 'text_doc' ? 'text_docs' : 'images';
  const metaDir = join(openloomDir, 'metadata', subdir);
  const metaPath = join(metaDir, `${metadata.hash}.md`);

  await mkdir(metaDir, { recursive: true });

  // Separate summary (goes in markdown body) from the rest (goes in frontmatter)
  const { summary, ...frontmatterData } = metadata;

  const frontmatter = yamlStringify(frontmatterData, {
    lineWidth: 0,       // Don't wrap long strings
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_DOUBLE',
  }).trimEnd();

  const content = `---\n${frontmatter}\n---\n\n${summary}\n`;

  await writeFile(metaPath, content, 'utf-8');
  return metaPath;
}

/**
 * Read an existing metadata file and parse it back into a FileMetadata object.
 * Returns null if the file does not exist.
 */
export async function readMetadata(
  hash: string,
  fileType: 'text_doc' | 'image',
  openloomDir: string,
): Promise<FileMetadata | null> {
  const subdir = fileType === 'text_doc' ? 'text_docs' : 'images';
  const metaPath = join(openloomDir, 'metadata', subdir, `${hash}.md`);

  if (!existsSync(metaPath)) return null;

  const { parse: yamlParse } = await import('yaml');
  const raw = await readFile(metaPath, 'utf-8');

  // Split frontmatter and body
  const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) return null;

  const [, frontmatterRaw, body] = match;
  const frontmatter = yamlParse(frontmatterRaw) as Omit<FileMetadata, 'summary'>;

  return { ...frontmatter, summary: body.trim() } as FileMetadata;
}

/**
 * Ensure the .openloom directory structure exists.
 */
export async function ensureOpenloomDir(openloomDir: string): Promise<void> {
  await Promise.all([
    mkdir(join(openloomDir, 'metadata', 'text_docs'), { recursive: true }),
    mkdir(join(openloomDir, 'metadata', 'images'), { recursive: true }),
    mkdir(join(openloomDir, 'faces'), { recursive: true }),
  ]);
}
