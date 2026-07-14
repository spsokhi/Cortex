/**
 * Full local-data backup and restore.
 *
 * Exports everything the user created — chats, notes, indexed files, custom
 * personas, saved prompts, settings — as one versioned JSON file, and merges
 * it back in without ever overwriting existing data: items whose id already
 * exists are skipped, settings are deep-merged over current ones. Restoring
 * onto a fresh install therefore equals a full restore; importing into a
 * live install only adds what's missing.
 *
 * Deliberately excluded: modelStore (installed models are machine-specific),
 * statsStore (aggregates don't merge meaningfully), and UI state.
 */
import { useChatStore } from "@/stores/chatStore";
import { useNotesStore, type Note } from "@/stores/notesStore";
import { useFileStore } from "@/stores/fileStore";
import { usePersonaStore } from "@/stores/personaStore";
import { usePromptStore, type SavedPrompt } from "@/stores/promptStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Conversation, ConversationSummary } from "@/types/chat";
import type { IndexedFile, FileCollection } from "@/types/files";
import type { Persona } from "@/data/personas";
import type { AppSettings } from "@/types/system";

export const BACKUP_VERSION = 1;

export interface CortexBackup {
  app: "cortex";
  backupVersion: number;
  exportedAt: number;
  data: {
    chat?: {
      conversations: ConversationSummary[];
      savedConversations: Record<string, Conversation>;
    };
    notes?: { notes: Note[] };
    files?: { files: IndexedFile[]; collections: FileCollection[] };
    personas?: { customPersonas: Persona[] };
    prompts?: { prompts: SavedPrompt[] };
    settings?: AppSettings;
  };
}

/** Counts of items that would be (or were) added by an import. */
export interface ImportCounts {
  conversations: number;
  notes: number;
  files: number;
  personas: number;
  prompts: number;
  hasSettings: boolean;
}

/** Snapshot all persisted user data from the stores. */
export function buildBackup(): CortexBackup {
  const chat = useChatStore.getState();
  const files = useFileStore.getState();
  return {
    app: "cortex",
    backupVersion: BACKUP_VERSION,
    exportedAt: Date.now(),
    data: {
      chat: {
        conversations: chat.conversations,
        savedConversations: chat.savedConversations,
      },
      notes: { notes: useNotesStore.getState().notes },
      files: { files: files.files, collections: files.collections },
      personas: { customPersonas: usePersonaStore.getState().customPersonas },
      prompts: { prompts: usePromptStore.getState().prompts },
      settings: useSettingsStore.getState().settings,
    },
  };
}

export function serializeBackup(): string {
  return JSON.stringify(buildBackup(), null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse and validate backup JSON. Throws with a user-facing message. */
export function parseBackup(json: string): CortexBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Not a valid JSON file.");
  }
  if (!isRecord(raw) || raw.app !== "cortex" || !isRecord(raw.data)) {
    throw new Error("This file is not a Cortex backup.");
  }
  if (typeof raw.backupVersion !== "number" || raw.backupVersion > BACKUP_VERSION) {
    throw new Error("This backup was made by a newer version of Cortex.");
  }

  const data = raw.data as CortexBackup["data"];
  const sectionsValid =
    (data.chat === undefined ||
      (Array.isArray(data.chat.conversations) && isRecord(data.chat.savedConversations))) &&
    (data.notes === undefined || Array.isArray(data.notes.notes)) &&
    (data.files === undefined ||
      (Array.isArray(data.files.files) && Array.isArray(data.files.collections))) &&
    (data.personas === undefined || Array.isArray(data.personas.customPersonas)) &&
    (data.prompts === undefined || Array.isArray(data.prompts.prompts)) &&
    (data.settings === undefined || isRecord(data.settings));
  if (!sectionsValid) {
    throw new Error("The backup file is damaged or incomplete.");
  }

  return raw as unknown as CortexBackup;
}

function newById<T extends { id: string }>(incoming: T[] | undefined, existing: T[]): T[] {
  if (!incoming?.length) return [];
  const known = new Set(existing.map((item) => item.id));
  return incoming.filter((item) => !known.has(item.id));
}

/** What an import would add, without changing anything. */
export function previewImport(backup: CortexBackup): ImportCounts {
  const { data } = backup;
  return {
    conversations: newById(data.chat?.conversations, useChatStore.getState().conversations).length,
    notes: newById(data.notes?.notes, useNotesStore.getState().notes).length,
    files: newById(data.files?.files, useFileStore.getState().files).length,
    personas: newById(data.personas?.customPersonas, usePersonaStore.getState().customPersonas)
      .length,
    prompts: newById(data.prompts?.prompts, usePromptStore.getState().prompts).length,
    hasSettings: data.settings !== undefined,
  };
}

/**
 * Merge the backup into the stores. Existing items always win — only ids
 * not present locally are added. Settings are deep-merged over current.
 */
export function applyBackup(backup: CortexBackup): ImportCounts {
  const { data } = backup;
  const counts = previewImport(backup);

  const newConversations = newById(data.chat?.conversations, useChatStore.getState().conversations);
  if (newConversations.length) {
    useChatStore.setState((state) => {
      const savedConversations = { ...state.savedConversations };
      for (const summary of newConversations) {
        const saved = data.chat?.savedConversations[summary.id];
        if (saved) savedConversations[summary.id] = saved;
      }
      return {
        conversations: [...newConversations, ...state.conversations],
        savedConversations,
      };
    });
  }

  const newNotes = newById(data.notes?.notes, useNotesStore.getState().notes);
  if (newNotes.length) {
    useNotesStore.setState((state) => ({ notes: [...newNotes, ...state.notes] }));
  }

  const newFiles = newById(data.files?.files, useFileStore.getState().files);
  const newCollections = newById(data.files?.collections, useFileStore.getState().collections);
  if (newFiles.length || newCollections.length) {
    useFileStore.setState((state) => ({
      files: [...state.files, ...newFiles],
      collections: [...state.collections, ...newCollections],
    }));
  }

  const newPersonas = newById(data.personas?.customPersonas, usePersonaStore.getState().customPersonas);
  if (newPersonas.length) {
    usePersonaStore.setState((state) => ({
      customPersonas: [...state.customPersonas, ...newPersonas],
    }));
  }

  const newPrompts = newById(data.prompts?.prompts, usePromptStore.getState().prompts);
  if (newPrompts.length) {
    usePromptStore.setState((state) => ({ prompts: [...newPrompts, ...state.prompts] }));
  }

  if (data.settings) {
    useSettingsStore.getState().updateSettings(data.settings);
  }

  return counts;
}

/** Default filename for a new backup, e.g. cortex-backup-2026-07-11.json */
export function backupFileName(): string {
  return `cortex-backup-${new Date().toISOString().slice(0, 10)}.json`;
}
