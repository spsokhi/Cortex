/**
 * Local tools the model can call during a chat turn. Everything executes
 * in-process against the user's own data — nothing leaves the machine.
 */
import { retrieveRag } from "@/services/rag";
import { useNotesStore } from "@/stores/notesStore";
import type { OllamaToolCall } from "@/services/api/ollama";

export const MAX_TOOL_ROUNDS = 4;

/** OpenAI-style function definitions, as Ollama's /api/chat expects. */
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_documents",
      description:
        "Search the user's indexed documents (PDFs, text, markdown, code files) for passages relevant to a query. Use this when the user asks about the contents of their files.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "List the titles of the user's saved notes.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_note",
      description: "Read the full content of one of the user's notes by its title.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The note title, or a distinctive part of it" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "current_datetime",
      description: "Get the current local date and time.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const TOOL_NAMES = new Set(TOOL_DEFINITIONS.map((d) => d.function.name));

/**
 * Fallback for Ollama/model combinations that don't populate message.tool_calls
 * and instead emit the call as raw JSON content, e.g.
 * `{"name": "read_note", "arguments": {"title": "x"}}` (optionally inside a
 * ```json fence or <tool_call> tags). Deliberately strict: the whole reply
 * must be a single JSON object (or array of them) naming one of our tools —
 * a user asking for JSON output can't trip it.
 */
export function parseInlineToolCalls(content: string): OllamaToolCall[] {
  let text = content.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  text = text.replace(/^<tool_call>\s*/i, "").replace(/\s*<\/tool_call>$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  const calls: OllamaToolCall[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) return [];
    const { name, arguments: args } = item as { name?: unknown; arguments?: unknown };
    if (typeof name !== "string" || !TOOL_NAMES.has(name)) return [];
    calls.push({
      function: {
        name,
        arguments:
          typeof args === "object" && args !== null && !Array.isArray(args)
            ? (args as Record<string, unknown>)
            : {},
      },
    });
  }
  return calls;
}

/** Run a tool and return its output as text for the model. Never throws — errors become tool output. */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "search_documents": {
        const query = typeof args.query === "string" ? args.query.trim() : "";
        if (!query) return "Error: the 'query' argument is required.";
        const { citations } = await retrieveRag(query);
        if (!citations.length) return "No matching passages found in the indexed documents.";
        return citations
          .map((c, i) => `[${i + 1}] From "${c.fileName}":\n${c.chunk}`)
          .join("\n\n");
      }

      case "list_notes": {
        const notes = useNotesStore.getState().notes;
        if (!notes.length) return "The user has no saved notes.";
        return notes.map((n) => `- ${n.title}`).join("\n");
      }

      case "read_note": {
        const title = typeof args.title === "string" ? args.title.trim().toLowerCase() : "";
        if (!title) return "Error: the 'title' argument is required.";
        const notes = useNotesStore.getState().notes;
        const note =
          notes.find((n) => n.title.toLowerCase() === title) ??
          notes.find((n) => n.title.toLowerCase().includes(title));
        if (!note) {
          return `No note found with a title matching "${String(args.title)}". Use list_notes to see available titles.`;
        }
        return `# ${note.title}\n\n${note.content}`;
      }

      case "current_datetime":
        return new Date().toLocaleString();

      default:
        return `Error: unknown tool "${name}".`;
    }
  } catch (err) {
    return `Error executing ${name}: ${err instanceof Error ? err.message : "unknown error"}`;
  }
}
