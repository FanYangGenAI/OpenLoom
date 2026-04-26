import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildUserProfileFromMetadata } from './build.js';

async function writeMetadataFile(base: string, subdir: 'text_docs' | 'images', hash: string, summary: string) {
  const dir = join(base, '.openloom', 'metadata', subdir);
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${hash}.md`);
  const content = `---
file_path: "C:/tmp/${hash}.md"
file_name: "${hash}.md"
file_type: "text_doc"
mime_type: "text/markdown"
file_size: 1
created_at: "2026-01-01T00:00:00.000Z"
modified_at: "2026-01-01T00:00:00.000Z"
hash: "${hash}"
parent_folder: "C:/tmp"
tags:
  keywords: []
  entities:
    persons: []
    places: []
    orgs: []
    other: []
spatiotemporal: []
extracted_at: "2026-01-01T00:00:00.000Z"
extractor_version: "0.1.0"
agent_used: "TextDocAgent"
model_used: "gemini-2.5-pro"
extraction_errors: []
---

${summary}
`;
  await writeFile(file, content, 'utf8');
}

describe('buildUserProfileFromMetadata', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('promotes profile and writes state when no conflicts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openloom-profile-'));
    tempDirs.push(root);
    const openloomDir = join(root, '.openloom');
    await writeMetadataFile(root, 'text_docs', 'hash-a', 'summary a');
    await writeMetadataFile(root, 'text_docs', 'hash-b', 'summary b');

    const result = await buildUserProfileFromMetadata({
      openloomDir,
      extractClaimsFn: async ({ metadataHash }) => ({
        metadata_hash: metadataHash,
        model: 'gemini-2.5-pro',
        claims: [
          {
            fact_key: `work_${metadataHash}`,
            event_type: 'work',
            value: `Worked on ${metadataHash}`,
            time: { time_start: '2024-01', time_end: null, time_text: '2024-present', precision: 'month' },
            location: { city: 'New York', province_or_state: 'NY', country: 'USA', raw_text: 'New York, NY' },
            evidence_hashes: [metadataHash],
            evidence_refs: [`evi_${metadataHash}`],
            model_confidence: 0.95,
            source_reliability_score: 0.9,
            final_confidence: 0.9,
            status: 'candidate',
            reasoning: 'mock',
          },
        ],
        extraction_notes: [],
      }),
      resolveConflictsFn: async ({ claimsJson }) => {
        const claims = JSON.parse(claimsJson) as Array<Record<string, unknown>>;
        return {
          model: 'gemini-2.5-pro',
          resolved_facts: claims.map((c) => ({
            ...c,
            update_allowed: true,
          })),
          conflicts: [],
          global_decision: 'promote',
          summary: 'ok',
        };
      },
    });

    expect(result.promoted).toBe(true);
    const stateRaw = await readFile(join(openloomDir, 'agent', 'profile-extract-state.json'), 'utf8');
    expect(stateRaw).toContain('hash-a');
    expect(stateRaw).toContain('hash-b');
    const userRaw = await readFile(join(openloomDir, 'agent', 'USER.md'), 'utf8');
    expect(userRaw).toContain('## Work');
  });

  it('holds profile update when conflicts require confirmation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openloom-profile-'));
    tempDirs.push(root);
    const openloomDir = join(root, '.openloom');
    await writeMetadataFile(root, 'text_docs', 'hash-c', 'summary c');

    const result = await buildUserProfileFromMetadata({
      openloomDir,
      extractClaimsFn: async ({ metadataHash }) => ({
        metadata_hash: metadataHash,
        model: 'gemini-2.5-pro',
        claims: [
          {
            fact_key: 'birthplace',
            event_type: 'identity',
            value: 'Anqing, Anhui',
            time: { time_start: '1984-09-27', time_end: '1984-09-27', time_text: '1984-09-27', precision: 'day' },
            location: { city: 'Anqing', province_or_state: 'Anhui', country: 'China', raw_text: 'Anqing, Anhui' },
            evidence_hashes: [metadataHash],
            evidence_refs: [`evi_${metadataHash}`],
            model_confidence: 0.8,
            source_reliability_score: 0.8,
            final_confidence: 0.8,
            status: 'candidate',
            reasoning: 'mock',
          },
        ],
        extraction_notes: [],
      }),
      resolveConflictsFn: async () => ({
        model: 'gemini-2.5-pro',
        resolved_facts: [],
        conflicts: [
          {
            conflict_id: 'c1',
            fact_key: 'birthplace',
            candidates: [
              { value: 'Anqing, Anhui', confidence: 0.9, evidence_hashes: ['hash-c'], evidence_refs: ['evi_hash-c'], reason: 'majority' },
              { value: 'Shanghai', confidence: 0.1, evidence_hashes: ['hash-c'], evidence_refs: ['evi_hash-c'], reason: 'minority' },
            ],
            recommended_value: 'Anqing, Anhui',
            recommended_confidence: 0.9,
            decision: 'requires_user_confirmation',
            freeze_user_update: true,
            lessons_rule_suggested: 'birthplace.manual_confirmation',
          },
        ],
        global_decision: 'hold',
        summary: 'conflict',
      }),
    });

    expect(result.promoted).toBe(false);
    expect(result.pendingConflicts).toBe(1);
    const conflictRaw = await readFile(join(openloomDir, 'agent', 'USER_CONFLICTS.md'), 'utf8');
    expect(conflictRaw).toContain('birthplace');
  });

  it('promotes profile when only work soft-conflicts exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openloom-profile-'));
    tempDirs.push(root);
    const openloomDir = join(root, '.openloom');
    await writeMetadataFile(root, 'text_docs', 'hash-d', 'summary d');

    const result = await buildUserProfileFromMetadata({
      openloomDir,
      extractClaimsFn: async ({ metadataHash }) => ({
        metadata_hash: metadataHash,
        model: 'gemini-2.5-pro',
        claims: [
          {
            fact_key: 'work.five9_2024_present',
            event_type: 'work',
            value: 'Senior ML Engineer at Five9',
            time: { time_start: '2024-08', time_end: null, time_text: '2024-present', precision: 'month' },
            location: { city: 'New York', province_or_state: 'NY', country: 'USA', raw_text: 'New York, NY' },
            evidence_hashes: [metadataHash],
            evidence_refs: [`evi_${metadataHash}`],
            model_confidence: 0.95,
            source_reliability_score: 0.9,
            final_confidence: 0.9,
            status: 'candidate',
            reasoning: 'mock',
          },
        ],
        extraction_notes: [],
      }),
      resolveConflictsFn: async ({ claimsJson }) => {
        const claims = JSON.parse(claimsJson) as Array<Record<string, unknown>>;
        return {
          model: 'gemini-2.5-pro',
          resolved_facts: claims.map((c) => ({ ...c, update_allowed: true })),
          conflicts: [
            {
              conflict_id: 'w1',
              fact_key: 'work.timeline',
              candidates: [
                { value: 'role a', confidence: 0.6, evidence_hashes: ['hash-d'], evidence_refs: ['evi_hash-d'], reason: 'overlap' },
                { value: 'role b', confidence: 0.4, evidence_hashes: ['hash-d'], evidence_refs: ['evi_hash-d'], reason: 'overlap' },
              ],
              recommended_value: null,
              recommended_confidence: null,
              decision: 'requires_user_confirmation',
              freeze_user_update: true,
              lessons_rule_suggested: 'work.parallel_roles.confirmation',
            },
          ],
          global_decision: 'promote_with_pending_conflicts',
          summary: 'soft conflict',
        };
      },
    });

    expect(result.promoted).toBe(true);
    expect(result.pendingConflicts).toBe(1);
    const userRaw = await readFile(join(openloomDir, 'agent', 'USER.md'), 'utf8');
    expect(userRaw).toContain('Senior ML Engineer at Five9');
    const conflictsRaw = await readFile(join(openloomDir, 'agent', 'USER_CONFLICTS.md'), 'utf8');
    expect(conflictsRaw).toContain('work.timeline');
  });
});
