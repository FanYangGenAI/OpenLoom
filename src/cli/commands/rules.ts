import {
  getScanRules,
  resetScanRules,
  resolveOpenloomDir,
  updateScanRules,
} from '../../config/user-settings.js';

interface RulesCommandOptions {
  openloom?: string;
}

export async function rulesShowCommand(options: RulesCommandOptions): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  const rules = await getScanRules(openloomDir);
  console.log(`Rules version: ${rules.version}`);
  console.log(`Include (${rules.include.length}):`);
  for (const pattern of rules.include) console.log(`- ${pattern}`);
  console.log(`Exclude (${rules.exclude.length}):`);
  for (const pattern of rules.exclude) console.log(`- ${pattern}`);
}

export async function rulesIncludeAddCommand(
  pattern: string,
  options: RulesCommandOptions,
): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  const rules = await getScanRules(openloomDir);
  await updateScanRules(openloomDir, { include: [...rules.include, pattern] });
  console.log(`Include rule added: ${pattern}`);
}

export async function rulesIncludeRemoveCommand(
  pattern: string,
  options: RulesCommandOptions,
): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  const rules = await getScanRules(openloomDir);
  await updateScanRules(openloomDir, {
    include: rules.include.filter((rule) => rule !== pattern),
  });
  console.log(`Include rule removed: ${pattern}`);
}

export async function rulesExcludeAddCommand(
  pattern: string,
  options: RulesCommandOptions,
): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  const rules = await getScanRules(openloomDir);
  await updateScanRules(openloomDir, { exclude: [...rules.exclude, pattern] });
  console.log(`Exclude rule added: ${pattern}`);
}

export async function rulesExcludeRemoveCommand(
  pattern: string,
  options: RulesCommandOptions,
): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  const rules = await getScanRules(openloomDir);
  await updateScanRules(openloomDir, {
    exclude: rules.exclude.filter((rule) => rule !== pattern),
  });
  console.log(`Exclude rule removed: ${pattern}`);
}

export async function rulesResetDefaultCommand(options: RulesCommandOptions): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  await resetScanRules(openloomDir);
  console.log('Rules reset to defaults.');
}
