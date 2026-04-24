import { mkdir, readdir, rename, rm, stat } from 'fs/promises';
import { cpSync, existsSync } from 'fs';
import { join, resolve, extname, basename } from 'path';
import { extractFile } from '../src/ingestion/extractors/index.js';
import { readMetadata, persistMetadata } from '../src/ingestion/extractors/persist.js';
import type { FileMetadata } from '../src/ingestion/extractors/types.js';

type SupportedKind = 'md' | 'docx' | 'jpg';

interface CaseEvidence {
  fileKind: SupportedKind;
  sourceFile: string;
  hash: string;
  metadataPath: string;
  case1ExtractedAt: string;
  case2ExtractedAt: string;
  case3ExtractedAt: string;
  case4ExtractedAt: string;
  pathHistoryLengthAfterMove: number;
  createdAtAfterTamper: string;
  createdAtAfterMove: string;
  extractionErrors: string[];
}

interface AssertionResult {
  id: string;
  description: string;
  pass: boolean;
  evidence?: string;
}

interface RunOutput {
  generatedAt: string;
  openloomDir: string;
  samples: Record<SupportedKind, string>;
  assertions: AssertionResult[];
  perFileEvidence: CaseEvidence[];
}

function expectedTypeAndMime(kind: SupportedKind): { fileType: 'text_doc' | 'image'; mimePrefix: string } {
  if (kind === 'jpg') return { fileType: 'image', mimePrefix: 'image/jpeg' };
  if (kind === 'docx') {
    return {
      fileType: 'text_doc',
      mimePrefix: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
  return { fileType: 'text_doc', mimePrefix: 'text/markdown' };
}

function metadataPathFor(openloomDir: string, fileType: 'text_doc' | 'image', hash: string): string {
  const subdir = fileType === 'text_doc' ? 'text_docs' : 'images';
  return join(openloomDir, 'metadata', subdir, `${hash}.md`);
}

async function pickSamples(dataDir: string): Promise<Record<SupportedKind, string>> {
  const entries = await readdir(dataDir);
  const byExt = new Map<string, string>();
  for (const entry of entries) {
    const ext = extname(entry).toLowerCase();
    if (!byExt.has(ext)) byExt.set(ext, resolve(dataDir, entry));
  }

  const md = byExt.get('.md');
  const docx = byExt.get('.docx');
  const jpg = byExt.get('.jpg') ?? byExt.get('.jpeg');

  if (!md || !docx || !jpg) {
    throw new Error('Expected at least one .md, .docx, and .jpg/.jpeg in data/fanyang');
  }

  return { md, docx, jpg };
}

async function copyFixturesToTemp(samples: Record<SupportedKind, string>, tempInputDir: string): Promise<Record<SupportedKind, string>> {
  await mkdir(tempInputDir, { recursive: true });
  const copied: Partial<Record<SupportedKind, string>> = {};
  for (const [kind, src] of Object.entries(samples) as Array<[SupportedKind, string]>) {
    const target = join(tempInputDir, basename(src));
    cpSync(src, target);
    copied[kind] = target;
  }
  return copied as Record<SupportedKind, string>;
}

async function runFlowForFile(
  kind: SupportedKind,
  filePath: string,
  openloomDir: string,
): Promise<{ assertions: AssertionResult[]; evidence: CaseEvidence }> {
  const assertions: AssertionResult[] = [];
  const expectation = expectedTypeAndMime(kind);

  const first = await extractFile(filePath, {
    openloomDir,
    forceReextract: false,
    ocrProvider: 'online',
    skipFaceDetection: true,
  });

  const metaPath = metadataPathFor(openloomDir, first.file_type, first.hash);
  const metaExists = existsSync(metaPath);
  assertions.push({
    id: `${kind}-case1-output-exists`,
    description: `${kind}: Case 1 should persist metadata by hash`,
    pass: metaExists,
    evidence: metaPath,
  });
  assertions.push({
    id: `${kind}-case1-type-mime`,
    description: `${kind}: Case 1 should have expected file_type and mime_type`,
    pass: first.file_type === expectation.fileType && first.mime_type.startsWith(expectation.mimePrefix),
    evidence: `${first.file_type} / ${first.mime_type}`,
  });

  const second = await extractFile(filePath, {
    openloomDir,
    forceReextract: false,
    ocrProvider: 'online',
    skipFaceDetection: true,
  });
  assertions.push({
    id: `${kind}-case2-hash-skip`,
    description: `${kind}: Case 2 should hit hash-skip (hash stable + extracted_at stable)`,
    pass: second.hash === first.hash && second.extracted_at === first.extracted_at,
    evidence: `${first.hash} / ${first.extracted_at} -> ${second.extracted_at}`,
  });

  const tampered = await readMetadata(first.hash, first.file_type, openloomDir);
  if (!tampered) {
    throw new Error(`Cannot read metadata before tamper: ${kind}`);
  }
  const tamperCreatedAt = '1999-01-01T00:00:00.000Z';
  await persistMetadata({ ...tampered, created_at: tamperCreatedAt }, openloomDir);

  const renamedDir = join(resolve(filePath, '..', '..'), 'renamed');
  await mkdir(renamedDir, { recursive: true });
  const movedPath = join(renamedDir, `${kind}-moved${extname(filePath).toLowerCase()}`);
  await rename(filePath, movedPath);

  const third = await extractFile(movedPath, {
    openloomDir,
    forceReextract: false,
    ocrProvider: 'online',
    skipFaceDetection: true,
  });
  const historyLen = third.path_history?.length ?? 0;
  const lastHistory = third.path_history?.[historyLen - 1];
  assertions.push({
    id: `${kind}-case3-location-refresh`,
    description: `${kind}: Case 3 should refresh current path and append path_history`,
    pass:
      third.file_path === movedPath &&
      historyLen >= 1 &&
      !!lastHistory &&
      lastHistory.file_path !== third.file_path,
    evidence: `new=${third.file_path} history=${historyLen}`,
  });
  assertions.push({
    id: `${kind}-case3-no-reextract`,
    description: `${kind}: Case 3 location refresh should not re-extract`,
    pass: third.extracted_at === second.extracted_at,
    evidence: `${second.extracted_at} -> ${third.extracted_at}`,
  });

  if (kind === 'jpg') {
    assertions.push({
      id: `${kind}-docalign-created-at-preserved`,
      description: `${kind}: image created_at should be preserved from cached metadata on location refresh`,
      pass: third.created_at === tamperCreatedAt,
      evidence: `tampered=${tamperCreatedAt} actual=${third.created_at}`,
    });
  } else {
    assertions.push({
      id: `${kind}-docalign-created-at-refreshed`,
      description: `${kind}: text_doc created_at should refresh from current file attrs on location refresh`,
      pass: third.created_at !== tamperCreatedAt,
      evidence: `tampered=${tamperCreatedAt} actual=${third.created_at}`,
    });
  }

  const fourth = await extractFile(movedPath, {
    openloomDir,
    forceReextract: true,
    ocrProvider: 'online',
    skipFaceDetection: true,
  });
  assertions.push({
    id: `${kind}-case4-force`,
    description: `${kind}: Case 4 --force should trigger re-extraction`,
    pass: fourth.extracted_at !== third.extracted_at,
    evidence: `${third.extracted_at} -> ${fourth.extracted_at}`,
  });

  const evidence: CaseEvidence = {
    fileKind: kind,
    sourceFile: movedPath,
    hash: fourth.hash,
    metadataPath: metaPath,
    case1ExtractedAt: first.extracted_at,
    case2ExtractedAt: second.extracted_at,
    case3ExtractedAt: third.extracted_at,
    case4ExtractedAt: fourth.extracted_at,
    pathHistoryLengthAfterMove: historyLen,
    createdAtAfterTamper: tamperCreatedAt,
    createdAtAfterMove: third.created_at,
    extractionErrors: fourth.extraction_errors,
  };

  return { assertions, evidence };
}

async function main(): Promise<void> {
  const repoRoot = resolve(process.cwd());
  const sampleDir = resolve(repoRoot, 'data', 'fanyang');
  const runRoot = resolve(repoRoot, '.tmp', 'metadata-regression');
  const inputRoot = join(runRoot, 'input');
  const openloomDir = join(runRoot, '.openloom');

  await rm(runRoot, { recursive: true, force: true });
  await mkdir(runRoot, { recursive: true });

  const samples = await pickSamples(sampleDir);
  const tempSamples = await copyFixturesToTemp(samples, inputRoot);

  const allAssertions: AssertionResult[] = [];
  const allEvidence: CaseEvidence[] = [];

  for (const kind of ['md', 'docx', 'jpg'] as const) {
    const filePath = tempSamples[kind];
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error(`Fixture not copied as file: ${filePath}`);
    const { assertions, evidence } = await runFlowForFile(kind, filePath, openloomDir);
    allAssertions.push(...assertions);
    allEvidence.push(evidence);
  }

  const output: RunOutput = {
    generatedAt: new Date().toISOString(),
    openloomDir,
    samples: tempSamples,
    assertions: allAssertions,
    perFileEvidence: allEvidence,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(`[metadata-regression] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
