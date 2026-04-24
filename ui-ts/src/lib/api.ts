import type { MetadataListItem, MetadataRecord, WsProgressEvent } from './protocol';
import { WsClient } from './wsClient';

export interface ApiClient {
  connect: () => void;
  extractStart: (payload: Record<string, unknown>) => Promise<unknown>;
  listDirectories: (path?: string) => Promise<{ currentPath: string; directories: Array<{ name: string; fullPath: string }> }>;
  metadataList: (payload: Record<string, unknown>) => Promise<{ items: MetadataListItem[]; total: number }>;
  metadataGet: (hash: string, fileType: 'text_doc' | 'image', openloomDir?: string) => Promise<{ metadata: MetadataRecord; metadata_version: number }>;
  metadataUpdate: (payload: Record<string, unknown>) => Promise<{ metadata: MetadataRecord; metadata_version: number; updatedAt: string }>;
}

export function createApiClient(
  onProgress: (event: WsProgressEvent) => void,
  onConnectionChange: (connected: boolean) => void,
): ApiClient {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WsClient(`${protocol}//${window.location.host}/ws`, onProgress, onConnectionChange);

  return {
    connect: () => ws.connect(),
    extractStart: (payload) => ws.request('extract.start', payload),
    listDirectories: (path?: string) => ws.request('fs.listDirectories', { path }),
    metadataList: (payload) => ws.request('metadata.list', payload),
    metadataGet: (hash, fileType, openloomDir) => ws.request('metadata.get', { hash, fileType, openloomDir }),
    metadataUpdate: (payload) => ws.request('metadata.updateHumanReview', payload),
  };
}
