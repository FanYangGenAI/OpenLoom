use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FileType {
    Image,
    Document,
    Video,
    Audio,
    Archive,
    Other,
}

impl FileType {
    /// Returns true for file types that represent personal user content
    /// (photos, documents, videos, music) — the types OpenLoom cares about.
    pub fn is_personal(&self) -> bool {
        matches!(self, FileType::Image | FileType::Document | FileType::Video | FileType::Audio)
    }
}

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub ext: String,
    pub size: u64,
    pub mtime_ms: i64,
    pub btime_ms: Option<i64>,
    pub file_type: FileType,
}

#[derive(Debug, Serialize)]
pub struct ScanSummary {
    #[serde(rename = "type")]
    pub record_type: String,
    pub total_files: u64,
    pub total_dirs: u64,
    pub total_size: u64,
    pub by_type: HashMap<String, u64>,
    pub date_range: DateRange,
    pub errors: u64,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct DateRange {
    pub earliest_ms: Option<i64>,
    pub latest_ms: Option<i64>,
}

pub struct ScanStats {
    pub total_files: u64,
    pub total_dirs: u64,
    pub total_size: u64,
    pub by_type: HashMap<FileType, u64>,
    pub earliest_ms: Option<i64>,
    pub latest_ms: Option<i64>,
    pub errors: u64,
}

impl ScanStats {
    pub fn new() -> Self {
        Self {
            total_files: 0,
            total_dirs: 0,
            total_size: 0,
            by_type: HashMap::new(),
            earliest_ms: None,
            latest_ms: None,
            errors: 0,
        }
    }

    pub fn record_file(&mut self, entry: &FileEntry) {
        self.total_files += 1;
        self.total_size += entry.size;
        *self.by_type.entry(entry.file_type).or_insert(0) += 1;

        let mtime = entry.mtime_ms;
        self.earliest_ms = Some(match self.earliest_ms {
            Some(current) => current.min(mtime),
            None => mtime,
        });
        self.latest_ms = Some(match self.latest_ms {
            Some(current) => current.max(mtime),
            None => mtime,
        });
    }

    pub fn record_dir(&mut self) {
        self.total_dirs += 1;
    }

    pub fn record_error(&mut self) {
        self.errors += 1;
    }

    pub fn into_summary(self, duration_ms: u64) -> ScanSummary {
        let by_type = self
            .by_type
            .into_iter()
            .map(|(k, v)| {
                let key = serde_json::to_value(k)
                    .ok()
                    .and_then(|v| v.as_str().map(String::from))
                    .unwrap_or_else(|| format!("{:?}", k));
                (key, v)
            })
            .collect();

        ScanSummary {
            record_type: "summary".to_string(),
            total_files: self.total_files,
            total_dirs: self.total_dirs,
            total_size: self.total_size,
            by_type,
            date_range: DateRange {
                earliest_ms: self.earliest_ms,
                latest_ms: self.latest_ms,
            },
            errors: self.errors,
            duration_ms,
        }
    }
}
