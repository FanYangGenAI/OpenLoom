import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { detectBootstrapMode } from './bootstrap-mode.js';
import { updateWorkspaceState } from '../config/workspace-state.js';

describe('detectBootstrapMode', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('returns interactive_blank when metadata is missing', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-bootstrap-mode-'));
    tempDirs.push(base);
    await mkdir(join(base, 'agent'), { recursive: true });
    await writeFile(join(base, 'agent', 'USER.md'), '# USER.md\n\n- preferred_user_name: pending\n', 'utf8');

    const decision = await detectBootstrapMode(base);
    expect(decision.mode).toBe('interactive_blank');
  });

  it('returns metadata_guided when metadata exists with pending conflicts', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-bootstrap-mode-'));
    tempDirs.push(base);
    await mkdir(join(base, 'agent'), { recursive: true });
    await mkdir(join(base, 'metadata', 'text_docs'), { recursive: true });
    await writeFile(join(base, 'metadata', 'text_docs', 'a.md'), '# md\n', 'utf8');
    await writeFile(
      join(base, 'agent', 'USER.md'),
      '# USER.md\n\n## General\n\n- official_name: Fan Yang\n',
      'utf8',
    );
    await writeFile(join(base, 'agent', 'USER_CONFLICTS.md'), '- pending_conflicts: 2\n', 'utf8');

    const decision = await detectBootstrapMode(base);
    expect(decision.mode).toBe('metadata_guided');
    expect(decision.pendingConflictCount).toBe(2);
  });

  it('returns normal_chat when metadata exists and onboarding already completed', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-bootstrap-mode-'));
    tempDirs.push(base);
    await mkdir(join(base, 'agent'), { recursive: true });
    await mkdir(join(base, 'metadata', 'text_docs'), { recursive: true });
    await writeFile(join(base, 'metadata', 'text_docs', 'a.md'), '# md\n', 'utf8');
    await writeFile(
      join(base, 'agent', 'USER.md'),
      '# USER.md\n\n## General\n\n- official_name: Fan Yang\n- date_of_birth: 1984-09-27\n',
      'utf8',
    );
    await updateWorkspaceState(base, {
      onboardingCompletedAt: new Date().toISOString(),
    });

    const decision = await detectBootstrapMode(base);
    expect(decision.mode).toBe('normal_chat');
  });
});
