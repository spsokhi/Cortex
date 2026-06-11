import { useState, useRef, useEffect } from "react";
import { ChevronDown, Circle, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useModelStore } from "@/stores/modelStore";
import { cn } from "@/utils/cn";

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { models, activeModelId, setActiveModel, ollamaConnected } = useModelStore();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all",
          "bg-cortex-surface-3 border border-cortex-border text-cortex-text-muted",
          "hover:border-cortex-accent/30 hover:text-cortex-text",
        )}
      >
        <Circle
          size={6}
          className={ollamaConnected ? "fill-cortex-success text-cortex-success" : "fill-cortex-error text-cortex-error"}
        />
        <Cpu size={11} />
        <span className="max-w-28 truncate">{activeModelId}</span>
        <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-20 w-56 bg-cortex-surface-2 border border-cortex-border rounded-xl shadow-cortex-lg overflow-hidden"
          >
            {models.length === 0 ? (
              <div className="px-4 py-3 text-xs text-cortex-text-dim text-center">
                {ollamaConnected ? "No models installed" : "Ollama not running"}
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto py-1">
                {models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setActiveModel(m.id); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors",
                      m.id === activeModelId
                        ? "bg-cortex-accent/10 text-cortex-accent"
                        : "text-cortex-text hover:bg-cortex-surface-3",
                    )}
                  >
                    <Cpu size={11} className="flex-shrink-0" />
                    <span className="font-mono truncate">{m.name}</span>
                    <span className="ml-auto text-cortex-text-dim shrink-0">
                      {m.parameterSize}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
