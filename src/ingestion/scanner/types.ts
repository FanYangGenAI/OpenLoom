/**
 * Types for the Rust Scanner output (NDJSON)
 */

export interface FileEntry {
  /** Absolute path */
  path: string;
  /** File name */
  name: string;
  /** File extension (without dot) */
  ext: string;
  /** File size in bytes */
  size: number;
  /** Modification time in milliseconds since epoch */
  mtime_ms: number;
  /** Creation time in milliseconds since epoch (0 if unknown) */
  btime_ms: number;
  /** File type category */
  file_type: FileType;
  /** Whether this entry is a directory */
  is_dir: boolean;
}

export type FileType = 
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'code'
  | 'archive'
  | 'other';

export interface ScanSummary {
  /** Root path that was scanned */
  root_path: string;
  /** Total number of files */
  total_files: number;
  /** Total number of directories */
  total_dirs: number;
  /** Total size in bytes */
  total_size: number;
  /** Scan duration in milliseconds */
  duration_ms: number;
  /** Files by type distribution */
  files_by_type: Record<FileType, number>;
}

export interface ScanSnapshot {
  /** Current scan ID */
  scan_id: string;
  /** Files scanned so far */
  files_scanned: number;
  /** Directories scanned so far */
  dirs_scanned: number;
  /** Current path being scanned */
  current_path: string;
  /** Timestamp */
  timestamp: number;
}

/** Event emitted during scan lifecycle */
export type ScanEvent =
  | { type: 'started'; scan_id: string; root_path: string }
  | { type: 'progress'; snapshot: ScanSnapshot }
  | { type: 'completed'; summary: ScanSummary }
  | { type: 'failed'; error: string };
