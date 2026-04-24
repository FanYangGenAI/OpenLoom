import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, isAbsolute, resolve } from 'path';

const DEFAULT_OPENLOOM_DIR = resolve(process.cwd(), '.openloom');

export interface RootConfig {
  path: string;
}

export interface UserPreferences {
  ocr_provider: 'online' | 'local';
  text_concurrency: number;
  image_concurrency: number;
  skip_faces: boolean;
}

export interface UserSettings {
  initialized: boolean;
  initialized_at: string | null;
  openloom_dir: string | null;
  default_root: RootConfig | null;
  preferences: UserPreferences;
}

const DEFAULT_SETTINGS: UserSettings = {
  initialized: false,
  initialized_at: null,
  openloom_dir: null,
  default_root: null,
  preferences: {
    ocr_provider: 'online',
    text_concurrency: 5,
    image_concurrency: 3,
    skip_faces: false,
  },
};

function getSettingsFilePath(openloomDir: string): string {
  return resolve(openloomDir, 'config', 'user-settings.json');
}

export function resolveOpenloomDir(cliOverride?: string): string {
  if (cliOverride?.trim()) {
    const candidate = cliOverride.trim();
    return isAbsolute(candidate) ? candidate : resolve(process.cwd(), candidate);
  }
  return DEFAULT_OPENLOOM_DIR;
}

export async function loadSettings(openloomDir: string): Promise<UserSettings> {
  const settingsPath = getSettingsFilePath(openloomDir);

  try {
    const raw = await readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      preferences: {
        ...DEFAULT_SETTINGS.preferences,
        ...parsed.preferences,
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(openloomDir: string, settings: UserSettings): Promise<void> {
  const settingsPath = getSettingsFilePath(openloomDir);
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

export async function isInitialized(openloomDir: string): Promise<boolean> {
  const settings = await loadSettings(openloomDir);
  return settings.initialized;
}

export async function markInitialized(openloomDir: string): Promise<UserSettings> {
  const settings = await loadSettings(openloomDir);
  const next: UserSettings = {
    ...settings,
    initialized: true,
    initialized_at: new Date().toISOString(),
  };
  await saveSettings(openloomDir, next);
  return next;
}

export async function getDefaultRoot(openloomDir: string): Promise<RootConfig | null> {
  const settings = await loadSettings(openloomDir);
  return settings.default_root;
}

export async function setDefaultRoot(
  openloomDir: string,
  rootPath: string | null,
): Promise<UserSettings> {
  const settings = await loadSettings(openloomDir);
  const normalizedRoot = rootPath?.trim()
    ? { path: isAbsolute(rootPath) ? rootPath : resolve(process.cwd(), rootPath) }
    : null;
  const next: UserSettings = {
    ...settings,
    default_root: normalizedRoot,
  };
  await saveSettings(openloomDir, next);
  return next;
}
