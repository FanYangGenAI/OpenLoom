import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getDefaultRoot,
  isInitialized,
  loadSettings,
  markInitialized,
  resolveOpenloomDir,
  saveSettings,
  setDefaultRoot,
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
});
