#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const openloomArgIndex = args.indexOf('--openloom');
const openloomDir =
  openloomArgIndex !== -1 && openloomArgIndex < args.length - 1
    ? args[openloomArgIndex + 1]
    : '.openloom';
const normalizedOpenloomDir = path.isAbsolute(openloomDir)
  ? openloomDir
  : path.resolve(process.cwd(), openloomDir);
const settingsPath = path.join(normalizedOpenloomDir, 'config', 'user-settings.json');

function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx === args.length - 1) return undefined;
  return args[idx + 1];
}

function parseBoolean(flag, fallback) {
  if (!args.includes(flag)) return fallback;
  const value = getArg(flag);
  if (!value) return true;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).toLowerCase());
}

function loadSettings() {
  if (!fs.existsSync(settingsPath)) {
    return {
      preferences: {
        ocr_provider: 'online',
        skip_faces: false,
        text_concurrency: 5,
        image_concurrency: 3,
      },
    };
  }
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return {
      preferences: {
        ocr_provider: 'online',
        skip_faces: false,
        text_concurrency: 5,
        image_concurrency: 3,
      },
    };
  }
}

const settings = loadSettings();
const preferences = settings.preferences || {};
const requestedOcr = getArg('--ocr-provider');
const requestedTextConcurrency = Number.parseInt(getArg('--text-concurrency') || '', 10);
const requestedImageConcurrency = Number.parseInt(getArg('--image-concurrency') || '', 10);

const payload = {
  ocrProvider:
    requestedOcr === 'online' || requestedOcr === 'local'
      ? requestedOcr
      : preferences.ocr_provider || 'online',
  skipFaceDetection: parseBoolean('--skip-faces', preferences.skip_faces ?? false),
  textConcurrency:
    Number.isInteger(requestedTextConcurrency) && requestedTextConcurrency > 0
      ? requestedTextConcurrency
      : preferences.text_concurrency || 5,
  imageConcurrency:
    Number.isInteger(requestedImageConcurrency) && requestedImageConcurrency > 0
      ? requestedImageConcurrency
      : preferences.image_concurrency || 3,
  openloomDir: normalizedOpenloomDir,
  settingsPath,
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  process.stdout.write(
    'Use --json to output resolved interactive extract options. Optional flags: --openloom --ocr-provider --skip-faces --text-concurrency --image-concurrency\n',
  );
}
