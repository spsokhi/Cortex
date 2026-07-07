import { describe, expect, it } from "vitest";
import { splitThinking, stripThinking, formatThinkingDuration } from "./thinking";

describe("splitThinking", () => {
  it("passes plain content through untouched", () => {
    const result = splitThinking("Hello! How can I help?");
    expect(result).toEqual({
      thinking: null,
      answer: "Hello! How can I help?",
      thinkingOpen: false,
    });
  });

  it("splits a closed think block from the answer", () => {
    const result = splitThinking("<think>The user greeted me.</think>\n\nHello!");
    expect(result.thinking).toBe("The user greeted me.");
    expect(result.answer).toBe("Hello!");
    expect(result.thinkingOpen).toBe(false);
  });

  it("tolerates leading whitespace before the tag", () => {
    const result = splitThinking("\n  <think>reasoning</think>answer");
    expect(result.thinking).toBe("reasoning");
    expect(result.answer).toBe("answer");
  });

  it("reports an unclosed block as still thinking", () => {
    const result = splitThinking("<think>Let me work through this");
    expect(result.thinking).toBe("Let me work through this");
    expect(result.answer).toBe("");
    expect(result.thinkingOpen).toBe(true);
  });

  it("treats a partial opening tag mid-stream as thinking, not answer text", () => {
    for (const partial of ["<", "<t", "<thin"]) {
      const result = splitThinking(partial);
      expect(result.thinkingOpen).toBe(true);
      expect(result.answer).toBe("");
    }
  });

  it("returns null thinking for an empty think block", () => {
    const result = splitThinking("<think>\n\n</think>Hi there");
    expect(result.thinking).toBeNull();
    expect(result.answer).toBe("Hi there");
  });

  it("ignores think tags that are not at the start", () => {
    const content = "Models emit <think>…</think> tags around reasoning.";
    const result = splitThinking(content);
    expect(result.thinking).toBeNull();
    expect(result.answer).toBe(content);
  });

  it("handles empty content", () => {
    expect(splitThinking("")).toEqual({ thinking: null, answer: "", thinkingOpen: false });
  });
});

describe("stripThinking", () => {
  it("removes the think block", () => {
    expect(stripThinking("<think>hmm</think>Answer.")).toBe("Answer.");
  });

  it("leaves ordinary content alone", () => {
    expect(stripThinking("Just an answer.")).toBe("Just an answer.");
  });

  it("returns empty string for a message aborted mid-thought", () => {
    expect(stripThinking("<think>never finished")).toBe("");
  });
});

describe("formatThinkingDuration", () => {
  it("formats seconds", () => {
    expect(formatThinkingDuration(12.3)).toBe("12s");
  });

  it("rounds sub-second up to 1s", () => {
    expect(formatThinkingDuration(0.4)).toBe("1s");
  });

  it("formats minutes and seconds", () => {
    expect(formatThinkingDuration(75)).toBe("1m 15s");
  });
});
