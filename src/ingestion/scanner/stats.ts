import { EventEmitter } from 'events';
import { FileEntry, FileType, ScanSnapshot, ScanEvent } from './types.js';

/**
 * Real-time statistics aggregator
 * Collects scan statistics and emits snapshot events at regular intervals
 */
export class StatsAggregator extends EventEmitter {
  private filesScanned = 0;
  private dirsScanned = 0;
  private totalSize = 0;
  private filesByType: Record<FileType, number> = {
    document: 0,
    image: 0,
    video: 0,
    audio: 0,
    code: 0,
    archive: 0,
    other: 0,
  };
  
  private scanId: string;
  private currentPath = '';
  private intervalId: NodeJS.Timeout | null = null;
  private readonly snapshotInterval: number;

  constructor(scanId: string, snapshotIntervalMs = 500) {
    super();
    this.scanId = scanId;
    this.snapshotInterval = snapshotIntervalMs;
  }

  /**
   * Start the aggregator with periodic snapshot emissions
   */
  start(): void {
    this.intervalId = setInterval(() => {
      this.emitSnapshot();
    }, this.snapshotInterval);
  }

  /**
   * Process a single file entry
   */
  processEntry(entry: FileEntry): void {
    if (entry.is_dir) {
      this.dirsScanned++;
    } else {
      this.filesScanned++;
      this.totalSize += entry.size;
      this.filesByType[entry.file_type]++;
    }
    this.currentPath = entry.path;
  }

  /**
   * Get current snapshot
   */
  getSnapshot(): ScanSnapshot {
    return {
      scan_id: this.scanId,
      files_scanned: this.filesScanned,
      dirs_scanned: this.dirsScanned,
      current_path: this.currentPath,
      timestamp: Date.now(),
    };
  }

  /**
   * Get final summary
   */
  getSummary() {
    return {
      total_files: this.filesScanned,
      total_dirs: this.dirsScanned,
      total_size: this.totalSize,
      files_by_type: { ...this.filesByType },
    };
  }

  /**
   * Emit current snapshot
   */
  private emitSnapshot(): void {
    const snapshot = this.getSnapshot();
    this.emit('progress', { type: 'progress', snapshot } as ScanEvent);
  }

  /**
   * Stop the aggregator
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Emit final snapshot
    this.emitSnapshot();
  }
}
