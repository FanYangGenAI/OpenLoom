#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const action = args[0] || 'show';

function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx === args.length - 1) return undefined;
  return args[idx + 1];
}

const openloomDir = getArg('--openloom') || '.openloom';
const rootPath = action === 'set' ? args[1] : null;
const normalizedOpenloomDir = path.isAbsolute(openloomDir)
  ? openloomDir
  : path.resolve(process.cwd(), openloomDir);
const settingsPath = path.join(normalizedOpenloomDir, 'config', 'user-settings.json');

function defaultSettings() {
  return {
    initialized: false,
    initialized_at: null,
    openloom_dir: normalizedOpenloomDir,
    default_root: null,
    preferences: {
      ocr_provider: 'online',
      text_concurrency: 5,
      image_concurrency: 3,
      skip_faces: false,
    },
  };
}

function loadSettings() {
  if (!fs.existsSync(settingsPath)) return defaultSettings();
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

const settings = loadSettings();
let defaultRoot = settings.default_root?.path ?? null;
let status = 'ok';
let message = '';

if (action === 'set') {
  if (!rootPath) {
    status = 'error';
    message = 'missing root path for set action';
  } else {
    defaultRoot = path.resolve(rootPath);
    settings.default_root = { path: defaultRoot };
    saveSettings(settings);
    message = 'default root updated';
  }
} else if (action === 'clear') {
  settings.default_root = null;
  defaultRoot = null;
  saveSettings(settings);
  message = 'default root cleared';
} else if (action === 'show') {
  message = defaultRoot ? 'default root available' : 'no default root configured';
} else {
  status = 'error';
  message = `unsupported action: ${action}`;
}

process.stdout.write(
  `${JSON.stringify(
    {
      status,
      action,
      openloom_dir: normalizedOpenloomDir,
      default_root: defaultRoot,
      settings_path: settingsPath,
      message,
    },
    null,
    2,
  )}\n`,
);

if (status !== 'ok') {
  process.exit(1);
}
