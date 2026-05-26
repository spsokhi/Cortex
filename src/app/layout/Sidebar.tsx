import { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  FolderOpen,
  FileText,
  Code2,
  StickyNote,
  Settings,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Pin,
  MoreHorizontal,
  Cpu,
  Trash2,
  Bot,
} from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { usePersonaStore } from "@/stores/personaStore";
import { PERSONAS } from "@/data/personas";
import { cn } from "@/utils/cn";
import { truncate, formatRelativeTime } from "@/utils/format";

type NavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
};

const NAV_ITEMS: NavItem[] = [
  { icon: MessageSquare, label: "Chat", path: "/chat" },
  { icon: FolderOpen, label: "Files", path: "/files" },
  { icon: FileText, label: "Documents", path: "/documents" },
  { icon: Code2, label: "Code", path: "/code" },
  { icon: StickyNote, label: "Notes", path: "/notes" },
];

export function Sidebar() {
  const { sidebarState, setSidebarTab, setSearchOpen } = useUIStore();
  const isExpanded = sidebarState === "expanded";
  const navigate = useNavigate();
  const location = useLocation();
  const [personasOpen, setPersonasOpen] = useState(true);

  const { conversations, activeConversationId, createConversation, deleteConversation } =
    useChatStore();
  const { activeModelId } = useModelStore();
  const { activePersonaId, setActivePersona } = usePersonaStore();
  const activePersona = PERSONAS.find((p) => p.id === activePersonaId) ?? null;

  const handleNewChat = useCallback(() => {
    const personaId = usePersonaStore.getState().activePersonaId;
    const persona = PERSONAS.find((p) => p.id === personaId);
    createConversation(activeModelId, undefined, persona?.systemPrompt);
    navigate("/chat");
  }, [createConversation, activeModelId, navigate]);

  const pinnedConversations = conversations.filter((c) => c.pinned);
  const recentConversations = conversations
    .filter((c) => !c.pinned)
    .slice(0, 20)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 240 : 52 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col h-full bg-cortex-surface border-r border-cortex-border flex-shrink-0 overflow-hidden"
    >
      {/* Nav icons */}
      <div className="flex flex-col gap-0.5 p-2 border-b border-cortex-border">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-lg text-cortex-text-muted",
            "hover:bg-cortex-surface-3 hover:text-cortex-text transition-all duration-150",
            !isExpanded && "justify-center",
          )}
          title="Search (Ctrl+K)"
        >
          <Search size={16} />
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                className="text-sm truncate"
              >
                Search
              </motion.span>
            )}
          </AnimatePresence>
          {isExpanded && (
            <span className="ml-auto text-2xs text-cortex-text-dim font-mono">⌘K</span>
          )}
        </button>

        {/* New Chat */}
        <button
          onClick={handleNewChat}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-lg",
            "bg-cortex-accent/10 text-cortex-accent border border-cortex-accent/20",
            "hover:bg-cortex-accent/20 transition-all duration-150",
            !isExpanded && "justify-center",
          )}
          title="New chat"
        >
          <Plus size={16} />
          {isExpanded && <span className="text-sm font-medium">New Chat</span>}
        </button>
      </div>

      {/* Navigation tabs */}
      <div className="flex flex-col gap-0.5 p-2 border-b border-cortex-border">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(item.path + "/");

          return (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setSidebarTab(item.path.slice(1) as never);
              }}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-lg transition-all duration-150",
                isActive
                  ? "bg-cortex-accent/15 text-cortex-accent"
                  : "text-cortex-text-muted hover:bg-cortex-surface-3 hover:text-cortex-text",
                !isExpanded && "justify-center",
              )}
              title={item.label}
            >
              <Icon size={16} />
              {isExpanded && (
                <span className="text-sm">{item.label}</span>
              )}
              {isExpanded && isActive && (
                <ChevronRight size={12} className="ml-auto opacity-60" />
              )}
            </button>
          );
        })}
      </div>

      {/* Persona picker — collapsed: emoji indicator, expanded: full list */}
      {!isExpanded ? (
        <div className="flex flex-col items-center py-1.5 border-b border-cortex-border">
          <button
            onClick={() => useUIStore.getState().toggleSidebar()}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-base",
              activePersona
                ? "bg-cortex-accent/10 text-cortex-accent"
                : "text-cortex-text-dim hover:bg-cortex-surface-3 hover:text-cortex-text-muted",
            )}
            title={activePersona ? `Persona: ${activePersona.name}` : "No persona active"}
          >
            {activePersona ? activePersona.emoji : <Bot size={15} />}
          </button>
        </div>
      ) : (
        <div className="border-b border-cortex-border flex-shrink-0">
          {/* Header row */}
          <button
            onClick={() => setPersonasOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-cortex-surface-3 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Bot size={11} className="text-cortex-text-dim" />
              <span className="text-2xs uppercase tracking-wider text-cortex-text-dim font-medium">
                Persona
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {activePersona && (
                <span className="text-2xs text-cortex-accent font-medium">
                  {activePersona.emoji} {activePersona.name}
                </span>
              )}
              <ChevronDown
                size={10}
                className={cn(
                  "text-cortex-text-dim transition-transform duration-200",
                  personasOpen && "rotate-180",
                )}
              />
            </div>
          </button>

          {/* Persona list */}
          <AnimatePresence initial={false}>
            {personasOpen && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-2 pb-2 space-y-0.5 max-h-56 overflow-y-auto no-scrollbar">
                  {/* None option */}
                  <button
                    onClick={() => setActivePersona(null)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors",
                      !activePersonaId
                        ? "bg-cortex-accent/10 text-cortex-accent"
                        : "text-cortex-text-muted hover:bg-cortex-surface-3 hover:text-cortex-text",
                    )}
                  >
                    <span className="text-sm w-5 text-center">🤖</span>
                    <div>
                      <p className="text-xs font-medium leading-tight">No Persona</p>
                      <p className="text-2xs text-cortex-text-dim leading-tight">Default AI behavior</p>
                    </div>
                  </button>

                  {PERSONAS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActivePersona(p.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors",
                        activePersonaId === p.id
                          ? "bg-cortex-accent/10 text-cortex-accent"
                          : "text-cortex-text-muted hover:bg-cortex-surface-3 hover:text-cortex-text",
                      )}
                    >
                      <span className="text-sm w-5 text-center">{p.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium leading-tight truncate">{p.name}</p>
                        <p className="text-2xs text-cortex-text-dim leading-tight truncate">{p.tagline}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Conversation history (only when expanded & on chat tab) */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-1 no-scrollbar">
          {pinnedConversations.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 py-1 text-2xs text-cortex-text-dim uppercase tracking-wider font-medium">
                <Pin size={10} />
                Pinned
              </div>
              {pinnedConversations.map((c) => (
                <ConversationItem
                  key={c.id}
                  id={c.id}
                  title={c.title}
                  lastMessage={c.lastMessage}
                  updatedAt={c.updatedAt}
                  isActive={activeConversationId === c.id}
                  pinned
                  onSelect={() => navigate(`/chat/${c.id}`)}
                  onDelete={() => deleteConversation(c.id)}
                />
              ))}
            </div>
          )}

          {recentConversations.length > 0 && (
            <div>
              <div className="px-2 py-1 text-2xs text-cortex-text-dim uppercase tracking-wider font-medium">
                Recent
              </div>
              {recentConversations.map((c) => (
                <ConversationItem
                  key={c.id}
                  id={c.id}
                  title={c.title}
                  lastMessage={c.lastMessage}
                  updatedAt={c.updatedAt}
                  isActive={activeConversationId === c.id}
                  onSelect={() => navigate(`/chat/${c.id}`)}
                  onDelete={() => deleteConversation(c.id)}
                />
              ))}
            </div>
          )}

          {conversations.length === 0 && (
            <div className="px-3 py-8 text-center text-cortex-text-dim text-xs">
              No conversations yet.
              <br />
              Start a new chat above.
            </div>
          )}
        </div>
      )}

      {/* Bottom settings */}
      <div className="flex flex-col gap-0.5 p-2 border-t border-cortex-border">
        <button
          onClick={() => navigate("/models")}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-lg text-cortex-text-muted",
            "hover:bg-cortex-surface-3 hover:text-cortex-text transition-all duration-150",
            !isExpanded && "justify-center",
          )}
          title="Models"
        >
          <Cpu size={16} />
          {isExpanded && <span className="text-sm">Models</span>}
        </button>
        <button
          onClick={() => navigate("/settings")}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-lg text-cortex-text-muted",
            "hover:bg-cortex-surface-3 hover:text-cortex-text transition-all duration-150",
            !isExpanded && "justify-center",
          )}
          title="Settings"
        >
          <Settings size={16} />
          {isExpanded && <span className="text-sm">Settings</span>}
        </button>
      </div>
    </motion.aside>
  );
}

interface ConversationItemProps {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: number;
  isActive: boolean;
  pinned?: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ConversationItem({
  title,
  lastMessage,
  updatedAt,
  isActive,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) { setConfirmDelete(false); return; }
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
        isActive ? "bg-cortex-accent/10" : "hover:bg-cortex-surface-3",
      )}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-medium truncate", isActive ? "text-cortex-accent" : "text-cortex-text")}>
          {truncate(title, 30)}
        </p>
        {lastMessage && (
          <p className="text-2xs text-cortex-text-dim truncate mt-0.5">{truncate(lastMessage, 38)}</p>
        )}
        <p className="text-2xs text-cortex-text-dim/60 mt-0.5">{formatRelativeTime(updatedAt)}</p>
      </div>

      {/* Three-dot menu trigger */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-cortex-surface-3 text-cortex-text-dim transition-all flex-shrink-0 mt-0.5"
        title="Options"
      >
        <MoreHorizontal size={12} />
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-7 z-50 w-40 bg-cortex-surface-2 border border-cortex-border rounded-xl shadow-cortex-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {!confirmDelete ? (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-cortex-error hover:bg-cortex-error/10 transition-colors"
              >
                <Trash2 size={12} />
                Delete chat
              </button>
            ) : (
              <div className="px-3 py-2 space-y-1.5">
                <p className="text-2xs text-cortex-text-muted">Delete this chat?</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}
                    className="flex-1 py-1 rounded-lg bg-cortex-error/20 text-cortex-error text-2xs font-medium hover:bg-cortex-error/30 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                    className="flex-1 py-1 rounded-lg bg-cortex-surface-3 text-cortex-text-muted text-2xs hover:bg-cortex-surface transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
