/**
 * Local semantic retrieval for RAG.
 *
 * Chunks are embedded via Ollama's /api/embed at index time and stored as
 * base64 int8-quantized unit vectors (~1 KB per chunk instead of ~7 KB of
 * JSON floats). At query time the question is embedded once and chunks are
 * ranked by cosine similarity. Files indexed without embeddings (or with a
 * different embedding model) fall back to keyword scoring so old files
 * keep working.
 */
import { ollamaClient } from "@/services/api/ollama";
import { useFileStore } from "@/stores/fileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { CitationSource } from "@/types/chat";

export interface RagResult {
  context: string;
  citations: CitationSource[];
}

export const EMPTY_RAG: RagResult = { context: "", citations: [] };

// nomic-embed-text is trained with task prefixes; other models take raw text
function withTaskPrefix(
  texts: string[],
  task: "search_document" | "search_query",
  model: string,
): string[] {
  return model.includes("nomic-embed") ? texts.map((t) => `${task}: ${t}`) : texts;
}

/** Normalize to unit length, quantize to int8 with a per-vector scale, base64-encode. */
export function encodeEmbedding(vec: number[]): string {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  let scale = 0;
  for (const x of vec) scale = Math.max(scale, Math.abs(x / norm));
  if (scale === 0) scale = 1;

  const bytes = new Uint8Array(4 + vec.length);
  new DataView(bytes.buffer).setFloat32(0, scale, true);
  for (let i = 0; i < vec.length; i++) {
    bytes[4 + i] = Math.round((vec[i] / norm / scale) * 127) & 0xff;
  }

  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function decodeEmbedding(encoded: string): Float32Array {
  const bin = atob(encoded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const scale = new DataView(bytes.buffer).getFloat32(0, true);
  const out = new Float32Array(bytes.length - 4);
  for (let i = 0; i < out.length; i++) {
    const byte = bytes[4 + i];
    const int8 = byte > 127 ? byte - 256 : byte;
    out[i] = (int8 / 127) * scale;
  }
  return out;
}

function normalize(vec: number[]): Float32Array {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return Float32Array.from(vec, (x) => x / norm);
}

/** Both inputs are (approximately) unit vectors, so the dot product is the cosine similarity. */
function dot(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) sum += a[i] * b[i];
  return sum;
}

function keywordScore(chunk: string, query: string): number {
  const queryWords = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const chunkLower = chunk.toLowerCase();
  return queryWords.reduce((acc, w) => acc + (chunkLower.split(w).length - 1), 0);
}

/** Embed document chunks and return them encoded for storage. Throws if Ollama/model is unavailable. */
export async function embedChunks(chunks: string[]): Promise<string[]> {
  const model = useSettingsStore.getState().settings.rag.embeddingModel;
  const vectors = await ollamaClient.embed(model, withTaskPrefix(chunks, "search_document", model));
  return vectors.map(encodeEmbedding);
}

/**
 * Retrieve the most relevant chunks and build the context block to inject
 * into the system prompt.
 *
 * When `fileIds` is given and non-empty, retrieval is scoped strictly to
 * those files (documents attached to the conversation) — nothing else is
 * searched, so "chat with this document" really means only that document.
 * Omit it to search every indexed file.
 */
export async function retrieveRag(query: string, fileIds?: string[]): Promise<RagResult> {
  const { embeddingModel, topK, minScore } = useSettingsStore.getState().settings.rag;
  let files = useFileStore
    .getState()
    .files.filter((f) => f.indexStatus === "indexed" && f.chunks?.length);

  if (fileIds && fileIds.length) {
    const scope = new Set(fileIds);
    files = files.filter((f) => scope.has(f.id));
  }

  if (!files.length) return EMPTY_RAG;

  const hasUsableEmbeddings = files.some(
    (f) => f.embeddings?.length && f.embeddingModel === embeddingModel,
  );

  let queryVec: Float32Array | null = null;
  if (hasUsableEmbeddings) {
    try {
      const [vec] = await ollamaClient.embed(
        embeddingModel,
        withTaskPrefix([query], "search_query", embeddingModel),
      );
      queryVec = normalize(vec);
    } catch {
      // Embedding model unavailable right now — fall back to keyword scoring
    }
  }

  const semantic: CitationSource[] = [];
  const keyword: CitationSource[] = [];

  for (const file of files) {
    const chunks = file.chunks ?? [];
    const embeddingsUsable =
      queryVec !== null && file.embeddingModel === embeddingModel && file.embeddings?.length;

    for (let i = 0; i < chunks.length; i++) {
      const encoded = embeddingsUsable ? file.embeddings?.[i] : undefined;
      if (queryVec && encoded) {
        const score = dot(queryVec, decodeEmbedding(encoded));
        if (score >= minScore) {
          semantic.push({ fileId: file.id, fileName: file.name, chunk: chunks[i], score });
        }
      } else {
        const score = keywordScore(chunks[i], query);
        if (score > 0) {
          keyword.push({ fileId: file.id, fileName: file.name, chunk: chunks[i], score });
        }
      }
    }
  }

  // Keyword hits use raw occurrence counts — normalize to 0..0.5 so they can
  // fill in for non-embedded files without outranking real semantic matches.
  const maxKeyword = keyword.reduce((m, c) => Math.max(m, c.score), 0);
  for (const c of keyword) c.score = (c.score / (maxKeyword || 1)) * 0.5;

  const top = [...semantic, ...keyword].sort((a, b) => b.score - a.score).slice(0, topK);
  if (!top.length) return EMPTY_RAG;

  const context =
    "Use the following context from uploaded documents to answer the question. " +
    "Cite specific details from the context.\n\n" +
    top.map((c) => `[From: ${c.fileName}]\n${c.chunk}`).join("\n\n---\n\n") +
    "\n\n---\n\nAnswer based on the context above.";

  return { context, citations: top };
}
