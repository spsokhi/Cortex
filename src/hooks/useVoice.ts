import { useCallback, useRef, useState } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";

type RecordingState = "idle" | "recording";

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

export function useVoice() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTextRef = useRef("");
  const { toast } = useUIStore();

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      toast("error", "Voice not supported", "Use Chrome or Edge for voice input.");
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

  const stopRecording = useCallback((): string => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecordingState("idle");
    setInterimText("");
    return finalTextRef.current.trim();
  }, []);

  return {
    recordingState,
    interimText,
    startRecording,
    stopRecording,
  };
}
