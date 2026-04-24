import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { resolveScannerBinaryPath } from './bridge.js';

describe('resolveScannerBinaryPath', () => {
  it('prefers OPENLOOM_SCANNER_PATH override', () => {
    const resolved = resolveScannerBinaryPath({
      platform: 'win32',
      env: { OPENLOOM_SCANNER_PATH: 'D:/tools/openloom-scanner.exe' },
      projectRoot: 'D:/repo',
    });
    expect(resolved).toBe('D:/tools/openloom-scanner.exe');
  });

  it('falls back to release binary path by platform', () => {
    const winPath = resolveScannerBinaryPath({
      platform: 'win32',
      env: {},
      projectRoot: 'D:/repo/monorepo/OpenLoom',
    });
    expect(winPath.endsWith('crates\\scanner\\target\\release\\openloom-scanner.exe')).toBe(true);

    const macPath = resolveScannerBinaryPath({
      platform: 'darwin',
      env: {},
      projectRoot: '/repo/OpenLoom',
    });
    expect(macPath.replace(/\\/g, '/').endsWith('crates/scanner/target/release/openloom-scanner')).toBe(
      true,
    );
  });

  it('uses debug binary when release is absent but debug exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openloom-scanner-path-'));
    const debugDir = join(root, 'crates', 'scanner', 'target', 'debug');
    await mkdir(debugDir, { recursive: true });
    await writeFile(join(debugDir, 'openloom-scanner.exe'), '');
    try {
      const resolved = resolveScannerBinaryPath({
        platform: 'win32',
        env: {},
        projectRoot: root,
      });
      expect(resolved.endsWith('openloom-scanner.exe')).toBe(true);
      expect(resolved.includes('target\\debug\\')).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
