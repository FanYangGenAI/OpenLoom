#!/usr/bin/env node
import { Command } from 'commander';
import { scanCommand } from './commands/scan.js';
import { statusCommand } from './commands/status.js';
import { serveCommand } from './commands/serve.js';
import { extractCommand } from './commands/extract.js';

const program = new Command();

program
  .name('openloom')
  .description('Weaving your digital chaos into a life narrative')
  .version('0.1.0');

program
  .command('scan <path>')
  .description('Scan a directory for file metadata')
  .option('-p, --personal', 'Personal mode: exclude common ignore patterns')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(scanCommand);

program
  .command('extract <path>')
  .description('Extract metadata from a file or all supported files in a directory')
  .option('--openloom <dir>',        'Path to OpenLoom data directory (default: OS-specific app data path)')
  .option('-f, --force',             'Re-extract even if metadata already exists (skip hash-cache)')
  .option('--ocr-provider <mode>',   'OCR provider: online (DeepSeek API) | local (Ollama)', 'online')
  .option('--skip-faces',            'Disable face detection (use if TF native bindings not installed)')
  .option('--text-concurrency <n>',  'Max parallel TextDocAgent workers', '5')
  .option('--image-concurrency <n>', 'Max parallel ImageAgent workers', '3')
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

program.parse();
