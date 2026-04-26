import type { WizardPrompter } from './prompts.js';
import type { ConflictDecision, PendingConflictItem } from '../profile/conflicts.js';

export interface GuidedOnboardingInput {
  pendingConflictCount: number;
  hasPriorOnboarding: boolean;
  initialRoot?: string;
  pendingConflicts: PendingConflictItem[];
}

export interface GuidedOnboardingResult {
  defaultRoot?: string;
  decisions: ConflictDecision[];
}

export async function runGuidedOnboardingWizard(
  prompter: WizardPrompter,
  input: GuidedOnboardingInput,
): Promise<GuidedOnboardingResult> {
  await prompter.intro('OpenLoom Guided Onboarding');
  await prompter.note(
    'We already extracted metadata. This flow focuses on confirmation and conflict follow-up, not re-entering everything.',
    'Guided Mode',
  );

  const continueConfirm = await prompter.confirm({
    message: `Detected ${input.pendingConflictCount} pending conflict(s). Continue with guided confirmation now`,
    initialValue: true,
  });
  if (!continueConfirm) {
    await prompter.outro('Guided onboarding skipped by user.');
    return { defaultRoot: input.initialRoot?.trim() || undefined, decisions: [] };
  }

  const decisions: ConflictDecision[] = [];
  if (input.pendingConflicts.length > 0) {
    await prompter.note('We will go through pending conflicts one by one.', 'Conflict Resolution');
    for (const conflict of input.pendingConflicts) {
      const options = conflict.candidates.map((candidate) => ({
        value: candidate.value,
        label: `${candidate.value} (confidence=${candidate.confidence.toFixed(2)})`,
      }));
      options.push({ value: '', label: 'Defer for later (keep pending)' });
      const selected = await prompter.select<string>({
        message: `Choose preferred value for ${conflict.factKey}`,
        options,
        initialValue: (conflict.recommendedCandidate ?? options[0]?.value ?? '') as string,
      });
      if (selected) {
        decisions.push({
          conflictId: conflict.conflictId,
          selectedValue: selected,
          resolutionNote: `guided_onboarding: user selected value for ${conflict.factKey}`,
        });
      }
    }
  } else {
    await prompter.note(
      'No pending conflicts detected. We will keep your current profile and preferences.',
      'Next Step',
    );
  }

  const root = await prompter.text({
    message: 'Default user data root directory path (optional)',
    initialValue: input.initialRoot ?? '',
    allowSkip: true,
  });

  const hasPrior = input.hasPriorOnboarding ? 'found' : 'not found';
  await prompter.outro(`Guided onboarding completed. Prior onboarding status: ${hasPrior}.`);
  return {
    defaultRoot: root?.trim() || undefined,
    decisions,
  };
}
