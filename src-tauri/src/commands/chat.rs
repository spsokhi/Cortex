use tauri::{AppHandle, Emitter, State};
use tokio::sync::broadcast;

use crate::models::{Conversation, OllamaChatMessage, StreamEvent};
use crate::services::{storage, AppState};
use crate::services::storage::open_connection;

#[tauri::command]
pub async fn list_conversations(app: AppHandle) -> Result<Vec<Conversation>, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    storage::list_conversations(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_conversation(app: AppHandle, id: String) -> Result<Option<Conversation>, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    storage::get_conversation(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_conversation(app: AppHandle, conversation: Conversation) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    storage::save_conversation(&conn, &conversation).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_conversation(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    storage::delete_conversation(&conn, &id).map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub conversation_id: String,
    pub message: String,
    pub model_id: String,
    pub system_prompt: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[tauri::command]
pub async fn start_chat_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    request: ChatRequest,
    channel: String,
) -> Result<(), String> {
    let (tx, _rx) = broadcast::channel::<StreamEvent>(256);
    let app_clone = app.clone();
    let channel_clone = channel.clone();
    let tx_clone = tx.clone();

    // Subscribe to broadcast events and emit to Tauri frontend
    let mut rx = tx.subscribe();
    tauri::async_runtime::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let _ = app_clone.emit(&channel_clone, &event);
            if matches!(event, StreamEvent::Done { .. } | StreamEvent::Error { .. }) {
                break;
            }
        }
    });

    // Get Ollama endpoint from settings (default fallback)
    let endpoint = "http://localhost:11434".to_string();

    let messages = {
        if let Some(sys) = &request.system_prompt {
            vec![
                OllamaChatMessage { role: "system".to_string(), content: sys.clone() },
                OllamaChatMessage { role: "user".to_string(), content: request.message },
            ]
        } else {
            vec![OllamaChatMessage { role: "user".to_string(), content: request.message }]
        }
    };

    let ollama = state.ollama.clone();
    let model_id = request.model_id;
    let temperature = request.temperature.unwrap_or(0.7);
    let num_ctx = 4096u32;

    let handle = tokio::spawn(async move {
        if let Err(e) = ollama
            .chat_stream(&endpoint, &model_id, messages, temperature, num_ctx, tx_clone)
            .await
        {
            log::error!("Stream error: {e}");
        }
    });

    // Store abort handle so cancel_stream can stop it
    state
        .active_streams
        .lock()
        .await
        .insert(request.conversation_id, handle.abort_handle());

    Ok(())
}

#[tauri::command]
pub async fn cancel_stream(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<(), String> {
    if let Some(handle) = state
        .active_streams
        .lock()
        .await
        .remove(&conversation_id)
    {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn generate_title(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<String, String> {
    // In production, this would call Ollama with the first few messages
    // For now, return a placeholder
    let _ = conversation_id;
    Ok("New conversation".to_string())
}
