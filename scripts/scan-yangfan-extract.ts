/**
 * 信息提取模块
 * 使用 LLM 提取文档的摘要、关键词、时间、空间、人物实体
 */

import { createScannerBridge } from '../src/ingestion/scanner/bridge.js';
import { openDatabase, closeDatabase } from '../src/knowledge/index/schema.js';
import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { basename, extname, join } from 'path';

// 配置
const TARGET_FOLDER = '/Users/fanyang/杨帆文件夹';
const TARGET_EXTS = ['.doc', '.docx', '.txt', '.md', '.pdf', '.jpg', '.jpeg', '.png', '.gif'];
const SCAN_ID = `demo-${Date.now()}`;
const DB_PATH = '/Users/fanyang/.jarvis/data/demo-yangfan.db';

// 扩展数据库 schema
function extendSchema(db: Database.Database) {
  // 提取结果表
  db.exec(`
    CREATE TABLE IF NOT EXISTS extractions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_ext TEXT NOT NULL,
      file_type TEXT NOT NULL,
      content_preview TEXT,
      summary TEXT,
      keywords TEXT,
      time_entities TEXT,
      space_entities TEXT,
      person_entities TEXT,
      raw_llm_response TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(file_path)
    )
  `);
  
  // 索引（IF NOT EXISTS）
  db.exec(`CREATE INDEX IF NOT EXISTS idx_extractions_scan_id ON extractions(scan_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_extractions_file_type ON extractions(file_type)`);
}

// 文件类型判断
function getFileType(ext: string): string {
  const docExts = ['.doc', '.docx', '.txt', '.md'];
  const pdfExts = ['.pdf'];
  const imgExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  ext = ext.toLowerCase();
  if (docExts.includes(ext)) return 'document';
  if (pdfExts.includes(ext)) return 'pdf';
  if (imgExts.includes(ext)) return 'image';
  return 'other';
}

// 读取文件内容（简化版）
async function extractFileContent(filePath: string, ext: string): Promise<string> {
  try {
    if (!existsSync(filePath)) {
      return '';
    }
    
    const content = readFileSync(filePath);
    const name = basename(filePath);
    
    switch (ext.toLowerCase()) {
      case 'txt':
      case 'md':
        return content.toString('utf-8').substring(0, 8000);
      case 'pdf':
        return `[PDF文档: ${name}]`;
      case 'doc':
      case 'docx':
        return `[Word文档: ${name}]`;
      case 'jpg':
      case 'jpeg':
      case 'png':
        return `[图片文件: ${name}, 大小: ${content.length} bytes]`;
      default:
        return '';
    }
  } catch (e) {
    return `[读取失败: ${e.message}]`;
  }
}

// 主扫描函数
async function scanAndExtract() {
  console.log('=== 开始扫描 ===');
  console.log('目标文件夹:', TARGET_FOLDER);
  
  const db = openDatabase(DB_PATH);
  extendSchema(db);
  
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO extractions 
    (scan_id, file_path, file_name, file_ext, file_type, content_preview, summary, keywords, time_entities, space_entities, person_entities, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const scanner = createScannerBridge();
  let totalScanned = 0;
  let targetFound = 0;
  
  for await (const entry of scanner.scan(TARGET_FOLDER, { personal: false })) {
    totalScanned++;
    
    const ext = entry.ext; // includes the dot, e.g., ".jpg"
    if (!TARGET_EXTS.includes(ext)) continue;
    
    targetFound++;
    
    // 提取内容
    const content = await extractFileContent(entry.path, ext);
    const fileType = getFileType(ext);
    
    // 插入基本信息（提取将在后续步骤完成）
    insertStmt.run(
      SCAN_ID,
      entry.path,
      entry.name,
      ext,
      fileType,
      content.substring(0, 500),
      '', // summary
      '', // keywords
      '', // time
      '', // space
      '', // person
      Date.now()
    );
    
    if (targetFound % 100 === 0) {
      console.log(`已扫描: ${totalScanned}, 目标文件: ${targetFound}`);
    }
  }
  
  console.log(`\n=== 扫描完成 ===`);
  console.log(`总扫描: ${totalScanned}`);
  console.log(`目标文件: ${targetFound}`);
  
  // 统计
  const stats = db.prepare(`
    SELECT file_type, COUNT(*) as count FROM extractions 
    WHERE scan_id = ? GROUP BY file_type
  `).all(SCAN_ID) as { file_type: string; count: number }[];
  
  console.log('\n文件类型分布:');
  for (const s of stats) {
    console.log(`  ${s.file_type}: ${s.count}`);
  }
  
  closeDatabase(db);
  
  return targetFound;
}

scanAndExtract().then(count => {
  console.log(`\n✅ 扫描完成，共 ${count} 个目标文件`);
  process.exit(0);
}).catch(e => {
  console.error('❌ 错误:', e);
  process.exit(1);
});
