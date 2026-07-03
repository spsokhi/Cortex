import { useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useUIStore } from "@/stores/uiStore";
import { usePersonaStore } from "@/stores/personaStore";
import { useStatsStore } from "@/stores/statsStore";
import { PERSONAS } from "@/data/personas";
import { ollamaClient } from "@/services/api/ollama";
import { retrieveRag, EMPTY_RAG } from "@/services/rag";
import type { StreamEvent } from "@/types/chat";
import type { UnlistenFn } from "@tauri-apps/api/event";

export function useChat() {
  const abortRef = useRef<AbortController | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const {
    addMessage,
    updateMessage,
    removeMessage,
    appendToMessage,
    setGenerating,
    createConversation,
    updateConversationTitle,
    updateConversationSummary,
  } = useChatStore();

  const { activeModelId, modelConfig } = useModelStore();
  const { toast } = useUIStore();

  const sendMessage = useCallback(
    async (content: string, ragEnabled = false) => {
      if (!content.trim()) return;

      // Read directly from store to avoid stale closure — Chat.tsx may have already created one
      let conversation = useChatStore.getState().activeConversation;

      if (!conversation) {
        const personaId = usePersonaStore.getState().activePersonaId;
        const persona = PERSONAS.find((p) => p.id === personaId);
        conversation = createConversation(activeModelId, undefined, persona?.systemPrompt);
      }

      // Add user message
      const userMessage = addMessage(conversation.id, "user", content);
      if (!userMessage) return;

      // Add placeholder assistant message
      const assistantMsgId = nanoid();
      const assistantMessage = {
        id: assistantMsgId,
        conversationId: conversation.id,
        role: "assistant" as const,
        content: "",
        status: "streaming" as const,
        modelId: activeModelId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Manually inject the assistant placeholder via store
      useChatStore.setState((state) => {
        if (!state.activeConversation) return state;
        return {
          activeConversation: {
            ...state.activeConversation,
            messages: [...state.activeConversation.messages, assistantMessage],
          },
        };
      });

      setGenerating(true, assistantMsgId);

      abortRef.current = new AbortController();

      try {
        const rag = ragEnabled ? await retrieveRag(content) : EMPTY_RAG;
        if (ragEnabled) {
          if (rag.context) {
            toast("info", "RAG active", `Using ${rag.citations.length} passage${rag.citations.length !== 1 ? "s" : ""} from your documents.`);
            updateMessage(assistantMsgId, { citations: rag.citations });
          } else {
            toast("warning", "RAG: no context found", "No indexed files matched your query.");
          }
        }
        const systemContent = [
          conversation.systemPrompt,
          rag.context,
        ].filter(Boolean).join("\n\n");

        const messages = [
          ...(systemContent ? [{ role: "system", content: systemContent }] : []),
          ...conversation.messages
            .filter((m) => m.status === "complete")
            .map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content },
        ];

        let firstTokenAt = 0;
        let streamedTokens = 0;
        let lastTpsWrite = 0;
        const setTps = useChatStore.getState().setStreamingTps;

        const result = await ollamaClient.chatStream(
          activeModelId,
          messages,
          {
            temperature: modelConfig.temperature,
            numCtx: modelConfig.numCtx,
            signal: abortRef.current.signal,
          },
          (token) => {
            if (firstTokenAt === 0) firstTokenAt = performance.now();
            streamedTokens++;
            appendToMessage(assistantMsgId, token);
            const now = performance.now();
            if (now - lastTpsWrite > 200) {
              lastTpsWrite = now;
              const secs = (now - firstTokenAt) / 1000;
              if (secs > 0) setTps(streamedTokens / secs);
            }
          },
        );

        const elapsedSec = firstTokenAt ? (performance.now() - firstTokenAt) / 1000 : 0;
        const finalTokens = result.completionTokens || streamedTokens;
        const tps = elapsedSec > 0 ? finalTokens / elapsedSec : 0;

        updateMessage(assistantMsgId, {
          status: "complete",
          content: result.content,
          tokenCount: result.completionTokens,
          tokensPerSec: tps > 0 ? Math.round(tps * 10) / 10 : undefined,
        });

        useStatsStore.getState().track({
          messages: 1,
          tokens: result.completionTokens ?? 0,
          words: result.content.trim().split(/\s+/).filter(Boolean).length,
          modelId: activeModelId,
          personaId: usePersonaStore.getState().activePersonaId,
        });

        // Auto-title after the first exchange — non-blocking AI call
        if (conversation.title === "New conversation" && conversation.messages.length === 0) {
          const convId = conversation.id;
          void ollamaClient.generateTitle(activeModelId, content).then((aiTitle) => {
            const title = aiTitle || content.slice(0, 50).trim();
            updateConversationTitle(convId, title);
          });
        }

        updateConversationSummary({
          ...conversation,
          messages: [
            ...conversation.messages,
            { ...userMessage, status: "complete" },
            { ...assistantMessage, content: result.content, status: "complete" },
          ],
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          updateMessage(assistantMsgId, { status: "complete" });
        } else {
          const errorMsg =
            err instanceof Error ? err.message : "An unknown error occurred";
          updateMessage(assistantMsgId, {
            status: "error",
            content: `Error: ${errorMsg}`,
          });
          toast("error", "Generation failed", errorMsg);
        }
      } finally {
        setGenerating(false);
        useChatStore.getState().setStreamingTps(0);
        abortRef.current = null;
      }
    },
    [
      activeModelId,
      modelConfig,
      addMessage,
      appendToMessage,
      updateMessage,
      setGenerating,
      createConversation,
      updateConversationTitle,
      updateConversationSummary,
      toast,
    ],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    unlistenRef.current?.();
  }, []);

  const editAndResend = useCallback(
    async (messageId: string, newContent: string, ragEnabled = false) => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv || useChatStore.getState().isGenerating) return;
      if (!newContent.trim()) return;

      useChatStore.getState().truncateMessages(messageId);
      await sendMessage(newContent, ragEnabled);
    },
    [sendMessage],
  );

  const regenerate = useCallback(async (ragEnabled = false) => {
    const conv = useChatStore.getState().activeConversation;
    if (!conv || useChatStore.getState().isGenerating) return;

    const msgs = conv.messages;
    const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    if (!lastAssistant || !lastUser) return;

    removeMessage(lastAssistant.id);

    const newId = nanoid();
    useChatStore.setState((state) => {
      if (!state.activeConversation) return state;
      return {
        activeConversation: {
          ...state.activeConversation,
          messages: [
            ...state.activeConversation.messages,
            {
              id: newId,
              conversationId: conv.id,
              role: "assistant" as const,
              content: "",
              status: "streaming" as const,
              modelId: activeModelId,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        },
      };
    });

    setGenerating(true, newId);
    abortRef.current = new AbortController();

    try {
      const rag = ragEnabled ? await retrieveRag(lastUser.content) : EMPTY_RAG;
      if (rag.citations.length) updateMessage(newId, { citations: rag.citations });
      const systemContent = [conv.systemPrompt, rag.context].filter(Boolean).join("\n\n");
      const history = msgs
        .filter((m) => m.id !== lastAssistant.id && m.status === "complete")
        .map((m) => ({ role: m.role, content: m.content }));

      let firstTokenAt = 0;
      let streamedTokens = 0;
      let lastTpsWrite = 0;
      const setTps = useChatStore.getState().setStreamingTps;

      const result = await ollamaClient.chatStream(
        activeModelId,
        [
          ...(systemContent ? [{ role: "system", content: systemContent }] : []),
          ...history,
        ],
        { temperature: modelConfig.temperature, numCtx: modelConfig.numCtx, signal: abortRef.current.signal },
        (token) => {
          if (firstTokenAt === 0) firstTokenAt = performance.now();
          streamedTokens++;
          appendToMessage(newId, token);
          const now = performance.now();
          if (now - lastTpsWrite > 200) {
            lastTpsWrite = now;
            const secs = (now - firstTokenAt) / 1000;
            if (secs > 0) setTps(streamedTokens / secs);
          }
        },
      );

      const elapsedSec = firstTokenAt ? (performance.now() - firstTokenAt) / 1000 : 0;
      const finalTokens = result.completionTokens || streamedTokens;
      const tps = elapsedSec > 0 ? finalTokens / elapsedSec : 0;

      updateMessage(newId, {
        status: "complete",
        content: result.content,
        tokenCount: result.completionTokens,
        tokensPerSec: tps > 0 ? Math.round(tps * 10) / 10 : undefined,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        updateMessage(newId, { status: "complete" });
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        updateMessage(newId, { status: "error", content: `Error: ${msg}` });
        toast("error", "Regeneration failed", msg);
      }
    } finally {
      setGenerating(false);
      useChatStore.getState().setStreamingTps(0);
      abortRef.current = null;
    }
  }, [activeModelId, modelConfig, removeMessage, appendToMessage, updateMessage, setGenerating, toast]);

  const handleStreamEvent = useCallback(
    (event: StreamEvent, messageId: string) => {
      switch (event.type) {
        case "token":
          appendToMessage(messageId, event.content);
          break;
        case "done":
          updateMessage(messageId, { status: "complete", tokenCount: event.tokenCount });
          setGenerating(false);
          break;
        case "error":
          updateMessage(messageId, { status: "error", content: `Error: ${event.message}` });
          setGenerating(false);
          toast("error", "Generation error", event.message);
          break;
        case "citations":
          updateMessage(messageId, { citations: event.citations });
          break;
      }
    },
    [appendToMessage, updateMessage, setGenerating, toast],
  );

  return {
    sendMessage,
    stopGeneration,
    regenerate,
    editAndResend,
    handleStreamEvent,
    isGenerating: useChatStore((s) => s.isGenerating),
  };
}
