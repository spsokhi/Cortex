/**
 * Context-window management for chat requests.
 *
 * Ollama silently truncates prompts that exceed num_ctx from the top —
 * which eats the system prompt (persona, RAG context) first. Instead we
 * trim the oldest conversation messages ourselves so the system prompt and
 * the newest exchange always survive, and tell the model something was cut.
 *
 * Token counts use the standard ~4 chars/token heuristic; exact tokenizer
 * counts aren't worth a dependency for a safety margin.
 */

import { stripThinking } from "@/services/thinking";
import type { Message } from "@/types/chat";

export interface ChatMessagePayload {
  role: string;
  content: string;
}

const CHARS_PER_TOKEN = 4;
const PER_MESSAGE_OVERHEAD_TOKENS = 4; // chat-template wrapping per message
const RESPONSE_RESERVE_FRACTION = 0.25; // leave room for the reply…
const MAX_RESPONSE_RESERVE_TOKENS = 1024; // …but never more than this

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function messageCost(message: ChatMessagePayload): number {
  return estimateTokens(message.content) + PER_MESSAGE_OVERHEAD_TOKENS;
}

/**
 * Completed messages as request payloads. Assistant <think> blocks are
 * stripped — feeding chain-of-thought back into reasoning models degrades
 * them (and wastes context) — and messages left empty by that (e.g. aborted
 * mid-thought) are dropped.
 */
export function toHistoryPayloads(messages: Message[]): ChatMessagePayload[] {
  return messages
    .filter((m) => m.status === "complete")
    .map((m) => ({
      role: m.role,
      content: m.role === "assistant" ? stripThinking(m.content) : m.content,
    }))
    .filter((m) => m.content.trim().length > 0);
}

export interface ContextUsage {
  /** Estimated prompt tokens currently in play (system prompt + history) */
  usedTokens: number;
  /** Prompt budget once the response reserve is set aside */
  budgetTokens: number;
  /** usedTokens / budgetTokens — at 1 or above, the oldest messages get dropped */
  fraction: number;
}

/** Mirror of buildChatMessages' budget math, for showing usage in the UI. */
export function estimateContextUsage(options: {
  systemContent: string;
  history: ChatMessagePayload[];
  numCtx: number;
}): ContextUsage {
  const { systemContent, history, numCtx } = options;
  const reserve = Math.min(
    MAX_RESPONSE_RESERVE_TOKENS,
    Math.floor(numCtx * RESPONSE_RESERVE_FRACTION),
  );
  const budgetTokens = Math.max(1, numCtx - reserve);
  let usedTokens = systemContent
    ? estimateTokens(systemContent) + PER_MESSAGE_OVERHEAD_TOKENS
    : 0;
  for (const message of history) usedTokens += messageCost(message);
  return { usedTokens, budgetTokens, fraction: usedTokens / budgetTokens };
}

export interface BuildChatMessagesOptions {
  /** System prompt (persona + RAG context), empty string for none */
  systemContent: string;
  /** Prior completed messages, oldest first. For a new send this excludes the new user message. */
  history: ChatMessagePayload[];
  /** The new user message for a send; omit for regenerate (history already ends with the user turn) */
  newUserContent?: string;
  /** The model's context window (num_ctx) */
  numCtx: number;
}

export interface BuildChatMessagesResult {
  messages: ChatMessagePayload[];
  /** How many history messages were dropped to fit the window */
  droppedCount: number;
}

export function buildChatMessages(options: BuildChatMessagesOptions): BuildChatMessagesResult {
  const { systemContent, history, newUserContent, numCtx } = options;

  const full: ChatMessagePayload[] = [
    ...history,
    ...(newUserContent != null ? [{ role: "user", content: newUserContent }] : []),
  ];

  let budget =
    numCtx -
    Math.min(MAX_RESPONSE_RESERVE_TOKENS, Math.floor(numCtx * RESPONSE_RESERVE_FRACTION));
  if (systemContent) budget -= estimateTokens(systemContent) + PER_MESSAGE_OVERHEAD_TOKENS;

  // Keep newest messages while they fit; the final message is always kept
  // (a request without the latest user turn is useless). Stop at the first
  // message that doesn't fit so the kept history stays contiguous.
  const kept: ChatMessagePayload[] = [];
  for (let i = full.length - 1; i >= 0; i--) {
    const cost = messageCost(full[i]);
    if (kept.length > 0 && cost > budget) break;
    kept.push(full[i]);
    budget -= cost;
  }
  kept.reverse();

  // After a trim, don't lead with a dangling assistant reply to a dropped question
  if (kept.length < full.length) {
    while (kept.length > 1 && kept[0].role === "assistant") kept.shift();
  }

  const droppedCount = full.length - kept.length;

  let system = systemContent;
  if (droppedCount > 0) {
    const note = `[Note: the earliest ${droppedCount} message${droppedCount !== 1 ? "s" : ""} of this conversation were omitted because they exceed the context window.]`;
    system = system ? `${system}\n\n${note}` : note;
  }

  return {
    messages: [...(system ? [{ role: "system", content: system }] : []), ...kept],
    droppedCount,
  };
}
