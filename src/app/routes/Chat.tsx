import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, Sparkles, FileText, Code2, Search as SearchIcon, Download, ChevronDown, ChevronUp, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ContextMeter } from "@/components/chat/ContextMeter";
import { ModelSelector } from "@/components/models/ModelSelector";
import { useChat } from "@/hooks/useChat";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { useFileStore } from "@/stores/fileStore";
import { usePersonaStore } from "@/stores/personaStore";
import { stripThinking } from "@/services/thinking";
import { stopSpeaking } from "@/services/tts";
import { addBrowserFile, isIndexableType } from "@/services/indexing";
import { getFileType } from "@/types/files";
import { PERSONAS } from "@/data/personas";
import type { Persona, PersonaSuggestion } from "@/data/personas";
import { cn } from "@/utils/cn";

const DEFAULT_SUGGESTIONS: PersonaSuggestion[] = [
  { label: "Explain a concept", prompt: "Explain quantum computing in simple terms" },
  { label: "Write code", prompt: "Write a Python script that monitors system resources" },
  { label: "Summarize text", prompt: "Summarize the following text for me:" },
  { label: "Research a topic", prompt: "What are the latest advances in local AI models?" },
];

const SUGGESTION_ICONS = [
  <Sparkles size={14} key="a" />,
  <Code2 size={14} key="b" />,
  <FileText size={14} key="c" />,
  <SearchIcon size={14} key="d" />,
];

export function ChatRoute() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  // In-chat find (Ctrl+F) — matches highlighted via the CSS Custom Highlight API
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [findCount, setFindCount] = useState(0);
  const findRangesRef = useRef<Range[]>([]);
  // Draft state for a not-yet-created conversation (welcome screen); once a
  // conversation exists these live on it so they survive switching chats.
  const [draftFlags, setDraftFlags] = useState({ rag: false, tools: false });
  const [draftContextFiles, setDraftContextFiles] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

  const {
    activeConversation,
    loadConversation,
    createConversation,
    setConversationFlags,
    addContextFiles,
    removeContextFile,
    conversations,
  } = useChatStore();
  const { activeModelId } = useModelStore();
  const { settings } = useSettingsStore();
  const { toast } = useUIStore();
  const files = useFileStore((s) => s.files);
  const { sendMessage, stopGeneration, regenerate, editAndResend, isGenerating } = useChat();
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const customPersonas = usePersonaStore((s) => s.customPersonas);
  const activePersona =
    PERSONAS.find((p) => p.id === activePersonaId) ??
    customPersonas.find((p) => p.id === activePersonaId) ??
    null;

  const ragEnabled = activeConversation ? (activeConversation.ragEnabled ?? false) : draftFlags.rag;
  const toolsEnabled = activeConversation ? (activeConversation.toolsEnabled ?? false) : draftFlags.tools;

  const toggleRag = useCallback(() => {
    const conv = useChatStore.getState().activeConversation;
    if (conv) setConversationFlags(conv.id, { ragEnabled: !(conv.ragEnabled ?? false) });
    else setDraftFlags((f) => ({ ...f, rag: !f.rag }));
  }, [setConversationFlags]);

  const toggleTools = useCallback(() => {
    const conv = useChatStore.getState().activeConversation;
    if (conv) setConversationFlags(conv.id, { toolsEnabled: !(conv.toolsEnabled ?? false) });
    else setDraftFlags((f) => ({ ...f, tools: !f.tools }));
  }, [setConversationFlags]);

  // Attached documents scope RAG to just those files. Source of truth is the
  // conversation (or draft state before one exists); chips derive from the
  // file store so their indexing status stays live.
  const contextFileIds = activeConversation ? (activeConversation.contextFileIds ?? []) : draftContextFiles;
  const attachments = contextFileIds.flatMap((fileId) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return [];
    const status: "indexing" | "ready" | "error" =
      file.indexStatus === "indexed" ? "ready" :
      file.indexStatus === "error" || file.indexStatus === "skipped" ? "error" :
      "indexing";
    return [{ id: fileId, name: file.name, status }];
  });

  const handleAttach = useCallback(
    (fileList: FileList | null) => {
      const picked = Array.from(fileList ?? []);
      if (!picked.length) return;

      const newIds: string[] = [];
      for (const file of picked) {
        if (!isIndexableType(getFileType(file.name))) {
          toast("warning", "Can't attach this file", `${file.name} — attach text, Markdown, code, or a PDF.`);
          continue;
        }
        newIds.push(addBrowserFile(file).fileId);
      }
      if (!newIds.length) return;

      const conv = useChatStore.getState().activeConversation;
      if (conv) {
        addContextFiles(conv.id, newIds);
        if (!(conv.ragEnabled ?? false)) setConversationFlags(conv.id, { ragEnabled: true });
      } else {
        setDraftContextFiles((prev) => [...new Set([...prev, ...newIds])]);
        setDraftFlags((f) => ({ ...f, rag: true }));
      }
    },
    [toast, addContextFiles, setConversationFlags],
  );

  const handleRemoveAttachment = useCallback(
    (fileId: string) => {
      const conv = useChatStore.getState().activeConversation;
      if (conv) removeContextFile(conv.id, fileId);
      else setDraftContextFiles((prev) => prev.filter((id) => id !== fileId));
    },
    [removeContextFile],
  );

  // Load conversation by ID from persisted store. Also re-runs when the
  // conversation list changes so a chat deleted elsewhere navigates home.
  useEffect(() => {
    if (!id) return;
    if (activeConversation?.id === id) return;
    const loaded = loadConversation(id);
    if (!loaded) {
      const found = conversations.find((c) => c.id === id);
      if (!found) navigate("/chat");
    }
  }, [id, activeConversation?.id, conversations, loadConversation, navigate]);

  // Pre-fill input from Code tab navigation
  useEffect(() => {
    const state = location.state as { initialPrompt?: string } | null;
    if (state?.initialPrompt) {
      setInputValue(state.initialPrompt);
      window.history.replaceState({}, ""); // clear state so it doesn't re-apply
    }
  }, [location.state]);

  // Stop read-aloud when leaving or switching conversations
  useEffect(() => stopSpeaking, [activeConversation?.id]);

  // Ctrl+F opens in-chat find (overrides the webview's native find)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // New query starts from the first match
  useEffect(() => setFindIndex(0), [findQuery]);

  // Collect match ranges over the rendered messages and register highlights.
  // Runs post-render, so it sees the DOM the current messages produced.
  useEffect(() => {
    if (!("highlights" in CSS)) return;
    CSS.highlights.delete("chat-find");
    CSS.highlights.delete("chat-find-active");
    findRangesRef.current = [];

    const q = findQuery.trim().toLowerCase();
    const container = scrollContainerRef.current;
    if (!findOpen || !q || !container) {
      setFindCount(0);
      return;
    }

    const ranges: Range[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? "").toLowerCase();
      let idx = text.indexOf(q);
      while (idx !== -1) {
        const range = new Range();
        range.setStart(node, idx);
        range.setEnd(node, idx + q.length);
        ranges.push(range);
        idx = text.indexOf(q, idx + q.length);
      }
    }

    findRangesRef.current = ranges;
    setFindCount(ranges.length);
    setFindIndex((i) => (ranges.length ? Math.min(i, ranges.length - 1) : 0));
    if (ranges.length) CSS.highlights.set("chat-find", new Highlight(...ranges));
  }, [findOpen, findQuery, activeConversation?.messages]);

  // Emphasize + scroll to the active match (declared after the collector so it runs second)
  useEffect(() => {
    if (!("highlights" in CSS)) return;
    CSS.highlights.delete("chat-find-active");
    const range = findRangesRef.current[findIndex];
    if (!findOpen || !range) return;
    CSS.highlights.set("chat-find-active", new Highlight(range));
    range.startContainer.parentElement?.scrollIntoView({ block: "center" });
  }, [findOpen, findIndex, findCount, findQuery]);

  // Drop highlight registrations when the route unmounts
  useEffect(() => () => {
    if ("highlights" in CSS) {
      CSS.highlights.delete("chat-find");
      CSS.highlights.delete("chat-find-active");
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (userScrolledUpRef.current) return;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = scrollContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 80;
    userScrolledUpRef.current = scrolledUp;
    setShowScrollBtn(scrolledUp);
  }, []);

  const jumpToBottom = useCallback(() => {
    userScrolledUpRef.current = false;
    setShowScrollBtn(false);
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Force scroll when a new message is added
  useEffect(() => {
    userScrolledUpRef.current = false;
    scrollToBottom();
  }, [activeConversation?.messages.length, scrollToBottom]);

  // Follow streaming content without queuing overlapping animations
  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, scrollToBottom]);

  const handleExport = async () => {
    if (!activeConversation) return;
    const lines = [
      `# ${activeConversation.title}`,
      `*Model: ${activeConversation.modelId} · Exported: ${new Date().toLocaleString()}*`,
      "",
    ];
    for (const msg of activeConversation.messages) {
      if (msg.status !== "complete") continue;
      const content = msg.role === "assistant" ? stripThinking(msg.content) : msg.content;
      if (!content.trim()) continue;
      lines.push(`## ${msg.role === "user" ? "You" : "Cortex"}\n\n${content}\n`);
      lines.push("---\n");
    }
    try {
      const path = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: `${activeConversation.title.replace(/[^\w\s-]/g, "")}.md`,
      });
      if (path) {
        await writeTextFile(path, lines.join("\n"));
        toast("success", "Chat exported", path);
      }
    } catch {
      toast("error", "Export failed", "Could not save the file");
    }
  };

  const handleSend = useCallback(async (message: string) => {
    if (!activeConversation) {
      const conv = createConversation(activeModelId, undefined, activePersona?.systemPrompt);
      if (draftFlags.rag || draftFlags.tools) {
        setConversationFlags(conv.id, { ragEnabled: draftFlags.rag, toolsEnabled: draftFlags.tools });
      }
      if (draftContextFiles.length) addContextFiles(conv.id, draftContextFiles);
      setDraftContextFiles([]);
      setDraftFlags({ rag: false, tools: false });
      navigate(`/chat/${conv.id}`);
    }
    await sendMessage(message, ragEnabled, toolsEnabled);
  }, [activeConversation, activeModelId, activePersona, createConversation, setConversationFlags, addContextFiles, draftFlags, draftContextFiles, navigate, sendMessage, ragEnabled, toolsEnabled]);

  const messages = activeConversation?.messages ?? [];
  const isEmpty = messages.length === 0;

  return (
    <motion.div
      key="chat"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full bg-cortex-bg"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-cortex-border bg-cortex-surface/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-cortex-text truncate max-w-xs">
            {activeConversation?.title ?? "New conversation"}
          </h2>
          {activePersona && !activeConversation && (
            <span className="flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full bg-cortex-accent/10 text-cortex-accent border border-cortex-accent/20 flex-shrink-0">
              {activePersona.emoji} {activePersona.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ContextMeter />
          {activeConversation && messages.length > 0 && (
            <button
              onClick={() => void handleExport()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-cortex-text-muted hover:text-cortex-text hover:bg-cortex-surface-3 transition-colors"
              title="Export chat as Markdown"
            >
              <Download size={13} />
              Export
            </button>
          )}
          <ModelSelector />
        </div>
      </div>

      {/* Messages area */}
      <div className="relative flex-1 min-h-0">
        {/* In-chat find bar */}
        {findOpen && (
          <div className="absolute top-3 right-4 z-20 flex items-center gap-1 pl-2.5 pr-1 py-1.5 rounded-xl bg-cortex-surface-2 border border-cortex-border shadow-cortex-lg">
            <SearchIcon size={12} className="text-cortex-text-dim flex-shrink-0" />
            <input
              autoFocus
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && findCount > 0) {
                  setFindIndex((i) => (e.shiftKey ? (i - 1 + findCount) % findCount : (i + 1) % findCount));
                }
                if (e.key === "Escape") setFindOpen(false);
              }}
              placeholder="Find in chat…"
              className="w-36 bg-transparent outline-none text-xs text-cortex-text placeholder-cortex-text-dim"
            />
            <span className="text-2xs font-mono tabular-nums text-cortex-text-dim px-1">
              {findCount ? `${findIndex + 1}/${findCount}` : "0/0"}
            </span>
            <button
              onClick={() => setFindIndex((i) => (i - 1 + findCount) % findCount)}
              disabled={!findCount}
              className="p-1 rounded text-cortex-text-dim hover:text-cortex-text disabled:opacity-40 transition-colors"
              title="Previous match (Shift+Enter)"
            >
              <ChevronUp size={12} />
            </button>
            <button
              onClick={() => setFindIndex((i) => (i + 1) % findCount)}
              disabled={!findCount}
              className="p-1 rounded text-cortex-text-dim hover:text-cortex-text disabled:opacity-40 transition-colors"
              title="Next match (Enter)"
            >
              <ChevronDown size={12} />
            </button>
            <button
              onClick={() => setFindOpen(false)}
              className="p-1 rounded text-cortex-text-dim hover:text-cortex-text transition-colors"
              title="Close (Esc)"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto"
        >
          {isEmpty ? (
            <WelcomeScreen
              onSuggestion={(prompt) => {
                setInputValue(prompt);
              }}
              activePersona={activePersona}
            />
          ) : (
            <div className="max-w-3xl mx-auto py-4">
              {messages.map((message, i) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  showTimestamp={settings.appearance.showTimestamps}
                  isLast={i === messages.length - 1}
                  onRegenerate={() => void regenerate(ragEnabled, toolsEnabled)}
                  onRegenerateWith={(modelId) => void regenerate(ragEnabled, toolsEnabled, modelId)}
                  onQuickAction={(prompt) => void handleSend(prompt)}
                  onEdit={(id, newContent) => void editAndResend(id, newContent, ragEnabled, toolsEnabled)}
                />
              ))}
              <div className="h-4" />
            </div>
          )}
        </div>

        {/* Scroll-to-bottom button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              onClick={jumpToBottom}
              className={cn(
                "absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cortex-surface-2 border shadow-lg text-xs transition-colors z-10",
                isGenerating
                  ? "border-cortex-accent/50 text-cortex-accent"
                  : "border-cortex-border text-cortex-text-muted hover:text-cortex-text hover:border-cortex-accent/40",
              )}
            >
              {isGenerating ? (
                <span className="w-1.5 h-1.5 rounded-full bg-cortex-accent animate-pulse" />
              ) : (
                <ChevronDown size={13} />
              )}
              {isGenerating ? "New content" : "Scroll to bottom"}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 max-w-3xl w-full mx-auto">
        <ChatInput
          onSend={(msg) => void handleSend(msg)}
          onStop={stopGeneration}
          isGenerating={isGenerating}
          ragEnabled={ragEnabled}
          onToggleRag={toggleRag}
          toolsEnabled={toolsEnabled}
          onToggleTools={toggleTools}
          initialValue={inputValue}
          onInputChange={setInputValue}
          attachments={attachments}
          onAttachFiles={handleAttach}
          onRemoveAttachment={handleRemoveAttachment}
        />
      </div>
    </motion.div>
  );
}

function WelcomeScreen({
  onSuggestion,
  activePersona,
}: {
  onSuggestion: (prompt: string) => void;
  activePersona: Persona | null;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 gap-8">
      {/* Logo mark */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {activePersona ? (
            <div className="w-16 h-16 rounded-2xl bg-cortex-accent/10 border border-cortex-accent/20 flex items-center justify-center text-4xl glow-accent">
              {activePersona.emoji}
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-cortex-accent/10 border border-cortex-accent/20 flex items-center justify-center glow-accent">
              <BrainCircuit size={32} className="text-cortex-accent" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cortex-success border-2 border-cortex-bg flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-cortex-bg" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-cortex-text tracking-tight">
            {activePersona ? activePersona.name : "Cortex"}
          </h1>
          <p className="text-sm text-cortex-text-muted mt-1">
            {activePersona ? activePersona.tagline : "Your private AI assistant — 100% local, zero cloud"}
          </p>
        </div>
      </div>

      {/* Suggestions — persona-specific when the active persona defines them */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
        {(activePersona?.suggestions?.length ? activePersona.suggestions : DEFAULT_SUGGESTIONS).map(
          (s, i) => (
            <button
              key={s.label}
              onClick={() => onSuggestion(s.prompt)}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-xl text-left",
                "bg-cortex-surface-2 border border-cortex-border",
                "hover:border-cortex-accent/30 hover:bg-cortex-surface-3",
                "transition-all duration-150 group",
              )}
            >
              <span className="text-cortex-text-muted group-hover:text-cortex-accent transition-colors mt-0.5">
                {SUGGESTION_ICONS[i % SUGGESTION_ICONS.length]}
              </span>
              <div>
                <p className="text-xs font-medium text-cortex-text">{s.label}</p>
                <p className="text-2xs text-cortex-text-dim mt-0.5 line-clamp-1">{s.prompt}</p>
              </div>
            </button>
          ),
        )}
      </div>

      <p className="text-2xs text-cortex-text-dim text-center max-w-sm">
        All conversations are stored locally on your device.
        Nothing is sent to any cloud service.
      </p>
    </div>
  );
}
