import { memo, useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Bot, User, AlertCircle, Brain, ChevronDown, ChevronUp, Cpu, RotateCcw, AlignLeft, Lightbulb, ArrowRight, StickyNote, Pencil, Square, Volume2, X, Wrench } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Message } from "@/types/chat";
import { useNotesStore } from "@/stores/notesStore";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useIsLightTheme } from "@/hooks/useTheme";
import { splitThinking, formatThinkingDuration } from "@/services/thinking";
import { toggleReadAloud, isTtsSupported } from "@/services/tts";
import { cn } from "@/utils/cn";
import { formatAbsoluteTime } from "@/utils/format";

interface ChatMessageProps {
  message: Message;
  showTimestamp?: boolean;
  isLast?: boolean;
  onRegenerate?: () => void;
  onRegenerateWith?: (modelId: string) => void;
  onQuickAction?: (prompt: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  showTimestamp = false,
  isLast = false,
  onRegenerate,
  onRegenerateWith,
  onQuickAction,
  onEdit,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isError = message.status === "error";
  const compact = useSettingsStore((s) => s.settings.appearance.compactMode ?? false);
  const showTokenCount = useSettingsStore((s) => s.settings.appearance.showTokenCount ?? false);
  // Reasoning models wrap chain-of-thought in <think>…</think> — split it
  // out so it renders as a collapsible block instead of answer text.
  const { thinking, answer, thinkingOpen } = isUser
    ? { thinking: null, answer: message.content, thinkingOpen: false }
    : splitThinking(message.content);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setEditValue(message.content);
      setTimeout(() => {
        const el = editRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }
      }, 0);
    }
  }, [editing, message.content]);

  const saveEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit?.(message.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group flex hover:bg-cortex-surface-2/30 transition-colors msg-auto-render",
        compact ? "gap-2.5 px-3 py-2" : "gap-3 px-4 py-4",
        isUser && "flex-row-reverse",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center",
          isUser
            ? "bg-cortex-user-border text-white"
            : "bg-cortex-surface-3 border border-cortex-border text-cortex-accent",
        )}
      >
        {isUser ? <User size={14} /> : isError ? <AlertCircle size={14} className="text-cortex-error" /> : <Bot size={14} />}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1 min-w-0 max-w-[85%]", isUser && "items-end")}>
        {/* Label */}
        <div className={cn("flex items-center gap-2", isUser && "flex-row-reverse")}>
          <span className="text-xs font-medium text-cortex-text-muted">
            {isUser ? "You" : "Cortex"}
          </span>
          {message.modelId && !isUser && (
            <span className="text-2xs font-mono text-cortex-text-dim bg-cortex-surface-3 px-1.5 py-0.5 rounded">
              {message.modelId}
            </span>
          )}
          {isStreaming && !isUser && <LiveTps />}
          {showTimestamp && (
            <span className="text-2xs text-cortex-text-dim opacity-0 group-hover:opacity-100 transition-opacity">
              {formatAbsoluteTime(message.createdAt)}
            </span>
          )}
        </div>

        {/* Message bubble */}
        <div
          className={cn(
            "relative rounded-xl text-sm selectable",
            compact ? "px-3 py-1.5" : "px-4 py-3",
            isUser
              ? "bg-cortex-user-bg border border-cortex-user-border text-cortex-text"
              : "bg-transparent text-cortex-text",
            isError && "bg-cortex-error/10 border border-cortex-error/30",
          )}
        >
          {isUser ? (
            editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={editRef}
                  value={editValue}
                  onChange={(e) => {
                    setEditValue(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      saveEdit();
                    }
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="w-full bg-cortex-surface-2 border border-cortex-accent/40 rounded-lg px-3 py-2 text-sm text-cortex-text outline-none resize-none min-w-[280px]"
                />
                <div className="flex gap-1.5 justify-end">
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs text-cortex-text-muted hover:text-cortex-text hover:bg-cortex-surface-3 transition-colors"
                  >
                    <X size={11} />
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs bg-cortex-accent text-white hover:bg-cortex-accent/90 transition-colors"
                  >
                    <ArrowRight size={11} />
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )
          ) : (
            <div className={cn("prose-cortex", isStreaming && !message.content && "min-h-[1.5rem]")}>
              {thinking !== null && (
                <ThinkingBlock
                  thinking={thinking}
                  isActive={thinkingOpen && isStreaming}
                  seconds={message.thinkingSeconds}
                />
              )}
              {answer ? (
                <MarkdownContent content={answer} />
              ) : isStreaming && thinking === null ? (
                <span className="inline-block w-2 h-4 bg-cortex-accent rounded-sm animate-blink" />
              ) : null}
              {isStreaming && answer && (
                <span className="inline-block w-2 h-4 bg-cortex-accent rounded-sm animate-blink ml-0.5 align-middle" />
              )}
            </div>
          )}

          {/* Copy + Edit buttons */}
          {!isStreaming && message.content && !editing && (
            <div className={cn(
              "absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
            )}>
              {isUser && onEdit && (
                <button
                  onClick={() => setEditing(true)}
                  className="p-1 rounded bg-cortex-surface-3 border border-cortex-border text-cortex-text-dim hover:text-cortex-text transition-colors"
                  title="Edit and resend"
                >
                  <Pencil size={11} />
                </button>
              )}
              <CopyButton text={isUser ? message.content : answer} />
            </div>
          )}
        </div>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallsBlock toolCalls={message.toolCalls} />
        )}

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <CitationsBlock citations={message.citations} />
        )}

        {/* Action row */}
        <div className="flex items-center gap-3 flex-wrap">
          {showTokenCount && !!message.tokenCount && !isStreaming && (
            <span className="text-2xs text-cortex-text-dim">
              {message.tokenCount.toLocaleString()} tokens
            </span>
          )}
          {showTokenCount && !!message.tokensPerSec && !isStreaming && (
            <span className="text-2xs text-cortex-text-dim">
              {message.tokensPerSec.toFixed(1)} tok/s
            </span>
          )}
          {!isUser && !isStreaming && !!answer && (
            <ReadAloudButton messageId={message.id} text={answer} />
          )}
          {!isUser && !isStreaming && message.content && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <QuickAction
                label="Summarize"
                icon={<AlignLeft size={11} />}
                onClick={() => onQuickAction?.("Summarize the above response in 2-3 concise sentences.")}
              />
              <QuickAction
                label="Explain simpler"
                icon={<Lightbulb size={11} />}
                onClick={() => onQuickAction?.("Explain the above in much simpler terms, as if explaining to a complete beginner.")}
              />
              <QuickAction
                label="Continue"
                icon={<ArrowRight size={11} />}
                onClick={() => onQuickAction?.("Continue from where you left off.")}
              />
              <QuickAction
                label="Save to note"
                icon={<StickyNote size={11} />}
                onClick={() => {
                  const { createNote, updateNote } = useNotesStore.getState();
                  const note = createNote();
                  const preview = answer.slice(0, 60).replace(/\n/g, " ");
                  updateNote(note.id, {
                    title: preview + (answer.length > 60 ? "…" : ""),
                    content: answer,
                  });
                  useUIStore.getState().toast("success", "Saved to Notes");
                }}
              />
            </div>
          )}
          {isLast && !isUser && !isStreaming && onRegenerate && (
            <RegenerateControl
              currentModelId={message.modelId}
              onRegenerate={onRegenerate}
              onRegenerateWith={onRegenerateWith}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
});

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node: _node, className, children, ...props }) {
          const isInline = !className;
          const match = /language-(\w+)/.exec(className ?? "");
          const lang = match?.[1] ?? "text";

          if (isInline) {
            return (
              <code className="bg-cortex-surface-3 text-cortex-accent px-1 py-0.5 rounded text-[0.85em] font-mono" {...props}>
                {children}
              </code>
            );
          }

          return (
            <CodeBlock lang={lang} code={String(children).replace(/\n$/, "")} />
          );
        },
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="mb-3 pl-5 list-disc space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 pl-5 list-decimal space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-cortex-text">{children}</li>,
        h1: ({ children }) => <h1 className="text-xl font-bold mb-3 text-cortex-text">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold mb-2 text-cortex-text">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mb-2 text-cortex-text">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-cortex-accent pl-4 text-cortex-text-muted italic my-3">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-cortex-border px-3 py-2 text-sm bg-cortex-surface-3 text-cortex-text font-medium text-left">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-cortex-border px-3 py-2 text-sm text-cortex-text">
            {children}
          </td>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cortex-accent hover:underline"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="border-cortex-border my-4" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/**
 * Collapsible chain-of-thought. Auto-expanded while the model is still
 * thinking, auto-collapses when the answer starts; a manual toggle wins
 * over both.
 */
function ThinkingBlock({
  thinking,
  isActive,
  seconds,
}: {
  thinking: string;
  isActive: boolean;
  seconds?: number;
}) {
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const expanded = userToggled ?? isActive;

  return (
    <div className="mb-3">
      <button
        onClick={() => setUserToggled(!expanded)}
        className={cn(
          "flex items-center gap-1.5 text-2xs transition-colors",
          isActive ? "text-cortex-accent" : "text-cortex-text-dim hover:text-cortex-text",
        )}
      >
        <Brain size={11} className={cn(isActive && "animate-pulse")} />
        <span className={cn(isActive && "animate-pulse")}>
          {isActive
            ? "Thinking…"
            : seconds
              ? `Thought for ${formatThinkingDuration(seconds)}`
              : "Thoughts"}
        </span>
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {expanded && thinking && (
        <div className="mt-2 pl-3 border-l-2 border-cortex-border text-xs leading-relaxed text-cortex-text-muted whitespace-pre-wrap break-words">
          {thinking}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const isLight = useIsLightTheme();

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-3 rounded-xl overflow-hidden border border-cortex-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-cortex-surface-3 border-b border-cortex-border">
        <span className="text-2xs font-mono text-cortex-text-dim">{lang}</span>
        <button
          onClick={() => void copy()}
          className="flex items-center gap-1 text-2xs text-cortex-text-dim hover:text-cortex-text transition-colors"
        >
          {copied ? (
            <><Check size={11} className="text-cortex-success" /> Copied</>
          ) : (
            <><Copy size={11} /> Copy</>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={lang}
        style={isLight ? oneLight : oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: isLight ? "#fafafa" : "#111113",
          fontSize: "0.8rem",
          lineHeight: "1.6",
        }}
        showLineNumbers={code.split("\n").length > 6}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={() => void copy()}
      className="p-1 rounded bg-cortex-surface-3 border border-cortex-border text-cortex-text-dim hover:text-cortex-text transition-colors"
    >
      {copied ? <Check size={11} className="text-cortex-success" /> : <Copy size={11} />}
    </button>
  );
}

/** Speaker toggle — only rendered when TTS is enabled in Settings → Voice. */
function ReadAloudButton({ messageId, text }: { messageId: string; text: string }) {
  const ttsEnabled = useSettingsStore((s) => s.settings.voice.ttsEnabled ?? false);
  const isSpeaking = useUIStore((s) => s.speakingMessageId === messageId);

  if (!ttsEnabled || !isTtsSupported()) return null;

  return (
    <button
      onClick={() => toggleReadAloud(messageId, text)}
      title={isSpeaking ? "Stop reading" : "Read aloud (local system voice)"}
      className={cn(
        "flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-md transition-all",
        isSpeaking
          ? "text-cortex-accent bg-cortex-accent/10 opacity-100"
          : "text-cortex-text-dim hover:text-cortex-accent hover:bg-cortex-surface-3 opacity-0 group-hover:opacity-100",
      )}
    >
      {isSpeaking ? <Square size={10} fill="currentColor" /> : <Volume2 size={11} />}
      {isSpeaking ? "Stop" : "Read aloud"}
    </button>
  );
}

/**
 * Regenerate, with a dropdown to re-answer using a different installed
 * model — the pick applies to this regeneration only and doesn't change
 * the app's active model.
 */
function RegenerateControl({
  currentModelId,
  onRegenerate,
  onRegenerateWith,
}: {
  currentModelId?: string;
  onRegenerate: () => void;
  onRegenerateWith?: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const models = useModelStore((s) => s.models);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const canPickModel = !!onRegenerateWith && models.length > 0;

  return (
    <div ref={ref} className={cn("relative flex items-center", !open && "opacity-0 group-hover:opacity-100")}>
      <button
        onClick={onRegenerate}
        className={cn(
          "flex items-center gap-1 text-2xs text-cortex-text-dim hover:text-cortex-accent transition-colors",
          canPickModel && "pr-0.5",
        )}
        title="Regenerate response"
      >
        <RotateCcw size={11} />
        Regenerate
      </button>
      {canPickModel && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-0.5 rounded text-cortex-text-dim hover:text-cortex-accent transition-colors"
          title="Regenerate with another model"
        >
          <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-0 mb-1 z-30 w-52 bg-cortex-surface-2 border border-cortex-border rounded-xl shadow-cortex-lg overflow-hidden"
          >
            <p className="px-3 pt-2 pb-1 text-2xs uppercase tracking-wider text-cortex-text-dim">
              Regenerate with
            </p>
            <div className="max-h-44 overflow-y-auto pb-1">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setOpen(false); onRegenerateWith?.(m.id); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors",
                    m.id === currentModelId
                      ? "text-cortex-accent bg-cortex-accent/10"
                      : "text-cortex-text hover:bg-cortex-surface-3",
                  )}
                >
                  <Cpu size={11} className="flex-shrink-0" />
                  <span className="font-mono truncate">{m.name}</span>
                  {m.id === currentModelId && (
                    <span className="ml-auto text-2xs text-cortex-text-dim shrink-0">current</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1 text-2xs text-cortex-text-dim hover:text-cortex-accent hover:bg-cortex-surface-3 px-1.5 py-0.5 rounded-md transition-colors"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function LiveTps() {
  const tps = useChatStore((s) => s.streamingTps);
  if (tps <= 0) return null;
  return (
    <span className="flex items-center gap-1 text-2xs font-mono text-cortex-accent" title="Generation speed">
      <span className="w-1 h-1 rounded-full bg-cortex-accent animate-pulse" />
      {tps.toFixed(1)} tok/s
    </span>
  );
}

function ToolCallsBlock({ toolCalls }: { toolCalls: NonNullable<Message["toolCalls"]> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-2xs text-cortex-text-dim hover:text-cortex-text transition-colors"
      >
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        <Wrench size={10} />
        {toolCalls.length} tool call{toolCalls.length !== 1 ? "s" : ""}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {toolCalls.map((call) => (
            <div
              key={call.id}
              className="p-2 rounded-lg bg-cortex-surface-3 border border-cortex-border"
            >
              <p className="text-2xs font-mono text-cortex-accent break-all">
                {call.name}({Object.keys(call.input).length ? JSON.stringify(call.input) : ""})
              </p>
              {call.output && (
                <p className="text-2xs text-cortex-text-muted mt-1 line-clamp-3 whitespace-pre-wrap">
                  {call.output}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CitationsBlock({ citations }: { citations: NonNullable<Message["citations"]> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-2xs text-cortex-text-dim hover:text-cortex-text transition-colors"
      >
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {citations.length} source{citations.length !== 1 ? "s" : ""}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {citations.map((c, i) => (
            <div
              key={i}
              className="flex gap-2 p-2 rounded-lg bg-cortex-surface-3 border border-cortex-border"
            >
              <span className="text-2xs text-cortex-text-dim font-mono mt-0.5">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-2xs font-medium text-cortex-accent truncate">{c.fileName}</p>
                <p className="text-2xs text-cortex-text-muted mt-0.5 line-clamp-2">{c.chunk}</p>
                <p className="text-2xs text-cortex-text-dim mt-0.5">
                  Score: {(c.score * 100).toFixed(0)}%
                  {c.page && ` · p.${c.page}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
