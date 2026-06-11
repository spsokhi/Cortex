use serde::{Deserialize, Serialize};

// ─── Chat models ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: MessageRole,
    pub content: String,
    pub status: MessageStatus,
    pub model_id: Option<String>,
    pub token_count: Option<u32>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageStatus {
    Pending,
    Streaming,
    Complete,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub model_id: String,
    pub system_prompt: Option<String>,
    pub messages: Vec<Message>,
    pub tags: Vec<String>,
    pub pinned: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

// ─── Model info ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub size: u64,
    pub parameter_size: String,
    pub quantization: Option<String>,
    pub capabilities: Vec<String>,
    pub context_length: u32,
    pub status: String,
    pub download_progress: Option<f32>,
    pub modified_at: Option<i64>,
    pub digest: Option<String>,
}

// ─── File models ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexedFile {
    pub id: String,
    pub name: String,
    pub path: String,
    pub file_type: String,
    pub size: u64,
    pub mime_type: Option<String>,
    pub index_status: String,
    pub chunk_count: Option<u32>,
    pub error: Option<String>,
    pub summary: Option<String>,
    pub tags: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub indexed_at: Option<i64>,
}

// ─── System models ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub gpu_usage: Option<f32>,
    pub vram_used: Option<u64>,
    pub vram_total: Option<u64>,
    pub ollama_running: bool,
    pub active_model: Option<String>,
    pub tokens_throughput: Option<f32>,
}

// ─── Ollama API types ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct OllamaTagsResponse {
    pub models: Vec<OllamaModelDetail>,
}

#[derive(Debug, Deserialize)]
pub struct OllamaModelDetail {
    pub name: String,
    pub modified_at: String,
    pub size: u64,
    pub digest: String,
    pub details: OllamaModelDetails,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct OllamaModelDetails {
    pub format: Option<String>,
    pub family: Option<String>,
    pub families: Option<Vec<String>>,
    pub parameter_size: String,
    pub quantization_level: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OllamaChatRequest {
    pub model: String,
    pub messages: Vec<OllamaChatMessage>,
    pub stream: bool,
    pub options: OllamaOptions,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct OllamaOptions {
    pub temperature: f32,
    pub num_ctx: u32,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct OllamaChatResponse {
    pub message: Option<OllamaChatMessage>,
    pub done: bool,
    pub prompt_eval_count: Option<u32>,
    pub eval_count: Option<u32>,
}

// ─── Stream events ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
#[allow(dead_code)]
pub enum StreamEvent {
    Token { content: String },
    Done { token_count: u32 },
    Error { message: String },
}

// ─── App settings ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub general: GeneralSettings,
    pub appearance: AppearanceSettings,
    pub models: ModelSettings,
    pub rag: RagSettings,
    pub voice: VoiceSettings,
    pub privacy: PrivacySettings,
    pub advanced: AdvancedSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralSettings {
    pub language: String,
    pub start_minimized: bool,
    pub close_to_tray: bool,
    pub auto_update_check: bool,
    pub data_directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceSettings {
    pub theme: String,
    pub font_size: String,
    pub compact_mode: bool,
    pub show_timestamps: bool,
    pub show_token_count: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSettings {
    pub default_model: String,
    pub ollama_endpoint: String,
    pub request_timeout: u32,
    pub default_temperature: f32,
    pub default_context_length: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagSettings {
    pub enabled: bool,
    pub embedding_model: String,
    pub chunk_size: u32,
    pub chunk_overlap: u32,
    pub top_k: u32,
    pub min_score: f32,
    pub index_on_upload: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceSettings {
    pub enabled: bool,
    pub whisper_model: String,
    pub language: String,
    pub wake_word_enabled: bool,
    pub tts_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySettings {
    pub telemetry_enabled: bool,
    pub crash_reporting_enabled: bool,
    pub encrypt_storage: bool,
    pub clear_history_on_exit: bool,
    pub history_retention_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancedSettings {
    pub debug_mode: bool,
    pub log_level: String,
    pub embedding_service_port: u16,
    pub whisper_service_port: u16,
    pub rag_service_port: u16,
}
