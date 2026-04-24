import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

export type WizardSelectOption<T = string> = {
  value: T;
  label: string;
  hint?: string;
};

export type WizardPrompter = {
  intro: (title: string) => Promise<void>;
  outro: (message: string) => Promise<void>;
  note: (message: string, title?: string) => Promise<void>;
  select: <T>(params: {
    message: string;
    options: Array<WizardSelectOption<T>>;
    initialValue?: T;
  }) => Promise<T>;
  text: (params: {
    message: string;
    initialValue?: string;
    allowSkip?: boolean;
  }) => Promise<string>;
  confirm: (params: { message: string; initialValue?: boolean }) => Promise<boolean>;
};

function normalizeText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase() === 'skip') return '';
  return trimmed;
}

export function createCliWizardPrompter(options?: {
  nonInteractive?: boolean;
}): WizardPrompter & { close: () => void } {
  const nonInteractive = options?.nonInteractive ?? false;
  const rl = createInterface({ input, output });

  return {
    async intro(title: string): Promise<void> {
      console.log(`\n${title}`);
      console.log('='.repeat(title.length));
    },
    async outro(message: string): Promise<void> {
      console.log(`\n${message}`);
    },
    async note(message: string, title?: string): Promise<void> {
      if (title) {
        console.log(`\n[${title}]`);
      }
      console.log(message);
    },
    async select<T>(params: {
      message: string;
      options: Array<WizardSelectOption<T>>;
      initialValue?: T;
    }): Promise<T> {
      const fallback =
        params.initialValue !== undefined ? params.initialValue : params.options[0]?.value;
      if (fallback === undefined) {
        throw new Error('wizard select requires at least one option');
      }
      if (nonInteractive) return fallback;

      console.log(`\n${params.message}`);
      params.options.forEach((option, idx) => {
        const hint = option.hint ? ` — ${option.hint}` : '';
        console.log(`  ${idx + 1}. ${option.label}${hint}`);
      });

      const answer = (await rl.question(`Choose [1-${params.options.length}] (Enter for default): `)).trim();
      if (!answer) return fallback;
      const index = Number.parseInt(answer, 10);
      if (!Number.isNaN(index) && index >= 1 && index <= params.options.length) {
        return params.options[index - 1].value;
      }
      return fallback;
    },
    async text(params: {
      message: string;
      initialValue?: string;
      allowSkip?: boolean;
    }): Promise<string> {
      if (nonInteractive) return params.initialValue ?? '';
      const skipHint = params.allowSkip ? ' (type "skip" to skip)' : '';
      const answer = await rl.question(`${params.message}${skipHint}: `);
      const normalized = normalizeText(answer);
      if (!normalized && params.initialValue) {
        return params.initialValue;
      }
      return normalized;
    },
    async confirm(params: { message: string; initialValue?: boolean }): Promise<boolean> {
      const initial = params.initialValue ?? true;
      if (nonInteractive) return initial;
      const answer = (await rl.question(`${params.message} [y/N]: `)).trim().toLowerCase();
      if (!answer) return initial;
      return answer === 'y' || answer === 'yes' || answer === 'true';
    },
    close(): void {
      rl.close();
    },
  };
}
