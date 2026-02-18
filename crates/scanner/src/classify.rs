use crate::types::FileType;

pub fn classify_extension(ext: &str) -> FileType {
    match ext {
        // Image
        ".jpg" | ".jpeg" | ".png" | ".gif" | ".webp" | ".heic" | ".heif" | ".raw" | ".cr2"
        | ".cr3" | ".nef" | ".arw" | ".dng" | ".orf" | ".rw2" | ".sr2" | ".raf" | ".pef"
        | ".svg" | ".bmp" | ".tiff" | ".tif" | ".ico" | ".avif" | ".jxl" => FileType::Image,

        // Document
        ".pdf" | ".doc" | ".docx" | ".txt" | ".md" | ".markdown" | ".rtf" | ".odt" | ".xls"
        | ".xlsx" | ".csv" | ".tsv" | ".ppt" | ".pptx" | ".odp" | ".ods" | ".pages"
        | ".numbers" | ".key" | ".epub" | ".mobi" | ".tex" | ".latex" | ".json" | ".xml"
        | ".yaml" | ".yml" | ".toml" | ".ini" | ".cfg" | ".conf" | ".log" | ".htm"
        | ".html" => FileType::Document,

        // Video
        ".mp4" | ".mov" | ".avi" | ".mkv" | ".wmv" | ".flv" | ".webm" | ".m4v" | ".mpg"
        | ".mpeg" | ".3gp" | ".3g2" | ".mts" | ".m2ts" | ".vob" => FileType::Video,

        // Audio
        ".mp3" | ".wav" | ".flac" | ".aac" | ".ogg" | ".opus" | ".m4a" | ".wma" | ".aiff"
        | ".aif" | ".ape" | ".alac" | ".mid" | ".midi" => FileType::Audio,

        // Archive
        ".zip" | ".tar" | ".gz" | ".tgz" | ".bz2" | ".xz" | ".7z" | ".rar" | ".zst"
        | ".lz4" | ".lzma" | ".cab" | ".dmg" | ".iso" | ".img" | ".pkg" | ".deb" | ".rpm"
        | ".msi" | ".jar" | ".war" => FileType::Archive,

        _ => FileType::Other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_image_types() {
        assert_eq!(classify_extension(".jpg"), FileType::Image);
        assert_eq!(classify_extension(".png"), FileType::Image);
        assert_eq!(classify_extension(".heic"), FileType::Image);
        assert_eq!(classify_extension(".cr2"), FileType::Image);
    }

    #[test]
    fn test_document_types() {
        assert_eq!(classify_extension(".pdf"), FileType::Document);
        assert_eq!(classify_extension(".docx"), FileType::Document);
        assert_eq!(classify_extension(".csv"), FileType::Document);
    }

    #[test]
    fn test_video_types() {
        assert_eq!(classify_extension(".mp4"), FileType::Video);
        assert_eq!(classify_extension(".mov"), FileType::Video);
    }

    #[test]
    fn test_audio_types() {
        assert_eq!(classify_extension(".mp3"), FileType::Audio);
        assert_eq!(classify_extension(".flac"), FileType::Audio);
    }

    #[test]
    fn test_archive_types() {
        assert_eq!(classify_extension(".zip"), FileType::Archive);
        assert_eq!(classify_extension(".tar"), FileType::Archive);
    }

    #[test]
    fn test_unknown_defaults_to_other() {
        assert_eq!(classify_extension(".xyz"), FileType::Other);
        assert_eq!(classify_extension(".foo"), FileType::Other);
        assert_eq!(classify_extension(""), FileType::Other);
    }
}
