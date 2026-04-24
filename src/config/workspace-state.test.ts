import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  isOnboardingCompleted,
  loadWorkspaceState,
  updateWorkspaceState,
} from './workspace-state.js';

describe('workspace-state', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('returns default state for missing file', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-workspace-state-'));
    tempDirs.push(base);

    const state = await loadWorkspaceState(base);
    expect(state.version).toBe(1);
    expect(state.onboardingCompletedAt).toBeUndefined();
  });

  it('updates and persists onboarding completion', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-workspace-state-'));
    tempDirs.push(base);

    await updateWorkspaceState(base, {
      onboardingCompletedAt: new Date().toISOString(),
      lastWizardSource: 'setup',
    });

    expect(await isOnboardingCompleted(base)).toBe(true);
    const state = await loadWorkspaceState(base);
    expect(state.lastWizardSource).toBe('setup');
  });
});
