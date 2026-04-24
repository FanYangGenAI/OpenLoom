export type FileType = 'text_doc' | 'image';

export interface ExtractProgress {
  file: string;
  status: 'success' | 'error';
  error?: string;
  completed: number;
  total: number;
  textDone: number;
  imageDone: number;
}

export interface MetadataListItem {
  hash: string;
  file_name: string;
  file_type: FileType;
  modified_at: string;
  summary: string;
  extraction_errors_count: number;
  tags_count: number;
  reviewed: boolean;
}

export interface MetadataRecord {
  hash: string;
  file_type: FileType;
  file_name: string;
  file_path?: string;
  modified_at: string;
  summary: string;
  extraction_errors: string[];
  tags: {
    keywords?: string[];
    entities?: {
      persons?: string[];
      places?: string[];
      orgs?: string[];
      other?: string[];
    };
  };
  spatiotemporal?: Array<{ period: string; place?: string; event: string; confidence: number }>;
  people_annotations?: Array<{ name: string; alias?: string[]; relationship?: string; notes?: string }>;
  path_history?: Array<{ file_path: string; file_name: string; parent_folder: string; recorded_at: string }>;
  human_review?: { reviewed: boolean; reviewed_at: string; reviewer: string; notes?: string };
}

export interface WsResponse<T> {
  type: 'response';
  requestId?: string;
  ok: boolean;
  data?: T;
  error?: string;
}

export interface WsProgressEvent {
  type: 'extract.progress';
  requestId?: string;
  data: ExtractProgress;
}
