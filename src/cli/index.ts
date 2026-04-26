#!/usr/bin/env node
import { Command } from 'commander';
import { scanCommand } from './commands/scan.js';
import { statusCommand } from './commands/status.js';
import { serveCommand } from './commands/serve.js';
import { extractCommand } from './commands/extract.js';
import { setupCommand } from './commands/setup.js';
import { profileBuildCommand, profileResetCommand } from './commands/profile.js';
import {
  rootsAddCommand,
  rootsClearCommand,
  rootsListCommand,
  rootsRemoveCommand,
  rootsSetDefaultCommand,
  rootsShowCommand,
} from './commands/roots.js';
import {
  rulesExcludeAddCommand,
  rulesExcludeRemoveCommand,
  rulesIncludeAddCommand,
  rulesIncludeRemoveCommand,
  rulesResetDefaultCommand,
  rulesShowCommand,
} from './commands/rules.js';

const program = new Command();

program
  .name('openloom')
  .description('Weaving your digital chaos into a life narrative')
  .version('0.1.0');

program
  .command('scan [path]')
  .description('Scan a directory for file metadata')
  .option('-p, --personal', 'Personal mode: exclude common ignore patterns')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .option('--all-roots', 'Scan all configured source roots')
  .option('--include <glob...>', 'Include glob patterns')
  .option('--exclude <glob...>', 'Exclude glob patterns')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(scanCommand);

program
  .command('extract [path]')
  .description('Extract metadata from a file or all supported files in a directory')
  .option('--openloom <dir>',        'Path to .openloom data directory (default: ./.openloom)')
  .option('-f, --force',             'Re-extract even if metadata already exists (skip hash-cache)')
  .option('--ocr-provider <mode>',   'OCR provider: online (DeepSeek API) | local (Ollama)', 'online')
  .option('--skip-faces',            'Disable face detection (use if TF native bindings not installed)')
  .option('--text-concurrency <n>',  'Max parallel TextDocAgent workers', '5')
  .option('--image-concurrency <n>', 'Max parallel ImageAgent workers', '3')
  .option('-i, --interactive',       'Use interactive prompt to resolve extract options')
  .option('--all-roots',             'Extract from all configured source roots')
  .option('--include <glob...>',     'Include glob patterns')
  .option('--exclude <glob...>',     'Exclude glob patterns')
  .option('--json',                  'Output results as JSON')
  .action(extractCommand);

program
  .command('status')
  .description('Show status of recent scans')
  .action(statusCommand);

program
  .command('serve')
  .description('Start the development server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .action(serveCommand);

program
  .command('setup')
  .description('Run first-time onboarding and initialize local settings')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .option('--root <path>', 'Default user data root directory')
  .option('--non-interactive', 'Skip prompts and use defaults/pending placeholders')
  .action(setupCommand);

const profile = program
  .command('profile')
  .description('Build and manage user profile from extracted metadata');

profile
  .command('build')
  .description('Build USER.md from .openloom/metadata with conflict gating')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .option('-f, --force', 'Re-process already processed metadata hashes')
  .option('--concurrency <n>', 'Max parallel metadata claim workers', '6')
  .action(profileBuildCommand);

profile
  .command('reset')
  .description('Cold start: template USER.md, clear profile state and related agent files')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(profileResetCommand);

const roots = program
  .command('roots')
  .description('Manage source root directories');

roots
  .command('show')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rootsShowCommand);

roots
  .command('list')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rootsListCommand);

roots
  .command('add [path]')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rootsAddCommand);

roots
  .command('remove [path]')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rootsRemoveCommand);

roots
  .command('set-default [path]')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rootsSetDefaultCommand);

roots
  .command('set [path]')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rootsSetDefaultCommand);

roots
  .command('clear')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rootsClearCommand);

const rules = program.command('rules').description('Manage include/exclude scan rules');

rules
  .command('show')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rulesShowCommand);

rules
  .command('include-add <pattern>')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rulesIncludeAddCommand);

rules
  .command('include-remove <pattern>')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rulesIncludeRemoveCommand);

rules
  .command('exclude-add <pattern>')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rulesExcludeAddCommand);

rules
  .command('exclude-remove <pattern>')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rulesExcludeRemoveCommand);

rules
  .command('reset-default')
  .option('--openloom <dir>', 'Path to .openloom data directory (default: ./.openloom)')
  .action(rulesResetDefaultCommand);

program.parse();
