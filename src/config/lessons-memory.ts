import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { mergeLessons, renderLessons } from './agent-memory/lessons-merge.js';

export interface LessonsInput {
  preferredUserName?: string;
  preferredAgentName?: string;
  tone?: string;
  languagePreference?: string;
  formatPreference?: string;
  workingAgreements?: string[];
}

function getLessonsPath(openloomDir: string): string {
  return resolve(openloomDir, 'agent', 'lessons.md');
}

function valueOrPending(value?: string): string {
  return value?.trim() ? value.trim() : 'pending';
}

function buildLessonsContent(input: LessonsInput, updateReason: string): string {
  const now = new Date().toISOString();
  const agreements = (input.workingAgreements ?? []).filter((item) => item.trim().length > 0);

  return [
    '# Agent Lessons',
    '',
    '## UserProfile',
    `- preferred_user_name: ${valueOrPending(input.preferredUserName)}`,
    `- preferred_agent_name: ${valueOrPending(input.preferredAgentName)}`,
    '',
    '## CommunicationStyle',
    `- tone: ${valueOrPending(input.tone)}`,
    `- language_preference: ${valueOrPending(input.languagePreference)}`,
    `- format_preference: ${valueOrPending(input.formatPreference)}`,
    '',
    '## WorkingAgreements',
    ...(agreements.length > 0 ? agreements.map((item) => `- ${item}`) : ['- pending']),
    '',
    '## UpdateLog',
    `- ${now}: ${updateReason}`,
    '',
  ].join('\n');
}

export async function readLessons(openloomDir: string): Promise<string> {
  try {
    return await readFile(getLessonsPath(openloomDir), 'utf8');
  } catch {
    return '';
  }
}

export async function upsertLessonsSections(
  openloomDir: string,
  input: LessonsInput,
  updateReason: string,
): Promise<void> {
  const lessonsPath = getLessonsPath(openloomDir);
  await mkdir(dirname(lessonsPath), { recursive: true });
  const existing = await readLessons(openloomDir);
  const content =
    existing.trim().length > 0
      ? renderLessons(mergeLessons(existing, input, updateReason))
      : buildLessonsContent(input, updateReason);
  await atomicWrite(lessonsPath, content);
}

export async function appendUpdateLog(openloomDir: string, message: string): Promise<void> {
  const lessonsPath = getLessonsPath(openloomDir);
  await mkdir(dirname(lessonsPath), { recursive: true });
  const current = await readLessons(openloomDir);
  const base = current.trim().length > 0 ? current.trimEnd() : buildLessonsContent({}, 'initialize lessons');
  const next = `${base}\n- ${new Date().toISOString()}: ${message}\n`;
  await atomicWrite(lessonsPath, next);
}

async function atomicWrite(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}-${Date.now().toString(36)}`;
  await writeFile(tmp, content, 'utf8');
  try {
    await rename(tmp, path);
  } catch (error) {
    await unlink(tmp).catch(() => {});
    throw error;
  }
}
