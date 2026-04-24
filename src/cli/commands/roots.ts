import { resolve } from 'path';
import { getDefaultRoot, resolveOpenloomDir, setDefaultRoot } from '../../config/user-settings.js';

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
  rootPath: string,
  options: RootsCommandOptions,
): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  const resolvedRoot = resolve(rootPath);
  await setDefaultRoot(openloomDir, resolvedRoot);
  console.log(`Default root set to: ${resolvedRoot}`);
}

export async function rootsClearCommand(options: RootsCommandOptions): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  await setDefaultRoot(openloomDir, null);
  console.log('Default root cleared.');
}
