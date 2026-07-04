import { describe, expect, it } from "vitest";
import { buildChatMessages, type ChatMessagePayload } from "./context";

const msg = (role: string, words: number): ChatMessagePayload => ({
  role,
  content: Array.from({ length: words }, (_, i) => `word${i}`).join(" "),
});

describe("buildChatMessages", () => {
  it("keeps everything and adds no note when the history fits", () => {
    const history = [msg("user", 10), msg("assistant", 10)];
    const { messages, droppedCount } = buildChatMessages({
      systemContent: "Be helpful.",
      history,
      newUserContent: "next question",
      numCtx: 4096,
    });

    expect(droppedCount).toBe(0);
    expect(messages[0]).toEqual({ role: "system", content: "Be helpful." });
    expect(messages.slice(1, 3)).toEqual(history);
    expect(messages.at(-1)).toEqual({ role: "user", content: "next question" });
  });

  it("omits the system message entirely when there is no system content", () => {
    const { messages } = buildChatMessages({
      systemContent: "",
      history: [msg("user", 5)],
      numCtx: 4096,
    });
    expect(messages[0].role).toBe("user");
  });

  it("drops oldest messages first when the window is too small", () => {
    // ~50 words ≈ 88 chars… make each message big enough that only a few fit
    const history = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? msg("user", 200) : msg("assistant", 200),
    );
    const { messages, droppedCount } = buildChatMessages({
      systemContent: "sys",
      history,
      newUserContent: "latest",
      numCtx: 2048,
    });

    expect(droppedCount).toBeGreaterThan(0);
    // Newest content always survives
    expect(messages.at(-1)).toEqual({ role: "user", content: "latest" });
    // Kept slice is the contiguous tail of the original history
    const kept = messages.filter((m) => m.role !== "system").slice(0, -1);
    expect(kept).toEqual(history.slice(history.length - kept.length));
    // The model is told about the omission
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("omitted");
  });

  it("always keeps the final message even if it alone exceeds the budget", () => {
    const { messages } = buildChatMessages({
      systemContent: "",
      history: [],
      newUserContent: msg("user", 5000).content,
      numCtx: 512,
    });
    expect(messages.filter((m) => m.role === "user")).toHaveLength(1);
  });

  it("does not lead the trimmed history with a dangling assistant reply", () => {
    const history = [
      msg("user", 500),
      msg("assistant", 500),
      msg("user", 500),
      msg("assistant", 500),
    ];
    const { messages, droppedCount } = buildChatMessages({
      systemContent: "",
      history,
      newUserContent: "latest",
      numCtx: 1200,
    });

    expect(droppedCount).toBeGreaterThan(0);
    const firstNonSystem = messages.find((m) => m.role !== "system");
    expect(firstNonSystem?.role).toBe("user");
  });
});
