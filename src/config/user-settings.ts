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
  roots: RootConfig[];
  scan_rules: ScanRules;
  preferences: UserPreferences;
}

export interface ScanRules {
  version: 1;
  include: string[];
  exclude: string[];
}

const DEFAULT_SCAN_RULES: ScanRules = {
  version: 1,
  include: [],
  exclude: [
    '**/.git/**',
    '**/node_modules/**',
    '**/.openloom/**',
    '**/.tmp/**',
    '**/dist/**',
    '**/*.log',
  ],
};

const DEFAULT_SETTINGS: UserSettings = {
  initialized: false,
  initialized_at: null,
  openloom_dir: null,
  default_root: null,
  roots: [],
  scan_rules: DEFAULT_SCAN_RULES,
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
    const merged: UserSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      roots: normalizeRoots((parsed as Partial<UserSettings>).roots),
      scan_rules: normalizeScanRules((parsed as Partial<UserSettings>).scan_rules),
      preferences: {
        ...DEFAULT_SETTINGS.preferences,
        ...parsed.preferences,
      },
    };
    if (merged.default_root?.path) {
      merged.roots = dedupeRoots([merged.default_root, ...merged.roots]);
    }
    return merged;
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

export async function listRoots(openloomDir: string): Promise<RootConfig[]> {
  const settings = await loadSettings(openloomDir);
  return settings.roots;
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
    roots: normalizedRoot ? dedupeRoots([normalizedRoot, ...settings.roots]) : settings.roots,
  };
  await saveSettings(openloomDir, next);
  return next;
}

export async function addRoot(openloomDir: string, rootPath: string): Promise<UserSettings> {
  const settings = await loadSettings(openloomDir);
  const normalized: RootConfig = {
    path: isAbsolute(rootPath) ? rootPath : resolve(process.cwd(), rootPath),
  };
  const roots = dedupeRoots([...settings.roots, normalized]);
  const defaultRoot = settings.default_root ?? roots[0] ?? null;
  const next: UserSettings = {
    ...settings,
    roots,
    default_root: defaultRoot,
  };
  await saveSettings(openloomDir, next);
  return next;
}

export async function removeRoot(openloomDir: string, rootPath: string): Promise<UserSettings> {
  const settings = await loadSettings(openloomDir);
  const normalizedPath = isAbsolute(rootPath) ? rootPath : resolve(process.cwd(), rootPath);
  const roots = settings.roots.filter((root) => root.path !== normalizedPath);
  const defaultRoot =
    settings.default_root?.path === normalizedPath ? roots[0] ?? null : settings.default_root;
  const next: UserSettings = {
    ...settings,
    roots,
    default_root: defaultRoot,
  };
  await saveSettings(openloomDir, next);
  return next;
}

export async function getScanRules(openloomDir: string): Promise<ScanRules> {
  const settings = await loadSettings(openloomDir);
  return settings.scan_rules;
}

export async function updateScanRules(
  openloomDir: string,
  patch: Partial<ScanRules>,
): Promise<UserSettings> {
  const settings = await loadSettings(openloomDir);
  const nextRules = normalizeScanRules({
    ...settings.scan_rules,
    ...patch,
    include: patch.include ?? settings.scan_rules.include,
    exclude: patch.exclude ?? settings.scan_rules.exclude,
  });
  const next: UserSettings = {
    ...settings,
    scan_rules: nextRules,
  };
  await saveSettings(openloomDir, next);
  return next;
}

export async function resetScanRules(openloomDir: string): Promise<UserSettings> {
  return updateScanRules(openloomDir, DEFAULT_SCAN_RULES);
}

export async function updatePreferences(
  openloomDir: string,
  patch: Partial<UserPreferences>,
): Promise<UserSettings> {
  const settings = await loadSettings(openloomDir);
  const next: UserSettings = {
    ...settings,
    preferences: {
      ...settings.preferences,
      ...patch,
    },
  };
  await saveSettings(openloomDir, next);
  return next;
}

function normalizeRoots(roots: RootConfig[] | undefined): RootConfig[] {
  return dedupeRoots(
    (roots ?? [])
      .filter((root): root is RootConfig => Boolean(root?.path?.trim()))
      .map((root) => ({
        path: isAbsolute(root.path) ? root.path : resolve(process.cwd(), root.path),
      })),
  );
}

function dedupeRoots(roots: RootConfig[]): RootConfig[] {
  const seen = new Set<string>();
  const deduped: RootConfig[] = [];
  for (const root of roots) {
    if (!root.path || seen.has(root.path)) continue;
    seen.add(root.path);
    deduped.push(root);
  }
  return deduped;
}

function normalizeScanRules(rules: Partial<ScanRules> | undefined): ScanRules {
  return {
    version: 1,
    include: Array.from(new Set(rules?.include ?? DEFAULT_SCAN_RULES.include)),
    exclude: Array.from(new Set(rules?.exclude ?? DEFAULT_SCAN_RULES.exclude)),
  };
}
