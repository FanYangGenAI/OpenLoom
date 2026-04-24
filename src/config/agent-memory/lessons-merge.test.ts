import { describe, expect, it } from 'vitest';
import { mergeLessons, renderLessons } from './lessons-merge.js';

describe('lessons-merge', () => {
  it('preserves existing values when incoming fields are skipped', () => {
    const existing = [
      '# Agent Lessons',
      '',
      '## UserProfile',
      '- preferred_user_name: Fan',
      '- preferred_agent_name: Loomy',
      '',
      '## CommunicationStyle',
      '- tone: concise',
      '- language_preference: zh-CN',
      '- format_preference: summary-first',
      '',
      '## WorkingAgreements',
      '- discuss before coding',
      '',
      '## UpdateLog',
      '- 2026-01-01T00:00:00.000Z: init',
      '',
    ].join('\n');

    const merged = mergeLessons(
      existing,
      {
        preferredUserName: 'skip',
        preferredAgentName: '',
      },
      'refresh',
    );
    const content = renderLessons(merged);

    expect(content).toContain('preferred_user_name: Fan');
    expect(content).toContain('preferred_agent_name: Loomy');
    expect(content).toContain('refresh');
  });

  it('deduplicates working agreements and appends new ones', () => {
    const existing = [
      '# Agent Lessons',
      '',
      '## UserProfile',
      '- preferred_user_name: pending',
      '- preferred_agent_name: pending',
      '',
      '## CommunicationStyle',
      '- tone: pending',
      '- language_preference: pending',
      '- format_preference: pending',
      '',
      '## WorkingAgreements',
      '- discuss before coding',
      '',
      '## UpdateLog',
      '- 2026-01-01T00:00:00.000Z: init',
      '',
    ].join('\n');

    const merged = mergeLessons(
      existing,
      {
        workingAgreements: ['Discuss before coding', 'share test logs'],
      },
      'update agreements',
    );
    const content = renderLessons(merged);

    expect(content.toLowerCase()).toContain('- discuss before coding');
    expect(content).toContain('- share test logs');
  });
});
