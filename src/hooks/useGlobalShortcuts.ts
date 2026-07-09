import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { usePersonaStore, findPersona } from "@/stores/personaStore";
import { stopActiveGeneration } from "@/hooks/useChat";

/**
 * App-wide keyboard shortcuts. Ctrl+K lives in CommandPalette; everything
 * else is here. Mounted once from AppBootstrap (needs router context).
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const persona = findPersona(usePersonaStore.getState().activePersonaId);
        useChatStore
          .getState()
          .createConversation(useModelStore.getState().activeModelId, undefined, persona?.systemPrompt);
        navigate("/chat");
        return;
      }

      if (mod && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        useUIStore.getState().toggleSidebar();
        return;
      }

      if (mod && e.key === "/") {
        e.preventDefault();
        const ui = useUIStore.getState();
        ui.setShortcutsHelp(!ui.shortcutsHelpOpen);
        return;
      }

      if (e.key === "Escape") {
        const ui = useUIStore.getState();
        if (ui.shortcutsHelpOpen) {
          ui.setShortcutsHelp(false);
          return;
        }
        // Escape closing an overlay shouldn't also kill the generation
        if (ui.commandPaletteOpen) return;
        if (useChatStore.getState().isGenerating) stopActiveGeneration();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
}
