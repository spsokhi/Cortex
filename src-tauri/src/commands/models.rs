use tauri::{Emitter, State};
use crate::models::ModelInfo;
use crate::services::AppState;

#[tauri::command]
pub async fn list_models(state: State<'_, AppState>) -> Result<Vec<ModelInfo>, String> {
    let endpoint = "http://localhost:11434";

    if !state.ollama.is_running(endpoint).await {
        return Ok(vec![]);
    }

    state
        .ollama
        .list_models(endpoint)
        .await
        .map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct DownloadModelRequest {
    pub model_name: String,
    pub insecure: Option<bool>,
}

#[tauri::command]
pub async fn download_model(
    app: tauri::AppHandle,
    request: DownloadModelRequest,
    channel: String,
) -> Result<(), String> {
    // In production, stream progress from Ollama pull API
    // For now, emit a single "complete" event
    let _ = app.emit(&channel, serde_json::json!({
        "status": "pulling manifest",
        "percent": 0
    }));

    // TODO: implement actual Ollama pull streaming
    log::info!("Download requested for model: {}", request.model_name);
    Ok(())
}

#[tauri::command]
pub async fn delete_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    state
        .ollama
        .delete_model("http://localhost:11434", &model_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_ollama_status(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let endpoint = "http://localhost:11434";
    let running = state.ollama.is_running(endpoint).await;
    let version = if running {
        state.ollama.get_version(endpoint).await
    } else {
        None
    };

    Ok(serde_json::json!({ "running": running, "version": version }))
}
