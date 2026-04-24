import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';

export interface WorkspaceState {
  version: 1;
  bootstrapSeededAt?: string;
  onboardingCompletedAt?: string;
  lastWizardRunAt?: string;
  lastWizardSource?: 'setup' | 'extract-interactive' | 'manual';
}

const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  version: 1,
};

function getWorkspaceStatePath(openloomDir: string): string {
  return resolve(openloomDir, 'agent', 'workspace-state.json');
}

export async function loadWorkspaceState(openloomDir: string): Promise<WorkspaceState> {
  try {
    const raw = await readFile(getWorkspaceStatePath(openloomDir), 'utf8');
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    return {
      ...DEFAULT_WORKSPACE_STATE,
      ...parsed,
      version: 1,
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_STATE };
  }
}

export async function saveWorkspaceState(openloomDir: string, state: WorkspaceState): Promise<void> {
  const path = getWorkspaceStatePath(openloomDir);
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp-${process.pid}-${Date.now().toString(36)}`;
  const payload = `${JSON.stringify(state, null, 2)}\n`;
  await writeFile(tempPath, payload, 'utf8');
  try {
    await rename(tempPath, path);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

export async function updateWorkspaceState(
  openloomDir: string,
  patch: Partial<WorkspaceState>,
): Promise<WorkspaceState> {
  const current = await loadWorkspaceState(openloomDir);
  const next: WorkspaceState = {
    ...current,
    ...patch,
    version: 1,
  };
  await saveWorkspaceState(openloomDir, next);
  return next;
}

export async function isOnboardingCompleted(openloomDir: string): Promise<boolean> {
  const state = await loadWorkspaceState(openloomDir);
  return Boolean(state.onboardingCompletedAt && state.onboardingCompletedAt.trim().length > 0);
}
