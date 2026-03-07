import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { FileEntry, ScanSummary } from './types.js';

/**
 * Bridge to the Rust scanner binary
 * Handles spawning the subprocess and parsing NDJSON output
 */
export class ScannerBridge {
  private binaryPath: string;
  private process: ChildProcess | null = null;

  constructor(binaryPath?: string) {
    // Default to the compiled binary in the project
    this.binaryPath = binaryPath || '/Users/fanyang/repo/OpenLoom/crates/scanner/target/release/openloom-scanner';
  }

  /**
   * Run scanner and yield file entries as they're parsed
   * @param rootPath - Root directory to scan
   * @param options - Scanner options
   */
  async *scan(
    rootPath: string,
    options: { personal?: boolean } = {}
  ): AsyncGenerator<FileEntry> {
    const args = [rootPath];
    
    if (options.personal) {
      args.push('--personal');
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
