import { useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useUIStore } from "@/stores/uiStore";
import { usePersonaStore, findPersona } from "@/stores/personaStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useStatsStore } from "@/stores/statsStore";
import { ollamaClient, type OllamaChatMessage } from "@/services/api/ollama";
import { retrieveRag, EMPTY_RAG } from "@/services/rag";
import { buildChatMessages, toHistoryPayloads, type ChatMessagePayload } from "@/services/context";
import { TOOL_DEFINITIONS, MAX_TOOL_ROUNDS, executeTool, parseInlineToolCalls } from "@/services/tools";
import type { StreamEvent, ToolCall } from "@/types/chat";
import type { UnlistenFn } from "@tauri-apps/api/event";

/** Generation options come from Settings → Models; fallbacks cover settings persisted by older versions. */
function generationOptions() {
  const models = useSettingsStore.getState().settings.models;
  return {
    temperature: models.defaultTemperature ?? 0.7,
    numCtx: models.defaultContextLength ?? 4096,
    topP: models.topP ?? 0.9,
    seed: models.seed ? models.seed : undefined,
    keepAlive: models.keepAlive === "always" ? -1 : (models.keepAlive ?? "10m"),
  };
}

// Conversations already warned (this session) that their history is being trimmed
const trimWarned = new Set<string>();

// Module-scoped: only one generation runs at a time, and global shortcuts
// (Esc-to-stop) need to abort it from outside the chat route's hook instance.
const activeAbort: { current: AbortController | null } = { current: null };

/** Abort the in-flight generation, if any. Safe to call from anywhere. */
export function stopActiveGeneration() {
  activeAbort.current?.abort();
}

export function useChat() {
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

  const { activeModelId } = useModelStore();
  const { toast } = useUIStore();

  /** Insert a streaming assistant placeholder into the active conversation. */
  const insertAssistantPlaceholder = useCallback(
    (conversationId: string, modelId: string = activeModelId) => {
      const id = nanoid();
      useChatStore.setState((state) => {
        if (!state.activeConversation) return state;
        return {
          activeConversation: {
            ...state.activeConversation,
            messages: [
              ...state.activeConversation.messages,
              {
                id,
                conversationId,
                role: "assistant" as const,
                content: "",
                status: "streaming" as const,
                modelId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          },
        };
      });
      setGenerating(true, id);
      return id;
    },
    [activeModelId, setGenerating],
  );

  /**
   * Stream a reply into the given assistant message, tracking tokens/sec.
   * With tools enabled, runs the tool loop: execute the model's tool calls
   * locally, feed results back, and continue until it answers in prose
   * (bounded by MAX_TOOL_ROUNDS). Handles abort and errors; returns the
   * final result, or null on failure/abort.
   */
  const runGeneration = useCallback(
    async (
      assistantMsgId: string,
      messages: ChatMessagePayload[],
      toolsEnabled = false,
      modelId: string = activeModelId,
    ) => {
      activeAbort.current = new AbortController();
      try {
        const { temperature, numCtx, topP, seed, keepAlive } = generationOptions();

        let firstTokenAt = 0;
        let streamedTokens = 0;
        let lastTpsWrite = 0;
        const setTps = useChatStore.getState().setStreamingTps;

        // Reasoning models open with <think>; time until </think> arrives
        // becomes the "Thought for Xs" label on the message.
        let streamText = "";
        let thinkPhase: "unknown" | "active" | "done" = "unknown";
        let thinkingSeconds: number | undefined;

        const onToken = (token: string) => {
          if (firstTokenAt === 0) firstTokenAt = performance.now();
          streamedTokens++;
          appendToMessage(assistantMsgId, token);
          if (thinkPhase !== "done") {
            streamText += token;
            if (thinkPhase === "unknown" && streamText.trimStart().length >= "<think>".length) {
              thinkPhase = streamText.trimStart().startsWith("<think>") ? "active" : "done";
            }
            if (thinkPhase === "active" && streamText.includes("</think>")) {
              thinkPhase = "done";
              thinkingSeconds = (performance.now() - firstTokenAt) / 1000;
            }
          }
          const now = performance.now();
          if (now - lastTpsWrite > 200) {
            lastTpsWrite = now;
            const secs = (now - firstTokenAt) / 1000;
            if (secs > 0) setTps(streamedTokens / secs);
          }
        };

        const convo: OllamaChatMessage[] = [...messages];
        const recordedCalls: ToolCall[] = [];
        let fullContent = "";
        let useTools = toolsEnabled;
        let result: Awaited<ReturnType<typeof ollamaClient.chatStream>> | null = null;

        let round = 0;
        while (round < MAX_TOOL_ROUNDS) {
          try {
            result = await ollamaClient.chatStream(
              modelId,
              convo,
              {
                temperature,
                numCtx,
                topP,
                seed,
                keepAlive,
                tools: useTools ? TOOL_DEFINITIONS : undefined,
                signal: activeAbort.current.signal,
              },
              onToken,
            );
          } catch (err) {
            // Model without tool support → warn once and answer normally
            if (useTools && err instanceof Error && /does not support tools/i.test(err.message)) {
              useTools = false;
              toast(
                "warning",
                "Tools unavailable",
                `${modelId} doesn't support tool calling — answering without tools.`,
              );
              continue;
            }
            throw err;
          }

          // Some Ollama/model combos emit the tool call as raw JSON content
          // instead of populating tool_calls — fall back to parsing it.
          const inlineCalls =
            useTools && !result.toolCalls.length ? parseInlineToolCalls(result.content) : [];
          const calls = result.toolCalls.length ? result.toolCalls : inlineCalls;

          // Inline-call JSON is model plumbing, not prose — keep it out of the answer
          if (!inlineCalls.length) fullContent += result.content;
          if (!useTools || !calls.length) break;
          round++;

          convo.push({
            role: "assistant",
            content: result.content,
            ...(result.toolCalls.length ? { tool_calls: result.toolCalls } : {}),
          });
          for (const call of calls) {
            const args = call.function.arguments ?? {};
            const output = await executeTool(call.function.name, args);
            recordedCalls.push({ id: nanoid(), name: call.function.name, input: args, output });
            convo.push({ role: "tool", tool_name: call.function.name, content: output });
          }
          // Reset the visible bubble to prose-only before the next round streams in
          updateMessage(assistantMsgId, { content: fullContent, toolCalls: [...recordedCalls] });
        }
        if (!result) return null;

        const elapsedSec = firstTokenAt ? (performance.now() - firstTokenAt) / 1000 : 0;
        const finalTokens = result.completionTokens || streamedTokens;
        const tps = elapsedSec > 0 ? finalTokens / elapsedSec : 0;

        updateMessage(assistantMsgId, {
          status: "complete",
          content: fullContent,
          tokenCount: result.completionTokens,
          tokensPerSec: tps > 0 ? Math.round(tps * 10) / 10 : undefined,
          ...(thinkingSeconds ? { thinkingSeconds: Math.round(thinkingSeconds * 10) / 10 } : {}),
          ...(recordedCalls.length ? { toolCalls: recordedCalls } : {}),
        });

        return { ...result, content: fullContent };
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          updateMessage(assistantMsgId, { status: "complete" });
        } else {
          const errorMsg = err instanceof Error ? err.message : "An unknown error occurred";
          updateMessage(assistantMsgId, { status: "error", content: `Error: ${errorMsg}` });
          toast("error", "Generation failed", errorMsg);
        }
        return null;
      } finally {
        setGenerating(false);
        useChatStore.getState().setStreamingTps(0);
        activeAbort.current = null;
      }
    },
    [activeModelId, appendToMessage, updateMessage, setGenerating, toast],
  );

  /** Fit history to the context window, warning once per conversation when trimming starts. */
  const fitToContext = useCallback(
    (
      conversationId: string,
      systemContent: string,
      history: ChatMessagePayload[],
      newUserContent?: string,
    ) => {
      const { numCtx } = generationOptions();
      const { messages, droppedCount } = buildChatMessages({
        systemContent,
        history,
        newUserContent,
        numCtx,
      });
      if (droppedCount > 0 && !trimWarned.has(conversationId)) {
        trimWarned.add(conversationId);
        toast(
          "info",
          "Long conversation trimmed",
          `The ${droppedCount} oldest message${droppedCount !== 1 ? "s" : ""} no longer fit the model's context window and are not sent. Increase the context length in Settings → Models to keep more.`,
        );
      }
      return messages;
    },
    [toast],
  );

  const sendMessage = useCallback(
    async (content: string, ragEnabled = false, toolsEnabled = false) => {
      if (!content.trim()) return;

      // Read directly from store to avoid stale closure — Chat.tsx may have already created one
      let conversation = useChatStore.getState().activeConversation;

      if (!conversation) {
        const personaId = usePersonaStore.getState().activePersonaId;
        const persona = findPersona(personaId);
        conversation = createConversation(activeModelId, undefined, persona?.systemPrompt);
      }

      const userMessage = addMessage(conversation.id, "user", content);
      if (!userMessage) return;

      const assistantMsgId = insertAssistantPlaceholder(conversation.id);

      const rag = ragEnabled ? await retrieveRag(content, conversation.contextFileIds) : EMPTY_RAG;
      if (ragEnabled) {
        if (rag.context) {
          toast("info", "RAG active", `Using ${rag.citations.length} passage${rag.citations.length !== 1 ? "s" : ""} from your documents.`);
          updateMessage(assistantMsgId, { citations: rag.citations });
        } else {
          toast("warning", "RAG: no context found", "No indexed files matched your query.");
        }
      }

      const systemContent = [conversation.systemPrompt, rag.context].filter(Boolean).join("\n\n");
      const history = toHistoryPayloads(conversation.messages);

      const messages = fitToContext(conversation.id, systemContent, history, content);
      const result = await runGeneration(assistantMsgId, messages, toolsEnabled);
      if (!result) return;

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
        const { keepAlive } = generationOptions();
        void ollamaClient.generateTitle(activeModelId, content, keepAlive).then((aiTitle) => {
          const title = aiTitle || content.slice(0, 50).trim();
          updateConversationTitle(convId, title);
        });
      }

      updateConversationSummary({
        ...conversation,
        messages: [
          ...conversation.messages,
          { ...userMessage, status: "complete" },
          {
            id: assistantMsgId,
            conversationId: conversation.id,
            role: "assistant",
            content: result.content,
            status: "complete",
            modelId: activeModelId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      });
    },
    [
      activeModelId,
      addMessage,
      insertAssistantPlaceholder,
      fitToContext,
      runGeneration,
      updateMessage,
      createConversation,
      updateConversationTitle,
      updateConversationSummary,
      toast,
    ],
  );

  const stopGeneration = useCallback(() => {
    stopActiveGeneration();
    unlistenRef.current?.();
  }, []);

  const editAndResend = useCallback(
    async (messageId: string, newContent: string, ragEnabled = false, toolsEnabled = false) => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv || useChatStore.getState().isGenerating) return;
      if (!newContent.trim()) return;

      useChatStore.getState().truncateMessages(messageId);
      await sendMessage(newContent, ragEnabled, toolsEnabled);
    },
    [sendMessage],
  );

  const regenerate = useCallback(
    async (ragEnabled = false, toolsEnabled = false, modelId?: string) => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv || useChatStore.getState().isGenerating) return;

      const msgs = conv.messages;
      const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
      const lastUser = [...msgs].reverse().find((m) => m.role === "user");
      if (!lastAssistant || !lastUser) return;

      removeMessage(lastAssistant.id);
      const newId = insertAssistantPlaceholder(conv.id, modelId);

      const rag = ragEnabled ? await retrieveRag(lastUser.content, conv.contextFileIds) : EMPTY_RAG;
      if (rag.citations.length) updateMessage(newId, { citations: rag.citations });

      const systemContent = [conv.systemPrompt, rag.context].filter(Boolean).join("\n\n");
      const history = toHistoryPayloads(msgs.filter((m) => m.id !== lastAssistant.id));

      const messages = fitToContext(conv.id, systemContent, history);
      await runGeneration(newId, messages, toolsEnabled, modelId);
    },
    [insertAssistantPlaceholder, fitToContext, runGeneration, removeMessage, updateMessage],
  );

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
