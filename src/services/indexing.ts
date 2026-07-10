/**
 * File indexing for RAG — shared by the Files route and the chat attach button.
 *
 * Extracts text (plain read or PDF parse), splits it into overlapping chunks,
 * embeds those chunks for semantic retrieval, and records everything on the
 * file store. Embedding failure is non-fatal: the file stays searchable via
 * the keyword fallback in retrieveRag.
 */
import { readTextFile, readFile } from "@tauri-apps/plugin-fs";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { nanoid } from "nanoid";
import { useFileStore } from "@/stores/fileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { embedChunks } from "@/services/rag";
import { getFileType, type FileType } from "@/types/files";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** A newly registered file plus a promise that settles once indexing finishes. */
export interface IndexHandle {
  fileId: string;
  type: FileType;
  /** Resolves when the file reaches its terminal status (indexed / skipped / error). */
  done: Promise<void>;
}

/** True for file types whose text we can extract and index. */
export function isIndexableType(type: FileType): boolean {
  return type !== "image" && type !== "unknown";
}

async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdf = await getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }
  return pages.join("\n\n");
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > chunkSize && current) {
      chunks.push(current.trim());
      const words = current.split(/\s+/);
      current = words.slice(-overlap).join(" ") + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.split(/\s+/).length >= 8);
}

/**
 * Chunk extracted text, embed the chunks for semantic retrieval, and mark the
 * file indexed. Embedding failure is non-fatal — the file stays usable via
 * keyword fallback in retrieval.
 */
export async function indexFileContent(fileId: string, text: string): Promise<void> {
  const { chunkSize, chunkOverlap, embeddingModel } = useSettingsStore.getState().settings.rag;
  const chunks = chunkText(text, chunkSize, chunkOverlap);

  useFileStore.getState().updateFile(fileId, {
    size: text.length,
    indexStatus: "indexing",
    content: text,
    chunks,
    chunkCount: chunks.length,
  });

  let embeddings: string[] | undefined;
  if (chunks.length) {
    try {
      embeddings = await embedChunks(chunks);
    } catch {
      useUIStore.getState().toast(
        "warning",
        "Semantic index unavailable",
        `Couldn't embed with "${embeddingModel}" — this file will use keyword search. Pull the model from the Models tab, then re-index.`,
      );
    }
  }

  useFileStore.getState().updateFile(fileId, {
    embeddings,
    embeddingModel: embeddings ? embeddingModel : undefined,
    indexStatus: "indexed",
    indexedAt: Date.now(),
  });
}

/** Register a file in the store as pending, then run its indexing pipeline. */
function register(
  file: { name: string; path: string; size: number; mimeType: string },
  extractText: () => Promise<string>,
  readErrorMessage: string,
): IndexHandle {
  const type = getFileType(file.name);
  const fileId = nanoid();

  useFileStore.getState().addFile({
    id: fileId,
    name: file.name,
    path: file.path,
    type,
    size: file.size,
    mimeType: file.mimeType,
    indexStatus: "pending",
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const done = (async () => {
    if (!isIndexableType(type)) {
      useFileStore.getState().updateFile(fileId, {
        indexStatus: "skipped",
        error: type === "image" ? "Image content not indexed" : undefined,
      });
      return;
    }
    useFileStore.getState().updateFile(fileId, { indexStatus: "indexing" });
    try {
      await indexFileContent(fileId, await extractText());
    } catch {
      useFileStore.getState().updateFile(fileId, { indexStatus: "error", error: readErrorMessage });
    }
  })();

  return { fileId, type, done };
}

/** Add and index a browser File (manual picker / chat attach). */
export function addBrowserFile(file: File): IndexHandle {
  const type = getFileType(file.name);
  return register(
    { name: file.name, path: file.name, size: file.size, mimeType: file.type },
    async () => (type === "pdf" ? extractPdfText(await file.arrayBuffer()) : file.text()),
    type === "pdf" ? "Failed to parse PDF" : "Failed to read file",
  );
}

/** Add and index a file by real OS path (Tauri native drag-drop). */
export function addPathFile(filePath: string): IndexHandle {
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
  const type = getFileType(fileName);
  return register(
    { name: fileName, path: filePath, size: 0, mimeType: "" },
    async () => {
      if (type === "pdf") {
        const bytes = await readFile(filePath);
        return extractPdfText(bytes.buffer);
      }
      return readTextFile(filePath);
    },
    "Permission denied — try the browse button instead",
  );
}
