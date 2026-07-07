import { useMemo } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { estimateContextUsage, toHistoryPayloads } from "@/services/context";
import { cn } from "@/utils/cn";

/**
 * Thin bar showing how full the model's context window is, so users see
 * *why* old messages stop being answered from — history is trimmed once
 * this hits 100% (same math as buildChatMessages).
 */
export function ContextMeter() {
  const conversation = useChatStore((s) => s.activeConversation);
  const numCtx = useSettingsStore((s) => s.settings.models.defaultContextLength ?? 4096);

  const usage = useMemo(() => {
    if (!conversation || conversation.messages.length === 0) return null;
    return estimateContextUsage({
      systemContent: conversation.systemPrompt ?? "",
      history: toHistoryPayloads(conversation.messages),
      numCtx,
    });
  }, [conversation, numCtx]);

  if (!usage) return null;

  const trimming = usage.fraction >= 1;
  const label = `${formatTokens(usage.usedTokens)} / ${formatTokens(usage.budgetTokens)}`;

  return (
    <div
      className="flex items-center gap-1.5"
      title={
        trimming
          ? `Context window full (~${label} tokens) — the oldest messages are no longer sent. Increase the context length in Settings → Models to keep more.`
          : `~${label} tokens of the model's context window used (estimate)`
      }
    >
      <div className="resource-bar w-12">
        <div
          className={cn(
            "resource-bar-fill",
            trimming
              ? "bg-cortex-error"
              : usage.fraction > 0.75
                ? "bg-cortex-warning"
                : "bg-cortex-accent/60",
          )}
          style={{ width: `${Math.min(100, usage.fraction * 100)}%` }}
        />
      </div>
      <span
        className={cn(
          "text-2xs font-mono tabular-nums",
          trimming ? "text-cortex-error" : "text-cortex-text-dim",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function formatTokens(tokens: number): string {
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`;
}
