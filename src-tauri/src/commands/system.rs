use tauri::State;
use sysinfo::System;

use crate::models::{AppSettings, SystemStats};
use crate::services::AppState;

#[tauri::command]
pub async fn get_system_stats(state: State<'_, AppState>) -> Result<SystemStats, String> {
    let mut sys = state.system.lock().await;
    sys.refresh_all();

    let cpu_usage = sys.global_cpu_info().cpu_usage();
    let memory_used = sys.used_memory();
    let memory_total = sys.total_memory();

    // Check Ollama status
    let ollama_running = state.ollama.is_running("http://localhost:11434").await;

    Ok(SystemStats {
        cpu_usage,
        memory_used,
        memory_total,
        gpu_usage: None,
        vram_used: None,
        vram_total: None,
        ollama_running,
        active_model: None,
        tokens_throughput: None,
    })
}

#[tauri::command]
pub async fn get_settings(_app: tauri::AppHandle) -> Result<AppSettings, String> {
    // In production, load from tauri-plugin-store
    Ok(default_settings())
}

#[tauri::command]
pub async fn save_settings(
    _app: tauri::AppHandle,
    settings: AppSettings,
) -> Result<(), String> {
    // In production, persist to tauri-plugin-store
    let _ = settings;
    Ok(())
}

#[tauri::command]
pub async fn open_file_dialog(
    app: tauri::AppHandle,
    options: serde_json::Value,
) -> Result<Option<Vec<String>>, String> {
    use tauri_plugin_dialog::DialogExt;

    let multiple = options
        .get("multiple")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if multiple {
        let paths = app.dialog().file().blocking_pick_files();
        Ok(paths.map(|ps| {
            ps.into_iter()
                .filter_map(|p| p.into_path().ok())
                .map(|p| p.to_string_lossy().into_owned())
                .collect()
        }))
    } else {
        let path = app.dialog().file().blocking_pick_file();
        Ok(path.and_then(|p| p.into_path().ok()).map(|p| {
            vec![p.to_string_lossy().into_owned()]
        }))
    }
}

#[tauri::command]
pub async fn open_directory_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app.dialog().file().blocking_pick_folder();
    Ok(path.and_then(|p| p.into_path().ok()).map(|p| {
        p.to_string_lossy().into_owned()
    }))
}

#[tauri::command]
pub async fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg("/select,")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(
            std::path::Path::new(&path)
                .parent()
                .unwrap_or(std::path::Path::new("/")),
        )
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn default_settings() -> AppSettings {
    AppSettings {
        general: crate::models::GeneralSettings {
            language: "en".into(),
            start_minimized: false,
            close_to_tray: true,
            auto_update_check: false,
            data_directory: String::new(),
        },
        appearance: crate::models::AppearanceSettings {
            theme: "dark".into(),
            font_size: "md".into(),
            compact_mode: false,
            show_timestamps: true,
            show_token_count: false,
        },
        models: crate::models::ModelSettings {
            default_model: "llama3:8b".into(),
            ollama_endpoint: "http://localhost:11434".into(),
            request_timeout: 120,
            default_temperature: 0.7,
            default_context_length: 4096,
        },
        rag: crate::models::RagSettings {
            enabled: true,
            embedding_model: "nomic-embed-text".into(),
            chunk_size: 512,
            chunk_overlap: 64,
            top_k: 5,
            min_score: 0.4,
            index_on_upload: true,
        },
        voice: crate::models::VoiceSettings {
            enabled: false,
            whisper_model: "base".into(),
            language: "en".into(),
            wake_word_enabled: false,
            tts_enabled: false,
        },
        privacy: crate::models::PrivacySettings {
            telemetry_enabled: false,
            crash_reporting_enabled: false,
            encrypt_storage: false,
            clear_history_on_exit: false,
            history_retention_days: 90,
        },
        advanced: crate::models::AdvancedSettings {
            debug_mode: false,
            log_level: "warn".into(),
            embedding_service_port: 8001,
            whisper_service_port: 8002,
            rag_service_port: 8003,
        },
    }
}
