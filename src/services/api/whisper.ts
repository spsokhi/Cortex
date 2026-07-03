/**
 * Client for the local Whisper transcription microservice
 * (services/whisper — FastAPI on localhost, port from Settings → Advanced).
 * Audio never leaves the machine.
 */
import { useSettingsStore } from "@/stores/settingsStore";

interface TranscriptionResponse {
  text: string;
  language: string;
  duration: number;
}

function baseUrl(): string {
  const port = useSettingsStore.getState().settings.advanced.whisperServicePort;
  return `http://127.0.0.1:${port}`;
}

export async function isWhisperRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Transcribe a recorded audio blob. `language` is an ISO code; omit or pass "auto" to auto-detect. */
export async function transcribeAudio(audio: Blob, language?: string): Promise<string> {
  const form = new FormData();
  form.append("audio", audio, "recording.webm");
  if (language && language !== "auto") form.append("language", language);

  const res = await fetch(`${baseUrl()}/transcribe`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Whisper service error ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as TranscriptionResponse;
  return data.text.trim();
}
