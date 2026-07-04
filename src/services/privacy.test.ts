import { beforeEach, describe, expect, it } from "vitest";
import { runHistoryRetention, clearChatHistory } from "./privacy";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { DEFAULT_SETTINGS } from "@/types/system";
import type { Conversation, ConversationSummary } from "@/types/chat";

const DAY = 86_400_000;
const NOW = 1_000 * DAY;

function seed(id: string, updatedAt: number, pinned = false) {
  const summary: ConversationSummary = {
    id,
    title: id,
    modelId: "m",
    pinned,
    tags: [],
    messageCount: 1,
    createdAt: updatedAt,
    updatedAt,
  };
  const full: Conversation = {
    id,
    title: id,
    modelId: "m",
    messages: [],
    tags: [],
    pinned,
    createdAt: updatedAt,
    updatedAt,
  };
  return { summary, full };
}

function seedStore() {
  const fresh = seed("fresh", NOW - 5 * DAY);
  const stale = seed("stale", NOW - 400 * DAY);
  const pinnedStale = seed("pinned-stale", NOW - 400 * DAY, true);
  useChatStore.setState({
    conversations: [fresh.summary, stale.summary, pinnedStale.summary],
    savedConversations: {
      fresh: fresh.full,
      stale: stale.full,
      "pinned-stale": pinnedStale.full,
    },
    activeConversationId: null,
    activeConversation: null,
  });
}

function setPrivacy(privacy: Partial<(typeof DEFAULT_SETTINGS)["privacy"]>) {
  useSettingsStore.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      privacy: { ...DEFAULT_SETTINGS.privacy, ...privacy },
    },
  });
}

describe("runHistoryRetention", () => {
  beforeEach(seedStore);

  it("does nothing with default settings (retention off)", () => {
    setPrivacy({});
    runHistoryRetention(NOW);
    expect(useChatStore.getState().conversations).toHaveLength(3);
  });

  it("does nothing when retention is enabled but nothing is stale", () => {
    setPrivacy({ retentionEnabled: true, historyRetentionDays: 500 });
    runHistoryRetention(NOW);
    expect(useChatStore.getState().conversations).toHaveLength(3);
  });

  it("prunes stale conversations but keeps pinned ones, including saved bodies", () => {
    setPrivacy({ retentionEnabled: true, historyRetentionDays: 90 });
    runHistoryRetention(NOW);

    const { conversations, savedConversations } = useChatStore.getState();
    expect(conversations.map((c) => c.id).sort()).toEqual(["fresh", "pinned-stale"]);
    expect(Object.keys(savedConversations).sort()).toEqual(["fresh", "pinned-stale"]);
  });

  it("wipes everything when clear-on-exit is set, regardless of retention", () => {
    setPrivacy({ clearHistoryOnExit: true, retentionEnabled: true, historyRetentionDays: 9999 });
    runHistoryRetention(NOW);

    const { conversations, savedConversations } = useChatStore.getState();
    expect(conversations).toHaveLength(0);
    expect(savedConversations).toEqual({});
  });
});

describe("clearChatHistory", () => {
  it("empties conversations and the active selection", () => {
    seedStore();
    useChatStore.setState({ activeConversationId: "fresh" });
    clearChatHistory();

    const state = useChatStore.getState();
    expect(state.conversations).toHaveLength(0);
    expect(state.savedConversations).toEqual({});
    expect(state.activeConversationId).toBeNull();
  });
});
