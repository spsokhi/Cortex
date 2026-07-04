import { beforeEach, describe, expect, it } from "vitest";
import { executeTool, parseInlineToolCalls, TOOL_DEFINITIONS } from "./tools";
import { useNotesStore } from "@/stores/notesStore";
import { useFileStore } from "@/stores/fileStore";

describe("executeTool", () => {
  beforeEach(() => {
    useNotesStore.setState({
      notes: [
        { id: "n1", title: "Shopping list", content: "milk, eggs", createdAt: 0, updatedAt: 0 },
        { id: "n2", title: "Project ideas", content: "build a robot", createdAt: 0, updatedAt: 0 },
      ],
    });
    useFileStore.setState({ files: [] });
  });

  it("lists note titles", async () => {
    const out = await executeTool("list_notes", {});
    expect(out).toContain("Shopping list");
    expect(out).toContain("Project ideas");
  });

  it("reads a note by exact or partial title, case-insensitively", async () => {
    expect(await executeTool("read_note", { title: "Shopping list" })).toContain("milk, eggs");
    expect(await executeTool("read_note", { title: "project" })).toContain("build a robot");
  });

  it("explains when a note doesn't exist", async () => {
    const out = await executeTool("read_note", { title: "nonexistent" });
    expect(out).toContain("No note found");
    expect(out).toContain("list_notes");
  });

  it("validates required arguments instead of throwing", async () => {
    expect(await executeTool("read_note", {})).toContain("Error");
    expect(await executeTool("search_documents", {})).toContain("Error");
  });

  it("reports no passages when nothing is indexed", async () => {
    const out = await executeTool("search_documents", { query: "anything" });
    expect(out).toContain("No matching passages");
  });

  it("returns the current date/time", async () => {
    const out = await executeTool("current_datetime", {});
    expect(out).toContain(String(new Date().getFullYear()));
  });

  it("rejects unknown tools gracefully", async () => {
    expect(await executeTool("format_disk", {})).toContain('unknown tool "format_disk"');
  });

  it("has a matching executor for every advertised tool", async () => {
    for (const def of TOOL_DEFINITIONS) {
      const out = await executeTool(def.function.name, { query: "x", title: "Shopping list" });
      expect(out).not.toContain("unknown tool");
    }
  });
});

describe("parseInlineToolCalls", () => {
  it("parses a bare JSON tool call", () => {
    const calls = parseInlineToolCalls('{"name": "read_note", "arguments": {"title": "x"}}');
    expect(calls).toHaveLength(1);
    expect(calls[0].function.name).toBe("read_note");
    expect(calls[0].function.arguments).toEqual({ title: "x" });
  });

  it("parses fenced and tagged variants", () => {
    expect(
      parseInlineToolCalls('```json\n{"name": "list_notes", "arguments": {}}\n```'),
    ).toHaveLength(1);
    expect(
      parseInlineToolCalls('<tool_call>\n{"name": "current_datetime"}\n</tool_call>'),
    ).toHaveLength(1);
  });

  it("rejects prose, embedded JSON, and unknown tool names", () => {
    expect(parseInlineToolCalls("The note says: milk and eggs.")).toHaveLength(0);
    expect(
      parseInlineToolCalls('Here you go: {"name": "read_note", "arguments": {}}'),
    ).toHaveLength(0);
    expect(parseInlineToolCalls('{"name": "delete_everything", "arguments": {}}')).toHaveLength(0);
    expect(parseInlineToolCalls('{"name": "config", "arguments": {"a": 1}}')).toHaveLength(0);
  });
});
