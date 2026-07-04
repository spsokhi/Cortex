import { beforeEach, describe, expect, it } from "vitest";
import { searchEverything, makeSnippet } from "./search";
import { useChatStore } from "@/stores/chatStore";
import { useNotesStore } from "@/stores/notesStore";
import { useFileStore } from "@/stores/fileStore";
import type { Conversation, ConversationSummary } from "@/types/chat";

function conversation(id: string, title: string, contents: string[], updatedAt: number) {
  const summary: ConversationSummary = {
    id,
    title,
    modelId: "m",
    pinned: false,
    tags: [],
    messageCount: contents.length,
    createdAt: updatedAt,
    updatedAt,
  };
  const full: Conversation = {
    id,
    title,
    modelId: "m",
    messages: contents.map((content, i) => ({
      id: `${id}-${i}`,
      conversationId: id,
      role: i % 2 === 0 ? "user" : "assistant",
      content,
      status: "complete",
      createdAt: updatedAt,
      updatedAt,
    })),
    tags: [],
    pinned: false,
    createdAt: updatedAt,
    updatedAt,
  };
  return { summary, full };
}

describe("searchEverything", () => {
  beforeEach(() => {
    const a = conversation("c1", "Rust borrow checker help", ["how do lifetimes work?"], 100);
    const b = conversation("c2", "Dinner ideas", ["what pairs well with salmon and rice?"], 200);
    useChatStore.setState({
      conversations: [a.summary, b.summary],
      savedConversations: { c1: a.full, c2: b.full },
    });
    useNotesStore.setState({
      notes: [
        {
          id: "n1",
          title: "Groceries",
          content: "salmon, rice vinegar, eggs",
          createdAt: 0,
          updatedAt: 300,
        },
      ],
    });
    useFileStore.setState({
      files: [],
    });
  });

  it("finds matches in conversation titles and bodies", () => {
    const results = searchEverything("salmon");
    const types = results.map((r) => `${r.type}:${r.id}`);
    expect(types).toContain("conversation:c2");
    expect(types).toContain("note:n1");
    expect(types).not.toContain("conversation:c1");
  });

  it("includes a body snippet only when the title didn't match", () => {
    const [conv] = searchEverything("borrow");
    expect(conv.titleMatch).toBe(true);
    expect(conv.snippet).toBeUndefined();

    const results = searchEverything("lifetimes");
    const c1 = results.find((r) => r.id === "c1");
    expect(c1?.titleMatch).toBe(false);
    expect(c1?.snippet).toContain("lifetimes");
  });

  it("ANDs multiple words together", () => {
    expect(searchEverything("salmon rice").map((r) => r.id).sort()).toEqual(["c2", "n1"]);
    expect(searchEverything("salmon lifetimes")).toHaveLength(0);
  });

  it("ranks title matches above body matches", () => {
    useNotesStore.setState({
      notes: [
        { id: "n-body", title: "Misc", content: "mentions rust once", createdAt: 0, updatedAt: 900 },
        { id: "n-title", title: "Rust notes", content: "…", createdAt: 0, updatedAt: 100 },
      ],
    });
    const notes = searchEverything("rust").filter((r) => r.type === "note");
    expect(notes.map((r) => r.id)).toEqual(["n-title", "n-body"]);
  });

  it("returns nothing for a blank query", () => {
    expect(searchEverything("   ")).toHaveLength(0);
  });
});

describe("makeSnippet", () => {
  it("centers the excerpt on the match and collapses whitespace", () => {
    const text = `${"x".repeat(200)}  target\n\nword ${"y".repeat(200)}`;
    const snippet = makeSnippet(text, "target");
    expect(snippet).toContain("target word");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet.length).toBeLessThan(120);
  });
});
