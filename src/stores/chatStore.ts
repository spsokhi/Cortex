import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Conversation, ConversationSummary, Message, MessageRole } from "@/types/chat";

interface ChatState {
  conversations: ConversationSummary[];
  savedConversations: Record<string, Conversation>; // persisted full conversations
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  isGenerating: boolean;
  streamingMessageId: string | null;

  // Actions
  createConversation: (modelId: string, title?: string, systemPrompt?: string) => Conversation;
  setActiveConversation: (id: string, conversation: Conversation) => void;
  loadConversation: (id: string) => Conversation | null;
  updateConversationTitle: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  pinConversation: (id: string, pinned: boolean) => void;
  addMessage: (conversationId: string, role: MessageRole, content: string) => Message;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  appendToMessage: (messageId: string, token: string) => void;
  setGenerating: (generating: boolean, streamingId?: string) => void;
  clearActiveConversation: () => void;
  updateConversationSummary: (conversation: Conversation) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
}

export const useChatStore = create<ChatState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        conversations: [],
        savedConversations: {},
        activeConversationId: null,
        activeConversation: null,
        isGenerating: false,
        streamingMessageId: null,

        createConversation: (modelId, title, systemPrompt) => {
          const now = Date.now();
          const conversation: Conversation = {
            id: nanoid(),
            title: title ?? "New conversation",
            modelId,
            systemPrompt,
            messages: [],
            tags: [],
            pinned: false,
            createdAt: now,
            updatedAt: now,
          };

          const summary: ConversationSummary = {
            id: conversation.id,
            title: conversation.title,
            modelId,
            pinned: false,
            tags: [],
            messageCount: 0,
            createdAt: now,
            updatedAt: now,
          };

          set((state) => ({
            conversations: [summary, ...state.conversations],
            activeConversationId: conversation.id,
            activeConversation: conversation,
          }));

          return conversation;
        },

        setActiveConversation: (id, conversation) => {
          set({ activeConversationId: id, activeConversation: conversation });
        },

        loadConversation: (id) => {
          const saved = get().savedConversations[id] ?? null;
          if (saved) set({ activeConversationId: id, activeConversation: saved });
          return saved;
        },

        updateConversationTitle: (id, title) => {
          const now = Date.now();
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, title, updatedAt: now } : c,
            ),
            activeConversation:
              state.activeConversation?.id === id
                ? { ...state.activeConversation, title, updatedAt: now }
                : state.activeConversation,
            savedConversations: state.savedConversations[id]
              ? { ...state.savedConversations, [id]: { ...state.savedConversations[id], title, updatedAt: now } }
              : state.savedConversations,
          }));
        },

        deleteConversation: (id) => {
          set((state) => ({
            conversations: state.conversations.filter((c) => c.id !== id),
            activeConversationId:
              state.activeConversationId === id ? null : state.activeConversationId,
            activeConversation:
              state.activeConversation?.id === id ? null : state.activeConversation,
          }));
        },

        pinConversation: (id, pinned) => {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, pinned } : c,
            ),
          }));
        },

        addMessage: (conversationId, role, content) => {
          const now = Date.now();
          const message: Message = {
            id: nanoid(),
            conversationId,
            role,
            content,
            status: "complete",
            createdAt: now,
            updatedAt: now,
          };

          set((state) => {
            if (state.activeConversation?.id !== conversationId) return state;
            const messages = [...state.activeConversation.messages, message];
            const updated: Conversation = { ...state.activeConversation, messages, updatedAt: now };
            return { activeConversation: updated };
          });

          return message;
        },

        updateMessage: (messageId, updates) => {
          set((state) => {
            if (!state.activeConversation) return state;
            const messages = state.activeConversation.messages.map((m) =>
              m.id === messageId ? { ...m, ...updates, updatedAt: Date.now() } : m,
            );
            return { activeConversation: { ...state.activeConversation, messages } };
          });
        },

        removeMessage: (messageId) =>
          set((state) => {
            if (!state.activeConversation) return state;
            const messages = state.activeConversation.messages.filter((m) => m.id !== messageId);
            return { activeConversation: { ...state.activeConversation, messages } };
          }),

        appendToMessage: (messageId, token) => {
          set((state) => {
            if (!state.activeConversation) return state;
            const messages = state.activeConversation.messages.map((m) =>
              m.id === messageId ? { ...m, content: m.content + token } : m,
            );
            return { activeConversation: { ...state.activeConversation, messages } };
          });
        },

        setGenerating: (generating, streamingId) => {
          set({ isGenerating: generating, streamingMessageId: streamingId ?? null });
        },

        clearActiveConversation: () => {
          set({ activeConversationId: null, activeConversation: null });
        },

        addTag: (id, tag) =>
          set((state) => {
            const add = (tags: string[]) => tags.includes(tag) ? tags : [...tags, tag];
            return {
              conversations: state.conversations.map((c) => c.id === id ? { ...c, tags: add(c.tags) } : c),
              activeConversation: state.activeConversation?.id === id
                ? { ...state.activeConversation, tags: add(state.activeConversation.tags) }
                : state.activeConversation,
              savedConversations: state.savedConversations[id]
                ? { ...state.savedConversations, [id]: { ...state.savedConversations[id], tags: add(state.savedConversations[id].tags) } }
                : state.savedConversations,
            };
          }),

        removeTag: (id, tag) =>
          set((state) => {
            const remove = (tags: string[]) => tags.filter((t) => t !== tag);
            return {
              conversations: state.conversations.map((c) => c.id === id ? { ...c, tags: remove(c.tags) } : c),
              activeConversation: state.activeConversation?.id === id
                ? { ...state.activeConversation, tags: remove(state.activeConversation.tags) }
                : state.activeConversation,
              savedConversations: state.savedConversations[id]
                ? { ...state.savedConversations, [id]: { ...state.savedConversations[id], tags: remove(state.savedConversations[id].tags) } }
                : state.savedConversations,
            };
          }),

        updateConversationSummary: (conversation) => {
          const lastMsg = conversation.messages.at(-1);
          const summary: ConversationSummary = {
            id: conversation.id,
            title: conversation.title,
            modelId: conversation.modelId,
            pinned: conversation.pinned,
            tags: conversation.tags,
            lastMessage: lastMsg?.content.slice(0, 80),
            messageCount: conversation.messages.length,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
          };
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === conversation.id ? summary : c,
            ),
            savedConversations: {
              ...state.savedConversations,
              [conversation.id]: conversation,
            },
          }));
        },
      }),
      {
        name: "cortex-chat-store",
        partialize: (state) => ({
          conversations: state.conversations,
          savedConversations: state.savedConversations,
        }),
      },
    ),
  ),
);
