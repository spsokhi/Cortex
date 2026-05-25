use std::path::Path;
use tauri::AppHandle;
use uuid::Uuid;

use crate::models::IndexedFile;
use crate::services::{indexer, storage};
use crate::services::storage::open_connection;

#[tauri::command]
pub async fn list_files(app: AppHandle) -> Result<Vec<IndexedFile>, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    storage::list_files(&conn).map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileUploadRequest {
    pub path: String,
    pub collection_id: Option<String>,
}

#[tauri::command]
pub async fn upload_file(
    app: AppHandle,
    request: FileUploadRequest,
) -> Result<IndexedFile, String> {
    upload_single_file(&app, &request.path).await
}

#[tauri::command]
pub async fn upload_files(
    app: AppHandle,
    paths: Vec<String>,
) -> Result<Vec<IndexedFile>, String> {
    let mut results = Vec::new();
    for path in paths {
        match upload_single_file(&app, &path).await {
            Ok(f) => results.push(f),
            Err(e) => log::warn!("Failed to upload {path}: {e}"),
        }
    }
    Ok(results)
}

async fn upload_single_file(app: &AppHandle, path_str: &str) -> Result<IndexedFile, String> {
    let path = Path::new(path_str);

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "unknown".to_string());

    let metadata = tokio::fs::metadata(path)
        .await
        .map_err(|e| format!("Cannot read file: {e}"))?;

    let file_type = indexer::detect_file_type(path).to_string();
    let mime_type = mime_guess::from_path(path)
        .first()
        .map(|m| m.to_string());

    let now = chrono::Utc::now().timestamp_millis();
    let id = Uuid::new_v4().to_string();

    let file = IndexedFile {
        id: id.clone(),
        name,
        path: path_str.to_string(),
        file_type,
        size: metadata.len(),
        mime_type,
        index_status: "pending".to_string(),
        chunk_count: None,
        error: None,
        summary: None,
        tags: vec![],
        created_at: now,
        updated_at: now,
        indexed_at: None,
    };

    // Persist the file record
    let conn = open_connection(app).map_err(|e| e.to_string())?;
    storage::save_file(&conn, &file).map_err(|e| e.to_string())?;

    // Kick off background indexing if the file is text-extractable
    if indexer::is_indexable(&file.file_type) {
        let app_clone = app.clone();
        let file_clone = file.clone();
        tauri::async_runtime::spawn(async move {
            index_file_background(app_clone, file_clone).await;
        });
    }

    Ok(file)
}

async fn index_file_background(app: AppHandle, mut file: IndexedFile) {
    file.index_status = "indexing".to_string();
    file.updated_at = chrono::Utc::now().timestamp_millis();

    if let Ok(conn) = open_connection(&app) {
        let _ = storage::save_file(&conn, &file);
    }

    let path = Path::new(&file.path);
    match indexer::extract_text_file(path).await {
        Ok(text) => {
            let chunks = indexer::chunk_text(&text, 512, 64);
            file.chunk_count = Some(chunks.len() as u32);
            file.index_status = "indexed".to_string();
            file.indexed_at = Some(chrono::Utc::now().timestamp_millis());

            // TODO: Send chunks to Python embeddings service for vector storage
            log::info!(
                "Indexed {} — {} chunks",
                file.name,
                chunks.len()
            );
        }
        Err(e) => {
            file.index_status = "error".to_string();
            file.error = Some(e.to_string());
            log::warn!("Failed to index {}: {e}", file.name);
        }
    }

    file.updated_at = chrono::Utc::now().timestamp_millis();
    if let Ok(conn) = open_connection(&app) {
        let _ = storage::save_file(&conn, &file);
    }
}

#[tauri::command]
pub async fn delete_file(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    storage::delete_file(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reindex_file(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;

    if let Ok(Some(file)) = storage::list_files(&conn).map(|files| {
        files.into_iter().find(|f| f.id == id)
    }) {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            index_file_background(app_clone, file).await;
        });
    }

    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub file_id: String,
    pub chunk: String,
    pub score: f32,
}

#[tauri::command]
pub async fn search_files(
    _app: AppHandle,
    query: String,
    top_k: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    // In production, this calls the Python RAG service for semantic search
    // For now, return empty results as a placeholder
    let _top_k = top_k.unwrap_or(5);
    log::info!("Semantic search: {query}");
    Ok(vec![])
}
