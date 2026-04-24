import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { setupCommand } from './setup.js';

describe('setupCommand', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('creates user settings and lessons files in non-interactive mode', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-setup-'));
    tempDirs.push(base);

    await setupCommand({
      openloom: base,
      root: base,
      nonInteractive: true,
    });

    const settingsRaw = await readFile(join(base, 'config', 'user-settings.json'), 'utf8');
    const lessonsRaw = await readFile(join(base, 'agent', 'lessons.md'), 'utf8');
    const workspaceStateRaw = await readFile(join(base, 'agent', 'workspace-state.json'), 'utf8');
    const identityRaw = await readFile(join(base, 'agent', 'IDENTITY.md'), 'utf8');
    const userRaw = await readFile(join(base, 'agent', 'USER.md'), 'utf8');
    const soulRaw = await readFile(join(base, 'agent', 'SOUL.md'), 'utf8');
    const bootstrapRaw = await readFile(join(base, 'agent', 'BOOTSTRAP.md'), 'utf8');

    const settings = JSON.parse(settingsRaw) as { initialized: boolean; default_root?: { path?: string } };
    const workspaceState = JSON.parse(workspaceStateRaw) as { onboardingCompletedAt?: string };
    expect(settings.initialized).toBe(true);
    expect(settings.default_root?.path).toBe(base);
    expect(lessonsRaw).toContain('preferred_user_name: pending');
    expect(workspaceState.onboardingCompletedAt).toBeTruthy();
    expect(identityRaw).toContain('# IDENTITY.md');
    expect(userRaw).toContain('# USER.md');
    expect(soulRaw).toContain('# SOUL.md');
    expect(bootstrapRaw).toContain('# BOOTSTRAP.md');
  });
});
