import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createStaticServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createScanner } from '../ingestion/scanner/scanner.js';
import { openDatabase, closeDatabase } from '../knowledge/index/schema.js';
import { createBatchWriter } from '../knowledge/index/writer.js';
import { WizardSession } from '../wizard/session.js';
import { runOnboardingWizard } from '../wizard/onboarding.js';
import { resolveOpenloomDir } from '../config/user-settings.js';
import { ensureAgentBootstrapFiles, updateBootstrapMemoryFiles } from '../config/agent-memory/bootstrap-files.js';
import { upsertLessonsSections } from '../config/lessons-memory.js';
import { updateWorkspaceState } from '../config/workspace-state.js';
import { markInitialized, setDefaultRoot } from '../config/user-settings.js';
import { getScanRules } from '../config/user-settings.js';
import { mergeScanRules, shouldIncludePath } from '../ingestion/filtering/rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;
const UI_DIR = resolve(__dirname, '..', '..', 'dev-ui');
const wizardSessions = new Map<string, WizardSession>();

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/**
 * Create HTTP server with static file serving
 */
function createServer(port: number): http.Server {
  const server = createStaticServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = join(UI_DIR, filePath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(UI_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (err) {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });

  return server;
}

/**
 * Handle WebSocket messages
 */
function handleWsMessage(ws: WebSocket, message: string, db: ReturnType<typeof openDatabase>): void {
  try {
    const { type, data } = JSON.parse(message);

    switch (type) {
      case 'scan.start':
        handleScanStart(ws, data, db);
        break;
      case 'wizard.start':
        handleWizardStart(ws, data);
        break;
      case 'wizard.next':
        handleWizardNext(ws, data);
        break;
      case 'wizard.answer':
        handleWizardAnswer(ws, data);
        break;
      case 'wizard.cancel':
        handleWizardCancel(ws, data);
        break;
      case 'chat.message':
        handleChatMessage(ws, data);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  } catch (err) {
    console.error('Failed to handle message:', err);
  }
}

function emitWizardStep(
  ws: WebSocket,
  wizardId: string,
  payload: { done: boolean; status: string; step?: unknown; error?: string },
): void {
  ws.send(
    JSON.stringify({
      type: 'wizard.step',
      data: {
        wizardId,
        ...payload,
      },
    }),
  );
}

async function runGatewayOnboarding(
  openloomDir: string,
  prompter: Parameters<typeof runOnboardingWizard>[0],
): Promise<void> {
  await ensureAgentBootstrapFiles(openloomDir);
  await updateWorkspaceState(openloomDir, {
    lastWizardRunAt: new Date().toISOString(),
    lastWizardSource: 'manual',
  });

  const result = await runOnboardingWizard(prompter, {});

  await upsertLessonsSections(
    openloomDir,
    {
      preferredUserName: result.preferredUserName,
      preferredAgentName: result.preferredAgentName,
      tone: result.tone,
      languagePreference: result.languagePreference,
      formatPreference: result.formatPreference,
    },
    'gateway onboarding capture',
  );
  await updateBootstrapMemoryFiles(openloomDir, {
    preferredUserName: result.preferredUserName,
    preferredAgentName: result.preferredAgentName,
    tone: result.tone,
    languagePreference: result.languagePreference,
    formatPreference: result.formatPreference,
  });
  if (result.defaultRoot?.trim()) {
    await setDefaultRoot(openloomDir, result.defaultRoot.trim());
  }
  await markInitialized(openloomDir);
  await updateWorkspaceState(openloomDir, {
    onboardingCompletedAt: new Date().toISOString(),
  });
}

function handleWizardStart(
  ws: WebSocket,
  data: { wizardType?: 'onboarding'; openloomDir?: string },
): void {
  const wizardType = data?.wizardType ?? 'onboarding';
  if (wizardType !== 'onboarding') {
    ws.send(
      JSON.stringify({
        type: 'wizard.error',
        data: { error: `Unsupported wizard type: ${wizardType}` },
      }),
    );
    return;
  }

  const openloomDir = resolveOpenloomDir(data?.openloomDir);
  const wizardId = `wizard-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const wizard = new WizardSession(async (prompter) => {
    await runGatewayOnboarding(openloomDir, prompter);
  });
  wizardSessions.set(wizardId, wizard);

  void wizard.run().finally(() => {
    wizardSessions.delete(wizardId);
  });

  ws.send(
    JSON.stringify({
      type: 'wizard.started',
      data: { wizardId, wizardType, openloomDir },
    }),
  );
}

async function handleWizardNext(ws: WebSocket, data: { wizardId: string }): Promise<void> {
  const wizard = wizardSessions.get(data?.wizardId);
  if (!wizard) {
    ws.send(JSON.stringify({ type: 'wizard.error', data: { error: 'Wizard session not found' } }));
    return;
  }
  const next = await wizard.next();
  emitWizardStep(ws, data.wizardId, {
    done: next.done,
    status: next.status,
    step: next.step,
    error: next.error,
  });
}

function handleWizardAnswer(
  ws: WebSocket,
  data: { wizardId: string; stepId: string; value: unknown },
): void {
  const wizard = wizardSessions.get(data?.wizardId);
  if (!wizard) {
    ws.send(JSON.stringify({ type: 'wizard.error', data: { error: 'Wizard session not found' } }));
    return;
  }
  try {
    wizard.answer(data.stepId, data.value);
    ws.send(JSON.stringify({ type: 'wizard.ack', data: { wizardId: data.wizardId, stepId: data.stepId } }));
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: 'wizard.error',
        data: { error: error instanceof Error ? error.message : String(error) },
      }),
    );
  }
}

function handleWizardCancel(ws: WebSocket, data: { wizardId: string }): void {
  const wizard = wizardSessions.get(data?.wizardId);
  if (!wizard) {
    ws.send(JSON.stringify({ type: 'wizard.error', data: { error: 'Wizard session not found' } }));
    return;
  }
  wizard.cancel('cancelled by client');
  wizardSessions.delete(data.wizardId);
  ws.send(JSON.stringify({ type: 'wizard.cancelled', data: { wizardId: data.wizardId } }));
}

/**
 * Handle scan start
 */
async function handleScanStart(
  ws: WebSocket,
  data: { path: string; personal?: boolean; include?: string[]; exclude?: string[]; openloomDir?: string },
  db: ReturnType<typeof openDatabase>,
): Promise<void> {
  let path = data.path;
  
  // Expand ~ to home directory
  if (path.startsWith('~')) {
    path = process.env.HOME + path.slice(1);
  }
  
  // Default to home if empty
  if (!path || path === '') {
    path = process.env.HOME || '/Users/fanyang';
  }

  const scanId = `scan-${Date.now()}`;
  const scanner = createScanner();
  const batchWriter = createBatchWriter(db, scanId);
  const openloomDir = resolveOpenloomDir(data.openloomDir);
  const configuredRules = await getScanRules(openloomDir);
  const rules = mergeScanRules(configuredRules, {
    include: data.include,
    exclude: data.exclude,
  });

  // Send scan started
  ws.send(JSON.stringify({
    type: 'scan.started',
    data: { scan_id: scanId, path: data.path }
  }));

  try {
    let fileCount = 0;
    
    for await (const entry of scanner.scan(scanId, path, {
      personal: data.personal,
      include: rules.include,
      exclude: rules.exclude,
    })) {
      if (!shouldIncludePath(entry.path, rules)) continue;
      batchWriter.add(entry);
      fileCount++;

      // Send progress every 100 files
      const isDir = entry.is_dir;
      if (fileCount % 100 === 0) {
        ws.send(JSON.stringify({
          type: 'scan.progress',
          data: {
            files_scanned: fileCount,
            dirs_scanned: batchWriter['dirsScanned'] || 0,
            current_path: entry.path
          }
        }));
      }
    }

    // Flush remaining
    batchWriter.flush();

    // Send completion
    ws.send(JSON.stringify({
      type: 'scan.completed',
      data: {
        scan_id: scanId,
        path: data.path,
        total_files: fileCount
      }
    }));

  } catch (error) {
    ws.send(JSON.stringify({
      type: 'scan.failed',
      data: { error: error instanceof Error ? error.message : String(error) }
    }));
  }
}

/**
 * Handle chat message (placeholder)
 */
function handleChatMessage(ws: WebSocket, data: { content: string }): void {
  // Placeholder: echo back
  ws.send(JSON.stringify({
    type: 'chat.message',
    data: { content: `Echo: ${data.content}` }
  }));
}

/**
 * Start the gateway server
 */
export async function startGateway(port = DEFAULT_PORT): Promise<void> {
  const db = openDatabase();
  
  const server = createServer(port);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
      handleWsMessage(ws, message.toString(), db);
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  server.listen(port, () => {
    console.log(`🚀 OpenLoom Gateway running at http://localhost:${port}`);
    console.log(`   WebSocket available at ws://localhost:${port}/ws`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    closeDatabase(db);
    server.close(() => {
      process.exit(0);
    });
  });
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startGateway(parseInt(process.env.PORT || String(DEFAULT_PORT), 10));
}
