import { readFile } from 'fs/promises';
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
  if (resolvedCount > 0) {
    await appendUpdateLog(openloomDir, `guided-onboarding resolved ${resolvedCount} conflict(s)`);
  }
  return next;
}
