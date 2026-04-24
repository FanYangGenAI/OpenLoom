import { resolve } from 'path';
import {
  loadSettings,
  markInitialized,
  resolveOpenloomDir,
  saveSettings,
  setDefaultRoot,
} from '../../config/user-settings.js';
import { upsertLessonsSections } from '../../config/lessons-memory.js';
import { createCliWizardPrompter } from '../../wizard/prompts.js';
import { runOnboardingWizard } from '../../wizard/onboarding.js';
import { WizardSession } from '../../wizard/session.js';
import {
  isOnboardingCompleted,
  updateWorkspaceState,
} from '../../config/workspace-state.js';
import {
  ensureAgentBootstrapFiles,
  finalizeBootstrapLifecycle,
  updateBootstrapMemoryFiles,
} from '../../config/agent-memory/bootstrap-files.js';

interface SetupOptions {
  openloom?: string;
  root?: string;
  nonInteractive?: boolean;
}

function printEnvironmentChecks(): void {
  const deepseekAvailable = Boolean(process.env.DEEPSEEK_API_KEY);
  const ollamaAvailable = Boolean(process.env.OLLAMA_HOST) || Boolean(process.env.OLLAMA_BASE_URL);
  console.log('\nEnvironment checks:');
  console.log(`- online OCR (DEEPSEEK_API_KEY): ${deepseekAvailable ? 'ready' : 'missing'}`);
  console.log(`- local OCR (OLLAMA_HOST/OLLAMA_BASE_URL): ${ollamaAvailable ? 'ready' : 'missing'}`);
}

export async function setupCommand(options: SetupOptions): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  const settings = await loadSettings(openloomDir);
  const alreadyOnboarded = await isOnboardingCompleted(openloomDir);
  const prompter = createCliWizardPrompter({ nonInteractive: options.nonInteractive });

  await ensureAgentBootstrapFiles(openloomDir);
  await updateWorkspaceState(openloomDir, {
    lastWizardRunAt: new Date().toISOString(),
    lastWizardSource: 'setup',
  });

  try {
    const session = new WizardSession(async (wizard) => {
      const onboarding = await runOnboardingWizard(wizard, {
        initialRoot: options.root,
      });

      await upsertLessonsSections(
        openloomDir,
        {
          preferredUserName: onboarding.preferredUserName,
          preferredAgentName: onboarding.preferredAgentName,
          tone: onboarding.tone,
          languagePreference: onboarding.languagePreference,
          formatPreference: onboarding.formatPreference,
        },
        settings.initialized || alreadyOnboarded
          ? 'refresh onboarding preferences'
          : 'initial onboarding capture',
      );

      await updateBootstrapMemoryFiles(openloomDir, {
        preferredUserName: onboarding.preferredUserName,
        preferredAgentName: onboarding.preferredAgentName,
        tone: onboarding.tone,
        languagePreference: onboarding.languagePreference,
        formatPreference: onboarding.formatPreference,
      });

      printEnvironmentChecks();

      const rootPath = onboarding.defaultRoot?.trim() || options.root?.trim();
      if (rootPath) {
        await setDefaultRoot(openloomDir, resolve(rootPath));
      }
    }, prompter);

    const result = await session.run();
    if (result.status !== 'done') {
      throw new Error(result.error ?? 'setup wizard failed');
    }

    const latest = await loadSettings(openloomDir);
    await saveSettings(openloomDir, {
      ...latest,
      openloom_dir: openloomDir,
    });
    await markInitialized(openloomDir);
    await updateWorkspaceState(openloomDir, {
      onboardingCompletedAt: new Date().toISOString(),
    });
    await finalizeBootstrapLifecycle(openloomDir);

    console.log('\nSetup completed.');
    console.log(`- Settings saved: ${openloomDir}/config/user-settings.json`);
    console.log(`- Workspace state saved: ${openloomDir}/agent/workspace-state.json`);
    console.log(`- Lessons saved: ${openloomDir}/agent/lessons.md`);
  } finally {
    prompter.close();
  }
}
