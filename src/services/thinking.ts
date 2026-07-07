/**
 * Reasoning-model output handling.
 *
 * DeepSeek-R1 / Qwen3-style models emit their chain of thought wrapped in
 * <think>…</think> at the start of the response, and Ollama streams those
 * tags straight into the message content. We split them out at render time:
 * the reasoning becomes a collapsible block, the answer is everything after
 * the closing tag. The raw content (tags included) stays in the store so
 * nothing is lost; the thinking is stripped only when re-sending history
 * (feeding CoT back into reasoning models degrades them), copying, or
 * building previews.
 */

export interface ThinkingSplit {
  /** Reasoning text, null when the message has none */
  thinking: string | null;
  /** The visible answer (content with the think block removed) */
  answer: string;
  /** True while a streaming message is still inside an unclosed <think> */
  thinkingOpen: boolean;
}

const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

export function splitThinking(content: string): ThinkingSplit {
  const trimmed = content.trimStart();

  // Mid-stream the opening tag may be only partially received — treat a
  // proper prefix of "<think>" as thinking already underway so the tag
  // never flashes as answer text.
  if (
    trimmed.length > 0 &&
    trimmed.length < OPEN_TAG.length &&
    OPEN_TAG.startsWith(trimmed)
  ) {
    return { thinking: "", answer: "", thinkingOpen: true };
  }

  // Only recognize the tag at the start of the message — mid-content
  // occurrences are the model talking *about* think tags, not using them.
  if (!trimmed.startsWith(OPEN_TAG)) {
    return { thinking: null, answer: content, thinkingOpen: false };
  }

  const rest = trimmed.slice(OPEN_TAG.length);
  const closeIdx = rest.indexOf(CLOSE_TAG);
  if (closeIdx === -1) {
    return { thinking: rest.trimStart(), answer: "", thinkingOpen: true };
  }

  const thinking = rest.slice(0, closeIdx).trim();
  const answer = rest.slice(closeIdx + CLOSE_TAG.length).trimStart();
  return { thinking: thinking || null, answer, thinkingOpen: false };
}

/** Answer text only — for history re-sends, copies, and previews. */
export function stripThinking(content: string): string {
  return splitThinking(content).answer;
}

/** 8 → "8s", 75 → "1m 15s"; sub-second rounds up to "1s" */
export function formatThinkingDuration(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
