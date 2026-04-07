import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema, openDatabase } from './schema.js';
import { createBatchWriter, BatchWriter } from './writer.js';
import { createFileReader, FileQuery } from './reader.js';
import { FileEntry } from '../../ingestion/scanner/types.js';

describe('Database Layer', () => {
  let db: Database.Database;
  let writer: BatchWriter;
  let reader: ReturnType<typeof createFileReader>;
  const testScanId = 'test-scan-001';

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSchema(db);
    writer = createBatchWriter(db, testScanId);
    reader = createFileReader(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('BatchWriter', () => {
    it('should batch insert entries', () => {
      const entry: FileEntry = {
        path: '/test/file.txt',
        name: 'file.txt',
        ext: 'txt',
        size: 1024,
        mtime_ms: Date.now(),
        btime_ms: 0,
        file_type: 'document',
        is_dir: false,
      };

      writer.add(entry);
      expect(writer.size()).toBe(1);

      writer.flush();
      expect(writer.size()).toBe(0);
    });

    it('should auto-flush at batch size', () => {
      // Default batch size is 1000
      for (let i = 0; i < 1000; i++) {
        writer.add({
          path: `/test/file${i}.txt`,
          name: `file${i}.txt`,
          ext: 'txt',
          size: 100,
          mtime_ms: Date.now(),
          btime_ms: 0,
          file_type: 'document',
          is_dir: false,
        });
      }

      // Should have auto-flushed
      expect(writer.size()).toBe(0);
      
      // Verify all inserted
      expect(reader.count({ scanId: testScanId })).toBe(1000);
    });
  });

  describe('FileReader', () => {
    it('should query files', () => {
      // Insert test data
      const entries: FileEntry[] = [
        { path: '/test/a.txt', name: 'a.txt', ext: 'txt', size: 100, mtime_ms: 1000, btime_ms: 0, file_type: 'document', is_dir: false },
        { path: '/test/b.jpg', name: 'b.jpg', ext: 'jpg', size: 200, mtime_ms: 2000, btime_ms: 0, file_type: 'image', is_dir: false },
        { path: '/test/c.mp4', name: 'c.mp4', ext: 'mp4', size: 300, mtime_ms: 3000, btime_ms: 0, file_type: 'video', is_dir: false },
      ];

      for (const entry of entries) {
        writer.add(entry);
      }
      writer.flush();

      // Query all
      const all = reader.query({});
      expect(all.length).toBe(3);

      // Query by type
      const images = reader.query({ fileType: 'image' });
      expect(images.length).toBe(1);
      expect(images[0].ext).toBe('jpg');

      // Query by extension
      const txtFiles = reader.query({ ext: 'txt' });
      expect(txtFiles.length).toBe(1);
    });

    it('should count files', () => {
      const entries: FileEntry[] = [
        { path: '/test/a.txt', name: 'a.txt', ext: 'txt', size: 100, mtime_ms: 1000, btime_ms: 0, file_type: 'document', is_dir: false },
        { path: '/test/b.txt', name: 'b.txt', ext: 'txt', size: 100, mtime_ms: 1000, btime_ms: 0, file_type: 'document', is_dir: false },
      ];

      for (const entry of entries) {
        writer.add(entry);
      }
      writer.flush();

      expect(reader.count()).toBe(2);
      expect(reader.count({ ext: 'txt' })).toBe(2);
      expect(reader.count({ fileType: 'image' })).toBe(0);
    });

    it('should get type distribution', () => {
      const entries: FileEntry[] = [
        { path: '/test/a.txt', name: 'a.txt', ext: 'txt', size: 100, mtime_ms: 1000, btime_ms: 0, file_type: 'document', is_dir: false },
        { path: '/test/b.txt', name: 'b.txt', ext: 'txt', size: 100, mtime_ms: 1000, btime_ms: 0, file_type: 'document', is_dir: false },
        { path: '/test/c.jpg', name: 'c.jpg', ext: 'jpg', size: 100, mtime_ms: 1000, btime_ms: 0, file_type: 'image', is_dir: false },
      ];

      for (const entry of entries) {
        writer.add(entry);
      }
      writer.flush();

      const dist = reader.getTypeDistribution();
      expect(dist.document).toBe(2);
      expect(dist.image).toBe(1);
    });
  });
});
