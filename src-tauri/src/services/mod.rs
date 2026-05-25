pub mod ollama;
pub mod storage;
pub mod indexer;

use std::sync::Arc;
use tokio::sync::Mutex;

/// Shared application state managed by Tauri
#[derive(Default)]
pub struct AppState {
    pub active_streams: Arc<Mutex<std::collections::HashMap<String, tokio::task::AbortHandle>>>,
    pub ollama: Arc<ollama::OllamaService>,
    pub system: Arc<Mutex<sysinfo::System>>,
}
