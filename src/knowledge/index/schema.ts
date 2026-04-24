import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { getDefaultOpenLoomHome } from '../../utils/platform-paths.js';

const DEFAULT_DB_PATH = join(getDefaultOpenLoomHome(), 'data.db');

/**
 * Initialize database schema
 */
export function initializeSchema(db: Database.Database): void {
  // Scans table - tracks scan runs
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      root_path TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      total_files INTEGER DEFAULT 0,
      total_dirs INTEGER DEFAULT 0,
      total_size INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running'
    )
  `);

  // Files table - stores file metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      ext TEXT,
      size INTEGER NOT NULL,
      mtime_ms INTEGER NOT NULL,
      btime_ms INTEGER,
      file_type TEXT NOT NULL,
      is_dir INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(scan_id, path)
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_scan_id ON files(scan_id);
    CREATE INDEX IF NOT EXISTS idx_files_file_type ON files(file_type);
    CREATE INDEX IF NOT EXISTS idx_files_mtime_ms ON files(mtime_ms);
    CREATE INDEX IF NOT EXISTS idx_files_ext ON files(ext);
  `);

  // Sessions table - for conversation engine
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Messages table - conversation messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
  `);
}

/**
 * Open or create database
 */
export function openDatabase(dbPath?: string): Database.Database {
  const path = dbPath || DEFAULT_DB_PATH;
  
  // Ensure directory exists
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  
  initializeSchema(db);
  
  return db;
}

/**
 * Close database
 */
export function closeDatabase(db: Database.Database): void {
  db.close();
}
