import { stdin as input, stdout as output } from 'process';
import { resolve } from 'path';
import { createInterface } from 'readline/promises';
import {
  loadSettings,
  markInitialized,
  resolveOpenloomDir,
  saveSettings,
  setDefaultRoot,
} from '../../config/user-settings.js';
import { upsertLessonsSections } from '../../config/lessons-memory.js';

interface SetupOptions {
  openloom?: string;
  root?: string;
  nonInteractive?: boolean;
}

async function promptWithSkip(
  rl: ReturnType<typeof createInterface>,
  question: string,
): Promise<string | undefined> {
  const answer = (await rl.question(`${question} (type "skip" to skip): `)).trim();
  if (!answer || answer.toLowerCase() === 'skip') return undefined;
  return answer;
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
  const rl = createInterface({ input, output });

  console.log('OpenLoom Setup');
  console.log('=============');
  console.log(`OpenLoom directory: ${openloomDir}`);

  try {
    const preferredUserName = options.nonInteractive
      ? undefined
      : await promptWithSkip(rl, 'How should the agent address you');
    const preferredAgentName = options.nonInteractive
      ? undefined
      : await promptWithSkip(rl, 'How would you like to address the agent');
    const tone = options.nonInteractive
      ? undefined
      : await promptWithSkip(rl, 'Preferred conversation style (e.g. concise/friendly/professional)');
    const formatPreference = options.nonInteractive
      ? undefined
      : await promptWithSkip(rl, 'Preferred output format (e.g. summary-first/detailed)');
    const languagePreference = options.nonInteractive
      ? undefined
      : await promptWithSkip(rl, 'Preferred language');

    await upsertLessonsSections(
      openloomDir,
      {
        preferredUserName,
        preferredAgentName,
        tone,
        languagePreference,
        formatPreference,
      },
      settings.initialized ? 'refresh onboarding preferences' : 'initial onboarding capture',
    );

    printEnvironmentChecks();

    let rootPath = options.root?.trim();
    if (!rootPath && !options.nonInteractive) {
      rootPath = await promptWithSkip(rl, 'Default user data root directory path');
    }

    if (rootPath?.trim()) {
      await setDefaultRoot(openloomDir, resolve(rootPath));
    }

    const latest = await loadSettings(openloomDir);
    await saveSettings(openloomDir, {
      ...latest,
      openloom_dir: openloomDir,
    });
    await markInitialized(openloomDir);

    console.log('\nSetup completed.');
    console.log(`- Settings saved: ${openloomDir}/config/user-settings.json`);
    console.log(`- Lessons saved: ${openloomDir}/agent/lessons.md`);
  } finally {
    rl.close();
  }
}
