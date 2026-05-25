mod commands;
mod models;
mod services;

use tauri::Manager;

pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("warn")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(services::AppState::default())
        .invoke_handler(tauri::generate_handler![
            // Chat
            commands::chat::list_conversations,
            commands::chat::get_conversation,
            commands::chat::save_conversation,
            commands::chat::delete_conversation,
            commands::chat::start_chat_stream,
            commands::chat::cancel_stream,
            commands::chat::generate_title,
            // Models
            commands::models::list_models,
            commands::models::download_model,
            commands::models::delete_model,
            commands::models::get_ollama_status,
            // Files
            commands::files::list_files,
            commands::files::upload_file,
            commands::files::upload_files,
            commands::files::delete_file,
            commands::files::reindex_file,
            commands::files::search_files,
            // System
            commands::system::get_system_stats,
            commands::system::get_settings,
            commands::system::save_settings,
            commands::system::open_file_dialog,
            commands::system::open_directory_dialog,
            commands::system::reveal_in_explorer,
            // Voice
            commands::voice::start_recording,
            commands::voice::stop_recording_and_transcribe,
            commands::voice::transcribe_file,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Initialize database on startup
            tauri::async_runtime::spawn(async move {
                if let Err(e) = services::storage::initialize_db(&app_handle).await {
                    log::error!("Database initialization failed: {e}");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Cortex");
}
