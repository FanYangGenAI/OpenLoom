import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StatsAggregator } from './stats';
import { FileEntry, FileType } from './types';

describe('StatsAggregator', () => {
  let aggregator: StatsAggregator;
  const scanId = 'test-scan-123';

  beforeEach(() => {
    aggregator = new StatsAggregator(scanId, 100); // 100ms interval for testing
  });

  afterEach(() => {
    aggregator.stop();
  });

  it('should start with zero counts', () => {
    const snapshot = aggregator.getSnapshot();
    expect(snapshot.files_scanned).toBe(0);
    expect(snapshot.dirs_scanned).toBe(0);
  });

  it('should process file entries', () => {
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

    aggregator.processEntry(entry);

    const summary = aggregator.getSummary();
    expect(summary.total_files).toBe(1);
    expect(summary.total_size).toBe(1024);
  });

  it('should process directory entries', () => {
    const entry: FileEntry = {
      path: '/test/dir',
      name: 'dir',
      ext: '',
      size: 0,
      mtime_ms: Date.now(),
      btime_ms: 0,
      file_type: 'other',
      is_dir: true,
    };

    aggregator.processEntry(entry);

    const summary = aggregator.getSummary();
    expect(summary.total_dirs).toBe(1);
  });

  it('should track files by type', () => {
    const entries: FileEntry[] = [
      { path: '/test/a.txt', name: 'a.txt', ext: 'txt', size: 100, mtime_ms: 0, btime_ms: 0, file_type: 'document', is_dir: false },
      { path: '/test/b.jpg', name: 'b.jpg', ext: 'jpg', size: 200, mtime_ms: 0, btime_ms: 0, file_type: 'image', is_dir: false },
      { path: '/test/c.mp4', name: 'c.mp4', ext: 'mp4', size: 300, mtime_ms: 0, btime_ms: 0, file_type: 'video', is_dir: false },
      { path: '/test/d.ts', name: 'd.ts', ext: 'ts', size: 400, mtime_ms: 0, btime_ms: 0, file_type: 'code', is_dir: false },
    ];

    for (const entry of entries) {
      aggregator.processEntry(entry);
    }

    const summary = aggregator.getSummary();
    expect(summary.files_by_type.document).toBe(1);
    expect(summary.files_by_type.image).toBe(1);
    expect(summary.files_by_type.video).toBe(1);
    expect(summary.files_by_type.code).toBe(1);
  });

  it('should emit progress events', () => {
    const progressHandler = vi.fn();
    aggregator.on('progress', progressHandler);

    aggregator.start();
    
    const entry: FileEntry = {
      path: '/test/file.txt',
      name: 'file.txt',
      ext: 'txt',
      size: 100,
      mtime_ms: 0,
      btime_ms: 0,
      file_type: 'document',
      is_dir: false,
    };
    aggregator.processEntry(entry);

    // Wait for interval
    return new Promise((resolve) => setTimeout(resolve, 150)).then(() => {
      expect(progressHandler).toHaveBeenCalled();
    });
  });
});
