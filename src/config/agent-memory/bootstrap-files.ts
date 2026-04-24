import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { updateWorkspaceState } from '../workspace-state.js';
import {
  BOOTSTRAP_TEMPLATE,
  IDENTITY_TEMPLATE,
  SOUL_TEMPLATE,
  USER_TEMPLATE,
} from './bootstrap-templates.js';

export interface BootstrapFilePaths {
  bootstrapPath: string;
  identityPath: string;
  userPath: string;
  soulPath: string;
}

function filePath(openloomDir: string, fileName: string): string {
  return resolve(openloomDir, 'agent', fileName);
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  try {
    await readFile(path, 'utf8');
  } catch {
    await writeFile(path, content, 'utf8');
  }
}

export async function ensureAgentBootstrapFiles(openloomDir: string): Promise<BootstrapFilePaths> {
  const paths: BootstrapFilePaths = {
    bootstrapPath: filePath(openloomDir, 'BOOTSTRAP.md'),
    identityPath: filePath(openloomDir, 'IDENTITY.md'),
    userPath: filePath(openloomDir, 'USER.md'),
    soulPath: filePath(openloomDir, 'SOUL.md'),
  };

  await writeIfMissing(paths.bootstrapPath, BOOTSTRAP_TEMPLATE);
  await writeIfMissing(paths.identityPath, IDENTITY_TEMPLATE);
  await writeIfMissing(paths.userPath, USER_TEMPLATE);
  await writeIfMissing(paths.soulPath, SOUL_TEMPLATE);

  await updateWorkspaceState(openloomDir, {
    bootstrapSeededAt: new Date().toISOString(),
  });

  return paths;
}

export async function updateBootstrapMemoryFiles(
  openloomDir: string,
  input: {
    preferredUserName?: string;
    preferredAgentName?: string;
    tone?: string;
    languagePreference?: string;
    formatPreference?: string;
  },
): Promise<void> {
  const identityPath = filePath(openloomDir, 'IDENTITY.md');
  const userPath = filePath(openloomDir, 'USER.md');
  const soulPath = filePath(openloomDir, 'SOUL.md');

  const currentIdentity = await readFile(identityPath, 'utf8').catch(() => IDENTITY_TEMPLATE);
  const currentUser = await readFile(userPath, 'utf8').catch(() => USER_TEMPLATE);
  const currentSoul = await readFile(soulPath, 'utf8').catch(() => SOUL_TEMPLATE);

  const nextIdentity = currentIdentity.replace(
    /- name:\s*.*/g,
    `- name: ${input.preferredAgentName ?? 'pending'}`,
  );
  const nextUser = currentUser
    .replace(/- preferred_user_name:\s*.*/g, `- preferred_user_name: ${input.preferredUserName ?? 'pending'}`)
    .replace(
      /- preferred_agent_name:\s*.*/g,
      `- preferred_agent_name: ${input.preferredAgentName ?? 'pending'}`,
    )
    .replace(
      /- language_preference:\s*.*/g,
      `- language_preference: ${input.languagePreference ?? 'pending'}`,
    );
  const nextSoul = currentSoul
    .replace(/- tone:\s*.*/g, `- tone: ${input.tone ?? 'pending'}`)
    .replace(
      /- format_preference:\s*.*/g,
      `- format_preference: ${input.formatPreference ?? 'pending'}`,
    );

  await writeFile(identityPath, nextIdentity, 'utf8');
  await writeFile(userPath, nextUser, 'utf8');
  await writeFile(soulPath, nextSoul, 'utf8');
}
