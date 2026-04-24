import { resolve } from 'path';
import {
  addRoot,
  getDefaultRoot,
  listRoots,
  removeRoot,
  resolveOpenloomDir,
  setDefaultRoot,
} from '../../config/user-settings.js';
import { createCliWizardPrompter } from '../../wizard/prompts.js';

interface RootsCommandOptions {
  openloom?: string;
}

export async function rootsShowCommand(options: RootsCommandOptions): Promise<void> {
  await rootsListCommand(options);
}

export async function rootsListCommand(options: RootsCommandOptions): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  const roots = await listRoots(openloomDir);
  const root = await getDefaultRoot(openloomDir);

  if (roots.length === 0) {
    console.log('No source roots configured.');
    return;
  }
  console.log('Configured source roots:');
  for (const configuredRoot of roots) {
    const marker = configuredRoot.path === root?.path ? ' (default)' : '';
    console.log(`- ${configuredRoot.path}${marker}`);
  }
}

export async function rootsAddCommand(
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
  await addRoot(openloomDir, resolvedRoot);
  console.log(`Source root added: ${resolvedRoot}`);
}

export async function rootsSetDefaultCommand(
  rootPath: string | undefined,
  options: RootsCommandOptions,
): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  if (!rootPath?.trim()) {
    console.log('No root path provided. Skip update.');
    return;
  }
  const resolvedRoot = resolve(rootPath.trim());
  await addRoot(openloomDir, resolvedRoot);
  await setDefaultRoot(openloomDir, resolvedRoot);
  console.log(`Default root set to: ${resolvedRoot}`);
}

export async function rootsRemoveCommand(
  rootPath: string | undefined,
  options: RootsCommandOptions,
): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  if (!rootPath?.trim()) {
    console.log('No root path provided. Skip remove.');
    return;
  }
  const resolvedRoot = resolve(rootPath.trim());
  await removeRoot(openloomDir, resolvedRoot);
  console.log(`Source root removed: ${resolvedRoot}`);
}

export async function rootsClearCommand(options: RootsCommandOptions): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  const roots = await listRoots(openloomDir);
  for (const root of roots) {
    await removeRoot(openloomDir, root.path);
  }
  await setDefaultRoot(openloomDir, null);
  console.log('All source roots cleared.');
}
