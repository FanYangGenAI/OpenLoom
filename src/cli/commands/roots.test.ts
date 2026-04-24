import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { rootsClearCommand, rootsSetCommand } from './roots.js';

describe('roots commands', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('set and clear default root in settings', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-roots-'));
    tempDirs.push(base);

    await rootsSetCommand('/tmp/root-a', { openloom: base });
    let settingsRaw = await readFile(join(base, 'config', 'user-settings.json'), 'utf8');
    let settings = JSON.parse(settingsRaw) as { default_root?: { path?: string } | null };
    expect(settings.default_root?.path).toContain('root-a');

    await rootsClearCommand({ openloom: base });
    settingsRaw = await readFile(join(base, 'config', 'user-settings.json'), 'utf8');
    settings = JSON.parse(settingsRaw) as { default_root?: { path?: string } | null };
    expect(settings.default_root).toBeNull();
  });
});
