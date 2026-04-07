import { createScannerBridge } from '../../ingestion/scanner/bridge.js';

interface ScanOptions {
  personal?: boolean;
  output?: string;
}

export async function scanCommand(path: string, options: ScanOptions): Promise<void> {
  console.log(`Scanning: ${path}`);
  console.log(`Personal mode: ${options.personal ? 'enabled' : 'disabled'}`);
  
  const scanner = createScannerBridge();
  
  let fileCount = 0;
  let dirCount = 0;
  let totalSize = 0;
  
  const startTime = Date.now();
  
  try {
    for await (const entry of scanner.scan(path, { personal: options.personal })) {
      fileCount++;
      totalSize += entry.size;
      
      if (entry.is_dir) {
        dirCount++;
      }
      
      // Progress indicator every 1000 files
      if (fileCount % 1000 === 0) {
        process.stdout.write(`\rScanned: ${fileCount} files, ${dirCount} directories...`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`\n\nScan completed in ${(duration / 1000).toFixed(2)}s`);
    console.log(`Total files: ${fileCount}`);
    console.log(`Total directories: ${dirCount}`);
    console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('Scan failed:', error);
    process.exit(1);
  }
}
