import { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { isWhisperRunning, transcribeAudio } from "@/services/api/whisper";

type RecordingState = "idle" | "recording" | "transcribing";

// Map the short language codes used in Settings to the BCP-47 tags
// that the Web Speech API expects. "auto" leaves it unset so the
// browser falls back to its own default locale.
const SPEECH_LANG: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  zh: "zh-CN",
  ja: "ja-JP",
};

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
}
interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    __TAURI_INTERNALS__?: unknown;
  }
}

/**
 * Voice input. Default engine records locally with MediaRecorder and
 * transcribes via the local Whisper service — audio never leaves the device.
 * The "browser" engine (Web Speech API, cloud-based) is an explicit opt-in
 * in Settings → Voice.
 */
export function useVoice() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [interimText, setInterimText] = useState("");

  // Whisper engine
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Browser engine
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTextRef = useRef("");

  const { toast } = useUIStore();

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => releaseStream, [releaseStream]);

  const startBrowserRecording = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      toast("error", "Voice not supported", "Web Speech is unavailable — switch to Local Whisper in Settings → Voice.");
      return;
    }

    finalTextRef.current = "";
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    const langSetting = useSettingsStore.getState().settings.voice.language;
    recognition.lang = SPEECH_LANG[langSetting] ?? (langSetting === "auto" ? "" : "en-US");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTextRef.current += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(finalTextRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        toast("error", "Voice error", event.error);
      }
      setRecordingState("idle");
      setInterimText("");
    };

    recognition.onend = () => {
      setRecordingState("idle");
      setInterimText("");
    };

    recognition.start();
    recognitionRef.current = recognition;
    setRecordingState("recording");
  }, [toast]);

  const startWhisperRecording = useCallback(async () => {
    if (!(await isWhisperRunning())) {
      toast(
        "error",
        "Whisper service not running",
        "Start it with `pnpm service:whisper` (see README), or switch the engine in Settings → Voice.",
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast("error", "Microphone unavailable", "Check microphone permissions for Cortex.");
      return;
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();

    streamRef.current = stream;
    mediaRecorderRef.current = recorder;
    setRecordingState("recording");
  }, [toast]);

  const startRecording = useCallback(async () => {
    const engine = useSettingsStore.getState().settings.voice.engine ?? "whisper";
    if (engine === "browser") startBrowserRecording();
    else await startWhisperRecording();
  }, [startBrowserRecording, startWhisperRecording]);

  const stopRecording = useCallback(async (): Promise<string> => {
    // Browser engine: transcript was accumulated live
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setRecordingState("idle");
      setInterimText("");
      return finalTextRef.current.trim();
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setRecordingState("idle");
      return "";
    }

    const audio = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });
    releaseStream();

    if (audio.size === 0) {
      setRecordingState("idle");
      return "";
    }

    setRecordingState("transcribing");
    try {
      const language = useSettingsStore.getState().settings.voice.language;
      return await transcribeAudio(audio, language);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast("error", "Transcription failed", msg);
      return "";
    } finally {
      setRecordingState("idle");
    }
  }, [releaseStream, toast]);

  return {
    recordingState,
    interimText,
    startRecording,
    stopRecording,
  };
}
