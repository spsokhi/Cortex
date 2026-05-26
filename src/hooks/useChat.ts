import { useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useUIStore } from "@/stores/uiStore";
import { useFileStore } from "@/stores/fileStore";
import { usePersonaStore } from "@/stores/personaStore";
import { PERSONAS } from "@/data/personas";
import { ollamaClient } from "@/services/api/ollama";
import type { StreamEvent } from "@/types/chat";
import type { UnlistenFn } from "@tauri-apps/api/event";

function scoreChunk(chunk: string, query: string): number {
  const queryWords = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const chunkLower = chunk.toLowerCase();
  return queryWords.reduce((acc, w) => acc + (chunkLower.split(w).length - 1), 0);
}

function retrieveContext(query: string, topK = 5): string {
  const files = useFileStore.getState().files.filter(
    (f) => f.indexStatus === "indexed" && f.chunks?.length,
  );

  console.debug("[RAG] indexed files with chunks:", files.map(f => `${f.name}(${f.chunks?.length} chunks)`));

  if (!files.length) {
    console.debug("[RAG] no indexed files found");
    return "";
  }

  const scored: Array<{ chunk: string; score: number; name: string }> = [];
  for (const file of files) {
    for (const chunk of file.chunks ?? []) {
      scored.push({ chunk, score: scoreChunk(chunk, query), name: file.name });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK);

  console.debug("[RAG] top chunks scores:", top.map(s => s.score));

  return (
    "Use the following context from uploaded documents to answer the question. " +
    "Cite specific details from the context.\n\n" +
    top.map((s) => `[From: ${s.name}]\n${s.chunk}`).join("\n\n---\n\n") +
    "\n\n---\n\nAnswer based on the context above."
  );
}

export function useChat() {
  const abortRef = useRef<AbortController | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const {
    activeConversation,
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
        const ragContext = ragEnabled ? retrieveContext(content) : "";
        if (ragEnabled) {
          if (ragContext) toast("info", "RAG active", "Injecting document context into prompt.");
          else toast("warning", "RAG: no context found", "No indexed files matched your query.");
        }
        const systemContent = [
          conversation.systemPrompt,
          ragContext,
        ].filter(Boolean).join("\n\n");

        const messages = [
          ...(systemContent ? [{ role: "system", content: systemContent }] : []),
          ...conversation.messages
            .filter((m) => m.status === "complete")
            .map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content },
        ];

        const result = await ollamaClient.chatStream(
          activeModelId,
          messages,
          {
            temperature: modelConfig.temperature,
            numCtx: modelConfig.numCtx,
            signal: abortRef.current.signal,
          },
          (token) => appendToMessage(assistantMsgId, token),
        );

        updateMessage(assistantMsgId, {
          status: "complete",
          content: result.content,
          tokenCount: result.completionTokens,
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
        abortRef.current = null;
      }
    },
    [
      activeConversation,
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
      const ragContext = ragEnabled ? retrieveContext(lastUser.content) : "";
      const systemContent = [conv.systemPrompt, ragContext].filter(Boolean).join("\n\n");
      const history = msgs
        .filter((m) => m.id !== lastAssistant.id && m.status === "complete")
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await ollamaClient.chatStream(
        activeModelId,
        [
          ...(systemContent ? [{ role: "system", content: systemContent }] : []),
          ...history,
        ],
        { temperature: modelConfig.temperature, numCtx: modelConfig.numCtx, signal: abortRef.current.signal },
        (token) => appendToMessage(newId, token),
      );

      updateMessage(newId, { status: "complete", content: result.content, tokenCount: result.completionTokens });
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
    handleStreamEvent,
    isGenerating: useChatStore((s) => s.isGenerating),
  };
}
