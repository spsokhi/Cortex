import { useState, useRef, useEffect } from "react";
import { BookOpen, Trash2, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePromptStore } from "@/stores/promptStore";
import { cn } from "@/utils/cn";

interface PromptLibraryProps {
  currentInput: string;
  onInsert: (content: string) => void;
}

export function PromptLibrary({ currentInput, onInsert }: PromptLibraryProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const { prompts, addPrompt, removePrompt } = usePromptStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setSaving(false); setSaveName(""); return; }
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (saving) nameInputRef.current?.focus();
  }, [saving]);

  const handleSave = () => {
    if (!saveName.trim() || !currentInput.trim()) return;
    addPrompt(saveName.trim(), currentInput.trim());
    setSaveName("");
    setSaving(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Prompt library"
        className={cn(
          "p-1.5 rounded-lg transition-colors",
          open
            ? "text-cortex-accent bg-cortex-surface-3"
            : "text-cortex-text-dim hover:text-cortex-text hover:bg-cortex-surface-3",
        )}
      >
        <BookOpen size={14} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 w-72 bg-cortex-surface-2 border border-cortex-border rounded-xl shadow-cortex-lg overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-cortex-border">
              <span className="text-xs font-semibold text-cortex-text">Prompt Library</span>
              <div className="flex items-center gap-1.5">
                {currentInput.trim() && (
                  <button
                    onClick={() => setSaving((v) => !v)}
                    className="flex items-center gap-1 text-2xs text-cortex-accent hover:text-white hover:bg-cortex-accent transition-colors px-1.5 py-0.5 rounded-md bg-cortex-accent/10"
                  >
                    <Plus size={10} />
                    Save current
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-0.5 text-cortex-text-dim hover:text-cortex-text transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Save name form */}
            <AnimatePresence initial={false}>
              {saving && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-2 px-3 py-2 border-b border-cortex-border bg-cortex-surface-3/50">
                    <input
                      ref={nameInputRef}
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave();
                        if (e.key === "Escape") setSaving(false);
                      }}
                      placeholder="Give this prompt a name…"
                      className="flex-1 bg-cortex-surface-3 border border-cortex-border rounded-lg px-2.5 py-1.5 text-xs text-cortex-text placeholder-cortex-text-dim outline-none focus:border-cortex-accent transition-colors"
                    />
                    <button
                      onClick={handleSave}
                      disabled={!saveName.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-cortex-accent text-white text-xs font-medium disabled:opacity-40 hover:bg-cortex-accent-dim transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Prompt list */}
            <div className="max-h-60 overflow-y-auto no-scrollbar">
              {prompts.length === 0 ? (
                <div className="py-10 text-center text-cortex-text-dim">
                  <BookOpen size={22} className="mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No saved prompts yet.</p>
                  <p className="text-2xs mt-0.5 opacity-70">
                    Type something and click "Save current".
                  </p>
                </div>
              ) : (
                prompts.map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-start gap-2 px-3 py-2.5 hover:bg-cortex-surface-3 transition-colors cursor-pointer border-b border-cortex-border/50 last:border-0"
                    onClick={() => { onInsert(p.content); setOpen(false); }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-cortex-text truncate">{p.name}</p>
                      <p className="text-2xs text-cortex-text-dim mt-0.5 line-clamp-2 leading-relaxed">
                        {p.content}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removePrompt(p.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-cortex-error/10 text-cortex-text-dim hover:text-cortex-error transition-all flex-shrink-0 mt-0.5"
                      title="Delete prompt"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
