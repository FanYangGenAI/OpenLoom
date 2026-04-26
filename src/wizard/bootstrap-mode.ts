import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';
import { loadWorkspaceState } from '../config/workspace-state.js';

export type BootstrapMode = 'interactive_blank' | 'metadata_guided' | 'normal_chat';

export interface BootstrapModeDecision {
  mode: BootstrapMode;
  reasons: string[];
  pendingConflictCount: number;
}

async function hasMetadataFiles(openloomDir: string): Promise<boolean> {
  const metadataRoot = resolve(openloomDir, 'metadata');
  try {
    const buckets = await readdir(metadataRoot, { withFileTypes: true });
    for (const bucket of buckets) {
      if (!bucket.isDirectory()) continue;
      const bucketPath = resolve(metadataRoot, bucket.name);
      const files = await readdir(bucketPath, { withFileTypes: true });
      if (files.some((item) => item.isFile() && item.name.endsWith('.md'))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function isUserTemplateLike(openloomDir: string): Promise<boolean> {
  const userPath = resolve(openloomDir, 'agent', 'USER.md');
  try {
    const raw = await readFile(userPath, 'utf8');
    const lower = raw.toLowerCase();
    const hasGeneral = lower.includes('## general');
    const hasIdentitySignal =
      lower.includes('official_name:') ||
      lower.includes('date_of_birth:') ||
      lower.includes('preferred_user_name:');
    if (!hasGeneral && !hasIdentitySignal) return true;
    const hasConfirmedIdentity =
      /official_name:\s*(?!unknown|pending)\S+/i.test(raw) || /date_of_birth:\s*(?!unknown|pending)\S+/i.test(raw);
    if (hasConfirmedIdentity) return false;
    return /preferred_user_name:\s*(pending)?\s*$/m.test(raw) || raw.trim().length < 120;
  } catch {
    return true;
  }
}

async function readPendingConflictCount(openloomDir: string): Promise<number> {
  const conflictPath = resolve(openloomDir, 'agent', 'USER_CONFLICTS.md');
  try {
    const raw = await readFile(conflictPath, 'utf8');
    const matched = raw.match(/pending_conflicts:\s*(\d+)/i);
    if (matched) return Number.parseInt(matched[1] ?? '0', 10) || 0;
    return (raw.match(/status:\s*pending_user_confirm/gi) ?? []).length;
  } catch {
    return 0;
  }
}

export async function detectBootstrapMode(openloomDir: string): Promise<BootstrapModeDecision> {
  const [hasMetadata, templateLike, pendingConflictCount, workspaceState] = await Promise.all([
    hasMetadataFiles(openloomDir),
    isUserTemplateLike(openloomDir),
    readPendingConflictCount(openloomDir),
    loadWorkspaceState(openloomDir),
  ]);

  const reasons: string[] = [];
  if (hasMetadata) reasons.push('metadata files detected');
  if (templateLike) reasons.push('USER.md looks template-like or sparse');
  if (pendingConflictCount > 0) reasons.push(`pending conflicts: ${pendingConflictCount}`);
  if (workspaceState.onboardingCompletedAt) reasons.push('onboarding previously completed');

  if (!hasMetadata) {
    return { mode: 'interactive_blank', reasons, pendingConflictCount };
  }
  if (pendingConflictCount > 0 || templateLike || !workspaceState.onboardingCompletedAt) {
    return { mode: 'metadata_guided', reasons, pendingConflictCount };
  }
  return { mode: 'normal_chat', reasons, pendingConflictCount };
}
