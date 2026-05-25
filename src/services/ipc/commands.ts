/**
 * Tauri IPC command wrappers.
 * All communication with the Rust backend goes through this module.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Conversation, ChatRequest, StreamEvent } from "@/types/chat";
import type { ModelInfo, ModelDownloadRequest } from "@/types/models";
import type { IndexedFile, FileUploadRequest } from "@/types/files";
import type { SystemStats, AppSettings } from "@/types/system";

// ─── Chat commands ─────────────────────────────────────────────────────────

export async function getConversation(id: string): Promise<Conversation> {
  return invoke<Conversation>("get_conversation", { id });
}

export async function getConversations(): Promise<Conversation[]> {
  return invoke<Conversation[]>("list_conversations");
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  return invoke("save_conversation", { conversation });
}

export async function deleteConversation(id: string): Promise<void> {
  return invoke("delete_conversation", { id });
}

export async function generateTitle(conversationId: string): Promise<string> {
  return invoke<string>("generate_title", { conversationId });
}

/**
 * Start a streaming chat request. Returns an unlistener function.
 * Events are emitted on the "chat-stream-{conversationId}" channel.
 */
export async function startChatStream(
  request: ChatRequest,
  onEvent: (event: StreamEvent) => void,
): Promise<UnlistenFn> {
  const channel = `chat-stream-${request.conversationId}`;

  const unlisten = await listen<StreamEvent>(channel, (event) => {
    onEvent(event.payload);
  });

  // Fire-and-forget — the Rust side emits events asynchronously
  invoke("start_chat_stream", { request, channel }).catch((err: unknown) => {
    onEvent({ type: "error", message: String(err) });
  });

  return unlisten;
}

export async function cancelStream(conversationId: string): Promise<void> {
  return invoke("cancel_stream", { conversationId });
}

// ─── Model commands ─────────────────────────────────────────────────────────

export async function listModels(): Promise<ModelInfo[]> {
  return invoke<ModelInfo[]>("list_models");
}

export async function downloadModel(
  request: ModelDownloadRequest,
  onProgress: (progress: { status: string; percent?: number }) => void,
): Promise<UnlistenFn> {
  const channel = `model-download-${request.modelName}`;

  const unlisten = await listen<{ status: string; percent?: number }>(channel, (e) => {
    onProgress(e.payload);
  });

  invoke("download_model", { request, channel }).catch(console.error);

  return unlisten;
}

export async function deleteModel(modelId: string): Promise<void> {
  return invoke("delete_model", { modelId });
}

export async function getOllamaStatus(): Promise<{ running: boolean; version?: string }> {
  return invoke("get_ollama_status");
}

// ─── File commands ──────────────────────────────────────────────────────────

export async function listFiles(): Promise<IndexedFile[]> {
  return invoke<IndexedFile[]>("list_files");
}

export async function uploadFile(request: FileUploadRequest): Promise<IndexedFile> {
  return invoke<IndexedFile>("upload_file", { request });
}

export async function uploadFiles(paths: string[]): Promise<IndexedFile[]> {
  return invoke<IndexedFile[]>("upload_files", { paths });
}

export async function deleteFile(id: string): Promise<void> {
  return invoke("delete_file", { id });
}

export async function reindexFile(id: string): Promise<void> {
  return invoke("reindex_file", { id });
}

export async function searchFiles(
  query: string,
  topK?: number,
): Promise<Array<{ fileId: string; chunk: string; score: number }>> {
  return invoke("search_files", { query, topK: topK ?? 5 });
}

// ─── System commands ────────────────────────────────────────────────────────

export async function getSystemStats(): Promise<SystemStats> {
  return invoke<SystemStats>("get_system_stats");
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function openFileDialog(
  options: { multiple?: boolean; filters?: Array<{ name: string; extensions: string[] }> } = {},
): Promise<string[] | null> {
  return invoke<string[] | null>("open_file_dialog", { options });
}

export async function openDirectoryDialog(): Promise<string | null> {
  return invoke<string | null>("open_directory_dialog");
}

export async function revealInExplorer(path: string): Promise<void> {
  return invoke("reveal_in_explorer", { path });
}

// ─── Voice commands ─────────────────────────────────────────────────────────

export async function startRecording(): Promise<void> {
  return invoke("start_recording");
}

export async function stopRecordingAndTranscribe(): Promise<string> {
  return invoke<string>("stop_recording_and_transcribe");
}

export async function transcribeFile(path: string): Promise<string> {
  return invoke<string>("transcribe_file", { path });
}
