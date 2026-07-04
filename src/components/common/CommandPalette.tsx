import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MessageSquare, FolderOpen, Cpu, Settings,
  StickyNote, Plus, FileText, Command,
} from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useNotesStore } from "@/stores/notesStore";
import { useFileStore } from "@/stores/fileStore";
import { searchEverything } from "@/services/search";
import { cn } from "@/utils/cn";

interface Entry {
  key: string;
  icon: React.ReactNode;
  label: string;
  snippet?: string;
  action: () => void;
  keywords?: string[];
}

interface Section {
  title: string | null;
  entries: Entry[];
}

/** Emphasize the first occurrence of the query's first word. */
function Highlight({ text, term }: { text: string; term: string }) {
  const idx = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-cortex-accent">{text.slice(idx, idx + term.length)}</span>
      {text.slice(idx + term.length)}
    </>
  );
}

const RESULT_ICONS = {
  conversation: <MessageSquare size={14} />,
  note: <StickyNote size={14} />,
  file: <FileText size={14} />,
} as const;

const RESULT_SECTION_TITLES = {
  conversation: "Conversations",
  note: "Notes",
  file: "Files",
} as const;

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPalette } = useUIStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { createConversation } = useChatStore();
  const { activeModelId } = useModelStore();

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPalette(!commandPaletteOpen);
      }
      if (e.key === "Escape") setCommandPalette(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, setCommandPalette]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  const close = () => setCommandPalette(false);

  const commands: Entry[] = [
    {
      key: "new-chat",
      label: "New chat",
      icon: <Plus size={14} />,
      action: () => {
        createConversation(activeModelId);
        navigate("/chat");
        close();
      },
      keywords: ["new", "chat", "create"],
    },
    {
      key: "nav-chat",
      label: "Go to Chat",
      icon: <MessageSquare size={14} />,
      action: () => { navigate("/chat"); close(); },
      keywords: ["chat", "go"],
    },
    {
      key: "nav-files",
      label: "Go to Files",
      icon: <FolderOpen size={14} />,
      action: () => { navigate("/files"); close(); },
      keywords: ["files", "upload", "documents"],
    },
    {
      key: "nav-docs",
      label: "Go to Documents",
      icon: <FileText size={14} />,
      action: () => { navigate("/documents"); close(); },
      keywords: ["documents", "pdf", "rag"],
    },
    {
      key: "nav-models",
      label: "Manage Models",
      icon: <Cpu size={14} />,
      action: () => { navigate("/models"); close(); },
      keywords: ["models", "ollama", "download"],
    },
    {
      key: "nav-notes",
      label: "Go to Notes",
      icon: <StickyNote size={14} />,
      action: () => { navigate("/notes"); close(); },
      keywords: ["notes", "markdown"],
    },
    {
      key: "nav-settings",
      label: "Open Settings",
      icon: <Settings size={14} />,
      action: () => { navigate("/settings"); close(); },
      keywords: ["settings", "config", "preferences"],
    },
  ];

  const trimmed = query.trim();
  const firstTerm = trimmed.split(/\s+/)[0] ?? "";
  const q = trimmed.toLowerCase();

  const hits = useMemo(() => (trimmed ? searchEverything(trimmed) : []), [trimmed]);

  const filteredCommands = q
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.includes(q)),
      )
    : commands;

  const sections: Section[] = [];
  if (filteredCommands.length) {
    sections.push({ title: q ? "Commands" : null, entries: filteredCommands });
  }
  for (const type of ["conversation", "note", "file"] as const) {
    const entries = hits
      .filter((h) => h.type === type)
      .map((h): Entry => ({
        key: `${h.type}-${h.id}`,
        icon: RESULT_ICONS[h.type],
        label: h.title,
        snippet: h.snippet,
        action: () => {
          if (h.type === "conversation") {
            navigate(`/chat/${h.id}`);
          } else if (h.type === "note") {
            useNotesStore.getState().setActiveNote(h.id);
            navigate("/notes");
          } else {
            useFileStore.getState().setSearchQuery(h.title);
            navigate("/files");
          }
          close();
        },
      }));
    if (entries.length) sections.push({ title: RESULT_SECTION_TITLES[type], entries });
  }

  const flat = sections.flatMap((s) => s.entries);

  useEffect(() => {
    setSelectedIndex(0);
  }, [trimmed]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[selectedIndex]?.action();
    }
  };

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={close}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-cortex-surface-2 border border-cortex-border rounded-2xl shadow-cortex-lg overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-cortex-border">
                <Search size={15} className="text-cortex-text-muted flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search commands, chats, notes, files…"
                  className="flex-1 bg-transparent text-sm text-cortex-text placeholder-cortex-text-dim outline-none"
                />
                <kbd className="text-2xs font-mono text-cortex-text-dim bg-cortex-surface-3 border border-cortex-border px-1.5 py-0.5 rounded">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
                {flat.length === 0 ? (
                  <p className="text-center text-sm text-cortex-text-dim py-6">
                    No matches found
                  </p>
                ) : (
                  sections.map((section) => (
                    <div key={section.title ?? "commands"}>
                      {section.title && (
                        <p className="px-4 pt-2 pb-1 text-2xs uppercase tracking-wider text-cortex-text-dim">
                          {section.title}
                        </p>
                      )}
                      {section.entries.map((entry) => {
                        flatIndex++;
                        const index = flatIndex;
                        return (
                          <button
                            key={entry.key}
                            data-index={index}
                            onClick={entry.action}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={cn(
                              "w-full flex items-start gap-3 px-4 py-2.5 text-sm text-left transition-colors",
                              index === selectedIndex ? "bg-cortex-surface-3" : "hover:bg-cortex-surface-3",
                            )}
                          >
                            <span className="text-cortex-text-muted mt-0.5">{entry.icon}</span>
                            <span className="min-w-0">
                              <span className="block text-cortex-text truncate">
                                <Highlight text={entry.label} term={firstTerm} />
                              </span>
                              {entry.snippet && (
                                <span className="block text-2xs text-cortex-text-dim truncate mt-0.5">
                                  <Highlight text={entry.snippet} term={firstTerm} />
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-2 px-4 py-2 border-t border-cortex-border">
                <Command size={10} className="text-cortex-text-dim" />
                <span className="text-2xs text-cortex-text-dim">
                  ↑↓ to navigate · Enter to open
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
