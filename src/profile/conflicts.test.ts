import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { applyConflictDecisions } from './conflicts.js';
import type { UserConflictsDocument } from './types.js';

describe('applyConflictDecisions', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('updates USER.md General fields for mapped identity conflicts', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-conflicts-'));
    tempDirs.push(base);
    await mkdir(join(base, 'agent'), { recursive: true });
    await writeFile(
      join(base, 'agent', 'USER.md'),
      [
        '# USER.md',
        '',
        '## General',
        '',
        '- official_name: unknown',
        '- date_of_birth: unknown',
        '- place_of_birth: unknown',
        '- gender: unknown',
        '- nationality: unknown',
        '',
        '### GeneralSummary',
        '',
        'unknown',
        '',
      ].join('\n'),
      'utf8',
    );

    const doc: UserConflictsDocument = {
      schema_version: '1.0.0',
      model: 'gemini-2.5-pro',
      updated_at: new Date().toISOString(),
      conflicts: [
        {
          conflict_id: 'c1',
          fact_key: 'identity.gender',
          candidates: [],
          status: 'pending_user_confirm',
          freeze_user_update: true,
        },
        {
          conflict_id: 'c2',
          fact_key: 'work.some_role',
          candidates: [],
          status: 'pending_user_confirm',
          freeze_user_update: false,
        },
      ],
    };

    await applyConflictDecisions(base, doc, [
      { conflictId: 'c1', selectedValue: 'Male' },
      { conflictId: 'c2', selectedValue: 'Founder (2023 - Present)' },
    ]);

    const userRaw = await readFile(join(base, 'agent', 'USER.md'), 'utf8');
    expect(userRaw).toContain('- gender: Male');
    expect(userRaw).not.toContain('Founder (2023 - Present)');

    const conflictsRaw = await readFile(join(base, 'agent', 'USER_CONFLICTS.md'), 'utf8');
    expect(conflictsRaw).toContain('status: resolved');
  });
});
