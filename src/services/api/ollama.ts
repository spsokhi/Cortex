/**
 * Direct Ollama HTTP API client (used for health checks and when
 * the Tauri backend is bypassed for lightweight operations).
 */
import type { OllamaListResponse } from "@/types/models";

export interface OllamaChatMessage {
  role: string;
  content: string;
  /** Echoed back to the model between tool rounds */
  tool_calls?: unknown[];
  tool_name?: string;
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:11434") {
    this.baseUrl = baseUrl;
  }

  async isRunning(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { version: string };
      return data.version;
    } catch {
      return null;
    }
  }

  async listModels(): Promise<OllamaListResponse> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
    return res.json() as Promise<OllamaListResponse>;
  }

  /**
   * Streaming chat completion. Calls onToken for each token,
   * returns final accumulated content.
   */
  async chatStream(
    model: string,
    messages: OllamaChatMessage[],
    options: {
      temperature?: number;
      numCtx?: number;
      topP?: number;
      seed?: number;
      /** Duration string ("10m") or -1 to keep the model loaded indefinitely */
      keepAlive?: string | number;
      /** Tool definitions (OpenAI function format) the model may call */
      tools?: unknown[];
      signal?: AbortSignal;
    },
    onToken: (token: string) => void,
  ): Promise<{
    content: string;
    promptTokens: number;
    completionTokens: number;
    toolCalls: OllamaToolCall[];
  }> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: options.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        ...(options.keepAlive != null ? { keep_alive: options.keepAlive } : {}),
        ...(options.tools?.length ? { tools: options.tools } : {}),
        options: {
          temperature: options.temperature ?? 0.7,
          num_ctx: options.numCtx ?? 4096,
          ...(options.topP != null ? { top_p: options.topP } : {}),
          ...(options.seed ? { seed: options.seed } : {}),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama chat error ${res.status}: ${text}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let content = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let buffer = "";
    const toolCalls: OllamaToolCall[] = [];

    const processLine = (line: string) => {
      if (!line.trim()) return;
      try {
        const data = JSON.parse(line) as {
          message?: { content: string; tool_calls?: OllamaToolCall[] };
          done?: boolean;
          prompt_eval_count?: number;
          eval_count?: number;
        };

        if (data.message?.content) {
          content += data.message.content;
          onToken(data.message.content);
        }

        if (data.message?.tool_calls?.length) {
          toolCalls.push(...data.message.tool_calls);
        }

        if (data.done) {
          promptTokens = data.prompt_eval_count ?? 0;
          completionTokens = data.eval_count ?? 0;
        }
      } catch {
        // Genuinely malformed line — ignore
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      // Append to buffer; only complete lines (terminated by \n) are safe to parse.
      // The trailing fragment stays in the buffer until its rest arrives next read.
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep the last (possibly incomplete) segment
      for (const line of lines) processLine(line);
    }

    // Flush any remaining buffered content after the stream ends
    buffer += decoder.decode();
    if (buffer.trim()) processLine(buffer);

    return { content, promptTokens, completionTokens, toolCalls };
  }

  /**
   * Generate embeddings for a batch of texts via /api/embed.
   * Batches requests to keep payloads small; throws on API errors
   * (e.g. 404 when the embedding model isn't pulled).
   */
  async embed(model: string, input: string[]): Promise<number[][]> {
    const BATCH_SIZE = 32;
    const out: number[][] = [];

    for (let i = 0; i < input.length; i += BATCH_SIZE) {
      const res = await fetch(`${this.baseUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: input.slice(i, i + BATCH_SIZE) }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama embed error ${res.status}: ${text}`);
      }

      const data = (await res.json()) as { embeddings: number[][] };
      out.push(...data.embeddings);
    }

    return out;
  }

  /**
   * Non-streaming one-shot completion via /api/generate.
   * Throws on API/network errors (callers surface them as toasts).
   */
  async generate(
    model: string,
    prompt: string,
    options: {
      temperature?: number;
      numPredict?: number;
      keepAlive?: string | number;
      timeoutMs?: number;
    } = {},
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 60000),
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        ...(options.keepAlive != null ? { keep_alive: options.keepAlive } : {}),
        options: {
          temperature: options.temperature ?? 0.3,
          ...(options.numPredict ? { num_predict: options.numPredict } : {}),
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama generate error ${res.status}: ${text}`);
    }
    const data = (await res.json()) as { response?: string };
    return (data.response ?? "").trim();
  }

  async generateTitle(
    model: string,
    userMessage: string,
    keepAlive?: string | number,
  ): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          model,
          prompt: `Summarize the following message as a short chat title. Reply with only 3-6 words, no punctuation, no quotes, no explanation:\n\n${userMessage.slice(0, 400)}`,
          stream: false,
          ...(keepAlive != null ? { keep_alive: keepAlive } : {}),
          options: { temperature: 0.3, num_predict: 15 },
        }),
      });
      if (!res.ok) return "";
      const data = (await res.json()) as { response?: string };
      return (data.response ?? "").trim().replace(/['".:!?]/g, "").slice(0, 60);
    } catch {
      return "";
    }
  }
}

export const ollamaClient = new OllamaClient();
