import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  addRoot,
  getDefaultRoot,
  getScanRules,
  isInitialized,
  listRoots,
  loadSettings,
  markInitialized,
  removeRoot,
  resetScanRules,
  resolveOpenloomDir,
  saveSettings,
  setDefaultRoot,
  updateScanRules,
  updatePreferences,
} from './user-settings.js';

describe('user-settings', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('loads defaults when settings file is missing', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-settings-'));
    tempDirs.push(base);

    const settings = await loadSettings(base);
    expect(settings.initialized).toBe(false);
    expect(settings.default_root).toBeNull();
    expect(settings.roots).toEqual([]);
    expect(settings.scan_rules.exclude.length).toBeGreaterThan(0);
    expect(settings.preferences.ocr_provider).toBe('online');
  });

  it('sets and gets default root path', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-settings-'));
    tempDirs.push(base);

    await setDefaultRoot(base, '/tmp/data-root');
    const root = await getDefaultRoot(base);
    expect(root?.path).toContain('data-root');
  });

  it('marks initialized and persists timestamp', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-settings-'));
    tempDirs.push(base);

    await markInitialized(base);
    expect(await isInitialized(base)).toBe(true);

    const settings = await loadSettings(base);
    expect(settings.initialized_at).toBeTruthy();
  });

  it('resolveOpenloomDir prefers explicit cli path', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-settings-'));
    tempDirs.push(base);

    const resolved = resolveOpenloomDir(base);
    expect(resolved).toBe(base);
  });

  it('saves full settings payload', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-settings-'));
    tempDirs.push(base);

    await saveSettings(base, {
      initialized: true,
      initialized_at: new Date().toISOString(),
      openloom_dir: base,
      default_root: { path: '/tmp/my-root' },
      roots: [{ path: '/tmp/my-root' }, { path: '/tmp/my-root-2' }],
      scan_rules: {
        version: 1,
        include: ['**/*.md'],
        exclude: ['**/node_modules/**'],
      },
      preferences: {
        ocr_provider: 'local',
        text_concurrency: 2,
        image_concurrency: 1,
        skip_faces: true,
      },
    });

    const loaded = await loadSettings(base);
    expect(loaded.preferences.ocr_provider).toBe('local');
    expect(loaded.default_root?.path).toContain('my-root');
    expect(loaded.roots).toHaveLength(2);
    expect(loaded.scan_rules.include).toContain('**/*.md');
  });

  it('updates preferences incrementally', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-settings-'));
    tempDirs.push(base);

    await updatePreferences(base, {
      ocr_provider: 'local',
      text_concurrency: 9,
    });

    const loaded = await loadSettings(base);
    expect(loaded.preferences.ocr_provider).toBe('local');
    expect(loaded.preferences.text_concurrency).toBe(9);
    expect(loaded.preferences.image_concurrency).toBe(3);
  });

  it('supports add/list/remove roots', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-settings-'));
    tempDirs.push(base);

    await addRoot(base, '/tmp/source-a');
    await addRoot(base, '/tmp/source-b');
    await addRoot(base, '/tmp/source-a');
    let roots = await listRoots(base);
    expect(roots).toHaveLength(2);

    await removeRoot(base, '/tmp/source-a');
    roots = await listRoots(base);
    expect(roots).toHaveLength(1);
    expect(roots[0].path).toContain('source-b');
  });

  it('keeps backward compatibility from default_root to roots', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-settings-'));
    tempDirs.push(base);
    await saveSettings(base, {
      initialized: false,
      initialized_at: null,
      openloom_dir: null,
      default_root: { path: '/tmp/legacy-root' },
      roots: [],
      scan_rules: {
        version: 1,
        include: [],
        exclude: [],
      },
      preferences: {
        ocr_provider: 'online',
        text_concurrency: 5,
        image_concurrency: 3,
        skip_faces: false,
      },
    });

    const loaded = await loadSettings(base);
    expect(loaded.roots.some((root) => root.path.includes('legacy-root'))).toBe(true);
  });

  it('updates and resets scan rules', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openloom-settings-'));
    tempDirs.push(base);

    await updateScanRules(base, {
      include: ['**/*.png'],
      exclude: ['**/.cache/**'],
    });
    const customized = await getScanRules(base);
    expect(customized.include).toContain('**/*.png');
    expect(customized.exclude).toContain('**/.cache/**');

    await resetScanRules(base);
    const reset = await getScanRules(base);
    expect(reset.include).toEqual([]);
    expect(reset.exclude).toContain('**/node_modules/**');
  });
});
