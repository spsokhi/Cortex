import { Minus, Square, X, BrainCircuit, Sun, Moon } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/utils/cn";

export function TitleBar() {
  const { toggleSidebar } = useUIStore();
  const theme = useSettingsStore((s) => s.settings.appearance.theme);
  const { updateSettings } = useSettingsStore();
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isLight = theme === "light" || (theme === "system" && !prefersDark);

  const toggleTheme = () => {
    updateSettings({ appearance: { theme: isLight ? "dark" : "light" } });
  };

  const minimize = () => { void getCurrentWindow().minimize().catch(() => null); };
  const maximize = () => { void getCurrentWindow().toggleMaximize().catch(() => null); };
  const close = () => { void getCurrentWindow().close().catch(() => null); };

  return (
    <div className="h-10 flex items-center justify-between bg-cortex-surface border-b border-cortex-border flex-shrink-0 select-none">
      {/* Left: Logo + App name — not a drag region so sidebar toggle works */}
      <div className="flex items-center gap-2 px-3">
        <button
          onClick={toggleSidebar}
          className={cn("cortex-button-icon p-1.5")}
          title="Toggle sidebar"
        >
          <BrainCircuit size={16} className="text-cortex-accent" />
        </button>
        <span className="text-sm font-semibold text-cortex-text tracking-tight">
          Cortex
        </span>
        <span className="text-2xs text-cortex-text-dim font-mono px-1.5 py-0.5 rounded bg-cortex-surface-3 border border-cortex-border">
          LOCAL
        </span>
      </div>

      {/* Center: drag region only — pointer-events-none on the label so it doesn't block dragging */}
      <div data-tauri-drag-region className="flex-1 h-full flex justify-center items-center cursor-move">
        <span className="text-xs text-cortex-text-dim pointer-events-none">Privacy-First AI</span>
      </div>

      {/* Right: Theme toggle + Window controls — not inside drag region */}
      <div className="flex items-center gap-1 px-2">
        <button
          onClick={toggleTheme}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-cortex-surface-3 text-cortex-text-muted hover:text-cortex-text transition-colors"
          title={isLight ? "Switch to dark mode" : "Switch to light mode"}
        >
          {isLight ? <Moon size={12} /> : <Sun size={12} />}
        </button>
        <div className="w-px h-4 bg-cortex-border mx-0.5" />
        <button
          onClick={minimize}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-cortex-surface-3 text-cortex-text-muted hover:text-cortex-text transition-colors"
          title="Minimize"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={maximize}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-cortex-surface-3 text-cortex-text-muted hover:text-cortex-text transition-colors"
          title="Maximize"
        >
          <Square size={11} />
        </button>
        <button
          onClick={close}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/20 text-cortex-text-muted hover:text-red-400 transition-colors"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
