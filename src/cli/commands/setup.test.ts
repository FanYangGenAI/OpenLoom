import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
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
    const workspaceState = JSON.parse(workspaceStateRaw) as {
      onboardingCompletedAt?: string;
      bootstrapLifecycleStatus?: string;
    };
    expect(settings.initialized).toBe(true);
    expect(settings.default_root?.path).toBe(base);
    expect(lessonsRaw).toContain('preferred_user_name: pending');
    expect(workspaceState.onboardingCompletedAt).toBeTruthy();
    expect(workspaceState.bootstrapLifecycleStatus).toBe('completed');
    expect(identityRaw).toContain('# IDENTITY.md');
    expect(userRaw).toContain('# USER.md');
    expect(soulRaw).toContain('# SOUL.md');
    expect(bootstrapRaw).toContain('# BOOTSTRAP.md');
    expect(bootstrapRaw).toContain('status: completed');
  });

  it('routes to metadata guided mode and resolves mapped conflict', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-setup-guided-'));
    tempDirs.push(base);
    await mkdir(join(base, 'agent'), { recursive: true });
    await mkdir(join(base, 'metadata', 'text_docs'), { recursive: true });
    await writeFile(join(base, 'metadata', 'text_docs', 'demo.md'), '# metadata\n', 'utf8');
    await writeFile(
      join(base, 'agent', 'USER.md'),
      [
        '# USER.md',
        '',
        '## General',
        '',
        '- official_name: Fan Yang',
        '- date_of_birth: 1984-09-27',
        '- place_of_birth: Anhui, China',
        '- gender: unknown',
        "- nationality: People's Republic of China",
        '',
        '### GeneralSummary',
        '',
        'Fan Yang',
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      join(base, 'agent', 'USER_CONFLICTS.md'),
      [
        '---',
        'schema_version: 1.0.0',
        'model: gemini-2.5-pro',
        `updated_at: ${new Date().toISOString()}`,
        'conflicts:',
        '  - conflict_id: conflict_identity.gender',
        '    fact_key: identity.gender',
        '    candidates:',
        '      - value: Male',
        '        confidence: 0.96',
        '        evidence_hashes: []',
        '        evidence_refs: []',
        '        reason: official id',
        '      - value: Female',
        '        confidence: 0.60',
        '        evidence_hashes: []',
        '        evidence_refs: []',
        '        reason: weak image',
        '    recommended_candidate: Male',
        '    recommended_confidence: 0.96',
        '    status: pending_user_confirm',
        '    freeze_user_update: true',
        '---',
        '',
        '- pending_conflicts: 1',
        '- resolved_conflicts: 0',
        '',
      ].join('\n'),
      'utf8',
    );

    await setupCommand({
      openloom: base,
      root: base,
      nonInteractive: true,
    });

    const workspaceStateRaw = await readFile(join(base, 'agent', 'workspace-state.json'), 'utf8');
    const workspaceState = JSON.parse(workspaceStateRaw) as {
      bootstrapMode?: string;
      pendingConflictCount?: number;
      onboardingStage?: string;
    };
    expect(workspaceState.bootstrapMode).toBe('metadata_guided');
    expect(workspaceState.pendingConflictCount).toBe(0);
    expect(workspaceState.onboardingStage).toBe('completed');

    const conflictsRaw = await readFile(join(base, 'agent', 'USER_CONFLICTS.md'), 'utf8');
    expect(conflictsRaw).toContain('status: resolved');
    const userRaw = await readFile(join(base, 'agent', 'USER.md'), 'utf8');
    expect(userRaw).toContain('- gender: Male');
  });
});
