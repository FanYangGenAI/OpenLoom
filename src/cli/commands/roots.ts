import { resolve } from 'path';
import { getDefaultRoot, resolveOpenloomDir, setDefaultRoot } from '../../config/user-settings.js';
import { createCliWizardPrompter } from '../../wizard/prompts.js';

interface RootsCommandOptions {
  openloom?: string;
}

export async function rootsShowCommand(options: RootsCommandOptions): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  const root = await getDefaultRoot(openloomDir);

  if (!root) {
    console.log('No default root configured.');
    return;
  }

  console.log(`Default root: ${root.path}`);
}

export async function rootsSetCommand(
  rootPath: string | undefined,
  options: RootsCommandOptions,
): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  let pathInput = rootPath?.trim();

  if (!pathInput) {
    if (process.env.VITEST) {
      console.log('No root path provided. Skip update.');
      return;
    }
    const prompter = createCliWizardPrompter();
    try {
      pathInput = await prompter.text({
        message: 'Root directory path',
      });
    } finally {
      prompter.close();
    }
  }

  if (!pathInput) {
    console.log('No root path provided. Skip update.');
    return;
  }

  const resolvedRoot = resolve(pathInput);
  await setDefaultRoot(openloomDir, resolvedRoot);
  console.log(`Default root set to: ${resolvedRoot}`);
}

export async function rootsClearCommand(options: RootsCommandOptions): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  await setDefaultRoot(openloomDir, null);
  console.log('Default root cleared.');
}
