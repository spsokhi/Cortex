use tauri::AppHandle;

#[tauri::command]
pub async fn start_recording(_app: AppHandle) -> Result<(), String> {
    // In production, this starts the audio capture via the Python whisper service
    // or a native audio library
    log::info!("Recording started");
    Ok(())
}

#[tauri::command]
pub async fn stop_recording_and_transcribe(_app: AppHandle) -> Result<String, String> {
    // In production, stop recording, send audio to Whisper service, return transcript
    log::info!("Recording stopped, transcribing…");

    // TODO: Implement via HTTP call to Python Whisper microservice at localhost:8002
    Ok("Voice transcription is available when the Whisper service is running.".to_string())
}

#[tauri::command]
pub async fn transcribe_file(_app: AppHandle, path: String) -> Result<String, String> {
    // TODO: Send file to Python Whisper microservice
    log::info!("Transcribing file: {path}");
    Ok("Transcription requires the Whisper service to be running.".to_string())
}
