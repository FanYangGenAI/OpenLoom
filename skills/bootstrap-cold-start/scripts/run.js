#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx === args.length - 1) return undefined;
  return args[idx + 1];
}

const openloomDir = getArg('--openloom') || '.openloom';
const root = getArg('--root') || null;
const nonInteractive = args.includes('--non-interactive');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../');
const normalizedOpenloomDir = path.isAbsolute(openloomDir)
  ? openloomDir
  : path.resolve(process.cwd(), openloomDir);

const setupArgs = ['--import', 'tsx', 'src/cli/index.ts', 'setup', '--openloom', normalizedOpenloomDir];
if (root) setupArgs.push('--root', root);
if (nonInteractive) setupArgs.push('--non-interactive');

const runResult = spawnSync(process.execPath, setupArgs, {
  cwd: repoRoot,
  env: process.env,
  stdio: 'pipe',
  encoding: 'utf8',
});

const lessonsPath = path.join(normalizedOpenloomDir, 'agent', 'lessons.md');
const settingsPath = path.join(normalizedOpenloomDir, 'config', 'user-settings.json');

const payload = {
  status: runResult.status === 0 ? 'initialized' : 'failed',
  openloom_dir: normalizedOpenloomDir,
  default_root: root,
  non_interactive: nonInteractive,
  lessons_path: lessonsPath,
  settings_path: settingsPath,
  checks: {
    deepseek_api_key: Boolean(process.env.DEEPSEEK_API_KEY),
    ollama_env: Boolean(process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL),
  },
  setup: {
    exit_code: runResult.status,
    stdout: runResult.stdout ? runResult.stdout.trim().split('\n').slice(-8) : [],
    stderr: runResult.stderr ? runResult.stderr.trim().split('\n').slice(-8) : [],
  },
  files: {
    lessons_exists: fs.existsSync(lessonsPath),
    settings_exists: fs.existsSync(settingsPath),
  },
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
process.exit(runResult.status === null ? 1 : runResult.status);
