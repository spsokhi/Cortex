import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MessageSquare, FolderOpen, Cpu, Settings,
  StickyNote, Plus, FileText, Command,
} from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { cn } from "@/utils/cn";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPalette } = useUIStore();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
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
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  const commands: CommandItem[] = [
    {
      id: "new-chat",
      label: "New chat",
      icon: <Plus size={14} />,
      action: () => {
        createConversation(activeModelId);
        navigate("/chat");
        setCommandPalette(false);
      },
      keywords: ["new", "chat", "create"],
    },
    {
      id: "nav-chat",
      label: "Go to Chat",
      icon: <MessageSquare size={14} />,
      action: () => { navigate("/chat"); setCommandPalette(false); },
      keywords: ["chat", "go"],
    },
    {
      id: "nav-files",
      label: "Go to Files",
      icon: <FolderOpen size={14} />,
      action: () => { navigate("/files"); setCommandPalette(false); },
      keywords: ["files", "upload", "documents"],
    },
    {
      id: "nav-docs",
      label: "Go to Documents",
      icon: <FileText size={14} />,
      action: () => { navigate("/documents"); setCommandPalette(false); },
      keywords: ["documents", "pdf", "rag"],
    },
    {
      id: "nav-models",
      label: "Manage Models",
      icon: <Cpu size={14} />,
      action: () => { navigate("/models"); setCommandPalette(false); },
      keywords: ["models", "ollama", "download"],
    },
    {
      id: "nav-notes",
      label: "Go to Notes",
      icon: <StickyNote size={14} />,
      action: () => { navigate("/notes"); setCommandPalette(false); },
      keywords: ["notes", "markdown"],
    },
    {
      id: "nav-settings",
      label: "Open Settings",
      icon: <Settings size={14} />,
      action: () => { navigate("/settings"); setCommandPalette(false); },
      keywords: ["settings", "config", "preferences"],
    },
  ];

  const filtered = query.trim()
    ? commands.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.includes(q))
        );
      })
    : commands;

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
            onClick={() => setCommandPalette(false)}
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
                  placeholder="Search commands…"
                  className="flex-1 bg-transparent text-sm text-cortex-text placeholder-cortex-text-dim outline-none"
                />
                <kbd className="text-2xs font-mono text-cortex-text-dim bg-cortex-surface-3 border border-cortex-border px-1.5 py-0.5 rounded">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-64 overflow-y-auto py-1.5">
                {filtered.length === 0 ? (
                  <p className="text-center text-sm text-cortex-text-dim py-6">
                    No commands found
                  </p>
                ) : (
                  filtered.map((cmd) => (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-cortex-surface-3 transition-colors"
                    >
                      <span className="text-cortex-text-muted">{cmd.icon}</span>
                      <span className="text-cortex-text">{cmd.label}</span>
                      {cmd.description && (
                        <span className="ml-auto text-xs text-cortex-text-dim">{cmd.description}</span>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-2 px-4 py-2 border-t border-cortex-border">
                <Command size={10} className="text-cortex-text-dim" />
                <span className="text-2xs text-cortex-text-dim">Cortex Command Palette</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
