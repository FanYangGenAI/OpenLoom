# USER_CHANGELOG.md

## Purpose

Track all promoted updates to `USER.md` with traceable evidence scope, validation status, and rollback pointers.

## Change Log

### user-v1-2026-04-24T13-10-00Z

- promoted_at: 2026-04-24T13:10:00Z
- profile_schema_version: 1.0.0
- parent_version: null
- update_type: bootstrap_and_stage_a_seed
- changed_sections:
  - StructuredProfile.identity_static
  - StructuredProfile.lifecycle_dynamic
  - StructuredProfile.spatiotemporal_timeline
  - StructuredProfile.evidence_index
  - StructuredProfile.sensitive_fields_policy
  - NarrativeSummary
  - OpenQuestions
- change_summary:
  - Seeded a hybrid profile structure (machine-readable + narrative).
  - Added timeline events for education, work, and residence-related signals.
  - Added evidence index references and confidence values for each event.
  - Introduced env-key encryption policy and masking requirements for sensitive fields.
- evidence_scope:
  - b0200ef1e8e9d0efce7bd895ee964477a354e22398a3fa2bba81cef3cd2999d9
  - 59b1506151ed58ffca8d32fb3073aba7d6d425c2c4bd325e5869ba5777836bff
  - a29d13b82052f10cd2af2c91ead5c6b6d0877c91031fff4da5153bdf37e56ef3
  - 6fab25e033e949fb5139f22825d25632bb49540c5912884827fcb59e95c74c22
  - 5e53adada89e6adfdd71e4bd99096027bb0fc7fa5cca14bdc8dac2c337260137
  - 99bdfc10f407f7c11140f03561e85dd02c6f5061fa0d3d0e26faaf17738a4339
- validation:
  consistency_check: pass
  traceability_check: pass
  privacy_check: pass
  readability_check: pass
- rollback:
  rollback_to_parent: not_applicable
  rollback_hint: "Restore previous USER.md snapshot once snapshot files are enabled."

## Rollback Policy

- Never update `USER.md` directly from raw extraction output.
- Always generate `USER.candidate.md` first, then validate and promote.
- On validation failure, keep current `USER.md` unchanged and append a failed attempt record.
- On post-promotion regression, restore target snapshot and record a new changelog entry.
