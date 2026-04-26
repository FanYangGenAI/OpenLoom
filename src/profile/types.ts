import { z } from 'zod';

export const TimeWindowSchema = z.object({
  time_start: z.string().nullable().optional(),
  time_end: z.string().nullable().optional(),
  time_text: z.string(),
  precision: z.enum(['day', 'month', 'year', 'range', 'unknown']).default('unknown'),
});

export const LocationInfoSchema = z.object({
  city: z.string().nullable().optional(),
  province_or_state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  raw_text: z.string().nullable().optional(),
});

export const ClaimCandidateSchema = z.object({
  fact_key: z.string(),
  event_type: z.enum(['identity', 'education', 'work', 'family', 'legal', 'residence', 'travel']),
  value: z.string(),
  time: TimeWindowSchema,
  location: LocationInfoSchema,
  evidence_hashes: z.array(z.string()).default([]),
  evidence_refs: z.array(z.string()).default([]),
  model_confidence: z.number().min(0).max(1),
  source_reliability_score: z.number().min(0).max(1),
  final_confidence: z.number().min(0).max(1),
  status: z.enum(['candidate', 'accepted', 'conflict_pending']).default('candidate'),
  reasoning: z.string(),
});

export const ClaimExtractionOutputSchema = z.object({
  metadata_hash: z.string(),
  model: z.literal('gemini-2.5-pro').default('gemini-2.5-pro'),
  claims: z.array(ClaimCandidateSchema).default([]),
  extraction_notes: z.array(z.string()).default([]),
});

export const ConflictCandidateSchema = z.object({
  value: z.string(),
  confidence: z.number().min(0).max(1),
  evidence_hashes: z.array(z.string()).default([]),
  evidence_refs: z.array(z.string()).default([]),
  reason: z.string(),
});

export const ConflictItemSchema = z.object({
  conflict_id: z.string(),
  fact_key: z.string(),
  candidates: z.array(ConflictCandidateSchema).default([]),
  recommended_value: z.string().nullable().optional(),
  recommended_confidence: z.number().min(0).max(1).nullable().optional(),
  decision: z.enum(['auto_accept', 'requires_user_confirmation', 'reject']).default('requires_user_confirmation'),
  freeze_user_update: z.boolean().default(true),
  lessons_rule_suggested: z.string().nullable().optional(),
});

export const ResolvedFactSchema = z.object({
  fact_key: z.string(),
  value: z.string(),
  event_type: z.enum(['identity', 'education', 'work', 'family', 'legal', 'residence', 'travel']),
  time: TimeWindowSchema,
  location: LocationInfoSchema,
  final_confidence: z.number().min(0).max(1),
  evidence_hashes: z.array(z.string()).default([]),
  evidence_refs: z.array(z.string()).default([]),
  update_allowed: z.boolean().default(true),
});

export const ConflictResolutionOutputSchema = z.object({
  model: z.literal('gemini-2.5-pro').default('gemini-2.5-pro'),
  resolved_facts: z.array(ResolvedFactSchema).default([]),
  conflicts: z.array(ConflictItemSchema).default([]),
  global_decision: z.enum(['promote', 'promote_with_pending_conflicts', 'hold']).default('hold'),
  summary: z.string(),
});

export const GateResultSchema = z.object({
  gate_name: z.enum(['coverage', 'traceability', 'consistency', 'confidence', 'conflict']),
  passed: z.boolean(),
  reason: z.string(),
  blocking: z.boolean().default(true),
  affected_fact_keys: z.array(z.string()).default([]),
});

export const GateValidationOutputSchema = z.object({
  run_id: z.string(),
  total_delta_hashes: z.number().int().nonnegative(),
  consumed_delta_hashes: z.number().int().nonnegative(),
  gate_results: z.array(GateResultSchema).default([]),
  all_passed: z.boolean().default(false),
  promotion_decision: z.enum(['promote', 'hold']).default('hold'),
  summary: z.string(),
});

export const ConflictRecordSchema = z.object({
  conflict_id: z.string(),
  fact_key: z.string(),
  candidates: z.array(ConflictCandidateSchema).default([]),
  recommended_candidate: z.string().nullable().optional(),
  recommended_confidence: z.number().min(0).max(1).nullable().optional(),
  status: z.enum(['pending_user_confirm', 'resolved']).default('pending_user_confirm'),
  freeze_user_update: z.boolean().default(true),
  resolved_by: z.enum(['user', 'rule']).nullable().optional(),
  resolved_at: z.string().nullable().optional(),
  resolution_note: z.string().nullable().optional(),
  lessons_rule_key: z.string().nullable().optional(),
});

export const UserConflictsDocumentSchema = z.object({
  schema_version: z.string().default('1.0.0'),
  model: z.literal('gemini-2.5-pro').default('gemini-2.5-pro'),
  updated_at: z.string(),
  conflicts: z.array(ConflictRecordSchema).default([]),
});

export type ClaimCandidate = z.infer<typeof ClaimCandidateSchema>;
export type ClaimExtractionOutput = z.infer<typeof ClaimExtractionOutputSchema>;
export type ResolvedFact = z.infer<typeof ResolvedFactSchema>;
export type ConflictResolutionOutput = z.infer<typeof ConflictResolutionOutputSchema>;
export type GateValidationOutput = z.infer<typeof GateValidationOutputSchema>;
export type UserConflictsDocument = z.infer<typeof UserConflictsDocumentSchema>;
