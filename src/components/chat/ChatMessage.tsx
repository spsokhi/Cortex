import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Bot, User, AlertCircle, ChevronDown, ChevronUp, RotateCcw, AlignLeft, Lightbulb, ArrowRight, StickyNote } from "lucide-react";
import { motion } from "framer-motion";
import type { Message } from "@/types/chat";
import { useNotesStore } from "@/stores/notesStore";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/utils/cn";
import { formatAbsoluteTime } from "@/utils/format";

interface ChatMessageProps {
  message: Message;
  showTimestamp?: boolean;
  isLast?: boolean;
  onRegenerate?: () => void;
  onQuickAction?: (prompt: string) => void;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  showTimestamp = false,
  isLast = false,
  onRegenerate,
  onQuickAction,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isError = message.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group flex gap-3 px-4 py-4 hover:bg-cortex-surface-2/30 transition-colors",
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
          {showTimestamp && (
            <span className="text-2xs text-cortex-text-dim opacity-0 group-hover:opacity-100 transition-opacity">
              {formatAbsoluteTime(message.createdAt)}
            </span>
          )}
        </div>

        {/* Message bubble */}
        <div
          className={cn(
            "relative rounded-xl px-4 py-3 text-sm selectable",
            isUser
              ? "bg-cortex-user-bg border border-cortex-user-border text-cortex-text"
              : "bg-transparent text-cortex-text",
            isError && "bg-cortex-error/10 border border-cortex-error/30",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className={cn("prose-cortex", isStreaming && !message.content && "min-h-[1.5rem]")}>
              {message.content ? (
                <MarkdownContent content={message.content} />
              ) : isStreaming ? (
                <span className="inline-block w-2 h-4 bg-cortex-accent rounded-sm animate-blink" />
              ) : null}
              {isStreaming && message.content && (
                <span className="inline-block w-2 h-4 bg-cortex-accent rounded-sm animate-blink ml-0.5 align-middle" />
              )}
            </div>
          )}

          {/* Copy button */}
          {!isStreaming && message.content && (
            <div className={cn(
              "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity",
            )}>
              <CopyButton text={message.content} />
            </div>
          )}
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <CitationsBlock citations={message.citations} />
        )}

        {/* Action row */}
        <div className="flex items-center gap-3 flex-wrap">
          {message.tokenCount && !isStreaming && (
            <span className="text-2xs text-cortex-text-dim">
              {message.tokenCount.toLocaleString()} tokens
            </span>
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
                  const preview = message.content.slice(0, 60).replace(/\n/g, " ");
                  updateNote(note.id, {
                    title: preview + (message.content.length > 60 ? "…" : ""),
                    content: message.content,
                  });
                  useUIStore.getState().toast("success", "Saved to Notes");
                }}
              />
            </div>
          )}
          {isLast && !isUser && !isStreaming && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 text-2xs text-cortex-text-dim hover:text-cortex-accent transition-colors opacity-0 group-hover:opacity-100"
              title="Regenerate response"
            >
              <RotateCcw size={11} />
              Regenerate
            </button>
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

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

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
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "#111113",
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
