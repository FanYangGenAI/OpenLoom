use std::path::Path;
use std::sync::Arc;
use std::time::Instant;

use jwalk::{Parallelism, WalkDir};

use crate::classify::classify_extension;
use crate::ignore::IgnoreRules;
use crate::output::{NdjsonWriter, ProgressReporter};
use crate::types::{FileEntry, ScanStats, ScanSummary};

pub struct WalkerConfig {
    pub root: String,
    pub threads: usize,
    pub follow_symlinks: bool,
    pub skip_hidden: bool,
    pub skip_system: bool,
    pub personal_only: bool,
    pub extra_ignores: Vec<String>,
    pub show_progress: bool,
    pub summary_only: bool,
}

pub fn run_scan(config: WalkerConfig) -> ScanSummary {
    let start = Instant::now();
    let root = Path::new(&config.root);

    let ignore_rules = Arc::new(IgnoreRules::new(&config.extra_ignores, config.skip_system));
    let skip_hidden = config.skip_hidden;

    let progress = Arc::new(ProgressReporter::new(config.show_progress));

    let progress_handle = if config.show_progress {
        let p = Arc::clone(&progress);
        Some(std::thread::spawn(move || p.run_progress_loop()))
    } else {
        None
    };

    let mut stats = ScanStats::new();
    let mut writer = NdjsonWriter::new();

    let rules = Arc::clone(&ignore_rules);
    let walk = WalkDir::new(root)
        .parallelism(Parallelism::RayonNewPool(config.threads))
        .follow_links(config.follow_symlinks)
        .sort(false)
        .process_read_dir(move |_depth, _path, _state, children| {
            children.retain(|entry_result| {
                entry_result.as_ref().map_or(true, |entry| {
                    let name = entry.file_name.to_string_lossy();
                    if entry.file_type.is_dir() {
                        !rules.should_skip_dir(&name, skip_hidden)
                    } else {
                        !rules.should_skip_file(&name, skip_hidden)
                    }
                })
            });
        });

    for entry_result in walk {
        match entry_result {
            Ok(entry) => {
                if entry.file_type().is_dir() {
                    stats.record_dir();
                    progress.record_dir();
                    continue;
                }

                if !entry.file_type().is_file() {
                    continue;
                }

                let path = entry.path();
                let metadata = match entry.metadata() {
                    Ok(m) => m,
                    Err(_) => {
                        stats.record_error();
                        progress.record_error();
                        continue;
                    }
                };

                let name = entry.file_name().to_string_lossy().to_string();
                let ext = path
                    .extension()
                    .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
                    .unwrap_or_default();

                let file_type = classify_extension(&ext);

                if config.personal_only && !file_type.is_personal() {
                    continue;
                }

                let size = metadata.len();

                let mtime_ms = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0);

                let btime_ms = metadata
                    .created()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64);

                let file_entry = FileEntry {
                    path: path.to_string_lossy().to_string(),
                    name,
                    ext,
                    size,
                    mtime_ms,
                    btime_ms,
                    file_type,
                };

                stats.record_file(&file_entry);
                progress.record_file(size);

                if !config.summary_only {
                    if let Err(e) = writer.write_entry(&file_entry) {
                        eprintln!("Write error: {e}");
                        break;
                    }
                }
            }
            Err(_) => {
                stats.record_error();
                progress.record_error();
            }
        }
    }

    let _ = writer.flush();
    let duration_ms = start.elapsed().as_millis() as u64;
    let summary = stats.into_summary(duration_ms);

    progress.mark_done();
    if let Some(handle) = progress_handle {
        let _ = handle.join();
    }

    if let Err(e) = writer.write_summary(&summary) {
        eprintln!("Failed to write summary: {e}");
    }

    summary
}
