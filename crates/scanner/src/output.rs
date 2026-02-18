use std::io::{self, BufWriter, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Instant;

use crate::types::{FileEntry, ScanSummary};

pub struct NdjsonWriter {
    writer: BufWriter<io::Stdout>,
}

impl NdjsonWriter {
    pub fn new() -> Self {
        Self {
            writer: BufWriter::with_capacity(64 * 1024, io::stdout()),
        }
    }

    pub fn write_entry(&mut self, entry: &FileEntry) -> io::Result<()> {
        serde_json::to_writer(&mut self.writer, entry)?;
        self.writer.write_all(b"\n")?;
        Ok(())
    }

    pub fn write_summary(&mut self, summary: &ScanSummary) -> io::Result<()> {
        serde_json::to_writer(&mut self.writer, summary)?;
        self.writer.write_all(b"\n")?;
        self.writer.flush()?;
        Ok(())
    }

    pub fn flush(&mut self) -> io::Result<()> {
        self.writer.flush()
    }
}

pub struct ProgressReporter {
    enabled: bool,
    start: Instant,
    files: AtomicU64,
    dirs: AtomicU64,
    size: AtomicU64,
    errors: AtomicU64,
    done: AtomicBool,
}

impl ProgressReporter {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled,
            start: Instant::now(),
            files: AtomicU64::new(0),
            dirs: AtomicU64::new(0),
            size: AtomicU64::new(0),
            errors: AtomicU64::new(0),
            done: AtomicBool::new(false),
        }
    }

    pub fn record_file(&self, size: u64) {
        self.files.fetch_add(1, Ordering::Relaxed);
        self.size.fetch_add(size, Ordering::Relaxed);
    }

    pub fn record_dir(&self) {
        self.dirs.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_error(&self) {
        self.errors.fetch_add(1, Ordering::Relaxed);
    }

    pub fn mark_done(&self) {
        self.done.store(true, Ordering::Relaxed);
    }

    pub fn run_progress_loop(&self) {
        if !self.enabled {
            return;
        }

        loop {
            std::thread::sleep(std::time::Duration::from_millis(500));

            let files = self.files.load(Ordering::Relaxed);
            let dirs = self.dirs.load(Ordering::Relaxed);
            let size = self.size.load(Ordering::Relaxed);
            let errors = self.errors.load(Ordering::Relaxed);
            let elapsed = self.start.elapsed().as_secs_f64();
            let is_done = self.done.load(Ordering::Relaxed);

            let label = if is_done { "done" } else { "scanning" };
            let size_str = format_size(size);

            let mut msg = format!(
                "\r[{label}] {files} files | {size_str} | {dirs} dirs | {elapsed:.1}s",
            );
            if errors > 0 {
                msg.push_str(&format!(" | {errors} errors"));
            }

            eprint!("{msg}\x1b[K");

            if is_done {
                eprintln!();
                break;
            }
        }
    }
}

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = 1024 * KB;
    const GB: u64 = 1024 * MB;
    const TB: u64 = 1024 * GB;

    if bytes >= TB {
        format!("{:.1} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{bytes} B")
    }
}
