import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

interface ProfileExtractState {
  processed_hashes: string[];
  updated_at: string;
}

const INITIAL_STATE: ProfileExtractState = {
  processed_hashes: [],
  updated_at: new Date(0).toISOString(),
};

function statePath(openloomDir: string): string {
  return join(openloomDir, 'agent', 'profile-extract-state.json');
}

async function atomicWrite(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}-${Date.now().toString(36)}`;
  await writeFile(tmp, content, 'utf8');
  try {
    await rename(tmp, path);
  } catch (error) {
    await unlink(tmp).catch(() => {});
    throw error;
  }
}

export async function readProfileExtractState(openloomDir: string): Promise<ProfileExtractState> {
  const path = statePath(openloomDir);
  const raw = await readFile(path, 'utf8').catch(() => '');
  if (!raw.trim()) return INITIAL_STATE;
  try {
    const parsed = JSON.parse(raw) as ProfileExtractState;
    return {
      processed_hashes: Array.isArray(parsed.processed_hashes) ? parsed.processed_hashes : [],
      updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : INITIAL_STATE.updated_at,
    };
  } catch {
    return INITIAL_STATE;
  }
}

export async function writeProfileExtractState(
  openloomDir: string,
  hashes: string[],
): Promise<void> {
  const path = statePath(openloomDir);
  await mkdir(dirname(path), { recursive: true });
  const unique = Array.from(new Set(hashes));
  const next: ProfileExtractState = {
    processed_hashes: unique,
    updated_at: new Date().toISOString(),
  };
  await atomicWrite(path, `${JSON.stringify(next, null, 2)}\n`);
}
