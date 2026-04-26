import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { USER_TEMPLATE } from '../../config/agent-memory/bootstrap-templates.js';
import { saveWorkspaceState } from '../../config/workspace-state.js';
import { resolveOpenloomDir } from '../../config/user-settings.js';
import { buildUserProfileFromMetadata } from '../../profile/build.js';

interface ProfileBuildOptions {
  openloom?: string;
  force?: boolean;
  concurrency?: string;
}

export async function profileBuildCommand(opts: ProfileBuildOptions): Promise<void> {
  const openloomDir = resolveOpenloomDir(opts.openloom);
  const concurrency = opts.concurrency ? parseInt(opts.concurrency, 10) : 6;
  const result = await buildUserProfileFromMetadata({
    openloomDir,
    force: opts.force ?? false,
    concurrency,
  });

  console.log(`Profile build run_id: ${result.runId}`);
  console.log(`Delta metadata: ${result.deltaCount}, consumed: ${result.consumedCount}, skipped: ${result.skippedCount}`);
  console.log(`Pending conflicts: ${result.pendingConflicts}`);
  console.log(`Promotion: ${result.promoted ? 'done (USER.md updated)' : 'hold (check USER_CONFLICTS.md)'}`);
}

interface ProfileResetOptions {
  openloom?: string;
}

const PROFILE_RESET_AGENT_FILES: readonly string[] = [
  'USER_CONFLICTS.md',
  'USER_CHANGELOG.md',
  'USER_VERSION_MANIFEST.json',
  'profile-extract-state.json',
  'USER.candidate.md',
];

async function tryUnlinkFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') return;
    throw error;
  }
}

/** Cold start: template USER.md, remove profile pipeline artifacts, reset agent lessons, minimal workspace state. */
export async function profileResetCommand(opts: ProfileResetOptions): Promise<void> {
  const openloomDir = resolveOpenloomDir(opts.openloom);
  const agentDir = join(openloomDir, 'agent');
  await mkdir(agentDir, { recursive: true });
  const userPath = join(agentDir, 'USER.md');
  await writeFile(userPath, `${USER_TEMPLATE.trimEnd()}\n`, 'utf8');

  for (const name of PROFILE_RESET_AGENT_FILES) {
    await tryUnlinkFile(join(agentDir, name));
  }

  const now = new Date().toISOString();
  const lessonsContent = [
    '# Agent Lessons',
    '',
    '## UserProfile',
    '- preferred_user_name: pending',
    '- preferred_agent_name: pending',
    '',
    '## CommunicationStyle',
    '- tone: pending',
    '- language_preference: pending',
    '- format_preference: pending',
    '',
    '## WorkingAgreements',
    '- pending',
    '',
    '## UpdateLog',
    `- ${now}: profile reset to cold start`,
    '',
  ].join('\n');
  await writeFile(join(agentDir, 'lessons.md'), lessonsContent, 'utf8');

  await saveWorkspaceState(openloomDir, { version: 1 });
  console.log('Profile reset: USER.md to template, pipeline/related files removed, lessons and workspace state reset.');
}
