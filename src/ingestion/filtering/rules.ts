import { resolve } from 'path';
import type { ScanRules } from '../../config/user-settings.js';

export interface RuleOverride {
  include?: string[];
  exclude?: string[];
}

export function mergeScanRules(base: ScanRules, override?: RuleOverride): ScanRules {
  return {
    version: 1,
    include: override?.include?.length ? override.include : base.include,
    exclude: override?.exclude?.length ? override.exclude : base.exclude,
  };
}

export function shouldIncludePath(path: string, rules: ScanRules): boolean {
  const normalized = normalizePath(path);
  if (isExcludedPath(path, rules)) {
    return false;
  }
  if (rules.include.length === 0) {
    return true;
  }
  return rules.include.some((pattern) => matchGlob(normalized, pattern));
}

export function isExcludedPath(path: string, rules: ScanRules): boolean {
  const normalized = normalizePath(path);
  return rules.exclude.some((pattern) => matchGlob(normalized, pattern));
}

export function normalizePath(path: string): string {
  return resolve(path).replace(/\\/g, '/');
}

function matchGlob(path: string, glob: string): boolean {
  const pattern = globToRegExp(glob);
  return pattern.test(path);
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/\\/g, '/')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}
