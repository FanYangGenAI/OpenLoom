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

    /// Directory names to skip (repeatable, e.g. -i node_modules -i vendor)
    #[arg(short = 'i', long = "ignore", value_name = "NAME")]
    ignores: Vec<String>,

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
        extra_ignores: cli.ignores,
        show_progress: cli.progress,
        summary_only: cli.summary_only,
    };

    run_scan(config);
}
