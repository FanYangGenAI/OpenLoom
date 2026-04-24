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

    const settings = JSON.parse(settingsRaw) as { initialized: boolean; default_root?: { path?: string } };
    expect(settings.initialized).toBe(true);
    expect(settings.default_root?.path).toBe(base);
    expect(lessonsRaw).toContain('preferred_user_name: pending');
  });
});
