use std::collections::HashSet;

pub struct IgnoreRules {
    dir_names: HashSet<String>,
}

const DEFAULT_IGNORE_DIRS: &[&str] = &[
    ".git",
    ".svn",
    ".hg",
    "node_modules",
    ".pnpm-store",
    ".venv",
    "venv",
    "__pycache__",
    ".tox",
    ".Trash",
    ".Trashes",
    "$RECYCLE.BIN",
    "System Volume Information",
    ".Spotlight-V100",
    ".fseventsd",
    ".TemporaryItems",
    ".VolumeIcon.icns",
    "DerivedData",
    ".gradle",
    ".idea",
    ".vs",
    "target", // Rust build output
];

impl IgnoreRules {
    pub fn new(extra_ignores: &[String], skip_hidden: bool) -> Self {
        let mut dir_names: HashSet<String> = DEFAULT_IGNORE_DIRS
            .iter()
            .map(|s| s.to_string())
            .collect();

        for name in extra_ignores {
            dir_names.insert(name.clone());
        }

        if skip_hidden {
            // Hidden dirs are handled in should_skip_dir via the dot-prefix check,
            // not by adding them to the set. This flag is checked in should_skip_dir.
        }
        let _ = skip_hidden; // stored implicitly in the caller

        Self { dir_names }
    }

    pub fn should_skip_dir(&self, name: &str, skip_hidden: bool) -> bool {
        if self.dir_names.contains(name) {
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
        // Skip well-known junk files
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
    fn test_default_ignores() {
        let rules = IgnoreRules::new(&[], false);
        assert!(rules.should_skip_dir(".git", false));
        assert!(rules.should_skip_dir("node_modules", false));
        assert!(!rules.should_skip_dir("Documents", false));
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
}
