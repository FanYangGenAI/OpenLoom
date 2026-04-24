/**
 * End-to-end integration test
 * Validates: CLI scan → Rust scanner → NDJSON → Node.js → SQLite
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase, closeDatabase } from '../knowledge/index/schema.js';
import { createBatchWriter } from '../knowledge/index/writer.js';
import { createFileReader } from '../knowledge/index/reader.js';
import { createScanner } from '../ingestion/scanner/scanner.js';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { getDefaultE2ETestDbPath, getRepoRootPath, resolveExistingScannerBinaryPath } from '../utils/platform-paths.js';

describe('E2E Integration', () => {
  const testDbPath = getDefaultE2ETestDbPath();
  const scannerBinary = resolveExistingScannerBinaryPath();
  const repoRoot = getRepoRootPath();
  const testDocDir = join(repoRoot, 'docs');
  let db: ReturnType<typeof openDatabase>;
  let reader: ReturnType<typeof createFileReader>;

  beforeEach(() => {
    // Clean up test DB
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    
    db = openDatabase(testDbPath);
    reader = createFileReader(db);
  });

  afterEach(() => {
    closeDatabase(db);
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('should scan small directory and persist to SQLite', async () => {
    if (!scannerBinary) {
      console.warn('Skipping E2E scan test: scanner binary not found');
      return;
    }
    const scanId = 'e2e-test-001';
    const testPath = testDocDir;

    const scanner = createScanner(scannerBinary);
    const batchWriter = createBatchWriter(db, scanId);
    
    let fileCount = 0;
    
    for await (const entry of scanner.scan(scanId, testPath, { personal: true })) {
      batchWriter.add(entry);
      fileCount++;
    }
    
    batchWriter.flush();
    
    // Verify
    expect(fileCount).toBeGreaterThan(0);
    expect(reader.count({ scanId })).toBe(fileCount);
    
    console.log(`Scanned ${fileCount} files to SQLite`);
  }, 30000); // 30s timeout

  it('should provide correct type distribution', async () => {
    if (!scannerBinary) {
      console.warn('Skipping E2E scan test: scanner binary not found');
      return;
    }
    const scanId = 'e2e-test-002';
    const testPath = repoRoot;

    const scanner = createScanner(scannerBinary);
    const batchWriter = createBatchWriter(db, scanId);
    
    for await (const entry of scanner.scan(scanId, testPath, { personal: true })) {
      batchWriter.add(entry);
    }
    
    batchWriter.flush();
    
    // Check distribution
    const dist = reader.getTypeDistribution(scanId);
    expect(dist).toBeDefined();
    expect(Object.keys(dist).length).toBeGreaterThan(0);
    
    console.log('Type distribution:', dist);
  }, 60000); // 60s timeout for full repo scan
});
