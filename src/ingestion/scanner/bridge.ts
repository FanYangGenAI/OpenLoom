import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { FileEntry, ScanSummary } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

/**
 * Bridge to the Rust scanner binary
 * Handles spawning the subprocess and parsing NDJSON output
 */
export class ScannerBridge {
  private binaryPath: string;
  private process: ChildProcess | null = null;

  constructor(binaryPath?: string) {
    this.binaryPath = binaryPath || resolveScannerBinaryPath();
  }

  /**
   * Run scanner and yield file entries as they're parsed
   * @param rootPath - Root directory to scan
   * @param options - Scanner options
   */
  async *scan(
    rootPath: string,
    options: { personal?: boolean; include?: string[]; exclude?: string[] } = {}
  ): AsyncGenerator<FileEntry> {
    if (!existsSync(this.binaryPath)) {
      throw new Error(
        `Scanner binary not found at: ${this.binaryPath}. ` +
          'Build scanner first (e.g. cargo build --release in crates/scanner) ' +
          'or set OPENLOOM_SCANNER_PATH to the correct binary.',
      );
    }
    const args = [rootPath];
    
    if (options.personal) {
      args.push('--personal');
    }
    const ignoreNames = deriveIgnoreNames(options.exclude ?? []);
    for (const ignore of ignoreNames) {
      args.push('-i', ignore);
    }

    // Spawn the scanner process
    this.process = spawn(this.binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout = createInterface({
      input: this.process.stdout!,
      crlfDelay: Infinity,
    });

    const stderr: string[] = [];
    
    // Collect stderr for error reporting
    this.process.stderr?.on('data', (chunk) => {
      stderr.push(chunk.toString());
    });

    // Parse NDJSON lines from stdout
    for await (const line of stdout) {
      if (!line.trim()) continue;
      
      try {
        const entry = JSON.parse(line) as FileEntry | ScanSummary;
        
        // Skip summary lines (they don't have 'path' field)
        if ('path' in entry) {
          yield entry;
        }
      } catch (err) {
        console.error('Failed to parse scanner output:', line, err);
      }
    }

    // Wait for process to complete
    const exitCode = await new Promise<number>((resolve) => {
      this.process!.on('close', resolve);
    });

    if (exitCode !== 0) {
      throw new Error(`Scanner exited with code ${exitCode}: ${stderr.join('')}`);
    }
  }

  /**
   * Stop the scanner process
   */
  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

/**
 * Get a scanner bridge instance
 */
export function createScannerBridge(binaryPath?: string): ScannerBridge {
  return new ScannerBridge(binaryPath);
}

export function resolveScannerBinaryPath(params?: {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  projectRoot?: string;
}): string {
  const platform = params?.platform ?? process.platform;
  const env = params?.env ?? process.env;
  const projectRoot = params?.projectRoot ?? PROJECT_ROOT;
  const suffix = platform === 'win32' ? '.exe' : '';

  const envOverride = env.OPENLOOM_SCANNER_PATH?.trim();
  if (envOverride) {
    return envOverride;
  }

  const releasePath = resolve(projectRoot, 'crates', 'scanner', 'target', 'release', `openloom-scanner${suffix}`);
  if (existsSync(releasePath)) {
    return releasePath;
  }

  const debugPath = resolve(projectRoot, 'crates', 'scanner', 'target', 'debug', `openloom-scanner${suffix}`);
  if (existsSync(debugPath)) {
    return debugPath;
  }

  // Return release path as default target for clearer error message if missing.
  return releasePath;
}

function deriveIgnoreNames(patterns: string[]): string[] {
  const names = new Set<string>();
  for (const pattern of patterns) {
    const normalized = pattern.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    for (const segment of segments) {
      if (segment === '*' || segment === '**' || segment.includes('*') || segment.includes('?')) {
        continue;
      }
      names.add(segment);
    }
  }
  return Array.from(names);
}
