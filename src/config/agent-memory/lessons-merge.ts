import type { LessonsInput } from '../lessons-memory.js';
import { parseLessons, type ParsedLessons } from './lessons-parser.js';

function normalizeIncoming(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === 'skip') return undefined;
  return trimmed;
}

function choose(existing?: string, incoming?: string): string {
  return normalizeIncoming(incoming) ?? existing ?? 'pending';
}

function mergeAgreements(existing: string[], incoming: string[] = []): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const item of [...existing, ...incoming]) {
    const value = item.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(value);
  }

  return merged.length > 0 ? merged : ['pending'];
}

export interface MergedLessonsState extends ParsedLessons {
  updateReason: string;
}

export function mergeLessons(
  existingContent: string,
  incoming: LessonsInput,
  updateReason: string,
): MergedLessonsState {
  const parsed = parseLessons(existingContent);
  return {
    preferredUserName: choose(parsed.preferredUserName, incoming.preferredUserName),
    preferredAgentName: choose(parsed.preferredAgentName, incoming.preferredAgentName),
    tone: choose(parsed.tone, incoming.tone),
    languagePreference: choose(parsed.languagePreference, incoming.languagePreference),
    formatPreference: choose(parsed.formatPreference, incoming.formatPreference),
    workingAgreements: mergeAgreements(parsed.workingAgreements, incoming.workingAgreements),
    updateLog: [...parsed.updateLog, `${new Date().toISOString()}: ${updateReason}`],
    updateReason,
  };
}

export function renderLessons(state: MergedLessonsState): string {
  return [
    '# Agent Lessons',
    '',
    '## UserProfile',
    `- preferred_user_name: ${state.preferredUserName ?? 'pending'}`,
    `- preferred_agent_name: ${state.preferredAgentName ?? 'pending'}`,
    '',
    '## CommunicationStyle',
    `- tone: ${state.tone ?? 'pending'}`,
    `- language_preference: ${state.languagePreference ?? 'pending'}`,
    `- format_preference: ${state.formatPreference ?? 'pending'}`,
    '',
    '## WorkingAgreements',
    ...state.workingAgreements.map((item) => `- ${item}`),
    '',
    '## UpdateLog',
    ...state.updateLog.map((item) => `- ${item}`),
    '',
  ].join('\n');
}
