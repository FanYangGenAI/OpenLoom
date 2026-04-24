import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createStaticServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises';
import { dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { extractDirectory, extractFile, type ExtractOptions } from '../ingestion/extractors/index.js';
import { getDefaultOpenLoomHome } from '../utils/platform-paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;
const DEFAULT_UI_DIR = resolve(__dirname, '..', '..', 'ui-ts', 'dist');
const UI_DIR = process.env.OPENLOOM_UI_DIR ? resolve(process.env.OPENLOOM_UI_DIR) : DEFAULT_UI_DIR;
const DEFAULT_OPENLOOM_DIR = getDefaultOpenLoomHome();

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
function createServer(_port: number): http.Server {
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
function handleWsMessage(ws: WebSocket, message: string): void {
  try {
    const payload = JSON.parse(message) as {
      type?: string;
      data?: Record<string, unknown>;
      requestId?: string;
    };
    void dispatchMessage(ws, payload);
  } catch (err) {
    sendError(ws, undefined, `Invalid message payload: ${(err as Error).message}`);
  }
}

type WsPayload = { type?: string; data?: Record<string, unknown>; requestId?: string };

interface MetadataListItem {
  hash: string;
  file_name: string;
  file_type: 'text_doc' | 'image';
  modified_at: string;
  summary: string;
  extraction_errors_count: number;
  tags_count: number;
  reviewed: boolean;
}

type MetadataRecord = Record<string, unknown> & {
  hash: string;
  file_type: 'text_doc' | 'image';
  file_name: string;
  modified_at: string;
  summary: string;
  extraction_errors: string[];
  tags: { keywords?: string[]; entities?: Record<string, string[]> };
};

async function dispatchMessage(ws: WebSocket, payload: WsPayload): Promise<void> {
  const { type, data = {}, requestId } = payload;

  if (!type) {
    sendError(ws, requestId, 'Missing message type');
    return;
  }

  try {
    switch (type) {
      case 'extract.start':
        await handleExtractStart(ws, data, requestId);
        break;
      case 'fs.listDirectories':
        sendResponse(ws, requestId, await handleFsListDirectories(data));
        break;
      case 'metadata.list':
        sendResponse(ws, requestId, await handleMetadataList(data));
        break;
      case 'metadata.get':
        sendResponse(ws, requestId, await handleMetadataGet(data));
        break;
      case 'metadata.updateHumanReview':
        sendResponse(ws, requestId, await handleMetadataUpdateHumanReview(data));
        break;
      default:
        sendError(ws, requestId, `Unknown message type: ${type}`);
    }
  } catch (error) {
    sendError(ws, requestId, error instanceof Error ? error.message : String(error));
  }
}

async function handleFsListDirectories(
  data: Record<string, unknown>,
): Promise<{ currentPath: string; directories: Array<{ name: string; fullPath: string }> }> {
  const inputPath = typeof data.path === 'string' && data.path.trim() ? data.path.trim() : process.cwd();
  const currentPath = resolve(inputPath);
  const info = await stat(currentPath);
  if (!info.isDirectory()) {
    throw new Error(`Not a directory: ${currentPath}`);
  }

  const entries = await readdir(currentPath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, fullPath: join(currentPath, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { currentPath, directories };
}

function resolveOpenloomDir(input: unknown): string {
  if (typeof input === 'string' && input.trim()) {
    return resolve(input.trim());
  }
  return DEFAULT_OPENLOOM_DIR;
}

function parseMetadataFile(raw: string): MetadataRecord {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Invalid metadata format');
  }
  const [, frontmatterRaw, body] = match;
  const frontmatter = yamlParse(frontmatterRaw) as Record<string, unknown>;
  return {
    ...frontmatter,
    summary: body.trim(),
    hash: String(frontmatter.hash ?? ''),
    file_type: (frontmatter.file_type as 'text_doc' | 'image') ?? 'text_doc',
    file_name: String(frontmatter.file_name ?? ''),
    modified_at: String(frontmatter.modified_at ?? ''),
    extraction_errors: Array.isArray(frontmatter.extraction_errors) ? (frontmatter.extraction_errors as string[]) : [],
    tags:
      (frontmatter.tags as { keywords?: string[]; entities?: Record<string, string[]> }) ??
      { keywords: [], entities: {} },
  };
}

async function readAllMetadata(openloomDir: string): Promise<MetadataRecord[]> {
  const textDir = join(openloomDir, 'metadata', 'text_docs');
  const imageDir = join(openloomDir, 'metadata', 'images');
  const records: MetadataRecord[] = [];

  for (const dir of [textDir, imageDir]) {
    if (!existsSync(dir)) continue;
    const files = await readdir(dir);
    for (const fileName of files) {
      if (!fileName.endsWith('.md')) continue;
      const fullPath = join(dir, fileName);
      const raw = await readFile(fullPath, 'utf-8');
      records.push(parseMetadataFile(raw));
    }
  }
  return records;
}

function toListItem(record: MetadataRecord): MetadataListItem {
  return {
    hash: record.hash,
    file_name: record.file_name,
    file_type: record.file_type,
    modified_at: record.modified_at,
    summary: record.summary,
    extraction_errors_count: record.extraction_errors.length,
    tags_count: (record.tags.keywords ?? []).length,
    reviewed: Boolean((record.human_review as Record<string, unknown> | undefined)?.reviewed),
  };
}

async function handleMetadataList(data: Record<string, unknown>): Promise<{ items: MetadataListItem[]; total: number }> {
  const openloomDir = resolveOpenloomDir(data.openloomDir);
  const fileType = data.fileType === 'text_doc' || data.fileType === 'image' ? data.fileType : undefined;
  const keyword = typeof data.keyword === 'string' ? data.keyword.trim().toLowerCase() : '';
  const page = typeof data.page === 'number' && data.page > 0 ? data.page : 1;
  const pageSize = typeof data.pageSize === 'number' && data.pageSize > 0 ? data.pageSize : 20;

  const all = await readAllMetadata(openloomDir);
  const filtered = all
    .filter((item) => (!fileType ? true : item.file_type === fileType))
    .filter((item) => {
      if (!keyword) return true;
      const haystack = `${item.file_name}\n${item.summary}\n${JSON.stringify(item.tags.entities ?? {})}`.toLowerCase();
      return haystack.includes(keyword);
    })
    .sort((a, b) => b.modified_at.localeCompare(a.modified_at));

  const offset = (page - 1) * pageSize;
  return {
    total: filtered.length,
    items: filtered.slice(offset, offset + pageSize).map(toListItem),
  };
}

async function handleMetadataGet(
  data: Record<string, unknown>,
): Promise<{ metadata: MetadataRecord; metadata_version: number }> {
  const openloomDir = resolveOpenloomDir(data.openloomDir);
  const hash = typeof data.hash === 'string' ? data.hash : '';
  const fileType = data.fileType === 'text_doc' || data.fileType === 'image' ? data.fileType : null;
  if (!hash || !fileType) {
    throw new Error('metadata.get requires hash and fileType');
  }
  const subdir = fileType === 'text_doc' ? 'text_docs' : 'images';
  const target = join(openloomDir, 'metadata', subdir, `${hash}.md`);
  if (!existsSync(target)) {
    throw new Error(`Metadata not found: ${hash}`);
  }
  const raw = await readFile(target, 'utf-8');
  const fileInfo = await stat(target);
  return { metadata: parseMetadataFile(raw), metadata_version: fileInfo.mtimeMs };
}

async function handleMetadataUpdateHumanReview(
  data: Record<string, unknown>,
): Promise<{ ok: true; updatedAt: string; metadata: MetadataRecord; metadata_version: number }> {
  const openloomDir = resolveOpenloomDir(data.openloomDir);
  const hash = typeof data.hash === 'string' ? data.hash : '';
  const fileType = data.fileType === 'text_doc' || data.fileType === 'image' ? data.fileType : null;
  const patch = (data.patch as Record<string, unknown> | undefined) ?? {};
  if (!hash || !fileType) {
    throw new Error('metadata.updateHumanReview requires hash and fileType');
  }
  const subdir = fileType === 'text_doc' ? 'text_docs' : 'images';
  const target = join(openloomDir, 'metadata', subdir, `${hash}.md`);
  if (!existsSync(target)) {
    throw new Error(`Metadata not found: ${hash}`);
  }
  const raw = await readFile(target, 'utf-8');
  const fileInfo = await stat(target);
  const expectedVersion = typeof data.expectedVersion === 'number' ? data.expectedVersion : undefined;
  if (expectedVersion !== undefined && Math.trunc(expectedVersion) !== Math.trunc(fileInfo.mtimeMs)) {
    throw new Error('Save conflict: metadata has changed on disk, please reload before saving');
  }
  const current = parseMetadataFile(raw);
  const now = new Date().toISOString();

  if (typeof patch.summary === 'string') {
    current.summary = patch.summary;
  }
  if (patch.tags && typeof patch.tags === 'object') {
    current.tags = patch.tags as MetadataRecord['tags'];
  }
  if (Array.isArray(patch.spatiotemporal)) {
    current.spatiotemporal = patch.spatiotemporal;
  }
  if (Array.isArray(patch.people_annotations)) {
    current.people_annotations = patch.people_annotations;
  }

  const reviewNotes = typeof patch.notes === 'string' ? patch.notes : 'Updated via review workbench';
  current.human_review = {
    reviewed: true,
    reviewed_at: now,
    reviewer: 'local-user',
    notes: reviewNotes,
  };

  const { summary, ...frontmatterData } = current;
  const frontmatter = yamlStringify(frontmatterData, {
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_DOUBLE',
  }).trimEnd();
  await writeFile(target, `---\n${frontmatter}\n---\n\n${summary}\n`, 'utf-8');
  const savedInfo = await stat(target);
  return { ok: true, updatedAt: now, metadata: current, metadata_version: savedInfo.mtimeMs };
}

async function handleExtractStart(ws: WebSocket, data: Record<string, unknown>, requestId?: string): Promise<void> {
  const inputPath = typeof data.path === 'string' ? data.path.trim() : '';
  if (!inputPath) {
    throw new Error('extract.start requires a path');
  }

  const openloomDir = resolveOpenloomDir(data.openloomDir);
  await mkdir(openloomDir, { recursive: true });
  const resolvedPath = resolve(inputPath);
  const fileStat = await stat(resolvedPath);
  const options: ExtractOptions = {
    openloomDir,
    forceReextract: Boolean(data.force),
    ocrProvider: data.ocrProvider === 'local' ? 'local' : 'online',
    skipFaceDetection: Boolean(data.skipFaces),
    textConcurrency: typeof data.textConcurrency === 'number' ? data.textConcurrency : undefined,
    imageConcurrency: typeof data.imageConcurrency === 'number' ? data.imageConcurrency : undefined,
    onProgress: (progress) => {
      ws.send(
        JSON.stringify({
          type: 'extract.progress',
          requestId,
          data: progress,
        }),
      );
    },
  };

  try {
    if (fileStat.isFile()) {
      const result = await extractFile(resolvedPath, options);
      sendResponse(ws, requestId, {
        mode: 'file',
        file: result.file_name,
        hash: result.hash,
        fileType: result.file_type,
      });
      return;
    }
    if (!fileStat.isDirectory()) {
      throw new Error('Path must be a file or directory');
    }
    const result = await extractDirectory(resolvedPath, options);
    sendResponse(ws, requestId, {
      mode: 'directory',
      succeeded: result.succeeded.length,
      failed: result.failed.length,
      durationMs: result.durationMs,
      errors: result.failed,
    });
  } catch (error) {
    sendError(ws, requestId, error instanceof Error ? error.message : String(error));
  }
}

function sendResponse(ws: WebSocket, requestId: string | undefined, data: unknown): void {
  ws.send(
    JSON.stringify({
      type: 'response',
      requestId,
      ok: true,
      data,
    }),
  );
}

function sendError(ws: WebSocket, requestId: string | undefined, error: string): void {
  ws.send(
    JSON.stringify({
      type: 'response',
      requestId,
      ok: false,
      error,
    }),
  );
}

/**
 * Start the gateway server
 */
export async function startGateway(port = DEFAULT_PORT): Promise<void> {
  const server = createServer(port);

  // Create WebSocket server
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('message', (message) => {
      handleWsMessage(ws, message.toString());
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  server.listen(port, () => {
    console.log(`🚀 OpenLoom Gateway running at http://localhost:${port}`);
    console.log(`   WebSocket available at ws://localhost:${port}/ws`);
    console.log(`   Serving UI from: ${UI_DIR}`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => {
      process.exit(0);
    });
  });
}

// Start if run directly
const isDirectRun =
  typeof process.argv[1] === 'string' &&
  (resolve(process.argv[1]) === fileURLToPath(import.meta.url) || process.argv[1].endsWith('src/gateway/server.ts'));

if (isDirectRun) {
  startGateway(parseInt(process.env.PORT || String(DEFAULT_PORT), 10));
}
