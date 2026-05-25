import { Cpu, MemoryStick, Zap, Circle, Layers } from "lucide-react";
import { useSystem } from "@/hooks/useSystem";
import { useModelStore } from "@/stores/modelStore";
import { formatBytes } from "@/utils/format";
import { cn } from "@/utils/cn";

export function StatusBar() {
  const stats = useSystem();
  const { activeModelId, ollamaConnected } = useModelStore();

  const memPercent = stats.memoryTotal > 0
    ? (stats.memoryUsed / stats.memoryTotal) * 100
    : 0;

  const cpuColor =
    stats.cpuUsage > 80 ? "text-cortex-error" :
    stats.cpuUsage > 50 ? "text-cortex-warning" :
    "text-cortex-success";

  const memColor =
    memPercent > 85 ? "text-cortex-error" :
    memPercent > 60 ? "text-cortex-warning" :
    "text-cortex-text-muted";

  return (
    <div className="h-6 flex items-center justify-between px-3 bg-cortex-surface border-t border-cortex-border flex-shrink-0 select-none">
      {/* Left: System stats */}
      <div className="flex items-center gap-4">
        {/* Ollama status */}
        <div className="flex items-center gap-1.5">
          <Circle
            size={6}
            className={ollamaConnected ? "fill-cortex-success text-cortex-success" : "fill-cortex-error text-cortex-error"}
          />
          <span className="text-2xs text-cortex-text-dim font-mono">
            {ollamaConnected ? "Ollama" : "Offline"}
          </span>
        </div>

        {/* CPU */}
        <div className="flex items-center gap-1">
          <Cpu size={10} className={cpuColor} />
          <span className={cn("text-2xs font-mono tabular-nums", cpuColor)}>
            {stats.cpuUsage.toFixed(0)}%
          </span>
        </div>

        {/* RAM */}
        <div className="flex items-center gap-1">
          <MemoryStick size={10} className={memColor} />
          <span className={cn("text-2xs font-mono tabular-nums", memColor)}>
            {formatBytes(stats.memoryUsed)} / {formatBytes(stats.memoryTotal)}
          </span>
        </div>

        {/* VRAM */}
        {stats.vramTotal && stats.vramTotal > 0 && (
          <div className="flex items-center gap-1">
            <Layers size={10} className="text-cortex-info" />
            <span className="text-2xs font-mono tabular-nums text-cortex-info">
              {formatBytes(stats.vramUsed ?? 0)} VRAM
            </span>
          </div>
        )}

        {/* Tokens per second */}
        {stats.tokensThroughput && stats.tokensThroughput > 0 && (
          <div className="flex items-center gap-1">
            <Zap size={10} className="text-cortex-warning" />
            <span className="text-2xs font-mono tabular-nums text-cortex-warning">
              {stats.tokensThroughput.toFixed(1)} tok/s
            </span>
          </div>
        )}
      </div>

      {/* Right: Active model + credit */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-cortex-text-dim">Model:</span>
          <span className="text-2xs font-mono text-cortex-accent">{activeModelId}</span>
        </div>
        <span className="text-2xs text-cortex-text-dim opacity-60">
          Made in India ❤️ by Sukhi
        </span>
      </div>
    </div>
  );
}
