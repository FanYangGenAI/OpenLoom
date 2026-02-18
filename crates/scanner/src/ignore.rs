use std::collections::HashSet;

pub struct IgnoreRules {
    always_skip: HashSet<String>,
    system_skip: HashSet<String>,
    skip_system: bool,
}

/// Directories that are never useful — VCS, OS metadata, trash
const ALWAYS_IGNORE_DIRS: &[&str] = &[
    // Version control
    ".git",
    ".svn",
    ".hg",
    // OS metadata & trash
    ".Trash",
    ".Trashes",
    "$RECYCLE.BIN",
    "System Volume Information",
    ".Spotlight-V100",
    ".fseventsd",
    ".TemporaryItems",
    ".VolumeIcon.icns",
    ".DocumentRevisions-V100",
    ".PKInstallSandboxManager-SystemSoftware",
];

/// System, application, and developer directories — skipped by default.
/// These contain app caches, runtimes, build artifacts, etc.
/// Use --include-system to scan them.
const SYSTEM_DIRS: &[&str] = &[
    // macOS system
    "Library",
    "Applications",
    ".vol",
    // Windows system
    "AppData",
    "ProgramData",
    "Windows",
    "Program Files",
    "Program Files (x86)",
    // Linux system
    "snap",
    // Package managers & language runtimes
    "node_modules",
    ".pnpm-store",
    ".npm",
    ".yarn",
    ".bun",
    ".cargo",
    ".rustup",
    "go",
    ".go",
    ".conda",
    ".pyenv",
    ".rbenv",
    ".nvm",
    ".volta",
    ".sdkman",
    ".venv",
    "venv",
    "__pycache__",
    ".tox",
    ".m2",
    ".cocoapods",
    ".pub-cache",
    ".nuget",
    ".gem",
    ".cpan",
    ".docker",
    ".colima",
    ".orbstack",
    // Build & output directories
    "target",
    "build",
    "dist",
    "out",
    ".output",
    ".next",
    ".nuxt",
    "Pods",
    "DerivedData",
    ".gradle",
    ".build",
    // IDE & editor directories
    ".idea",
    ".vs",
    ".vscode",
    ".eclipse",
    // Cache & config (rarely contain user content)
    ".cache",
    ".local",
    ".config",
    ".dbus",
    ".fontconfig",
    // Cloud storage metadata (not the actual synced files)
    ".dropbox",
    ".dropbox.cache",
    // Misc
    ".Trash-1000",
    "lost+found",
];

impl IgnoreRules {
    pub fn new(extra_ignores: &[String], skip_system: bool) -> Self {
        let always_skip: HashSet<String> = ALWAYS_IGNORE_DIRS
            .iter()
            .map(|s| s.to_string())
            .chain(extra_ignores.iter().cloned())
            .collect();

        let system_skip: HashSet<String> =
            SYSTEM_DIRS.iter().map(|s| s.to_string()).collect();

        Self {
            always_skip,
            system_skip,
            skip_system,
        }
    }

    pub fn should_skip_dir(&self, name: &str, skip_hidden: bool) -> bool {
        if self.always_skip.contains(name) {
            return true;
        }
        if self.skip_system && self.system_skip.contains(name) {
            return true;
        }
        if skip_hidden && name.starts_with('.') && name != "." && name != ".." {
            return true;
        }
        false
    }

    pub fn should_skip_file(&self, name: &str, skip_hidden: bool) -> bool {
        if skip_hidden && name.starts_with('.') && name != "." && name != ".." {
            return true;
        }
        matches!(
            name,
            ".DS_Store" | "Thumbs.db" | "desktop.ini" | ".directory"
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_always_ignores() {
        let rules = IgnoreRules::new(&[], false);
        assert!(rules.should_skip_dir(".git", false));
        assert!(rules.should_skip_dir(".Trash", false));
    }

    #[test]
    fn test_system_dirs_skipped_by_default() {
        let rules = IgnoreRules::new(&[], true);
        assert!(rules.should_skip_dir("Library", false));
        assert!(rules.should_skip_dir("node_modules", false));
        assert!(rules.should_skip_dir(".cache", false));
        assert!(rules.should_skip_dir("AppData", false));
        assert!(!rules.should_skip_dir("Documents", false));
        assert!(!rules.should_skip_dir("Pictures", false));
    }

    #[test]
    fn test_system_dirs_included_when_disabled() {
        let rules = IgnoreRules::new(&[], false);
        assert!(!rules.should_skip_dir("Library", false));
        assert!(!rules.should_skip_dir("node_modules", false));
        assert!(!rules.should_skip_dir(".cache", false));
    }

    #[test]
    fn test_extra_ignores() {
        let rules = IgnoreRules::new(&["my_custom_dir".to_string()], false);
        assert!(rules.should_skip_dir("my_custom_dir", false));
    }

    #[test]
    fn test_hidden_skip() {
        let rules = IgnoreRules::new(&[], false);
        assert!(rules.should_skip_dir(".hidden", true));
        assert!(!rules.should_skip_dir(".hidden", false));
        assert!(rules.should_skip_file(".hidden_file", true));
        assert!(!rules.should_skip_file(".hidden_file", false));
    }

    #[test]
    fn test_junk_files() {
        let rules = IgnoreRules::new(&[], false);
        assert!(rules.should_skip_file(".DS_Store", false));
        assert!(rules.should_skip_file("Thumbs.db", false));
        assert!(!rules.should_skip_file("photo.jpg", false));
    }

    #[test]
    fn test_user_dirs_never_skipped() {
        let rules = IgnoreRules::new(&[], true);
        let user_dirs = ["Documents", "Desktop", "Pictures", "Music", "Movies", "Downloads"];
        for dir in &user_dirs {
            assert!(!rules.should_skip_dir(dir, false), "{dir} should not be skipped");
        }
    }
}
