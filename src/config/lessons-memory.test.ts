import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { appendUpdateLog, readLessons, upsertLessonsSections } from './lessons-memory.js';

describe('lessons-memory', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('creates lessons markdown with pending placeholders', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-lessons-'));
    tempDirs.push(base);

    await upsertLessonsSections(base, {}, 'initial onboarding');
    const content = await readLessons(base);

    expect(content).toContain('## UserProfile');
    expect(content).toContain('preferred_user_name: pending');
    expect(content).toContain('## UpdateLog');
  });

  it('writes provided onboarding values', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-lessons-'));
    tempDirs.push(base);

    await upsertLessonsSections(
      base,
      {
        preferredUserName: 'Fan',
        preferredAgentName: 'Loomy',
        tone: 'concise',
        languagePreference: 'zh-CN',
        formatPreference: 'summary-first',
        workingAgreements: ['Discuss before coding'],
      },
      'capture profile',
    );

    const content = await readLessons(base);
    expect(content).toContain('preferred_user_name: Fan');
    expect(content).toContain('preferred_agent_name: Loomy');
    expect(content).toContain('- Discuss before coding');
  });

  it('appends update log entry without losing previous sections', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-lessons-'));
    tempDirs.push(base);

    await upsertLessonsSections(base, { preferredUserName: 'A' }, 'init');
    await appendUpdateLog(base, 'updated tone preference');

    const content = await readLessons(base);
    expect(content).toContain('## CommunicationStyle');
    expect(content).toContain('updated tone preference');
  });
});
