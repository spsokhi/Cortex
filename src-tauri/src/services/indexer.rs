use anyhow::{Context, Result};
use std::path::Path;

/// Split text into overlapping chunks for RAG indexing.
pub fn chunk_text(text: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    if text.is_empty() {
        return vec![];
    }

    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return vec![];
    }

    let mut chunks = Vec::new();
    let mut start = 0;

    while start < words.len() {
        let end = (start + chunk_size).min(words.len());
        let chunk = words[start..end].join(" ");
        chunks.push(chunk);

        if end == words.len() {
            break;
        }

        start = if end > overlap { end - overlap } else { end };
    }

    chunks
}

/// Extract text from a plain text or markdown file.
pub async fn extract_text_file(path: &Path) -> Result<String> {
    tokio::fs::read_to_string(path)
        .await
        .context("Failed to read text file")
}

/// Detect file type from extension.
pub fn detect_file_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "pdf" => "pdf",
        "txt" => "txt",
        "md" | "markdown" => "md",
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" => "image",
        "ts" | "tsx" | "js" | "jsx" | "py" | "rs" | "go" | "java"
        | "cpp" | "c" | "h" | "cs" | "rb" | "php" | "swift" | "kt"
        | "scala" | "sh" | "bash" | "toml" | "yaml" | "yml" | "json"
        | "html" | "css" | "sql" => "code",
        _ => "unknown",
    }
}

/// Check whether a file can be indexed (text-extractable).
pub fn is_indexable(file_type: &str) -> bool {
    matches!(file_type, "pdf" | "txt" | "md" | "code")
}
