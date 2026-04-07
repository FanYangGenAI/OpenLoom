import Database from 'better-sqlite3';
import { FileEntry } from '../../ingestion/scanner/types.js';

const BATCH_SIZE = 1000;

/**
 * Batch writer for efficient file insertion
 */
export class BatchWriter {
  private db: Database.Database;
  private batch: FileEntry[] = [];
  private scanId: string;
  private insertStmt: Database.Statement;
  private flushCallback: (() => void) | null = null;

  constructor(db: Database.Database, scanId: string) {
    this.db = db;
    this.scanId = scanId;
    
    this.insertStmt = db.prepare(`
      INSERT OR REPLACE INTO files (scan_id, path, name, ext, size, mtime_ms, btime_ms, file_type, is_dir)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  /**
   * Add file entry to batch
   */
  add(entry: FileEntry): void {
    this.batch.push(entry);
    
    if (this.batch.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Flush pending entries to database
   */
  flush(): void {
    if (this.batch.length === 0) return;

    const insertMany = this.db.transaction((entries: FileEntry[]) => {
      for (const entry of entries) {
        this.insertStmt.run(
          this.scanId,
          entry.path,
          entry.name,
          entry.ext,
          entry.size,
          entry.mtime_ms,
          entry.btime_ms,
          entry.file_type,
          entry.is_dir ? 1 : 0
        );
      }
    });

    insertMany(this.batch);
    
    const count = this.batch.length;
    this.batch = [];
    
    if (this.flushCallback) {
      this.flushCallback();
    }
    
    return;
  }

  /**
   * Register callback for flush events
   */
  onFlush(callback: () => void): void {
    this.flushCallback = callback;
  }

  /**
   * Get current batch size
   */
  size(): number {
    return this.batch.length;
  }
}

/**
 * Create a batch writer
 */
export function createBatchWriter(db: Database.Database, scanId: string): BatchWriter {
  return new BatchWriter(db, scanId);
}
