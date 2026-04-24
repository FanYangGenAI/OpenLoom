import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  rulesExcludeAddCommand,
  rulesExcludeRemoveCommand,
  rulesIncludeAddCommand,
  rulesIncludeRemoveCommand,
  rulesResetDefaultCommand,
} from './rules.js';

describe('rules commands', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('adds and removes include/exclude rules', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-rules-'));
    tempDirs.push(base);

    await rulesIncludeAddCommand('**/*.md', { openloom: base });
    await rulesExcludeAddCommand('**/.cache/**', { openloom: base });
    await rulesIncludeRemoveCommand('**/*.md', { openloom: base });
    await rulesExcludeRemoveCommand('**/.cache/**', { openloom: base });

    const settingsRaw = await readFile(join(base, 'config', 'user-settings.json'), 'utf8');
    const settings = JSON.parse(settingsRaw) as {
      scan_rules?: { include?: string[]; exclude?: string[] };
    };
    expect(settings.scan_rules?.include ?? []).not.toContain('**/*.md');
    expect(settings.scan_rules?.exclude ?? []).not.toContain('**/.cache/**');
  });

  it('resets rules to defaults', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-rules-'));
    tempDirs.push(base);

    await rulesIncludeAddCommand('**/*.png', { openloom: base });
    await rulesResetDefaultCommand({ openloom: base });

    const settingsRaw = await readFile(join(base, 'config', 'user-settings.json'), 'utf8');
    const settings = JSON.parse(settingsRaw) as {
      scan_rules?: { include?: string[]; exclude?: string[] };
    };
    expect(settings.scan_rules?.include).toEqual([]);
    expect(settings.scan_rules?.exclude ?? []).toContain('**/node_modules/**');
  });
});
