import type { WizardPrompter } from './prompts.js';

export type WizardStepType = 'note' | 'select' | 'text' | 'confirm';

export interface WizardStep {
  id: string;
  type: WizardStepType;
  message: string;
}

export type WizardSessionStatus = 'running' | 'done' | 'cancelled' | 'error';

export class WizardSession {
  private status: WizardSessionStatus = 'running';
  private error?: string;

  constructor(
    private readonly runner: (prompter: WizardPrompter) => Promise<void>,
    private readonly prompter: WizardPrompter,
  ) {}

  async run(): Promise<{ status: WizardSessionStatus; error?: string }> {
    if (this.status !== 'running') {
      return { status: this.status, error: this.error };
    }

    try {
      await this.runner(this.prompter);
      this.status = 'done';
    } catch (error) {
      this.status = 'error';
      this.error = error instanceof Error ? error.message : String(error);
    }
    return { status: this.status, error: this.error };
  }

  cancel(reason = 'cancelled by user'): void {
    if (this.status !== 'running') return;
    this.status = 'cancelled';
    this.error = reason;
  }

  getStatus(): WizardSessionStatus {
    return this.status;
  }
}
