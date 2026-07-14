/**
 * Global full-text search across conversations, notes, and indexed files.
 * All data lives in the zustand stores, so this is a plain in-memory scan —
 * multi-word queries AND together, title matches rank above content matches,
 * recency breaks ties.
 */
import { useChatStore } from "@/stores/chatStore";
import { useNotesStore } from "@/stores/notesStore";
import { useFileStore } from "@/stores/fileStore";

export interface SearchResult {
  type: "conversation" | "note" | "file";
  id: string;
  title: string;
  /** Matched context from the body, when the match wasn't (only) in the title */
  snippet?: string;
  updatedAt: number;
  titleMatch: boolean;
}

function terms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function matchesAll(textLower: string, needles: string[]): boolean {
  return needles.every((t) => textLower.includes(t));
}

/** A compact excerpt around the first occurrence of `needle`. */
export function makeSnippet(text: string, needle: string, radius = 45): string {
  const clean = text.replace(/\s+/g, " ");
  const idx = clean.toLowerCase().indexOf(needle);
  if (idx === -1) return clean.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(clean.length, idx + needle.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

function byRank(a: SearchResult, b: SearchResult): number {
  if (a.titleMatch !== b.titleMatch) return a.titleMatch ? -1 : 1;
  return b.updatedAt - a.updatedAt;
}

const PER_TYPE_LIMIT = 5;

export function searchEverything(query: string): SearchResult[] {
  const needles = terms(query);
  if (!needles.length) return [];

  const results: SearchResult[] = [];

  // Conversations — title plus full message text of the saved conversation
  const { conversations, savedConversations } = useChatStore.getState();
  const conversationHits: SearchResult[] = [];
  for (const summary of conversations) {
    const full = savedConversations[summary.id];
    const titleLower = summary.title.toLowerCase();
    const bodyText = full ? full.messages.map((m) => m.content).join("\n") : "";
    const titleMatch = matchesAll(titleLower, needles);
    if (!titleMatch && !matchesAll(`${titleLower}\n${bodyText.toLowerCase()}`, needles)) continue;

    let snippet: string | undefined;
    if (!titleMatch && full) {
      const message = full.messages.find((m) => m.content.toLowerCase().includes(needles[0]));
      if (message) snippet = makeSnippet(message.content, needles[0]);
    }
    conversationHits.push({
      type: "conversation",
      id: summary.id,
      title: summary.title,
      snippet,
      updatedAt: summary.updatedAt,
      titleMatch,
    });
  }
  results.push(...conversationHits.sort(byRank).slice(0, PER_TYPE_LIMIT));

  // Notes
  const { notes } = useNotesStore.getState();
  const noteHits: SearchResult[] = [];
  for (const note of notes) {
    const titleMatch = matchesAll(note.title.toLowerCase(), needles);
    const combined = `${note.title}\n${note.content}`.toLowerCase();
    if (!titleMatch && !matchesAll(combined, needles)) continue;
    noteHits.push({
      type: "note",
      id: note.id,
      title: note.title,
      snippet: titleMatch ? undefined : makeSnippet(note.content, needles[0]),
      updatedAt: note.updatedAt,
      titleMatch,
    });
  }
  results.push(...noteHits.sort(byRank).slice(0, PER_TYPE_LIMIT));

  // Files — name, AI summary, and extracted text
  const { files } = useFileStore.getState();
  const fileHits: SearchResult[] = [];
  for (const file of files) {
    const titleMatch = matchesAll(file.name.toLowerCase(), needles);
    const combined = `${file.name}\n${file.summary ?? ""}\n${file.content ?? ""}`.toLowerCase();
    if (!titleMatch && !matchesAll(combined, needles)) continue;

    // Prefer the summary for the snippet — it reads better than raw chunk text
    let snippet: string | undefined;
    if (!titleMatch) {
      if (file.summary?.toLowerCase().includes(needles[0])) {
        snippet = makeSnippet(file.summary, needles[0]);
      } else if (file.content) {
        snippet = makeSnippet(file.content, needles[0]);
      }
    }
    fileHits.push({
      type: "file",
      id: file.id,
      title: file.name,
      snippet,
      updatedAt: file.updatedAt,
      titleMatch,
    });
  }
  results.push(...fileHits.sort(byRank).slice(0, PER_TYPE_LIMIT));

  return results;
}
