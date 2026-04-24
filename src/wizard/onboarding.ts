import type { WizardPrompter } from './prompts.js';

export interface OnboardingWizardInput {
  initialRoot?: string;
}

export interface OnboardingWizardResult {
  preferredUserName?: string;
  preferredAgentName?: string;
  tone?: string;
  formatPreference?: string;
  languagePreference?: string;
  defaultRoot?: string;
}

export async function runOnboardingWizard(
  prompter: WizardPrompter,
  input: OnboardingWizardInput = {},
): Promise<OnboardingWizardResult> {
  await prompter.intro('OpenLoom Onboarding Wizard');
  await prompter.note(
    'You can type "skip" for optional profile questions and fill them later.',
    'Onboarding',
  );

  const preferredUserName = await prompter.text({
    message: 'How should the agent address you',
    allowSkip: true,
  });
  const preferredAgentName = await prompter.text({
    message: 'How would you like to address the agent',
    allowSkip: true,
  });
  const tone = await prompter.text({
    message: 'Preferred conversation style (concise/friendly/professional)',
    allowSkip: true,
  });
  const formatPreference = await prompter.text({
    message: 'Preferred output format (summary-first/detailed/step-by-step)',
    allowSkip: true,
  });
  const languagePreference = await prompter.text({
    message: 'Preferred language',
    allowSkip: true,
  });
  const defaultRoot = await prompter.text({
    message: 'Default user data root directory path',
    initialValue: input.initialRoot ?? '',
    allowSkip: true,
  });

  await prompter.outro('Onboarding questions completed.');
  return {
    preferredUserName: preferredUserName || undefined,
    preferredAgentName: preferredAgentName || undefined,
    tone: tone || undefined,
    formatPreference: formatPreference || undefined,
    languagePreference: languagePreference || undefined,
    defaultRoot: defaultRoot || undefined,
  };
}
