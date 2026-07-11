import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "K"], label: "Search & command palette" },
  { keys: ["Ctrl", "N"], label: "New chat" },
  { keys: ["Ctrl", "F"], label: "Find in conversation" },
  { keys: ["Ctrl", "B"], label: "Toggle sidebar" },
  { keys: ["Enter"], label: "Send message" },
  { keys: ["Shift", "Enter"], label: "New line in message" },
  { keys: ["Esc"], label: "Stop generation / close dialogs" },
  { keys: ["Ctrl", "/"], label: "Show this overlay" },
];

export function ShortcutsHelp() {
  const { shortcutsHelpOpen, setShortcutsHelp } = useUIStore();
  const close = () => setShortcutsHelp(false);

  return (
    <AnimatePresence>
      {shortcutsHelpOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-cortex-surface-2 border border-cortex-border rounded-2xl shadow-cortex-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-cortex-border">
              <div className="flex items-center gap-2">
                <Keyboard size={14} className="text-cortex-accent" />
                <h2 className="text-sm font-medium text-cortex-text">Keyboard shortcuts</h2>
              </div>
              <button
                onClick={close}
                className="p-1 rounded-lg text-cortex-text-dim hover:text-cortex-text hover:bg-cortex-surface-3 transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="px-4 py-3 space-y-2">
              {SHORTCUTS.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-cortex-text-muted">{s.label}</span>
                  <span className="flex items-center gap-1 flex-shrink-0">
                    {s.keys.map((key) => (
                      <kbd
                        key={key}
                        className="px-1.5 py-0.5 rounded bg-cortex-surface-3 border border-cortex-border text-2xs font-mono text-cortex-text"
                      >
                        {key}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>

            <p className="px-4 pb-3 text-2xs text-cortex-text-dim">
              Tip: double-click a chat title in the sidebar to rename it.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
