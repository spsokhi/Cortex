export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus = "pending" | "streaming" | "complete" | "error";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
}

export interface CitationSource {
  fileId: string;
  fileName: string;
  chunk: string;
  score: number;
  page?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  modelId?: string;
  tokenCount?: number;
  tokensPerSec?: number;
  toolCalls?: ToolCall[];
  citations?: CitationSource[];
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  modelId: string;
  systemPrompt?: string;
  messages: Message[];
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  modelId: string;
  pinned: boolean;
  tags: string[];
  lastMessage?: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChatRequest {
  conversationId: string;
  message: string;
  modelId: string;
  systemPrompt?: string;
  ragEnabled?: boolean;
  contextFileIds?: string[];
  temperature?: number;
  maxTokens?: number;
}

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "citations"; citations: CitationSource[] }
  | { type: "done"; tokenCount: number }
  | { type: "error"; message: string };
