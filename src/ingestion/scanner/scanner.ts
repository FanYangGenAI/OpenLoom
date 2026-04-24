import { EventEmitter } from 'events';
import { createScannerBridge, ScannerBridge } from './bridge.js';
import { StatsAggregator } from './stats.js';
import { FileEntry, ScanSummary, ScanEvent } from './types.js';

/**
 * Scanner orchestrator
 * Coordinates bridge, stats aggregator, and event emission
 */
export class Scanner extends EventEmitter {
  private bridge: ScannerBridge;
  private aggregator: StatsAggregator | null = null;

  constructor(binaryPath?: string) {
    super();
    this.bridge = createScannerBridge(binaryPath);
  }

  /**
   * Run a scan with full orchestration
   */
  async *scan(
    scanId: string,
    rootPath: string,
    options: { personal?: boolean; include?: string[]; exclude?: string[] } = {}
  ): AsyncGenerator<FileEntry> {
    // Emit started event
    this.emit('started', { type: 'started', scan_id: scanId, root_path: rootPath } as ScanEvent);

    // Create and start stats aggregator
    this.aggregator = new StatsAggregator(scanId);
    this.aggregator.start();
    
    // Forward aggregator events
    this.aggregator.on('progress', (event: ScanEvent) => {
      this.emit('progress', event);
    });

    const startTime = Date.now();

    try {
      // Stream entries through bridge
      for await (const entry of this.bridge.scan(rootPath, options)) {
        // Feed to aggregator
        this.aggregator.processEntry(entry);
        
        // Yield to consumer
        yield entry;
      }

      // Calculate final summary
      const summary: ScanSummary = {
        root_path: rootPath,
        total_files: this.aggregator.getSummary().total_files,
        total_dirs: this.aggregator.getSummary().total_dirs,
        total_size: this.aggregator.getSummary().total_size,
        duration_ms: Date.now() - startTime,
        files_by_type: this.aggregator.getSummary().files_by_type,
      };

      // Emit completed event
      this.emit('completed', { type: 'completed', summary } as ScanEvent);

    } catch (error) {
      // Emit failed event
      this.emit('failed', { 
        type: 'failed', 
        error: error instanceof Error ? error.message : String(error) 
      } as ScanEvent);
      throw error;
    } finally {
      // Cleanup
      this.aggregator?.stop();
      this.bridge.stop();
    }
  }

  /**
   * Stop ongoing scan
   */
  stop(): void {
    this.bridge.stop();
    this.aggregator?.stop();
  }
}

/**
 * Create a scanner instance
 */
export function createScanner(binaryPath?: string): Scanner {
  return new Scanner(binaryPath);
}
