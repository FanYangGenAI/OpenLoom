import { describe, expect, it, vi } from 'vitest';
import { WizardSession } from './session.js';
import type { WizardPrompter } from './prompts.js';

function mockPrompter(): WizardPrompter {
  return {
    intro: vi.fn(async () => {}),
    outro: vi.fn(async () => {}),
    note: vi.fn(async () => {}),
    select: vi.fn(async ({ initialValue }) => initialValue ?? 'online'),
    text: vi.fn(async ({ initialValue }) => initialValue ?? ''),
    confirm: vi.fn(async ({ initialValue }) => initialValue ?? true),
  };
}

describe('WizardSession', () => {
  it('returns done status when runner succeeds', async () => {
    const prompter = mockPrompter();
    const session = new WizardSession(async (p) => {
      await p.intro('test');
      await p.outro('done');
    }, prompter);

    const result = await session.run();
    expect(result.status).toBe('done');
    expect(session.getStatus()).toBe('done');
  });

  it('returns error status when runner throws', async () => {
    const prompter = mockPrompter();
    const session = new WizardSession(async () => {
      throw new Error('boom');
    }, prompter);

    const result = await session.run();
    expect(result.status).toBe('error');
    expect(result.error).toContain('boom');
  });

  it('can be cancelled before run', async () => {
    const prompter = mockPrompter();
    const session = new WizardSession(async () => {}, prompter);
    session.cancel('manual cancel');

    expect(session.getStatus()).toBe('cancelled');
  });
});
