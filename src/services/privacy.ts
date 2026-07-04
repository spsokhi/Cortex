/**
 * Privacy policy enforcement for chat history.
 *
 * Both policies run at startup, once the chat store has hydrated from disk:
 * - "clear history on exit" is implemented as wipe-on-next-launch — teardown
 *   hooks are unreliable (crashes and force-kills skip them), while startup
 *   enforcement guarantees history from a previous session never survives.
 * - retention pruning deletes conversations older than the configured number
 *   of days; pinned conversations are always kept. It is gated behind
 *   retentionEnabled (default off) so an upgrade can never silently delete
 *   chats — settings persisted by older versions lack the flag.
 */
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Conversation } from "@/types/chat";

export function clearChatHistory(): void {
  useChatStore.setState({
    conversations: [],
    savedConversations: {},
    activeConversationId: null,
    activeConversation: null,
  });
}

/** The policy work itself — exported for tests; the app calls applyHistoryRetention(). */
export function runHistoryRetention(now = Date.now()): void {
  const { clearHistoryOnExit, retentionEnabled, historyRetentionDays } =
    useSettingsStore.getState().settings.privacy;

  if (clearHistoryOnExit) {
    clearChatHistory();
    return;
  }

  if (!retentionEnabled || !historyRetentionDays || historyRetentionDays <= 0) return;

  const cutoff = now - historyRetentionDays * 86_400_000;
  const { conversations, savedConversations } = useChatStore.getState();
  const keep = conversations.filter((c) => c.pinned || c.updatedAt >= cutoff);
  if (keep.length === conversations.length) return;

  const keptSaved: Record<string, Conversation> = {};
  for (const c of keep) {
    const full = savedConversations[c.id];
    if (full) keptSaved[c.id] = full;
  }
  useChatStore.setState({ conversations: keep, savedConversations: keptSaved });
}

/** Enforce privacy policies once chat history has been read from disk. */
export function applyHistoryRetention(): void {
  if (useChatStore.persist.hasHydrated()) {
    runHistoryRetention();
  } else {
    const unsubscribe = useChatStore.persist.onFinishHydration(() => {
      unsubscribe();
      runHistoryRetention();
    });
  }
}
