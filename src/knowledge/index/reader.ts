import Database from 'better-sqlite3';

export interface FileQuery {
  scanId?: string;
  fileType?: string;
  ext?: string;
  minMtime?: number;
  maxMtime?: number;
  pathLike?: string;
  limit?: number;
  offset?: number;
}

export interface FileRecord {
  id: number;
  scan_id: string;
  path: string;
  name: string;
  ext: string | null;
  size: number;
  mtime_ms: number;
  btime_ms: number | null;
  file_type: string;
  is_dir: number;
  created_at: number;
}

/**
 * Query interface for file metadata
 */
export class FileReader {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Query files with filters
   */
  query(options: FileQuery = {}): FileRecord[] {
    const { 
      scanId, 
      fileType, 
      ext, 
      minMtime, 
      maxMtime, 
      pathLike,
      limit = 100,
      offset = 0 
    } = options;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (scanId) {
      conditions.push('scan_id = ?');
      params.push(scanId);
    }

    if (fileType) {
      conditions.push('file_type = ?');
      params.push(fileType);
    }

    if (ext) {
      conditions.push('ext = ?');
      params.push(ext);
    }

    if (minMtime !== undefined) {
      conditions.push('mtime_ms >= ?');
      params.push(minMtime);
    }

    if (maxMtime !== undefined) {
      conditions.push('mtime_ms <= ?');
      params.push(maxMtime);
    }

    if (pathLike) {
      conditions.push('path LIKE ?');
      params.push(`%${pathLike}%`);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const sql = `
      SELECT * FROM files 
      ${whereClause}
      ORDER BY mtime_ms DESC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);

    return this.db.prepare(sql).all(...params) as FileRecord[];
  }

  /**
   * Get file count
   */
  count(options: Omit<FileQuery, 'limit' | 'offset'> = {}): number {
    const { scanId, fileType, ext, minMtime, maxMtime, pathLike } = options;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (scanId) {
      conditions.push('scan_id = ?');
      params.push(scanId);
    }

    if (fileType) {
      conditions.push('file_type = ?');
      params.push(fileType);
    }

    if (ext) {
      conditions.push('ext = ?');
      params.push(ext);
    }

    if (minMtime !== undefined) {
      conditions.push('mtime_ms >= ?');
      params.push(minMtime);
    }

    if (maxMtime !== undefined) {
      conditions.push('mtime_ms <= ?');
      params.push(maxMtime);
    }

    if (pathLike) {
      conditions.push('path LIKE ?');
      params.push(`%${pathLike}%`);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = this.db.prepare(`SELECT COUNT(*) as count FROM files ${whereClause}`).get(...params) as { count: number };
    return result.count;
  }

  /**
   * Get files by type distribution
   */
  getTypeDistribution(scanId?: string): Record<string, number> {
    const whereClause = scanId ? 'WHERE scan_id = ?' : '';
    const params = scanId ? [scanId] : [];
    
    const rows = this.db.prepare(`
      SELECT file_type, COUNT(*) as count 
      FROM files ${whereClause}
      GROUP BY file_type
    `).all(...params) as { file_type: string; count: number }[];

    const distribution: Record<string, number> = {};
    for (const row of rows) {
      distribution[row.file_type] = row.count;
    }
    return distribution;
  }

  /**
   * Check if file has changed (by path + mtime + size)
   */
  hasChanged(path: string, mtimeMs: number, size: number): boolean {
    const row = this.db.prepare(`
      SELECT mtime_ms, size FROM files WHERE path = ? ORDER BY created_at DESC LIMIT 1
    `).get(path) as { mtime_ms: number; size: number } | undefined;

    if (!row) return true;
    return row.mtime_ms !== mtimeMs || row.size !== size;
  }
}

/**
 * Create a file reader
 */
export function createFileReader(db: Database.Database): FileReader {
  return new FileReader(db);
}
