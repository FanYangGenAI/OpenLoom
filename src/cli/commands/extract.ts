import { stat } from 'fs/promises';
import { resolve, basename } from 'path';
import { extractFile, extractDirectory, type ProgressUpdate } from '../../ingestion/extractors/index.js';
import {
  getDefaultRoot,
  isInitialized,
  loadSettings,
  resolveOpenloomDir,
  updatePreferences,
} from '../../config/user-settings.js';
import { setupCommand } from './setup.js';
import { isOnboardingCompleted, updateWorkspaceState } from '../../config/workspace-state.js';
import { createCliWizardPrompter } from '../../wizard/prompts.js';
import {
  runInteractiveExtractWizard,
  type InteractiveExtractOptions,
} from '../../wizard/extract-interactive.js';

interface ExtractCommandOptions {
  openloom?: string;
  force?: boolean;
  ocrProvider?: 'online' | 'local';
  skipFaces?: boolean;
  textConcurrency?: string;
  imageConcurrency?: string;
  interactive?: boolean;
  json?: boolean;
}

export async function extractCommand(
  targetPath: string | undefined,
  opts: ExtractCommandOptions,
): Promise<void> {
  const openloomDir = resolveOpenloomDir(opts.openloom);
  await ensureInitializedOrSetup(openloomDir, opts.openloom);

  const resolvedTargetPath = await resolveTargetPath(targetPath, openloomDir);
  const resolved = resolve(resolvedTargetPath);
  const settings = await loadSettings(openloomDir);
  const interactiveDefaults: InteractiveExtractOptions = {
    ocrProvider: (opts.ocrProvider as 'online' | 'local') ?? settings.preferences.ocr_provider ?? 'online',
    skipFaceDetection: opts.skipFaces ?? settings.preferences.skip_faces ?? false,
    textConcurrency:
      opts.textConcurrency ? parseInt(opts.textConcurrency, 10) : settings.preferences.text_concurrency ?? 5,
    imageConcurrency:
      opts.imageConcurrency
        ? parseInt(opts.imageConcurrency, 10)
        : settings.preferences.image_concurrency ?? 3,
  };

  const interactiveOverrides = opts.interactive
    ? await runInteractiveExtractPrompt(
        interactiveDefaults,
        openloomDir,
      )
    : null;

  const options = {
    openloomDir,
    forceReextract: opts.force ?? false,
    ocrProvider: interactiveOverrides?.ocrProvider ?? (opts.ocrProvider as 'online' | 'local') ?? 'online',
    skipFaceDetection: interactiveOverrides?.skipFaceDetection ?? (opts.skipFaces ?? false),
    textConcurrency:
      interactiveOverrides?.textConcurrency ??
      (opts.textConcurrency ? parseInt(opts.textConcurrency, 10) : undefined),
    imageConcurrency:
      interactiveOverrides?.imageConcurrency ??
      (opts.imageConcurrency ? parseInt(opts.imageConcurrency, 10) : undefined),
  };

  if (opts.interactive && interactiveOverrides) {
    await maybePersistInteractivePreferences(openloomDir, interactiveOverrides);
  }

  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(resolved);
  } catch {
    console.error(`Error: path not found: ${resolved}`);
    process.exit(1);
  }

  // ── Single file ───────────────────────────────────────────────────────────
  if (info.isFile()) {
    try {
      const meta = await extractFile(resolved, options);
      if (opts.json) {
        console.log(JSON.stringify(meta, null, 2));
      } else {
        printSingleResult(meta);
      }
    } catch (err) {
      console.error(`Failed: ${(err as Error).message}`);
      process.exit(1);
    }
    return;
  }

  // ── Directory ─────────────────────────────────────────────────────────────
  if (!info.isDirectory()) {
    console.error(`Error: not a file or directory: ${resolved}`);
    process.exit(1);
  }

  console.log(`Scanning ${resolved} ...`);
  const spinner = new ProgressBar();

  const result = await extractDirectory(resolved, {
    ...options,
    onProgress: (update: ProgressUpdate) => {
      spinner.update(update);
    },
  });

  spinner.finish();
  console.log('');

  if (opts.json) {
    console.log(JSON.stringify({
      succeeded: result.succeeded.length,
      failed:    result.failed.length,
      durationMs: result.durationMs,
      errors: result.failed,
    }, null, 2));
  } else {
    printBatchResult(result);
  }

  if (result.failed.length > 0) process.exit(1);
}

async function ensureInitializedOrSetup(openloomDir: string, openloomOverride?: string): Promise<void> {
  const initialized = await isInitialized(openloomDir);
  const onboarded = await isOnboardingCompleted(openloomDir);
  if (initialized && onboarded) return;

  console.log('OpenLoom is not initialized yet. Starting setup...');
  await setupCommand({ openloom: openloomOverride });
}

async function resolveTargetPath(targetPath: string | undefined, openloomDir: string): Promise<string> {
  if (targetPath?.trim()) return targetPath;

  const root = await getDefaultRoot(openloomDir);
  if (root?.path) return root.path;

  console.error('Error: no extract path provided and no default root configured.');
  console.error('Use "openloom setup" or "openloom roots set <path>" first, or pass a path.');
  process.exit(1);
}

async function runInteractiveExtractPrompt(
  defaults: InteractiveExtractOptions,
  openloomDir: string,
): Promise<InteractiveExtractOptions> {
  const prompter = createCliWizardPrompter();
  try {
    const result = await runInteractiveExtractWizard(prompter, defaults);
    await updateWorkspaceState(openloomDir, {
      lastWizardRunAt: new Date().toISOString(),
      lastWizardSource: 'extract-interactive',
    });
    return result;
  } finally {
    prompter.close();
  }
}

async function maybePersistInteractivePreferences(
  openloomDir: string,
  interactiveOptions: InteractiveExtractOptions,
): Promise<void> {
  const prompter = createCliWizardPrompter();
  try {
    const saveAsDefault = await prompter.confirm({
      message: 'Save these interactive options as defaults for next runs',
      initialValue: true,
    });
    if (!saveAsDefault) return;

    await updatePreferences(openloomDir, {
      ocr_provider: interactiveOptions.ocrProvider,
      skip_faces: interactiveOptions.skipFaceDetection,
      text_concurrency: interactiveOptions.textConcurrency,
      image_concurrency: interactiveOptions.imageConcurrency,
    });
    console.log('Interactive defaults saved to user settings.');
  } finally {
    prompter.close();
  }
}

// ─── Output helpers ───────────────────────────────────────────────────────────

function printSingleResult(meta: Awaited<ReturnType<typeof extractFile>>): void {
  console.log(`\n✓ ${meta.file_name}`);
  console.log(`  Type:    ${meta.file_type} (${meta.mime_type})`);
  console.log(`  Hash:    ${meta.hash.slice(0, 12)}...`);
  console.log(`  Agent:   ${meta.agent_used}`);
  console.log(`  Summary: ${meta.summary.slice(0, 120)}${meta.summary.length > 120 ? '...' : ''}`);
  if (meta.tags.keywords.length > 0) {
    console.log(`  Tags:    ${meta.tags.keywords.join(', ')}`);
  }
  if (meta.spatiotemporal.length > 0) {
    console.log(`  Events:  ${meta.spatiotemporal.length} spatio-temporal entries`);
  }
  if (meta.faces && meta.faces.length > 0) {
    console.log(`  Faces:   ${meta.faces.length} detected`);
  }
  if (meta.extraction_errors.length > 0) {
    console.log(`  Warnings: ${meta.extraction_errors.join('; ')}`);
  }
}

function printBatchResult(result: Awaited<ReturnType<typeof extractDirectory>>): void {
  const { succeeded, failed, durationMs } = result;
  const total = succeeded.length + failed.length;
  const secs = (durationMs / 1000).toFixed(1);

  console.log(`\nDone in ${secs}s — ${total} files processed`);
  console.log(`  Succeeded: ${succeeded.length}`);
  console.log(`  Failed:    ${failed.length}`);

  const textCount  = succeeded.filter((m) => m.file_type === 'text_doc').length;
  const imageCount = succeeded.filter((m) => m.file_type === 'image').length;
  console.log(`  Text docs: ${textCount}   Images: ${imageCount}`);

  const totalFaces = succeeded.reduce((n, m) => n + (m.faces?.length ?? 0), 0);
  if (totalFaces > 0) {
    console.log(`  Faces detected: ${totalFaces}`);
  }

  if (failed.length > 0) {
    console.log('\nFailed files:');
    for (const { file, error } of failed) {
      console.log(`  ✗ ${basename(file)}: ${error}`);
    }
  }
}

// ─── Simple inline progress bar ──────────────────────────────────────────────

class ProgressBar {
  private lastLine = '';

  update(u: ProgressUpdate): void {
    const pct = Math.round((u.completed / u.total) * 100);
    const bar = '█'.repeat(Math.floor(pct / 5)).padEnd(20, '░');
    const status = u.status === 'error' ? ' ✗' : '';
    const line = `  [${bar}] ${pct}%  ${u.completed}/${u.total}  (txt:${u.textDone} img:${u.imageDone})${status}`;

    // Overwrite previous line in TTY
    if (process.stdout.isTTY) {
      process.stdout.write(`\r${line}`);
    } else if (line !== this.lastLine) {
      console.log(line);
      this.lastLine = line;
    }
  }

  finish(): void {
    if (process.stdout.isTTY) process.stdout.write('\n');
  }
}
