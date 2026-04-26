import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { stringify as yamlStringify } from 'yaml';
import type { ResolvedFact, UserConflictsDocument } from './types.js';

function userPath(openloomDir: string): string {
  return join(openloomDir, 'agent', 'USER.md');
}

function conflictsPath(openloomDir: string): string {
  return join(openloomDir, 'agent', 'USER_CONFLICTS.md');
}

function manifestPath(openloomDir: string): string {
  return join(openloomDir, 'agent', 'USER_VERSION_MANIFEST.json');
}

function changelogPath(openloomDir: string): string {
  return join(openloomDir, 'agent', 'USER_CHANGELOG.md');
}

function sectionFacts(facts: ResolvedFact[], eventType: ResolvedFact['event_type']): ResolvedFact[] {
  return facts
    .filter((fact) => fact.event_type === eventType)
    .sort((a, b) => (a.time.time_start ?? '').localeCompare(b.time.time_start ?? ''));
}

function renderFactLine(fact: ResolvedFact): string {
  const time = fact.time.time_text || `${fact.time.time_start ?? 'Unknown'} to ${fact.time.time_end ?? 'Unknown'}`;
  const place = [fact.location.city, fact.location.province_or_state, fact.location.country]
    .filter(Boolean)
    .join(', ');
  const locationSuffix = place ? ` @ ${place}` : '';
  return `- ${time}: ${fact.value}${locationSuffix} (confidence=${fact.final_confidence.toFixed(2)}, evidence_refs=[${fact.evidence_refs.join(', ')}])`;
}

function renderGeneralSummary(facts: ResolvedFact[]): string {
  const workNow = facts.find((f) => f.event_type === 'work' && f.time.time_end == null);
  const identity = facts.find((f) => f.event_type === 'identity');
  const parts = [
    identity?.value,
    workNow?.value,
  ].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts.join('; ') : 'Profile facts are available in sections below.';
}

function pickBestFactByKeys(facts: ResolvedFact[], keys: string[]): ResolvedFact | undefined {
  return facts
    .filter((fact) => keys.includes(fact.fact_key))
    .sort((a, b) => b.final_confidence - a.final_confidence)[0];
}

function renderGeneralFacts(facts: ResolvedFact[]): string[] {
  const officialName = pickBestFactByKeys(facts, ['identity.official_name', 'identity.legal_name', 'identity.name']);
  const dateOfBirth = pickBestFactByKeys(facts, ['identity.birth_date']);
  const placeOfBirth = pickBestFactByKeys(facts, ['identity.birth_place']);
  const gender = pickBestFactByKeys(facts, ['identity.gender', 'identity.sex']);
  const nationality = pickBestFactByKeys(facts, ['identity.nationality']);
  const currentPrimaryRole = facts
    .filter((fact) => fact.event_type === 'work' && fact.time.time_end == null)
    .sort((a, b) => b.final_confidence - a.final_confidence)[0];

  return [
    `- official_name: ${officialName?.value ?? 'unknown'}`,
    `- date_of_birth: ${dateOfBirth?.value ?? 'unknown'}`,
    `- place_of_birth: ${placeOfBirth?.value ?? 'unknown'}`,
    `- gender: ${gender?.value ?? 'unknown'}`,
    `- nationality: ${nationality?.value ?? 'unknown'}`,
    `- current_primary_role: ${currentPrimaryRole?.value ?? 'unknown'}`,
    '- immutability_note: General facts are treated as stable identity attributes and should only change with explicit high-confidence evidence.',
  ];
}

export async function writeUserProfile(openloomDir: string, facts: ResolvedFact[]): Promise<void> {
  const path = userPath(openloomDir);
  await mkdir(dirname(path), { recursive: true });
  const identity = sectionFacts(facts, 'identity');
  const study = sectionFacts(facts, 'education');
  const work = sectionFacts(facts, 'work');
  const family = sectionFacts(facts, 'family');
  const residence = sectionFacts(facts, 'residence');
  const legal = sectionFacts(facts, 'legal');
  const travel = sectionFacts(facts, 'travel');

  const lines = [
    '# USER.md',
    '',
    '## General',
    '',
    ...renderGeneralFacts(facts),
    '',
    '### GeneralSummary',
    '',
    renderGeneralSummary(facts),
    '',
    '## Study',
    ...study.map(renderFactLine),
    '',
    '## Work',
    ...work.map(renderFactLine),
    '',
    '## Family',
    ...(family.length > 0 ? family.map(renderFactLine) : ['- No high-confidence family facts yet.']),
    '',
    '## ResidenceAndMobility',
    ...residence.map(renderFactLine),
    ...legal.map(renderFactLine),
    ...travel.map(renderFactLine),
    '',
    '## Timeline',
    ...facts
      .slice()
      .sort((a, b) => (a.time.time_start ?? '').localeCompare(b.time.time_start ?? ''))
      .map((f) => `- [${f.event_type}] ${renderFactLine(f).slice(2)}`),
    '',
    '## EvidenceIndex',
    ...Array.from(new Set(facts.flatMap((f) => f.evidence_refs))).map((ref) => `- ${ref}`),
    '',
    '## OpenQuestions',
    '- Refer to USER_CONFLICTS.md for unresolved conflicts requiring confirmation.',
    '',
    '## SensitiveDataPolicy',
    '- Single-file policy: USER.md is local runtime-only and should not be exposed externally.',
    '',
  ];
  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
}

export async function writeConflictsDoc(openloomDir: string, doc: UserConflictsDocument): Promise<void> {
  const path = conflictsPath(openloomDir);
  await mkdir(dirname(path), { recursive: true });
  const frontmatter = yamlStringify(doc, { lineWidth: 0 }).trimEnd();
  const pending = doc.conflicts.filter((c) => c.status === 'pending_user_confirm').length;
  const resolved = doc.conflicts.filter((c) => c.status === 'resolved').length;
  const body = [
    `- pending_conflicts: ${pending}`,
    `- resolved_conflicts: ${resolved}`,
    '',
    'Review each pending conflict and confirm one candidate before profile promotion updates those fields.',
  ].join('\n');
  const content = `---\n${frontmatter}\n---\n\n${body}\n`;
  await writeFile(path, content, 'utf8');
}

export async function updateVersionArtifacts(
  openloomDir: string,
  versionId: string,
  parentVersion: string | null,
  evidenceHashes: string[],
  summary: string,
): Promise<void> {
  const manifestFile = manifestPath(openloomDir);
  const changelogFile = changelogPath(openloomDir);

  const rawManifest = await readFile(manifestFile, 'utf8').catch(() => '');
  const manifest = rawManifest.trim() ? (JSON.parse(rawManifest) as Record<string, unknown>) : {};
  manifest.schema_version = '1.0.0';
  manifest.current_version = {
    version_id: versionId,
    parent_version: parentVersion,
    promoted_at: new Date().toISOString(),
    status: 'active',
    generated_from_evidence_hashes: evidenceHashes,
  };
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const oldLog = await readFile(changelogFile, 'utf8').catch(() => '# USER_CHANGELOG.md\n\n## Change Log\n');
  const entry = [
    '',
    `### ${versionId}`,
    '',
    `- promoted_at: ${new Date().toISOString()}`,
    `- parent_version: ${parentVersion ?? 'null'}`,
    `- evidence_hashes_count: ${evidenceHashes.length}`,
    `- change_summary: ${summary}`,
    '',
  ].join('\n');
  await writeFile(changelogFile, `${oldLog.trimEnd()}\n${entry}`, 'utf8');
}
