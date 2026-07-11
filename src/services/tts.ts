/**
 * Read-aloud via the browser's SpeechSynthesis API — on Windows this uses
 * the local system (SAPI) voices, so nothing leaves the device. Only one
 * message plays at a time; the currently speaking message id lives in
 * uiStore so any component can render play/stop state.
 */
import { useUIStore } from "@/stores/uiStore";

/** Markdown reads terribly aloud — flatten it to plain sentences first. */
function toSpeechText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ". Code block omitted. ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__|~~)/g, "")
    .replace(/(^|\s)[*_](\S[^*_]*\S)[*_](?=\s|$|[.,!?])/g, "$1$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Start reading a message, or stop if it's the one currently playing. */
export function toggleReadAloud(messageId: string, markdown: string): void {
  if (!isTtsSupported()) return;
  const wasSpeaking = useUIStore.getState().speakingMessageId === messageId;

  window.speechSynthesis.cancel();
  useUIStore.getState().setSpeakingMessage(null);
  if (wasSpeaking) return;

  const text = toSpeechText(markdown);
  if (!text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  const clear = () => {
    if (useUIStore.getState().speakingMessageId === messageId) {
      useUIStore.getState().setSpeakingMessage(null);
    }
  };
  utterance.onend = clear;
  utterance.onerror = clear;

  useUIStore.getState().setSpeakingMessage(messageId);
  window.speechSynthesis.speak(utterance);
}

/** Stop any in-progress read-aloud. Safe to call unconditionally. */
export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
  useUIStore.getState().setSpeakingMessage(null);
}
