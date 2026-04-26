import { randomUUID } from 'crypto';
import { appendUpdateLog } from '../config/lessons-memory.js';
import { runConcurrent } from '../ingestion/extractors/concurrency.js';
import { listAllMetadata, type MetadataDoc } from './metadata.js';
import { extractClaimsFromMetadata, resolveClaimConflicts } from './llm.js';
import {
  GateValidationOutputSchema,
  UserConflictsDocumentSchema,
  type ClaimCandidate,
  type ConflictResolutionOutput,
  type GateValidationOutput,
} from './types.js';
import { readProfileExtractState, writeProfileExtractState } from './state.js';
import { updateVersionArtifacts, writeConflictsDoc, writeUserProfile } from './io.js';

export interface BuildProfileOptions {
  openloomDir: string;
  force?: boolean;
  concurrency?: number;
  extractClaimsFn?: typeof extractClaimsFromMetadata;
  resolveConflictsFn?: typeof resolveClaimConflicts;
}

export interface BuildProfileResult {
  runId: string;
  deltaCount: number;
  consumedCount: number;
  promoted: boolean;
  pendingConflicts: number;
  skippedCount: number;
}

function candidateToResolved(candidate: ClaimCandidate) {
  return {
    fact_key: candidate.fact_key,
    value: candidate.value,
    event_type: candidate.event_type,
    time: candidate.time,
    location: candidate.location,
    final_confidence: candidate.final_confidence,
    evidence_hashes: candidate.evidence_hashes,
    evidence_refs: candidate.evidence_refs,
    update_allowed: candidate.final_confidence >= 0.85,
  };
}

function buildGateOutput(
  runId: string,
  totalDelta: number,
  consumed: number,
  resolution: ConflictResolutionOutput,
): GateValidationOutput {
  const traceabilityViolations = resolution.resolved_facts
    .filter((fact) => fact.evidence_refs.length === 0)
    .map((fact) => fact.fact_key);
  const lowConfidence = resolution.resolved_facts
    .filter((fact) => fact.final_confidence < 0.85)
    .map((fact) => fact.fact_key);
  const pendingConflicts = resolution.conflicts
    .filter((conflict) => conflict.decision === 'requires_user_confirmation')
    .map((conflict) => conflict.fact_key);
  const hardConflictFactKeys = resolution.conflicts
    .filter((conflict) => conflict.decision === 'requires_user_confirmation')
    .filter((conflict) => isHardConflictFactKey(conflict.fact_key))
    .map((conflict) => conflict.fact_key);

  const gateResults = [
    {
      gate_name: 'coverage' as const,
      passed: consumed === totalDelta,
      reason: consumed === totalDelta ? 'All delta hashes consumed.' : 'Some delta hashes were not consumed.',
      blocking: true,
      affected_fact_keys: [],
    },
    {
      gate_name: 'traceability' as const,
      passed: traceabilityViolations.length === 0,
      reason: traceabilityViolations.length === 0 ? 'All facts have evidence refs.' : 'Missing evidence refs.',
      blocking: false,
      affected_fact_keys: traceabilityViolations,
    },
    {
      gate_name: 'consistency' as const,
      passed: true,
      reason: 'Consistency is delegated to conflict resolution stage.',
      blocking: true,
      affected_fact_keys: [],
    },
    {
      gate_name: 'confidence' as const,
      passed: lowConfidence.length === 0,
      reason: lowConfidence.length === 0 ? 'All facts passed confidence threshold.' : 'Some facts below threshold.',
      blocking: false,
      affected_fact_keys: lowConfidence,
    },
    {
      gate_name: 'conflict' as const,
      passed: hardConflictFactKeys.length === 0,
      reason:
        hardConflictFactKeys.length === 0
          ? pendingConflicts.length === 0
            ? 'No pending conflicts.'
            : 'Only soft conflicts detected; profile update is allowed.'
          : 'Hard conflicts require confirmation before promotion.',
      blocking: true,
      affected_fact_keys: hardConflictFactKeys,
    },
  ];

  const allPassed = gateResults.every((gate) => !gate.blocking || gate.passed);
  return GateValidationOutputSchema.parse({
    run_id: runId,
    total_delta_hashes: totalDelta,
    consumed_delta_hashes: consumed,
    gate_results: gateResults,
    all_passed: allPassed,
    promotion_decision: allPassed ? 'promote' : 'hold',
    summary: allPassed ? 'All required gates passed.' : 'Blocking gates failed.',
  });
}

function isHardConflictFactKey(factKey: string): boolean {
  const hardPrefixes = [
    'birthplace',
    'identity.birth_date',
    'identity.birth_place',
    'identity.legal_name',
    'identity.nationality',
    'legal.id_number',
    'legal.passport_number',
    'family.marital_status',
    'family.children_count',
  ];
  return hardPrefixes.some((prefix) => factKey.startsWith(prefix));
}

function hashList(docs: MetadataDoc[]): string[] {
  return docs.map((doc) => doc.hash);
}

function enrichResolutionEvidence(
  resolution: ConflictResolutionOutput,
  allClaims: ConflictResolutionOutput['resolved_facts'],
): ConflictResolutionOutput {
  const claimByKey = new Map<string, Array<{ evidence_hashes: string[]; evidence_refs: string[] }>>();
  for (const claim of allClaims) {
    const bucket = claimByKey.get(claim.fact_key) ?? [];
    bucket.push({ evidence_hashes: claim.evidence_hashes, evidence_refs: claim.evidence_refs });
    claimByKey.set(claim.fact_key, bucket);
  }

  const resolved_facts = resolution.resolved_facts.map((fact) => {
    if (fact.evidence_refs.length > 0 && fact.evidence_hashes.length > 0) return fact;
    const candidates = claimByKey.get(fact.fact_key) ?? [];
    const evidence_hashes = new Set(fact.evidence_hashes);
    const evidence_refs = new Set(fact.evidence_refs);
    for (const candidate of candidates) {
      for (const hash of candidate.evidence_hashes) evidence_hashes.add(hash);
      for (const ref of candidate.evidence_refs) evidence_refs.add(ref);
    }
    const next = {
      ...fact,
      evidence_hashes: Array.from(evidence_hashes),
      evidence_refs: Array.from(evidence_refs),
    };
    if (next.evidence_refs.length === 0 && next.evidence_hashes.length > 0) {
      next.evidence_refs = next.evidence_hashes.map((hash) => `metadata_hash:${hash}`);
    }
    return next;
  });

  return {
    ...resolution,
    resolved_facts,
  };
}

export async function buildUserProfileFromMetadata(options: BuildProfileOptions): Promise<BuildProfileResult> {
  const extractClaims = options.extractClaimsFn ?? extractClaimsFromMetadata;
  const resolveConflicts = options.resolveConflictsFn ?? resolveClaimConflicts;
  const runId = randomUUID();
  const concurrency = Math.max(1, options.concurrency ?? 6);
  const allMetadata = await listAllMetadata(options.openloomDir);
  const state = await readProfileExtractState(options.openloomDir);
  const processedSet = new Set(state.processed_hashes);
  const delta = options.force ? allMetadata : allMetadata.filter((doc) => !processedSet.has(doc.hash));

  if (delta.length === 0) {
    return {
      runId,
      deltaCount: 0,
      consumedCount: 0,
      promoted: false,
      pendingConflicts: 0,
      skippedCount: allMetadata.length,
    };
  }

  const tasks = delta.map((doc) => async () =>
    extractClaims({
      metadataHash: doc.hash,
      metadataFilePath: doc.filePath,
      frontmatterYaml: doc.frontmatterYaml,
      summary: doc.summary,
    }),
  );
  const settled = await runConcurrent(tasks, concurrency);
  const success = settled
    .filter((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof extractClaimsFromMetadata>>> => item.status === 'fulfilled')
    .map((item) => item.value);

  const allClaims = success.flatMap((out) => out.claims.map(candidateToResolved));
  const fallbackResolution: ConflictResolutionOutput = {
    model: 'gemini-2.5-pro',
    resolved_facts: allClaims,
    conflicts: [],
    global_decision: 'promote',
    summary: 'Fallback resolution used due to empty conflict output.',
  };

  const rawResolution = await resolveConflicts({
    runId,
    claimsJson: JSON.stringify(allClaims),
  }).catch(() => fallbackResolution);
  const resolution = enrichResolutionEvidence(rawResolution, allClaims);

  const gates = buildGateOutput(runId, delta.length, success.length, resolution);
  const conflictsDoc = UserConflictsDocumentSchema.parse({
    schema_version: '1.0.0',
    model: 'gemini-2.5-pro',
    updated_at: new Date().toISOString(),
    conflicts: resolution.conflicts.map((conflict) => ({
      conflict_id: conflict.conflict_id,
      fact_key: conflict.fact_key,
      candidates: conflict.candidates.map((candidate) => ({
        value: candidate.value,
        confidence: candidate.confidence,
        evidence_hashes: candidate.evidence_hashes,
        evidence_refs: candidate.evidence_refs,
        reason: candidate.reason,
      })),
      recommended_candidate: conflict.recommended_value ?? null,
      recommended_confidence: conflict.recommended_confidence ?? null,
      status: 'pending_user_confirm',
      freeze_user_update: conflict.freeze_user_update,
      lessons_rule_key: conflict.lessons_rule_suggested ?? null,
    })),
  });
  await writeConflictsDoc(options.openloomDir, conflictsDoc);

  const pendingConflicts = conflictsDoc.conflicts.length;
  if (!gates.all_passed) {
    await appendUpdateLog(
      options.openloomDir,
      `profile-build hold: pending conflicts or gate failure; run_id=${runId}; pending_conflicts=${pendingConflicts}`,
    );
    return {
      runId,
      deltaCount: delta.length,
      consumedCount: success.length,
      promoted: false,
      pendingConflicts,
      skippedCount: allMetadata.length - delta.length,
    };
  }

  const hardConflictFactKeys = new Set(
    resolution.conflicts
      .filter((conflict) => conflict.decision === 'requires_user_confirmation')
      .filter((conflict) => isHardConflictFactKey(conflict.fact_key))
      .map((conflict) => conflict.fact_key),
  );
  const sourceFacts = resolution.resolved_facts.length > 0 ? resolution.resolved_facts : allClaims;
  const promotedFacts = sourceFacts.filter(
    (fact) => fact.update_allowed && !hardConflictFactKeys.has(fact.fact_key),
  );
  await writeUserProfile(options.openloomDir, promotedFacts);
  const parentVersion = null;
  const versionId = `user-v1-${new Date().toISOString().replaceAll(':', '-')}`;
  await updateVersionArtifacts(
    options.openloomDir,
    versionId,
    parentVersion,
    hashList(delta),
    `Promoted ${promotedFacts.length} facts from metadata profile extraction.`,
  );

  const nextHashes = options.force ? hashList(allMetadata) : [...state.processed_hashes, ...hashList(delta)];
  await writeProfileExtractState(options.openloomDir, nextHashes);
  await appendUpdateLog(
    options.openloomDir,
    `profile-build promote: run_id=${runId}; promoted_facts=${promotedFacts.length}; delta_hashes=${delta.length}`,
  );

  return {
    runId,
    deltaCount: delta.length,
    consumedCount: success.length,
    promoted: true,
    pendingConflicts,
    skippedCount: allMetadata.length - delta.length,
  };
}
