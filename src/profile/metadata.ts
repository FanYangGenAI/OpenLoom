import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

export interface MetadataDoc {
  hash: string;
  filePath: string;
  frontmatter: Record<string, unknown>;
  frontmatterYaml: string;
  summary: string;
}

function splitFrontmatter(raw: string): { frontmatter: string; body: string } | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) return null;
  return { frontmatter: match[1], body: match[2] ?? '' };
}

async function readMetadataFile(path: string): Promise<MetadataDoc | null> {
  const raw = await readFile(path, 'utf8');
  const parts = splitFrontmatter(raw);
  if (!parts) return null;
  const frontmatter = yamlParse(parts.frontmatter) as Record<string, unknown>;
  const hash = String(frontmatter.hash ?? '');
  if (!hash) return null;
  return {
    hash,
    filePath: path,
    frontmatter,
    frontmatterYaml: yamlStringify(frontmatter),
    summary: parts.body.trim(),
  };
}

export async function listAllMetadata(openloomDir: string): Promise<MetadataDoc[]> {
  const targets = [join(openloomDir, 'metadata', 'text_docs'), join(openloomDir, 'metadata', 'images')];
  const out: MetadataDoc[] = [];
  for (const dir of targets) {
    const files = await readdir(dir).catch(() => []);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const doc = await readMetadataFile(join(dir, file)).catch(() => null);
      if (doc) out.push(doc);
    }
  }
  return out;
}
