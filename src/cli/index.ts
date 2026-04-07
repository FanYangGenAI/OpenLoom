#!/usr/bin/env node
import { Command } from 'commander';
import { scanCommand } from './commands/scan.js';
import { statusCommand } from './commands/status.js';
import { serveCommand } from './commands/serve.js';

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
  .command('status')
  .description('Show status of recent scans')
  .action(statusCommand);

program
  .command('serve')
  .description('Start the development server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .action(serveCommand);

program.parse();
