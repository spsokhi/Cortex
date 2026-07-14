import { describe, it, expect, beforeEach } from "vitest";
import {
  buildBackup,
  serializeBackup,
  parseBackup,
  previewImport,
  applyBackup,
  BACKUP_VERSION,
  type CortexBackup,
} from "./backup";
import { useChatStore } from "@/stores/chatStore";
import { useNotesStore, type Note } from "@/stores/notesStore";
import { useFileStore } from "@/stores/fileStore";
import { usePersonaStore } from "@/stores/personaStore";
import { usePromptStore } from "@/stores/promptStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { DEFAULT_SETTINGS } from "@/types/system";
import type { Conversation, ConversationSummary } from "@/types/chat";
import type { IndexedFile } from "@/types/files";
import type { Persona } from "@/data/personas";

function summary(id: string, title = `Chat ${id}`): ConversationSummary {
  return { id, title, modelId: "m", pinned: false, tags: [], messageCount: 0, createdAt: 1, updatedAt: 1 };
}

function conversation(id: string, title = `Chat ${id}`): Conversation {
  return { id, title, modelId: "m", messages: [], tags: [], pinned: false, createdAt: 1, updatedAt: 1 };
}

function note(id: string, title = `Note ${id}`): Note {
  return { id, title, content: "body", createdAt: 1, updatedAt: 1 };
}

function file(id: string): IndexedFile {
  return { id, name: `${id}.md`, path: `${id}.md`, type: "md", size: 1, indexStatus: "indexed", tags: [], createdAt: 1, updatedAt: 1 };
}

function persona(id: string): Persona {
  return { id, name: `P ${id}`, emoji: "🤖", tagline: "t", systemPrompt: "s" };
}

beforeEach(() => {
  useChatStore.setState({ conversations: [], savedConversations: {} });
  useNotesStore.setState({ notes: [] });
  useFileStore.setState({ files: [], collections: [] });
  usePersonaStore.setState({ customPersonas: [] });
  usePromptStore.setState({ prompts: [] });
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
});

describe("backup round-trip", () => {
  it("serializes and parses back everything the stores held", () => {
    useChatStore.setState({
      conversations: [summary("c1")],
      savedConversations: { c1: conversation("c1") },
    });
    useNotesStore.setState({ notes: [note("n1")] });
    usePersonaStore.setState({ customPersonas: [persona("custom-x")] });

    const parsed = parseBackup(serializeBackup());
    expect(parsed.backupVersion).toBe(BACKUP_VERSION);
    expect(parsed.data.chat?.conversations).toHaveLength(1);
    expect(parsed.data.chat?.savedConversations.c1.title).toBe("Chat c1");
    expect(parsed.data.notes?.notes[0].id).toBe("n1");
    expect(parsed.data.personas?.customPersonas[0].id).toBe("custom-x");
    expect(parsed.data.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("parseBackup validation", () => {
  it("rejects non-JSON", () => {
    expect(() => parseBackup("not json {")).toThrow(/valid JSON/);
  });

  it("rejects JSON that is not a Cortex backup", () => {
    expect(() => parseBackup(JSON.stringify({ hello: "world" }))).toThrow(/not a Cortex backup/);
  });

  it("rejects backups from a newer app version", () => {
    const backup = { app: "cortex", backupVersion: BACKUP_VERSION + 1, exportedAt: 1, data: {} };
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/newer version/);
  });

  it("rejects structurally damaged sections", () => {
    const backup = {
      app: "cortex",
      backupVersion: BACKUP_VERSION,
      exportedAt: 1,
      data: { notes: { notes: "not-an-array" } },
    };
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/damaged/);
  });
});

describe("applyBackup merge semantics", () => {
  const backup: CortexBackup = {
    app: "cortex",
    backupVersion: BACKUP_VERSION,
    exportedAt: 1,
    data: {
      chat: {
        conversations: [summary("c1", "Imported title"), summary("c2")],
        savedConversations: { c1: conversation("c1", "Imported title"), c2: conversation("c2") },
      },
      notes: { notes: [note("n1")] },
      files: { files: [file("f1")], collections: [] },
      personas: { customPersonas: [persona("custom-x")] },
      prompts: { prompts: [{ id: "p1", name: "p", content: "c", createdAt: 1 }] },
    },
  };

  it("restores everything onto a fresh install", () => {
    const counts = applyBackup(backup);
    expect(counts).toMatchObject({ conversations: 2, notes: 1, files: 1, personas: 1, prompts: 1 });
    expect(useChatStore.getState().conversations).toHaveLength(2);
    expect(useChatStore.getState().savedConversations.c2.id).toBe("c2");
    expect(useNotesStore.getState().notes).toHaveLength(1);
    expect(useFileStore.getState().files).toHaveLength(1);
    expect(usePersonaStore.getState().customPersonas).toHaveLength(1);
    expect(usePromptStore.getState().prompts).toHaveLength(1);
  });

  it("never overwrites existing items with the same id", () => {
    useChatStore.setState({
      conversations: [summary("c1", "Local title")],
      savedConversations: { c1: conversation("c1", "Local title") },
    });

    const counts = applyBackup(backup);
    expect(counts.conversations).toBe(1); // only c2 is new
    const chats = useChatStore.getState();
    expect(chats.conversations).toHaveLength(2);
    expect(chats.conversations.find((c) => c.id === "c1")?.title).toBe("Local title");
    expect(chats.savedConversations.c1.title).toBe("Local title");
  });

  it("previewImport counts without mutating", () => {
    useNotesStore.setState({ notes: [note("n1")] });
    const counts = previewImport(backup);
    expect(counts.notes).toBe(0);
    expect(counts.conversations).toBe(2);
    expect(useChatStore.getState().conversations).toHaveLength(0); // untouched
  });

  it("deep-merges settings over current ones", () => {
    const withSettings: CortexBackup = {
      ...backup,
      data: {
        settings: {
          ...DEFAULT_SETTINGS,
          appearance: { ...DEFAULT_SETTINGS.appearance, theme: "light", accent: "rose" },
        },
      },
    };
    applyBackup(withSettings);
    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.theme).toBe("light");
    expect(settings.appearance.accent).toBe("rose");
    expect(settings.models.defaultContextLength).toBe(DEFAULT_SETTINGS.models.defaultContextLength);
  });

  it("handles a backup with only some sections", () => {
    const partial: CortexBackup = {
      app: "cortex",
      backupVersion: BACKUP_VERSION,
      exportedAt: 1,
      data: { notes: { notes: [note("solo")] } },
    };
    const counts = applyBackup(partial);
    expect(counts).toMatchObject({ conversations: 0, notes: 1, files: 0, personas: 0, prompts: 0, hasSettings: false });
    expect(useNotesStore.getState().notes[0].id).toBe("solo");
  });
});

describe("buildBackup shape", () => {
  it("marks the file as a cortex backup with the current version", () => {
    const backup = buildBackup();
    expect(backup.app).toBe("cortex");
    expect(backup.backupVersion).toBe(BACKUP_VERSION);
    expect(typeof backup.exportedAt).toBe("number");
  });
});
