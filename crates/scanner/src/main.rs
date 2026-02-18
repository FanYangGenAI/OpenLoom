mod classify;
mod ignore;
mod output;
mod types;
mod walker;

use std::path::Path;
use std::process;

use clap::Parser;

use walker::{run_scan, WalkerConfig};

/// High-performance parallel file system scanner for OpenLoom.
/// Outputs one NDJSON record per file to stdout, with a summary as the final line.
///
/// By default, system and application directories (Library, AppData, .cache,
/// node_modules, etc.) are skipped. Use --include-system to scan them.
#[derive(Parser, Debug)]
#[command(name = "openloom-scanner", version, about)]
struct Cli {
    /// Root directory to scan
    path: String,

    /// Number of parallel walker threads (default: CPU core count)
    #[arg(short = 't', long, default_value_t = 0)]
    threads: usize,

    /// Skip hidden files and directories (names starting with '.')
    #[arg(long)]
    no_hidden: bool,

    /// Directory names to skip (repeatable, e.g. -i vendor -i tmp)
    #[arg(short = 'i', long = "ignore", value_name = "NAME")]
    ignores: Vec<String>,

    /// Include system/application directories (Library, AppData, .cache, etc.)
    /// that are skipped by default
    #[arg(long)]
    include_system: bool,

    /// Only output personal content: images, documents, videos, and audio.
    /// Skips archives, code, binaries, and other non-personal files.
    #[arg(long)]
    personal: bool,

    /// Follow symbolic links
    #[arg(long)]
    follow_symlinks: bool,

    /// Print real-time progress to stderr
    #[arg(long)]
    progress: bool,

    /// Print only the final summary line, not individual file entries
    #[arg(long)]
    summary_only: bool,
}

fn main() {
    let cli = Cli::parse();

    let root = Path::new(&cli.path);
    if !root.exists() {
        eprintln!("Error: path does not exist: {}", cli.path);
        process::exit(1);
    }
    if !root.is_dir() {
        eprintln!("Error: path is not a directory: {}", cli.path);
        process::exit(1);
    }

    let threads = if cli.threads == 0 {
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
    } else {
        cli.threads
    };

    let config = WalkerConfig {
        root: cli.path,
        threads,
        follow_symlinks: cli.follow_symlinks,
        skip_hidden: cli.no_hidden,
        skip_system: !cli.include_system,
        personal_only: cli.personal,
        extra_ignores: cli.ignores,
        show_progress: cli.progress,
        summary_only: cli.summary_only,
    };

    run_scan(config);
}
