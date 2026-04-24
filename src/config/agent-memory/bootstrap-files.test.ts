import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ensureAgentBootstrapFiles, updateBootstrapMemoryFiles } from './bootstrap-files.js';

describe('bootstrap-files', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('seeds default bootstrap files when missing', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-bootstrap-'));
    tempDirs.push(base);

    await ensureAgentBootstrapFiles(base);

    const identity = await readFile(join(base, 'agent', 'IDENTITY.md'), 'utf8');
    const user = await readFile(join(base, 'agent', 'USER.md'), 'utf8');
    const soul = await readFile(join(base, 'agent', 'SOUL.md'), 'utf8');

    expect(identity).toContain('# IDENTITY.md');
    expect(user).toContain('# USER.md');
    expect(soul).toContain('# SOUL.md');
  });

  it('updates user and identity values from onboarding input', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-bootstrap-'));
    tempDirs.push(base);
    await ensureAgentBootstrapFiles(base);

    await updateBootstrapMemoryFiles(base, {
      preferredUserName: 'Fan',
      preferredAgentName: 'Loomy',
      tone: 'concise',
      languagePreference: 'zh-CN',
      formatPreference: 'summary-first',
    });

    const user = await readFile(join(base, 'agent', 'USER.md'), 'utf8');
    const identity = await readFile(join(base, 'agent', 'IDENTITY.md'), 'utf8');
    const soul = await readFile(join(base, 'agent', 'SOUL.md'), 'utf8');
    expect(user).toContain('preferred_user_name: Fan');
    expect(identity).toContain('name: Loomy');
    expect(soul).toContain('tone: concise');
  });
});
