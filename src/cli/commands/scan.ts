import { createScannerBridge } from '../../ingestion/scanner/bridge.js';
import { getDefaultRoot, getScanRules, listRoots, resolveOpenloomDir } from '../../config/user-settings.js';
import { mergeScanRules, shouldIncludePath } from '../../ingestion/filtering/rules.js';

interface ScanOptions {
  personal?: boolean;
  output?: string;
  openloom?: string;
  allRoots?: boolean;
  include?: string[];
  exclude?: string[];
}

export async function scanCommand(path: string | undefined, options: ScanOptions): Promise<void> {
  const openloomDir = resolveOpenloomDir(options.openloom);
  const configuredRules = await getScanRules(openloomDir);
  const rules = mergeScanRules(configuredRules, {
    include: options.include,
    exclude: options.exclude,
  });
  const targets = await resolveScanTargets(path, openloomDir, options.allRoots ?? false);
  const scanner = createScannerBridge();

  let hasFailure = false;
  for (const target of targets) {
    console.log(`Scanning: ${target}`);
    console.log(`Personal mode: ${options.personal ? 'enabled' : 'disabled'}`);

    let fileCount = 0;
    let dirCount = 0;
    let totalSize = 0;

    const startTime = Date.now();
    try {
      for await (const entry of scanner.scan(target, {
        personal: options.personal,
        include: rules.include,
        exclude: rules.exclude,
      })) {
        if (!shouldIncludePath(entry.path, rules)) continue;
        fileCount++;
        totalSize += entry.size;
        if (entry.is_dir) {
          dirCount++;
        }
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
      hasFailure = true;
      console.error('Scan failed:', error);
    }
  }
  if (hasFailure) {
    process.exit(1);
  }
}

async function resolveScanTargets(
  path: string | undefined,
  openloomDir: string,
  allRoots: boolean,
): Promise<string[]> {
  if (path?.trim()) return [path];
  if (allRoots) {
    const roots = await listRoots(openloomDir);
    if (roots.length > 0) return roots.map((root) => root.path);
  }
  const defaultRoot = await getDefaultRoot(openloomDir);
  if (defaultRoot?.path) return [defaultRoot.path];
  console.error('Error: no scan path provided and no source roots configured.');
  process.exit(1);
  return [];
}
