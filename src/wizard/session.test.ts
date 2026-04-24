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

  it('supports protocol next/answer flow without explicit prompter', async () => {
    const session = new WizardSession(async (p) => {
      await p.note('hello', 'greeting');
      const name = await p.text({ message: 'name?' });
      expect(name).toBe('Fan');
      const ok = await p.confirm({ message: 'continue?', initialValue: true });
      expect(ok).toBe(true);
    });

    const running = session.run();

    const step1 = await session.next();
    expect(step1.done).toBe(false);
    expect(step1.step?.type).toBe('note');
    session.answer(step1.step!.id, true);

    const step2 = await session.next();
    expect(step2.done).toBe(false);
    expect(step2.step?.type).toBe('text');
    session.answer(step2.step!.id, 'Fan');

    const step3 = await session.next();
    expect(step3.done).toBe(false);
    expect(step3.step?.type).toBe('confirm');
    session.answer(step3.step!.id, true);

    const step4 = await session.next();
    expect(step4.done).toBe(true);
    expect(step4.status).toBe('done');
    await running;
  });
});
