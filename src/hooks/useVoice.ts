import { useCallback, useRef, useState } from "react";
import { useUIStore } from "@/stores/uiStore";

type RecordingState = "idle" | "recording" | "processing";

export function useVoice() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useUIStore();

  const startRecording = useCallback(async () => {
    if (recordingState !== "idle") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect in 100ms chunks
      setRecordingState("recording");
      setTranscript("");
    } catch (err) {
      toast("error", "Microphone access denied", "Please allow microphone access.");
    }
  }, [recordingState, toast]);

  const stopRecording = useCallback(async (): Promise<string> => {
    if (recordingState !== "recording" || !mediaRecorderRef.current) return "";

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current!;

      recorder.onstop = async () => {
        setRecordingState("processing");
        try {
          new Blob(chunksRef.current, { type: "audio/webm" });

          // In Tauri env, send to whisper service
          if (typeof window.__TAURI_INTERNALS__ !== "undefined") {
            const { stopRecordingAndTranscribe } = await import("@/services/ipc/commands");
            const text = await stopRecordingAndTranscribe();
            setTranscript(text);
            resolve(text);
          } else {
            // Browser dev fallback
            const text = "[Voice transcription requires the desktop app]";
            setTranscript(text);
            resolve(text);
          }
        } catch (err) {
          toast("error", "Transcription failed");
          resolve("");
        } finally {
          setRecordingState("idle");
          // Stop all tracks
          recorder.stream.getTracks().forEach((t) => t.stop());
        }
      };

      recorder.stop();
    });
  }, [recordingState, toast]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    setRecordingState("idle");
    setTranscript("");
  }, []);

  return {
    recordingState,
    transcript,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording: recordingState === "recording",
    isProcessing: recordingState === "processing",
  };
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}
