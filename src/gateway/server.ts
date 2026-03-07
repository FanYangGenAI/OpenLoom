import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createStaticServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createScanner } from '../ingestion/scanner/scanner.js';
import { openDatabase, closeDatabase } from '../knowledge/index/schema.js';
import { createBatchWriter } from '../knowledge/index/writer.js';

import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;
const UI_DIR = resolve(__dirname, '..', '..', 'dev-ui');

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

/**
 * Handle scan start
 */
async function handleScanStart(ws: WebSocket, data: { path: string; personal?: boolean }, db: ReturnType<typeof openDatabase>): Promise<void> {
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

  // Send scan started
  ws.send(JSON.stringify({
    type: 'scan.started',
    data: { scan_id: scanId, path: data.path }
  }));

  try {
    let fileCount = 0;
    
    for await (const entry of scanner.scan(scanId, data.path, { personal: data.personal })) {
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
