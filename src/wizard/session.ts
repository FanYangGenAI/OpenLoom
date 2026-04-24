import type { WizardPrompter } from './prompts.js';

export type WizardStepType = 'note' | 'select' | 'text' | 'confirm';

export interface WizardStep {
  id: string;
  type: WizardStepType;
  message?: string;
  title?: string;
  options?: Array<{ value: unknown; label: string; hint?: string }>;
  initialValue?: unknown;
  allowSkip?: boolean;
}

export type WizardSessionStatus = 'running' | 'done' | 'cancelled' | 'error';

export class WizardSession {
  private status: WizardSessionStatus = 'running';
  private error?: string;
  private currentStep: WizardStep | null = null;
  private stepWaiter: ((step: WizardStep | null) => void) | null = null;
  private answerWaiters = new Map<string, (value: unknown) => void>();
  private answerRejectors = new Map<string, (reason?: unknown) => void>();
  private static nextId = 0;

  constructor(
    private readonly runner: (prompter: WizardPrompter) => Promise<void>,
    private readonly prompter?: WizardPrompter,
  ) {
    if (!this.prompter) {
      this.prompter = this.createProtocolPrompter();
    }
  }

  async run(): Promise<{ status: WizardSessionStatus; error?: string }> {
    if (this.status !== 'running') {
      return { status: this.status, error: this.error };
    }

    try {
      await this.runner(this.prompter as WizardPrompter);
      this.status = 'done';
    } catch (error) {
      this.status = 'error';
      this.error = error instanceof Error ? error.message : String(error);
    }
    this.resolveStep(null);
    return { status: this.status, error: this.error };
  }

  cancel(reason = 'cancelled by user'): void {
    if (this.status !== 'running') return;
    this.status = 'cancelled';
    this.error = reason;
    for (const reject of this.answerRejectors.values()) {
      reject(new Error(reason));
    }
    this.answerRejectors.clear();
    this.answerWaiters.clear();
    this.currentStep = null;
    this.resolveStep(null);
  }

  getStatus(): WizardSessionStatus {
    return this.status;
  }

  async next(): Promise<{ done: boolean; step?: WizardStep; status: WizardSessionStatus; error?: string }> {
    if (this.currentStep) {
      return { done: false, step: this.currentStep, status: this.status };
    }
    if (this.status !== 'running') {
      return { done: true, status: this.status, error: this.error };
    }
    const step = await new Promise<WizardStep | null>((resolve) => {
      this.stepWaiter = resolve;
    });
    if (step) {
      return { done: false, step, status: this.status };
    }
    return { done: true, status: this.status, error: this.error };
  }

  answer(stepId: string, value: unknown): void {
    const resolve = this.answerWaiters.get(stepId);
    if (!resolve) {
      throw new Error(`wizard: no pending step ${stepId}`);
    }
    this.answerWaiters.delete(stepId);
    this.answerRejectors.delete(stepId);
    this.currentStep = null;
    resolve(value);
  }

  private pushStep(step: WizardStep): void {
    this.currentStep = step;
    this.resolveStep(step);
  }

  private resolveStep(step: WizardStep | null): void {
    if (!this.stepWaiter) return;
    const resolve = this.stepWaiter;
    this.stepWaiter = null;
    resolve(step);
  }

  private awaitAnswer(step: WizardStep): Promise<unknown> {
    this.pushStep(step);
    return new Promise<unknown>((resolve, reject) => {
      this.answerWaiters.set(step.id, resolve);
      this.answerRejectors.set(step.id, reject);
    });
  }

  private static createId(prefix: string): string {
    WizardSession.nextId += 1;
    return `${prefix}-${Date.now().toString(36)}-${WizardSession.nextId}`;
  }

  private createProtocolPrompter(): WizardPrompter {
    return {
      intro: async (title: string): Promise<void> => {
        await this.awaitAnswer({
          id: WizardSession.createId('intro'),
          type: 'note',
          title,
          message: '',
        });
      },
      outro: async (message: string): Promise<void> => {
        await this.awaitAnswer({
          id: WizardSession.createId('outro'),
          type: 'note',
          title: 'Done',
          message,
        });
      },
      note: async (message: string, title?: string): Promise<void> => {
        await this.awaitAnswer({
          id: WizardSession.createId('note'),
          type: 'note',
          title,
          message,
        });
      },
      select: async <T>(params: {
        message: string;
        options: Array<{ value: T; label: string; hint?: string }>;
        initialValue?: T;
      }): Promise<T> => {
        const answer = await this.awaitAnswer({
          id: WizardSession.createId('select'),
          type: 'select',
          message: params.message,
          options: params.options.map((option) => ({
            value: option.value,
            label: option.label,
            hint: option.hint,
          })),
          initialValue: params.initialValue,
        });
        if (answer === undefined || answer === null || answer === '') {
          return (params.initialValue ?? params.options[0]?.value) as T;
        }
        return answer as T;
      },
      text: async (params: {
        message: string;
        initialValue?: string;
        allowSkip?: boolean;
      }): Promise<string> => {
        const answer = await this.awaitAnswer({
          id: WizardSession.createId('text'),
          type: 'text',
          message: params.message,
          initialValue: params.initialValue,
          allowSkip: params.allowSkip,
        });
        if (typeof answer === 'string') return answer;
        if (answer === undefined || answer === null) return params.initialValue ?? '';
        return String(answer);
      },
      confirm: async (params: { message: string; initialValue?: boolean }): Promise<boolean> => {
        const answer = await this.awaitAnswer({
          id: WizardSession.createId('confirm'),
          type: 'confirm',
          message: params.message,
          initialValue: params.initialValue,
        });
        if (typeof answer === 'boolean') return answer;
        if (typeof answer === 'string') {
          const normalized = answer.trim().toLowerCase();
          if (['y', 'yes', 'true', '1'].includes(normalized)) return true;
          if (['n', 'no', 'false', '0'].includes(normalized)) return false;
        }
        return params.initialValue ?? false;
      },
    };
  }
}
