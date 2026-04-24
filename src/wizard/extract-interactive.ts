import type { WizardPrompter } from './prompts.js';

export interface InteractiveExtractOptions {
  ocrProvider: 'online' | 'local';
  skipFaceDetection: boolean;
  textConcurrency: number;
  imageConcurrency: number;
}

export async function runInteractiveExtractWizard(
  prompter: WizardPrompter,
  defaults: InteractiveExtractOptions,
): Promise<InteractiveExtractOptions> {
  await prompter.intro('Interactive Extract Wizard');
  await prompter.note('Press Enter to keep defaults. You can always run non-interactive mode.', 'Extract');

  const ocrProvider = await prompter.select<'online' | 'local'>({
    message: 'OCR provider',
    options: [
      { value: 'online', label: 'online', hint: 'DeepSeek API' },
      { value: 'local', label: 'local', hint: 'Ollama local model' },
    ],
    initialValue: defaults.ocrProvider,
  });

  const skipFaceDetection = await prompter.confirm({
    message: 'Skip face detection',
    initialValue: defaults.skipFaceDetection,
  });

  const textConcurrencyInput = await prompter.text({
    message: `Text concurrency (current: ${defaults.textConcurrency})`,
    initialValue: String(defaults.textConcurrency),
  });
  const imageConcurrencyInput = await prompter.text({
    message: `Image concurrency (current: ${defaults.imageConcurrency})`,
    initialValue: String(defaults.imageConcurrency),
  });

  await prompter.outro('Interactive extract options resolved.');
  return {
    ocrProvider,
    skipFaceDetection,
    textConcurrency: Math.max(1, Number.parseInt(textConcurrencyInput, 10) || defaults.textConcurrency),
    imageConcurrency: Math.max(
      1,
      Number.parseInt(imageConcurrencyInput, 10) || defaults.imageConcurrency,
    ),
  };
}
