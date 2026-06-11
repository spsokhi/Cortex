import { useState } from "react";
import {
  Download, Trash2, RefreshCw, CheckCircle, Cpu,
  Search, Eye, Code2, Layers,
} from "lucide-react";
import { useModelStore } from "@/stores/modelStore";
import { useModels } from "@/hooks/useModels";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/utils/format";
import type { ModelInfo } from "@/types/models";

const POPULAR_MODELS = [
  { name: "llama3:8b", desc: "Meta's Llama 3 8B — fast & capable", size: "4.7 GB", tags: ["chat", "code"] },
  { name: "llama3:70b", desc: "Meta's Llama 3 70B — top-tier quality", size: "39 GB", tags: ["chat", "code"] },
  { name: "mistral:7b", desc: "Mistral 7B — excellent instruction following", size: "4.1 GB", tags: ["chat"] },
  { name: "codellama:13b", desc: "Code Llama 13B — specialized for code", size: "7.4 GB", tags: ["code"] },
  { name: "qwen2:7b", desc: "Qwen2 7B — multilingual powerhouse", size: "4.4 GB", tags: ["chat"] },
  { name: "deepseek-coder-v2", desc: "DeepSeek Coder V2 — cutting-edge code model", size: "8.9 GB", tags: ["code"] },
  { name: "phi3:mini", desc: "Microsoft Phi-3 Mini — tiny but mighty", size: "2.3 GB", tags: ["chat"] },
  { name: "nomic-embed-text", desc: "Nomic Embed — best-in-class embeddings", size: "274 MB", tags: ["embed"] },
  { name: "llava:7b", desc: "LLaVA 7B — vision + language understanding", size: "4.7 GB", tags: ["vision"] },
];

export function ModelManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"installed" | "browse">("installed");
  const [customModel, setCustomModel] = useState("");

  const { models, ollamaConnected, refreshModels } = useModels();
  const { activeModelId, setActiveModel, downloadQueue } = useModelStore();
  const { toast } = useUIStore();

  const filteredModels = searchQuery
    ? models.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : models;

  const filteredPopular = searchQuery
    ? POPULAR_MODELS.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.desc.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : POPULAR_MODELS;

  const handleDownload = async (modelName: string) => {
    toast("info", `Downloading ${modelName}`, "This may take several minutes…");
  };

  const handleDelete = async (modelId: string) => {
    toast("warning", `Deleted ${modelId}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
        <div>
          <h1 className="text-lg font-semibold text-cortex-text">Model Manager</h1>
          <p className="text-xs text-cortex-text-muted mt-0.5">
            {ollamaConnected
              ? `${models.length} model${models.length !== 1 ? "s" : ""} installed`
              : "Ollama not running"}
          </p>
        </div>
        <button
          onClick={() => void refreshModels()}
          className="cortex-button-icon"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Search + Tabs */}
      <div className="px-6 pt-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cortex-text-dim" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search models…"
            className="cortex-input w-full pl-9 py-2 text-sm"
          />
        </div>
        <div className="flex gap-1 bg-cortex-surface-3 rounded-lg p-1">
          {(["installed", "browse"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === tab
                  ? "bg-cortex-surface text-cortex-text shadow-sm"
                  : "text-cortex-text-muted hover:text-cortex-text",
              )}
            >
              {tab === "installed" ? "Installed" : "Browse"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {activeTab === "installed" ? (
          <>
            {!ollamaConnected && (
              <div className="rounded-xl border border-cortex-warning/30 bg-cortex-warning/5 p-4 text-sm text-cortex-warning">
                Ollama is not running. Start Ollama to manage models.
              </div>
            )}
            {filteredModels.length === 0 && ollamaConnected ? (
              <div className="text-center py-12 text-cortex-text-dim text-sm">
                <Cpu size={32} className="mx-auto mb-3 opacity-30" />
                No models installed yet.
                <br />
                Browse the model library to get started.
              </div>
            ) : (
              filteredModels.map((model) => (
                <InstalledModelCard
                  key={model.id}
                  model={model}
                  isActive={activeModelId === model.id}
                  onSelect={() => setActiveModel(model.id)}
                  onDelete={() => void handleDelete(model.id)}
                />
              ))
            )}
          </>
        ) : (
          <>
            {/* Custom model input */}
            <div className="flex gap-2">
              <input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="Custom model name (e.g. llama3:8b)"
                className="cortex-input flex-1 text-sm"
              />
              <button
                onClick={() => { void handleDownload(customModel); setCustomModel(""); }}
                disabled={!customModel.trim()}
                className="cortex-button-primary text-sm px-3 py-2 whitespace-nowrap disabled:opacity-50"
              >
                Pull
              </button>
            </div>

            {/* Download queue */}
            {downloadQueue.length > 0 && (
              <div className="space-y-2">
                {downloadQueue.map((q) => (
                  <div key={q.modelName} className="cortex-card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-cortex-text">{q.modelName}</span>
                      <span className="text-2xs text-cortex-text-muted">{q.status}</span>
                    </div>
                    {q.percent !== undefined && (
                      <div className="resource-bar">
                        <div
                          className="resource-bar-fill bg-cortex-accent"
                          style={{ width: `${q.percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Popular models */}
            <div className="space-y-2">
              {filteredPopular.map((m) => (
                <PopularModelCard
                  key={m.name}
                  name={m.name}
                  desc={m.desc}
                  size={m.size}
                  tags={m.tags}
                  installed={models.some((im) => im.id === m.name)}
                  onDownload={() => void handleDownload(m.name)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InstalledModelCard({
  model,
  isActive,
  onSelect,
  onDelete,
}: {
  model: ModelInfo;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
        isActive
          ? "bg-cortex-accent/10 border-cortex-accent/30"
          : "bg-cortex-surface-2 border-cortex-border hover:border-cortex-accent/20",
      )}
      onClick={onSelect}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isActive ? "bg-cortex-accent text-white" : "bg-cortex-surface-3 text-cortex-text-muted",
        )}
      >
        {model.capabilities.includes("vision") ? (
          <Eye size={14} />
        ) : model.capabilities.includes("code") ? (
          <Code2 size={14} />
        ) : model.capabilities.includes("embedding") ? (
          <Layers size={14} />
        ) : (
          <Cpu size={14} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-cortex-text truncate">{model.name}</span>
          {isActive && <CheckCircle size={12} className="text-cortex-success flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-2xs text-cortex-text-dim">{model.parameterSize}</span>
          {model.quantization && (
            <span className="text-2xs text-cortex-text-dim font-mono">{model.quantization}</span>
          )}
          <span className="text-2xs text-cortex-text-dim">{formatBytes(model.size)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg text-cortex-text-dim hover:text-cortex-error hover:bg-cortex-error/10 transition-colors"
          title="Delete model"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function PopularModelCard({
  name,
  desc,
  size,
  tags,
  installed,
  onDownload,
}: {
  name: string;
  desc: string;
  size: string;
  tags: string[];
  installed: boolean;
  onDownload: () => void;
}) {
  const TAG_COLORS: Record<string, string> = {
    chat: "text-cortex-accent bg-cortex-accent/10",
    code: "text-green-400 bg-green-400/10",
    vision: "text-purple-400 bg-purple-400/10",
    embed: "text-yellow-400 bg-yellow-400/10",
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-cortex-border bg-cortex-surface-2 hover:border-cortex-accent/20 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-mono text-cortex-text">{name}</span>
          {tags.map((t) => (
            <span
              key={t}
              className={cn("text-2xs px-1.5 py-0.5 rounded font-medium", TAG_COLORS[t] ?? "")}
            >
              {t}
            </span>
          ))}
        </div>
        <p className="text-xs text-cortex-text-muted mt-0.5">{desc}</p>
        <p className="text-2xs text-cortex-text-dim mt-1">{size}</p>
      </div>
      <button
        onClick={onDownload}
        disabled={installed}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0",
          installed
            ? "text-cortex-success bg-cortex-success/10 cursor-default"
            : "text-cortex-accent bg-cortex-accent/10 hover:bg-cortex-accent/20",
        )}
      >
        {installed ? (
          <><CheckCircle size={12} /> Installed</>
        ) : (
          <><Download size={12} /> Pull</>
        )}
      </button>
    </div>
  );
}
