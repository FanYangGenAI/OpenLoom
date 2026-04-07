import { z } from 'zod';

// ─── File type enum ───────────────────────────────────────────────────────────

export const FileTypeSchema = z.enum(['text_doc', 'image']);
export type FileType = z.infer<typeof FileTypeSchema>;

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

export const GeoPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  place_name: z.string().optional(),
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;

export const SpatiotemporalEntrySchema = z.object({
  period: z.string(),
  place: z.string().optional(),
  event: z.string(),
  confidence: z.number().min(0).max(1),
});
export type SpatiotemporalEntry = z.infer<typeof SpatiotemporalEntrySchema>;

export const FaceEntrySchema = z.object({
  face_id: z.string(),
  crop_path: z.string(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  matched_person: z.string().nullable(),
});
export type FaceEntry = z.infer<typeof FaceEntrySchema>;

export const TagsSchema = z.object({
  keywords: z.array(z.string()),
  entities: z.object({
    persons: z.array(z.string()),
    places: z.array(z.string()),
    orgs: z.array(z.string()),
    other: z.array(z.string()),
  }),
});
export type Tags = z.infer<typeof TagsSchema>;

// ─── AI semantic output schema (Structured Output from LLM) ──────────────────

export const SemanticOutputSchema = z.object({
  summary: z.string(),
  author_inferred: z.string().nullable(),
  tags: TagsSchema,
  spatiotemporal: z.array(SpatiotemporalEntrySchema),
  web_search_needed: z.array(
    z.object({
      entity: z.string(),
      reason: z.string(),
      query: z.string(),
    }),
  ),
});
export type SemanticOutput = z.infer<typeof SemanticOutputSchema>;

// ─── Full FileMetadata ────────────────────────────────────────────────────────

export const FileMetadataSchema = z.object({
  // File attributes
  file_path: z.string(),
  file_name: z.string(),
  file_type: FileTypeSchema,
  mime_type: z.string(),
  file_size: z.number(),
  created_at: z.string(),   // ISO 8601
  modified_at: z.string(),  // ISO 8601
  hash: z.string(),         // SHA-256
  parent_folder: z.string(),

  // Optional file attributes (from format metadata or AI inference)
  author: z.string().optional(),
  location: GeoPointSchema.optional(),
  device: z.string().optional(),

  // Content semantics (extracted by Agent + LLM)
  summary: z.string(),
  tags: TagsSchema,
  spatiotemporal: z.array(SpatiotemporalEntrySchema),
  faces: z.array(FaceEntrySchema).optional(), // images only

  // Processing metadata
  extracted_at: z.string(),       // ISO 8601
  extractor_version: z.string(),
  agent_used: z.enum(['TextDocAgent', 'ImageAgent']),
  model_used: z.string(),
  extraction_errors: z.array(z.string()),
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;

// ─── Supported file extensions ────────────────────────────────────────────────

export const TEXT_DOC_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.docx', '.doc']);
export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.webp']);

export function detectFileType(ext: string): FileType | null {
  const lower = ext.toLowerCase();
  if (TEXT_DOC_EXTENSIONS.has(lower)) return 'text_doc';
  if (IMAGE_EXTENSIONS.has(lower)) return 'image';
  return null;
}
