import { createScanner } from './src/ingestion/scanner/scanner.js';
import { openDatabase, closeDatabase } from './src/knowledge/index/schema.js';
import { createBatchWriter } from './src/knowledge/index/writer.js';
import { createScannerBridge } from './src/ingestion/scanner/bridge.js';
import { readFileSync, existsSync } from 'fs';
import { basename, extname } from 'path';

// 配置
const TARGET_FOLDER = '/Users/fanyang/杨帆文件夹';
const TARGET_EXTS = ['doc', 'docx', 'txt', 'md', 'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

const SCAN_ID = `demo-${Date.now()}`;

// 数据库
const db = openDatabase();
const batchWriter = createBatchWriter(db, SCAN_ID);

// 扫描器
const scanner = createScannerBridge();

async function isTargetFile(ext: string): Promise<boolean> {
  return TARGET_EXTS.includes(ext.toLowerCase());
}

async function extractContent(filePath: string, ext: string): Promise<string> {
  try {
    const content = readFileSync(filePath);
    
    switch (ext.toLowerCase()) {
      case 'txt':
      case 'md':
        return content.toString('utf-8').substring(0, 5000);
      case 'pdf':
        // 简化的 PDF 文本提取（实际需要 pdf-parse）
        return `[PDF file: ${basename(filePath)}]`;
      case 'doc':
      case 'docx':
        return `[Word file: ${basename(filePath)}]`;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return `[Image file: ${basename(filePath)}]`;
      default:
        return '';
    }
  } catch (e) {
    return `[Error reading: ${e.message}]`;
  }
}

async function main() {
  console.log('Starting scan of:', TARGET_FOLDER);
  
  let fileCount = 0;
  let targetCount = 0;
  
  for await (const entry of scanner.scan(TARGET_FOLDER, { personal: false })) {
    fileCount++;
    
    const ext = entry.ext.toLowerCase();
    if (!TARGET_EXTS.includes(ext)) continue;
    
    targetCount++;
    
    // 提取内容（简化版）
    const content = await extractContent(entry.path, ext);
    
    // 添加到批次
    batchWriter.add({
      ...entry,
      file_type: getFileType(ext)
    });
    
    if (targetCount % 50 === 0) {
      console.log(`Processed: ${targetCount} target files...`);
    }
  }
  
  // 刷新剩余
  batchWriter.flush();
  
  console.log(`\n=== Scan Complete ===`);
  console.log(`Total files scanned: ${fileCount}`);
  console.log(`Target files: ${targetCount}`);
  
  closeDatabase(db);
}

function getFileType(ext: string): string {
  const docExts = ['doc', 'docx', 'txt', 'md'];
  const pdfExts = ['pdf'];
  const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  
  if (docExts.includes(ext)) return 'document';
  if (pdfExts.includes(ext)) return 'pdf';
  if (imgExts.includes(ext)) return 'image';
  return 'other';
}

main().catch(console.error);
