import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, Sparkles, FileText, Code2, Search as SearchIcon, Download, ChevronDown } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ModelSelector } from "@/components/models/ModelSelector";
import { useChat } from "@/hooks/useChat";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { usePersonaStore } from "@/stores/personaStore";
import { PERSONAS } from "@/data/personas";
import type { Persona } from "@/data/personas";
import { cn } from "@/utils/cn";

const SUGGESTIONS = [
  { icon: <Sparkles size={14} />, label: "Explain a concept", prompt: "Explain quantum computing in simple terms" },
  { icon: <Code2 size={14} />, label: "Write code", prompt: "Write a Python script that monitors system resources" },
  { icon: <FileText size={14} />, label: "Summarize text", prompt: "Summarize the following text for me:" },
  { icon: <SearchIcon size={14} />, label: "Research a topic", prompt: "What are the latest advances in local AI models?" },
];

export function ChatRoute() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const { activeConversation, loadConversation, createConversation, conversations } = useChatStore();
  const { activeModelId } = useModelStore();
  const { settings } = useSettingsStore();
  const { toast } = useUIStore();
  const { sendMessage, stopGeneration, regenerate, editAndResend, isGenerating } = useChat();
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const activePersona = PERSONAS.find((p) => p.id === activePersonaId) ?? null;

  // Load conversation by ID from persisted store
  useEffect(() => {
    if (!id) return;
    if (activeConversation?.id === id) return;
    const loaded = loadConversation(id);
    if (!loaded) {
      const found = conversations.find((c) => c.id === id);
      if (!found) navigate("/chat");
    }
  }, [id]);

  // Pre-fill input from Code tab navigation
  useEffect(() => {
    const state = location.state as { initialPrompt?: string } | null;
    if (state?.initialPrompt) {
      setInputValue(state.initialPrompt);
      window.history.replaceState({}, ""); // clear state so it doesn't re-apply
    }
  }, [location.state]);

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
  }, [activeConversation?.messages.length]);

  // Follow streaming content without queuing overlapping animations
  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  const handleExport = async () => {
    if (!activeConversation) return;
    const lines = [
      `# ${activeConversation.title}`,
      `*Model: ${activeConversation.modelId} · Exported: ${new Date().toLocaleString()}*`,
      "",
    ];
    for (const msg of activeConversation.messages) {
      if (msg.status !== "complete") continue;
      lines.push(`## ${msg.role === "user" ? "You" : "Cortex"}\n\n${msg.content}\n`);
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
      const conv = createConversation(activeModelId);
      navigate(`/chat/${conv.id}`);
    }
    await sendMessage(message, ragEnabled);
  }, [activeConversation, activeModelId, createConversation, navigate, sendMessage, ragEnabled]);

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
                  onRegenerate={() => void regenerate(ragEnabled)}
                  onQuickAction={(prompt) => void handleSend(prompt)}
                  onEdit={(id, newContent) => void editAndResend(id, newContent, ragEnabled)}
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
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cortex-surface-2 border border-cortex-border shadow-lg text-xs text-cortex-text-muted hover:text-cortex-text hover:border-cortex-accent/40 transition-colors z-10"
            >
              <ChevronDown size={13} />
              Scroll to bottom
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
          onToggleRag={() => setRagEnabled((v) => !v)}
          initialValue={inputValue}
          onInputChange={setInputValue}
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

      {/* Suggestions */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
        {SUGGESTIONS.map((s) => (
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
              {s.icon}
            </span>
            <div>
              <p className="text-xs font-medium text-cortex-text">{s.label}</p>
              <p className="text-2xs text-cortex-text-dim mt-0.5 line-clamp-1">{s.prompt}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="text-2xs text-cortex-text-dim text-center max-w-sm">
        All conversations are stored locally on your device.
        Nothing is sent to any cloud service.
      </p>
    </div>
  );
}
