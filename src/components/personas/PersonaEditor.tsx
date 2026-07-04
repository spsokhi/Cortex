import { useState } from "react";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import { usePersonaStore } from "@/stores/personaStore";
import { useUIStore } from "@/stores/uiStore";
import type { Persona } from "@/data/personas";

interface PersonaEditorProps {
  /** Persona being edited, or null to create a new one */
  persona: Persona | null;
  onClose: () => void;
}

export function PersonaEditor({ persona, onClose }: PersonaEditorProps) {
  const { addPersona, updatePersona, setActivePersona } = usePersonaStore();
  const { toast } = useUIStore();

  const [emoji, setEmoji] = useState(persona?.emoji ?? "🧠");
  const [name, setName] = useState(persona?.name ?? "");
  const [tagline, setTagline] = useState(persona?.tagline ?? "");
  const [systemPrompt, setSystemPrompt] = useState(persona?.systemPrompt ?? "");

  const canSave = name.trim().length > 0 && systemPrompt.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const fields = {
      emoji: emoji.trim() || "🧠",
      name: name.trim(),
      tagline: tagline.trim(),
      systemPrompt: systemPrompt.trim(),
    };
    if (persona) {
      updatePersona(persona.id, fields);
      toast("success", "Persona updated", fields.name);
    } else {
      const created = addPersona(fields);
      setActivePersona(created.id);
      toast("success", "Persona created", `${fields.name} is now active.`);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="w-[480px] max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto bg-cortex-surface-2 border border-cortex-border rounded-2xl shadow-cortex-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cortex-border">
          <span className="text-sm font-semibold text-cortex-text">
            {persona ? "Edit persona" : "New persona"}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-cortex-text-dim hover:text-cortex-text hover:bg-cortex-surface-3 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Fields */}
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <div className="w-16">
              <label className="block text-2xs text-cortex-text-muted mb-1">Emoji</label>
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
                className="cortex-input text-sm w-full text-center"
              />
            </div>
            <div className="flex-1">
              <label className="block text-2xs text-cortex-text-muted mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SQL Mentor"
                maxLength={40}
                className="cortex-input text-sm w-full"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-2xs text-cortex-text-muted mb-1">Tagline</label>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Short description shown in the sidebar"
              maxLength={60}
              className="cortex-input text-sm w-full"
            />
          </div>

          <div>
            <label className="block text-2xs text-cortex-text-muted mb-1">System prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are… Describe how the AI should think, speak, and respond."
              rows={8}
              className="cortex-input text-sm w-full resize-y font-mono leading-relaxed"
            />
            <p className="text-2xs text-cortex-text-dim mt-1">
              Applied as the system prompt when you start a new chat with this persona.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-cortex-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-cortex-text-muted hover:text-cortex-text hover:bg-cortex-surface-3 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cortex-accent text-white hover:bg-cortex-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {persona ? "Save changes" : "Create persona"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
