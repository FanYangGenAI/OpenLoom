import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { parse as yamlParse } from 'yaml';
import { appendUpdateLog } from '../config/lessons-memory.js';
import { type UserConflictsDocument, UserConflictsDocumentSchema } from './types.js';
import { writeConflictsDoc } from './io.js';

export interface PendingConflictItem {
  conflictId: string;
  factKey: string;
  candidates: Array<{ value: string; confidence: number }>;
  recommendedCandidate?: string | null;
}

export interface ConflictDecision {
  conflictId: string;
  selectedValue?: string;
  resolutionNote?: string;
}

const FACT_TO_GENERAL_FIELD: Array<{ prefix: string; field: string }> = [
  { prefix: 'identity.official_name', field: 'official_name' },
  { prefix: 'identity.legal_name', field: 'official_name' },
  { prefix: 'identity.name', field: 'official_name' },
  { prefix: 'identity.birth_date', field: 'date_of_birth' },
  { prefix: 'identity.birth_place', field: 'place_of_birth' },
  { prefix: 'identity.gender', field: 'gender' },
  { prefix: 'identity.sex', field: 'gender' },
  { prefix: 'identity.nationality', field: 'nationality' },
];

function extractFrontmatter(raw: string): string | null {
  if (!raw.startsWith('---')) return null;
  const second = raw.indexOf('\n---', 3);
  if (second < 0) return null;
  return raw.slice(4, second).trim();
}

export async function readUserConflictsDoc(openloomDir: string): Promise<UserConflictsDocument | null> {
  try {
    const path = `${openloomDir}/agent/USER_CONFLICTS.md`;
    const raw = await readFile(path, 'utf8');
    const fm = extractFrontmatter(raw);
    if (!fm) return null;
    const parsed = yamlParse(fm);
    return UserConflictsDocumentSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function listPendingConflicts(doc: UserConflictsDocument | null): PendingConflictItem[] {
  if (!doc) return [];
  return doc.conflicts
    .filter((conflict) => conflict.status === 'pending_user_confirm')
    .map((conflict) => ({
      conflictId: conflict.conflict_id,
      factKey: conflict.fact_key,
      candidates: conflict.candidates.map((candidate) => ({
        value: candidate.value,
        confidence: candidate.confidence,
      })),
      recommendedCandidate: conflict.recommended_candidate ?? null,
    }));
}

function mapFactKeyToGeneralField(factKey: string): string | null {
  const matched = FACT_TO_GENERAL_FIELD.find((item) => factKey.startsWith(item.prefix));
  return matched?.field ?? null;
}

function splitGeneralBlock(raw: string): { start: number; end: number } | null {
  const start = raw.indexOf('## General');
  if (start < 0) return null;
  const rest = raw.slice(start + '## General'.length);
  const nextHeaderOffset = rest.search(/\n##\s+/);
  const end = nextHeaderOffset >= 0 ? start + '## General'.length + nextHeaderOffset : raw.length;
  return { start, end };
}

async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now().toString(36)}`;
  await writeFile(tmp, content, 'utf8');
  try {
    await rename(tmp, path);
  } catch (error) {
    await unlink(tmp).catch(() => {});
    throw error;
  }
}

async function applyGeneralFieldUpdates(
  openloomDir: string,
  updates: Array<{ field: string; value: string }>,
): Promise<number> {
  if (updates.length === 0) return 0;
  const userPath = `${openloomDir}/agent/USER.md`;
  const raw = await readFile(userPath, 'utf8').catch(() => '# USER.md\n\n## General\n\n');
  const uniq = new Map<string, string>();
  for (const item of updates) {
    const value = item.value.trim();
    if (!value) continue;
    uniq.set(item.field, value);
  }
  if (uniq.size === 0) return 0;

  const block = splitGeneralBlock(raw);
  if (!block) return 0;
  const prefix = raw.slice(0, block.start);
  const general = raw.slice(block.start, block.end);
  const suffix = raw.slice(block.end);
  const lines = general.split('\n');
  let changed = 0;
  for (const [field, value] of uniq.entries()) {
    const pattern = new RegExp(`^- ${field}:\\s*.*$`);
    const index = lines.findIndex((line) => pattern.test(line));
    const next = `- ${field}: ${value}`;
    if (index >= 0) {
      if (lines[index] !== next) {
        lines[index] = next;
        changed += 1;
      }
    } else {
      const insertAt = lines.findIndex((line) => line.startsWith('### GeneralSummary'));
      const target = insertAt >= 0 ? insertAt : lines.length;
      lines.splice(target, 0, next);
      changed += 1;
    }
  }
  if (changed > 0) {
    await atomicWrite(userPath, `${prefix}${lines.join('\n')}${suffix}`);
  }
  return changed;
}

export async function applyConflictDecisions(
  openloomDir: string,
  doc: UserConflictsDocument,
  decisions: ConflictDecision[],
): Promise<UserConflictsDocument> {
  const byId = new Map(decisions.map((decision) => [decision.conflictId, decision]));
  const next: UserConflictsDocument = {
    ...doc,
    updated_at: new Date().toISOString(),
    conflicts: doc.conflicts.map((conflict) => {
      const decision = byId.get(conflict.conflict_id);
      if (!decision || !decision.selectedValue) return conflict;
      return {
        ...conflict,
        status: 'resolved',
        resolved_by: 'user',
        resolved_at: new Date().toISOString(),
        resolution_note:
          decision.resolutionNote ?? `user_selected=${decision.selectedValue}; fact_key=${conflict.fact_key}`,
      };
    }),
  };
  await writeConflictsDoc(openloomDir, next);
  const resolvedCount = decisions.filter((item) => Boolean(item.selectedValue)).length;
  const generalUpdates: Array<{ field: string; value: string }> = [];
  for (const conflict of doc.conflicts) {
    const decision = byId.get(conflict.conflict_id);
    if (!decision?.selectedValue) continue;
    const field = mapFactKeyToGeneralField(conflict.fact_key);
    if (!field) continue;
    generalUpdates.push({ field, value: decision.selectedValue });
  }
  const userUpdatedCount = await applyGeneralFieldUpdates(openloomDir, generalUpdates);
  if (resolvedCount > 0) {
    await appendUpdateLog(openloomDir, `guided-onboarding resolved ${resolvedCount} conflict(s)`);
  }
  if (userUpdatedCount > 0) {
    await appendUpdateLog(
      openloomDir,
      `guided-onboarding updated USER.md General fields: ${userUpdatedCount}`,
    );
  }
  return next;
}
