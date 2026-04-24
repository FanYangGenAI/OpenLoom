import { existsSync } from 'fs';
import { homedir, platform, tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const CURRENT_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(CURRENT_FILE_DIR, '..', '..');

export function getDefaultOpenLoomHome(): string {
  const envOverride = process.env.OPENLOOM_HOME?.trim();
  if (envOverride) return resolve(envOverride);

  const userHome = homedir();
  const currentPlatform = platform();
  if (currentPlatform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA?.trim();
    if (localAppData) return join(localAppData, 'OpenLoom');
    return join(userHome, 'AppData', 'Local', 'OpenLoom');
  }
  if (currentPlatform === 'darwin') {
    return join(userHome, 'Library', 'Application Support', 'OpenLoom');
  }
  const xdgDataHome = process.env.XDG_DATA_HOME?.trim();
  if (xdgDataHome) return join(xdgDataHome, 'OpenLoom');
  return join(userHome, '.local', 'share', 'OpenLoom');
}

export function getDefaultScannerBinaryPath(): string {
  const envOverride = process.env.OPENLOOM_SCANNER_BIN?.trim();
  if (envOverride) return resolve(envOverride);

  const binaryName = platform() === 'win32' ? 'openloom-scanner.exe' : 'openloom-scanner';
  return resolve(REPO_ROOT, 'crates', 'scanner', 'target', 'release', binaryName);
}

export function resolveExistingScannerBinaryPath(): string | null {
  const preferred = getDefaultScannerBinaryPath();
  if (existsSync(preferred)) return preferred;
  return null;
}

export function getDefaultE2ETestDbPath(): string {
  return join(tmpdir(), 'openloom-test.db');
}

export function getRepoRootPath(): string {
  return REPO_ROOT;
}
