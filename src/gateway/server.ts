import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createStaticServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createScanner } from '../ingestion/scanner/scanner.js';
import { createBatchWriter } from '../knowledge/index/writer.js';

const DEFAULT_DB_PATH = process.env.DB_PATH || '/Users/fanyang/.jarvis/data/demo-yangfan.db';
let Database: any = null;

/**
 * Open or create database
 */
async function openDatabase(dbPath?: string): Promise<any> {
  if (!Database) {
    Database = (await import('better-sqlite3')).default;
  }
  const path = dbPath || DEFAULT_DB_PATH;
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  return db;
}

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
 * Handle API requests
 */
function handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse, db: ReturnType<typeof openDatabase>): void {
  const url = req.url || '';
  
  // GET /api/stats - 返回统计信息
  if (url === '/api/stats') {
    try {
      const stats = db.prepare(`
        SELECT file_type, COUNT(*) as count 
        FROM files 
        GROUP BY file_type
      `).all() as { file_type: string; count: number }[];
      
      const total = stats.reduce((sum, s) => sum + s.count, 0);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ total, by_type: stats }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }
  
  // GET /api/files - 返回文件列表（支持分页）
  if (url.startsWith('/api/files')) {
    try {
      const urlObj = new URL(url, 'http://localhost');
      const page = parseInt(urlObj.searchParams.get('page') || '1');
      const limit = parseInt(urlObj.searchParams.get('limit') || '20');
      const offset = (page - 1) * limit;
      const type = urlObj.searchParams.get('type');
      
      let whereClause = '';
      const params: any[] = [];
      if (type) {
        whereClause = 'WHERE files.file_type = ?';
        params.push(type);
      }
      
      const files = db.prepare(`
        SELECT files.id, files.name, files.path, files.ext, files.file_type, files.size, files.mtime_ms,
               extractions.summary, extractions.keywords, extractions.time_entities, extractions.space_entities, extractions.person_entities
        FROM files
        LEFT JOIN extractions ON files.path = extractions.file_path
        ${whereClause}
        ORDER BY files.id
        LIMIT ${limit} OFFSET ${offset}
      `).all(...params) as any[];
      
      const total = db.prepare(`
        SELECT COUNT(*) as count FROM files ${whereClause}
      `).get(...params) as { count: number };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        files, 
        pagination: { page, limit, total: total.count }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }
  
  // 404 for unknown API
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

/**
 * Create HTTP server with static file serving + API
 */
function createServer(port: number, db: ReturnType<typeof openDatabase>): http.Server {
  const server = createStaticServer((req, res) => {
    // API Endpoints
    if (req.url?.startsWith('/api/')) {
      handleApiRequest(req, res, db);
      return;
    }

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;
const UI_DIR = resolve(__dirname, '..', '..', 'dev-ui');

/**
 * Start the gateway server
 */
export async function startGateway(port = DEFAULT_PORT): Promise<void> {
  const db = await openDatabase();
  
  const server = createServer(port, db);
  
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
