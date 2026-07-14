import { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings, Cpu, Database, Mic, Eye, Shield, Terminal, Save,
  RotateCcw, ChevronRight, BarChart2, Download, Upload,
} from "lucide-react";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { useStatsStore } from "@/stores/statsStore";
import { useChatStore } from "@/stores/chatStore";
import { findPersona } from "@/stores/personaStore";
import { clearChatHistory } from "@/services/privacy";
import {
  serializeBackup, parseBackup, previewImport, applyBackup, backupFileName,
  type CortexBackup, type ImportCounts,
} from "@/services/backup";
import { ACCENT_PRESETS } from "@/data/accents";
import { cn } from "@/utils/cn";

type Section = "general" | "models" | "rag" | "voice" | "appearance" | "privacy" | "advanced" | "stats";

const SECTIONS: Array<{ id: Section; label: string; icon: React.ElementType; desc: string }> = [
  { id: "general", label: "General", icon: Settings, desc: "App behavior & data" },
  { id: "appearance", label: "Appearance", icon: Eye, desc: "Theme, fonts, layout" },
  { id: "models", label: "Models", icon: Cpu, desc: "Ollama endpoint & defaults" },
  { id: "rag", label: "RAG", icon: Database, desc: "Embeddings & retrieval" },
  { id: "voice", label: "Voice", icon: Mic, desc: "Whisper & TTS" },
  { id: "privacy", label: "Privacy", icon: Shield, desc: "Telemetry & storage" },
  { id: "advanced", label: "Advanced", icon: Terminal, desc: "Debug & ports" },
  { id: "stats", label: "Stats", icon: BarChart2, desc: "Your usage at a glance" },
];

export function SettingsRoute() {
  const [activeSection, setActiveSection] = useState<Section>("general");
  const { settings, updateSettings, resetSection, isDirty } = useSettingsStore();
  const { toast } = useUIStore();

  const handleSave = () => {
    useSettingsStore.getState().markSaved();
    toast("success", "Settings saved");
  };

  const handleReset = () => {
    if (activeSection === "stats") return;
    resetSection(activeSection);
    toast("info", `${SECTIONS.find((s) => s.id === activeSection)?.label} settings reset`);
  };

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full"
    >
      {/* Sections list */}
      <div className="w-52 flex-shrink-0 border-r border-cortex-border bg-cortex-surface flex flex-col">
        <div className="px-4 py-4 border-b border-cortex-border">
          <h1 className="text-sm font-semibold text-cortex-text">Settings</h1>
          <p className="text-xs text-cortex-text-muted mt-0.5">App configuration</p>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
                  activeSection === s.id
                    ? "bg-cortex-accent/10 text-cortex-accent"
                    : "text-cortex-text-muted hover:bg-cortex-surface-3 hover:text-cortex-text",
                )}
              >
                <Icon size={14} />
                {s.label}
                {activeSection === s.id && (
                  <ChevronRight size={12} className="ml-auto" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Version info */}
        <div className="px-4 py-3 border-t border-cortex-border">
          <p className="text-2xs text-cortex-text-dim">Cortex v0.1.0</p>
          <p className="text-2xs text-cortex-text-dim">MIT License</p>
        </div>
      </div>

      {/* Settings panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border bg-cortex-surface/50">
          <div>
            <h2 className="text-sm font-semibold text-cortex-text">
              {SECTIONS.find((s) => s.id === activeSection)?.label}
            </h2>
            <p className="text-xs text-cortex-text-muted mt-0.5">
              {SECTIONS.find((s) => s.id === activeSection)?.desc}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeSection !== "stats" && (
              <button onClick={handleReset} className="cortex-button-ghost text-xs flex items-center gap-1.5">
                <RotateCcw size={12} />
                Reset
              </button>
            )}
            {isDirty && activeSection !== "stats" && (
              <button onClick={handleSave} className="cortex-button-primary text-xs flex items-center gap-1.5">
                <Save size={12} />
                Save changes
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {activeSection === "general" && (
            <GeneralSettings
              settings={settings.general}
              onChange={(v) => updateSettings({ general: v })}
            />
          )}
          {activeSection === "models" && (
            <ModelSettings
              settings={settings.models}
              onChange={(v) => updateSettings({ models: v })}
            />
          )}
          {activeSection === "rag" && (
            <RagSettings
              settings={settings.rag}
              onChange={(v) => updateSettings({ rag: v })}
            />
          )}
          {activeSection === "voice" && (
            <VoiceSettings
              settings={settings.voice}
              onChange={(v) => updateSettings({ voice: v })}
            />
          )}
          {activeSection === "appearance" && (
            <AppearanceSettings
              settings={settings.appearance}
              onChange={(v) => updateSettings({ appearance: v })}
            />
          )}
          {activeSection === "privacy" && (
            <PrivacySettings
              settings={settings.privacy}
              onChange={(v) => updateSettings({ privacy: v })}
            />
          )}
          {activeSection === "advanced" && (
            <AdvancedSettings
              settings={settings.advanced}
              onChange={(v) => updateSettings({ advanced: v })}
            />
          )}
          {activeSection === "stats" && <StatsSection />}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Settings sections ─────────────────────────────────────────────────────

function SettingRow({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-cortex-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-cortex-text font-medium">{label}</p>
        {description && <p className="text-xs text-cortex-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-9 h-5 rounded-full transition-colors duration-200",
        checked ? "bg-cortex-accent" : "bg-cortex-surface-3 border border-cortex-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

function GeneralSettings({ settings, onChange }: {
  settings: ReturnType<typeof useSettingsStore.getState>["settings"]["general"];
  onChange: (v: Partial<typeof settings>) => void;
}) {
  const { toast } = useUIStore();
  const [pendingImport, setPendingImport] = useState<{ backup: CortexBackup; counts: ImportCounts } | null>(null);

  const handleExport = async () => {
    try {
      const path = await saveDialog({
        filters: [{ name: "Cortex backup", extensions: ["json"] }],
        defaultPath: backupFileName(),
      });
      if (!path) return;
      await writeTextFile(path, serializeBackup());
      toast("success", "Backup exported", path);
    } catch {
      toast("error", "Export failed", "Could not save the backup file");
    }
  };

  const handlePickBackup = async () => {
    try {
      const path = await openDialog({
        multiple: false,
        filters: [{ name: "Cortex backup", extensions: ["json"] }],
      });
      if (typeof path !== "string") return; // cancelled
      const backup = parseBackup(await readTextFile(path));
      setPendingImport({ backup, counts: previewImport(backup) });
    } catch (err) {
      toast("error", "Can't read backup", err instanceof Error ? err.message : undefined);
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    const counts = applyBackup(pendingImport.backup);
    setPendingImport(null);
    const added =
      counts.conversations + counts.notes + counts.files + counts.personas + counts.prompts;
    toast(
      "success",
      "Backup restored",
      `${added} item${added !== 1 ? "s" : ""} added${counts.hasSettings ? " · settings applied" : ""}.`,
    );
  };

  const importSummary = (counts: ImportCounts): string => {
    const parts = [
      counts.conversations && `${counts.conversations} chat${counts.conversations !== 1 ? "s" : ""}`,
      counts.notes && `${counts.notes} note${counts.notes !== 1 ? "s" : ""}`,
      counts.files && `${counts.files} file${counts.files !== 1 ? "s" : ""}`,
      counts.personas && `${counts.personas} persona${counts.personas !== 1 ? "s" : ""}`,
      counts.prompts && `${counts.prompts} prompt${counts.prompts !== 1 ? "s" : ""}`,
    ].filter(Boolean);
    if (!parts.length) {
      return counts.hasSettings
        ? "Everything in this backup already exists here — only settings will be applied."
        : "Everything in this backup already exists here — nothing to add.";
    }
    return `Adds ${parts.join(", ")}${counts.hasSettings ? " and applies the backed-up settings" : ""}. Existing items are never overwritten.`;
  };

  return (
    <div>
      <SettingRow label="Close to tray" description="Keep Cortex running in the background when closed">
        <Toggle checked={settings.closeToTray} onChange={(v) => onChange({ closeToTray: v })} />
      </SettingRow>
      <SettingRow label="Start minimized" description="Launch minimized to tray">
        <Toggle checked={settings.startMinimized} onChange={(v) => onChange({ startMinimized: v })} />
      </SettingRow>
      <SettingRow label="Auto-update check" description="Check for new Cortex releases on startup">
        <Toggle checked={settings.autoUpdateCheck} onChange={(v) => onChange({ autoUpdateCheck: v })} />
      </SettingRow>
      <SettingRow
        label="Export all data"
        description="Save chats, notes, indexed files, personas, prompts and settings to a single JSON file"
      >
        <button
          onClick={() => void handleExport()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-cortex-surface-3 border border-cortex-border text-cortex-text-muted hover:text-cortex-text hover:border-cortex-accent/30 transition-colors"
        >
          <Download size={13} />
          Export
        </button>
      </SettingRow>
      <SettingRow
        label="Restore from backup"
        description="Merge a backup file into this install — existing items are kept, nothing is overwritten"
      >
        <button
          onClick={() => void handlePickBackup()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-cortex-surface-3 border border-cortex-border text-cortex-text-muted hover:text-cortex-text hover:border-cortex-accent/30 transition-colors"
        >
          <Upload size={13} />
          Choose file…
        </button>
      </SettingRow>

      {pendingImport && (
        <div className="mt-4 p-4 rounded-xl bg-cortex-accent/5 border border-cortex-accent/20">
          <p className="text-xs font-medium text-cortex-text">
            Backup from {new Date(pendingImport.backup.exportedAt).toLocaleString()}
          </p>
          <p className="text-xs text-cortex-text-muted mt-1">{importSummary(pendingImport.counts)}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleConfirmImport}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cortex-accent text-white hover:bg-cortex-accent-dim transition-colors"
            >
              Restore
            </button>
            <button
              onClick={() => setPendingImport(null)}
              className="px-3 py-1.5 rounded-lg text-xs bg-cortex-surface-3 text-cortex-text-muted hover:text-cortex-text border border-cortex-border transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModelSettings({ settings, onChange }: {
  settings: ReturnType<typeof useSettingsStore.getState>["settings"]["models"];
  onChange: (v: Partial<typeof settings>) => void;
}) {
  return (
    <div>
      <SettingRow label="Ollama endpoint" description="URL of your local Ollama instance">
        <input
          value={settings.ollamaEndpoint}
          onChange={(e) => onChange({ ollamaEndpoint: e.target.value })}
          className="cortex-input text-sm w-56 font-mono"
        />
      </SettingRow>
      <SettingRow label="Default temperature" description="Controls randomness (0 = deterministic, 2 = creative)">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.defaultTemperature}
            onChange={(e) => onChange({ defaultTemperature: parseFloat(e.target.value) })}
            className="w-24 accent-cortex-accent"
          />
          <span className="text-xs font-mono text-cortex-text w-8 text-right">
            {settings.defaultTemperature.toFixed(1)}
          </span>
        </div>
      </SettingRow>
      <SettingRow label="Context length" description="Maximum tokens in the context window">
        <select
          value={settings.defaultContextLength}
          onChange={(e) => onChange({ defaultContextLength: parseInt(e.target.value) })}
          className="cortex-input text-sm"
        >
          {[2048, 4096, 8192, 16384, 32768].map((v) => (
            <option key={v} value={v}>{v.toLocaleString()}</option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="Top P" description="Nucleus sampling — lower values make output more focused">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={settings.topP ?? 0.9}
            onChange={(e) => onChange({ topP: parseFloat(e.target.value) })}
            className="w-24 accent-cortex-accent"
          />
          <span className="text-xs font-mono text-cortex-text w-8 text-right">
            {(settings.topP ?? 0.9).toFixed(2)}
          </span>
        </div>
      </SettingRow>
      <SettingRow label="Seed" description="Fixed seed for reproducible outputs (0 = random)">
        <input
          type="number"
          min="0"
          value={settings.seed ?? 0}
          onChange={(e) => onChange({ seed: parseInt(e.target.value) || 0 })}
          className="cortex-input text-sm w-24 font-mono"
        />
      </SettingRow>
      <SettingRow
        label="Keep model loaded"
        description="How long Ollama keeps the model in memory after a message — longer avoids reload delays"
      >
        <select
          value={settings.keepAlive ?? "10m"}
          onChange={(e) => onChange({ keepAlive: e.target.value })}
          className="cortex-input text-sm"
        >
          <option value="5m">5 minutes</option>
          <option value="10m">10 minutes</option>
          <option value="30m">30 minutes</option>
          <option value="1h">1 hour</option>
          <option value="always">Always</option>
        </select>
      </SettingRow>
      <SettingRow label="Request timeout" description="Seconds before a request times out">
        <input
          type="number"
          min="10"
          max="600"
          value={settings.requestTimeout}
          onChange={(e) => onChange({ requestTimeout: parseInt(e.target.value) })}
          className="cortex-input text-sm w-20 font-mono"
        />
      </SettingRow>
    </div>
  );
}

function RagSettings({ settings, onChange }: {
  settings: ReturnType<typeof useSettingsStore.getState>["settings"]["rag"];
  onChange: (v: Partial<typeof settings>) => void;
}) {
  return (
    <div>
      <SettingRow label="Enable RAG" description="Use indexed documents as context for chat">
        <Toggle checked={settings.enabled} onChange={(v) => onChange({ enabled: v })} />
      </SettingRow>
      <SettingRow label="Embedding model" description="Local model for generating embeddings">
        <input
          value={settings.embeddingModel}
          onChange={(e) => onChange({ embeddingModel: e.target.value })}
          className="cortex-input text-sm w-48 font-mono"
        />
      </SettingRow>
      <SettingRow label="Chunk size" description="Tokens per document chunk">
        <input
          type="number"
          value={settings.chunkSize}
          onChange={(e) => onChange({ chunkSize: parseInt(e.target.value) })}
          className="cortex-input text-sm w-20 font-mono"
        />
      </SettingRow>
      <SettingRow label="Top K results" description="Number of chunks to retrieve per query">
        <input
          type="number"
          min="1"
          max="20"
          value={settings.topK}
          onChange={(e) => onChange({ topK: parseInt(e.target.value) })}
          className="cortex-input text-sm w-16 font-mono"
        />
      </SettingRow>
      <SettingRow label="Index on upload" description="Automatically index files when added">
        <Toggle checked={settings.indexOnUpload} onChange={(v) => onChange({ indexOnUpload: v })} />
      </SettingRow>
    </div>
  );
}

function VoiceSettings({ settings, onChange }: {
  settings: ReturnType<typeof useSettingsStore.getState>["settings"]["voice"];
  onChange: (v: Partial<typeof settings>) => void;
}) {
  return (
    <div>
      <SettingRow label="Enable voice" description="Allow voice input via microphone">
        <Toggle checked={settings.enabled} onChange={(v) => onChange({ enabled: v })} />
      </SettingRow>
      <SettingRow
        label="Recognition engine"
        description="Local Whisper keeps audio on your device. Browser uses the Web Speech API, which sends audio to your browser vendor's servers"
      >
        <select
          value={settings.engine ?? "whisper"}
          onChange={(e) => onChange({ engine: e.target.value as typeof settings.engine })}
          className="cortex-input text-sm"
        >
          <option value="whisper">Local Whisper (private)</option>
          <option value="browser">Browser (cloud)</option>
        </select>
      </SettingRow>
      <SettingRow label="Whisper model" description="Larger models are more accurate but slower">
        <select
          value={settings.whisperModel}
          onChange={(e) => onChange({ whisperModel: e.target.value as typeof settings.whisperModel })}
          className="cortex-input text-sm"
        >
          {["tiny", "base", "small", "medium", "large"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="Language" description="Primary language for speech recognition">
        <select
          value={settings.language}
          onChange={(e) => onChange({ language: e.target.value })}
          className="cortex-input text-sm"
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="zh">Chinese</option>
          <option value="ja">Japanese</option>
          <option value="auto">Auto-detect</option>
        </select>
      </SettingRow>
      <SettingRow
        label="Read responses aloud"
        description="Show a speaker button on responses that reads them with your system voice — fully local"
      >
        <Toggle checked={settings.ttsEnabled ?? false} onChange={(v) => onChange({ ttsEnabled: v })} />
      </SettingRow>
    </div>
  );
}

function AppearanceSettings({ settings, onChange }: {
  settings: ReturnType<typeof useSettingsStore.getState>["settings"]["appearance"];
  onChange: (v: Partial<typeof settings>) => void;
}) {
  return (
    <div>
      <SettingRow label="Theme" description="Color scheme for the app">
        <div className="flex gap-1">
          {(["dark", "light", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ theme: t })}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs capitalize transition-colors",
                settings.theme === t
                  ? "bg-cortex-accent text-white"
                  : "bg-cortex-surface-3 text-cortex-text-muted hover:text-cortex-text border border-cortex-border",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Accent color" description="Highlight color used across the app">
        <div className="flex gap-1.5">
          {ACCENT_PRESETS.map((preset) => {
            const selected = (settings.accent ?? "indigo") === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onChange({ accent: preset.id })}
                title={preset.label}
                className={cn(
                  "w-6 h-6 rounded-full transition-all duration-150",
                  selected
                    ? "ring-2 ring-offset-2 ring-offset-cortex-surface scale-110"
                    : "hover:scale-110 opacity-80 hover:opacity-100",
                )}
                style={{
                  backgroundColor: `rgb(${preset.dark.accent})`,
                  ...(selected ? { ["--tw-ring-color" as string]: `rgb(${preset.dark.accent})` } : {}),
                }}
              />
            );
          })}
        </div>
      </SettingRow>
      <SettingRow label="Font size" description="UI text size">
        <select
          value={settings.fontSize}
          onChange={(e) => onChange({ fontSize: e.target.value as typeof settings.fontSize })}
          className="cortex-input text-sm"
        >
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
        </select>
      </SettingRow>
      <SettingRow label="Compact mode" description="Reduce padding and spacing">
        <Toggle checked={settings.compactMode} onChange={(v) => onChange({ compactMode: v })} />
      </SettingRow>
      <SettingRow label="Show timestamps" description="Show message timestamps on hover">
        <Toggle checked={settings.showTimestamps} onChange={(v) => onChange({ showTimestamps: v })} />
      </SettingRow>
      <SettingRow label="Show token count" description="Display token count per message">
        <Toggle checked={settings.showTokenCount} onChange={(v) => onChange({ showTokenCount: v })} />
      </SettingRow>
    </div>
  );
}

function PrivacySettings({ settings, onChange }: {
  settings: ReturnType<typeof useSettingsStore.getState>["settings"]["privacy"];
  onChange: (v: Partial<typeof settings>) => void;
}) {
  const { toast } = useUIStore();
  const conversationCount = useChatStore((s) => s.conversations.length);
  const [confirmingClear, setConfirmingClear] = useState(false);

  return (
    <div>
      <div className="p-4 rounded-xl bg-cortex-success/5 border border-cortex-success/20 mb-4">
        <p className="text-xs font-medium text-cortex-success">Privacy by default</p>
        <p className="text-xs text-cortex-text-muted mt-1">
          Cortex sends no data anywhere — no telemetry, no crash reports, no analytics.
          There is nothing to opt out of. Everything below controls only what is kept on your own disk.
        </p>
      </div>
      <SettingRow
        label="Don't keep chat history"
        description="Conversations are wiped when Cortex starts its next session — nothing persists between sessions"
      >
        <Toggle checked={settings.clearHistoryOnExit} onChange={(v) => onChange({ clearHistoryOnExit: v })} />
      </SettingRow>
      <SettingRow
        label="Auto-delete old chats"
        description="On startup, delete conversations not updated within the period below. Pinned conversations are always kept"
      >
        <Toggle checked={settings.retentionEnabled ?? false} onChange={(v) => onChange({ retentionEnabled: v })} />
      </SettingRow>
      <SettingRow label="Retention period (days)" description="Applies only when auto-delete is on">
        <input
          type="number"
          min="1"
          max="3650"
          disabled={!settings.retentionEnabled}
          value={settings.historyRetentionDays}
          onChange={(e) => onChange({ historyRetentionDays: Math.max(1, parseInt(e.target.value) || 1) })}
          className="cortex-input text-sm w-20 font-mono disabled:opacity-40"
        />
      </SettingRow>
      <SettingRow
        label="Clear history now"
        description={`Permanently delete all ${conversationCount} conversation${conversationCount !== 1 ? "s" : ""}`}
      >
        <button
          onClick={() => {
            if (!confirmingClear) {
              setConfirmingClear(true);
              setTimeout(() => setConfirmingClear(false), 4000);
              return;
            }
            clearChatHistory();
            setConfirmingClear(false);
            toast("success", "History cleared", "All conversations were deleted.");
          }}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            confirmingClear
              ? "bg-cortex-error text-white border-cortex-error"
              : "text-cortex-error border-cortex-error/40 hover:bg-cortex-error/10",
          )}
        >
          {confirmingClear ? "Click again to confirm" : "Clear history"}
        </button>
      </SettingRow>
    </div>
  );
}

function AdvancedSettings({ settings, onChange }: {
  settings: ReturnType<typeof useSettingsStore.getState>["settings"]["advanced"];
  onChange: (v: Partial<typeof settings>) => void;
}) {
  return (
    <div>
      <div className="p-3 rounded-lg bg-cortex-warning/5 border border-cortex-warning/20 mb-4">
        <p className="text-xs text-cortex-warning">
          Changes here may affect stability. Restart required for some options.
        </p>
      </div>
      <SettingRow label="Debug mode" description="Enable verbose logging">
        <Toggle checked={settings.debugMode} onChange={(v) => onChange({ debugMode: v })} />
      </SettingRow>
      <SettingRow label="Log level" description="Minimum severity to log">
        <select
          value={settings.logLevel}
          onChange={(e) => onChange({ logLevel: e.target.value as typeof settings.logLevel })}
          className="cortex-input text-sm font-mono"
        >
          {["error", "warn", "info", "debug"].map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="Embedding service port" description="Port for the Python embeddings service">
        <input
          type="number"
          value={settings.embeddingServicePort}
          onChange={(e) => onChange({ embeddingServicePort: parseInt(e.target.value) })}
          className="cortex-input text-sm w-20 font-mono"
        />
      </SettingRow>
      <SettingRow label="Whisper service port" description="Port for the Python Whisper service">
        <input
          type="number"
          value={settings.whisperServicePort}
          onChange={(e) => onChange({ whisperServicePort: parseInt(e.target.value) })}
          className="cortex-input text-sm w-20 font-mono"
        />
      </SettingRow>
    </div>
  );
}

function StatsSection() {
  const { totalMessages, totalTokens, totalWords, modelUsage, personaUsage, firstUsed, reset } =
    useStatsStore();
  const totalConversations = useChatStore((s) => s.conversations.length);
  const { toast } = useUIStore();
  const [confirmReset, setConfirmReset] = useState(false);

  const topModels = Object.entries(modelUsage).sort((a, b) => b[1] - a[1]);
  const topPersonas = Object.entries(personaUsage).sort((a, b) => b[1] - a[1]);
  const maxModel = topModels[0]?.[1] ?? 1;
  const maxPersona = topPersonas[0]?.[1] ?? 1;

  const sinceText = firstUsed
    ? new Date(firstUsed).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "No activity yet";

  const handleExport = async () => {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const lines = [
      "# Cortex Stats Report",
      `*Generated: ${new Date().toLocaleString()}*`,
      "",
      "## Summary",
      `- Conversations: ${totalConversations}`,
      `- Messages Sent: ${totalMessages}`,
      `- Tokens Generated: ${totalTokens.toLocaleString()}`,
      `- Words Generated: ${totalWords.toLocaleString()}`,
      `- Using Cortex since: ${sinceText}`,
      "",
    ];
    if (topModels.length > 0) {
      lines.push("## Model Usage", "| Model | Responses |", "|-------|-----------|");
      topModels.forEach(([m, c]) => lines.push(`| \`${m}\` | ${c} |`));
      lines.push("");
    }
    if (topPersonas.length > 0) {
      lines.push("## Persona Usage", "| Persona | Uses |", "|---------|------|");
      topPersonas.forEach(([id, c]) => {
        const p = findPersona(id);
        lines.push(`| ${p ? `${p.emoji} ${p.name}` : id} | ${c} |`);
      });
      lines.push("");
    }
    try {
      const path = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: `cortex-stats-${new Date().toISOString().slice(0, 10)}.md`,
      });
      if (path) {
        await writeTextFile(path, lines.join("\n"));
        toast("success", "Stats exported", path);
      }
    } catch {
      toast("error", "Export failed", "Could not save the file");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Conversations", value: totalConversations.toLocaleString() },
          { label: "Messages Sent", value: totalMessages.toLocaleString() },
          { label: "Tokens Generated", value: totalTokens > 999 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens.toString() },
          { label: "Words Generated", value: totalWords > 999 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords.toString() },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl bg-cortex-surface-2 border border-cortex-border">
            <p className="text-2xs text-cortex-text-muted uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-cortex-text mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {topModels.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-cortex-text mb-3">Model Usage</p>
          <div className="space-y-2">
            {topModels.map(([model, count]) => (
              <div key={model}>
                <div className="flex justify-between text-2xs text-cortex-text-muted mb-1">
                  <span className="font-mono truncate max-w-[70%]">{model}</span>
                  <span>{count} responses</span>
                </div>
                <div className="h-1.5 rounded-full bg-cortex-surface-3 overflow-hidden">
                  <div className="h-full rounded-full bg-cortex-accent transition-all" style={{ width: `${(count / maxModel) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topPersonas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-cortex-text mb-3">Persona Usage</p>
          <div className="space-y-2">
            {topPersonas.map(([personaId, count]) => {
              const persona = findPersona(personaId);
              return (
                <div key={personaId}>
                  <div className="flex justify-between text-2xs text-cortex-text-muted mb-1">
                    <span>{persona ? `${persona.emoji} ${persona.name}` : personaId}</span>
                    <span>{count} uses</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-cortex-surface-3 overflow-hidden">
                    <div className="h-full rounded-full bg-cortex-success transition-all" style={{ width: `${(count / maxPersona) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalMessages === 0 && (
        <div className="py-8 text-center text-cortex-text-dim">
          <BarChart2 size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No activity tracked yet.</p>
          <p className="text-xs mt-1 opacity-70">Stats update as you use the app.</p>
        </div>
      )}

      <div className="space-y-3 pt-2 border-t border-cortex-border">
        <p className="text-2xs text-cortex-text-dim">Using Cortex since {sinceText}</p>
        <div className="flex gap-2">
          <button
            onClick={() => void handleExport()}
            disabled={totalMessages === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-cortex-surface-3 border border-cortex-border text-cortex-text-muted hover:text-cortex-text hover:border-cortex-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={12} />
            Export as Markdown
          </button>

          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={totalMessages === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-cortex-surface-3 border border-cortex-border text-cortex-text-muted hover:text-cortex-error hover:border-cortex-error/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw size={12} />
              Reset stats
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-cortex-text-muted">Are you sure?</span>
              <button
                onClick={() => { reset(); setConfirmReset(false); toast("info", "Stats reset to zero"); }}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-cortex-error/20 text-cortex-error border border-cortex-error/30 hover:bg-cortex-error/30 transition-colors"
              >
                Yes, reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-cortex-surface-3 text-cortex-text-muted hover:text-cortex-text transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
