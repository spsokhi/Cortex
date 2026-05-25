export type FileType =
  | "pdf"
  | "txt"
  | "md"
  | "markdown"
  | "code"
  | "image"
  | "unknown";

export type IndexStatus = "pending" | "indexing" | "indexed" | "error" | "skipped";

export interface IndexedFile {
  id: string;
  name: string;
  path: string;
  type: FileType;
  size: number; // bytes
  mimeType?: string;
  indexStatus: IndexStatus;
  chunkCount?: number;
  error?: string;
  summary?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  indexedAt?: number;
  content?: string;   // raw extracted text
  chunks?: string[];  // text chunks for RAG retrieval
}

export interface FileChunk {
  id: string;
  fileId: string;
  content: string;
  page?: number;
  chunkIndex: number;
  embedding?: number[];
}

export interface FileSearchResult {
  fileId: string;
  fileName: string;
  chunk: string;
  score: number;
  page?: number;
}

export interface FileUploadRequest {
  path: string;
  collectionId?: string;
}

export interface FileCollection {
  id: string;
  name: string;
  description?: string;
  fileIds: string[];
  createdAt: number;
  updatedAt: number;
}

export function getFileType(fileName: string): FileType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const codeExts = [
    "ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "cpp", "c",
    "h", "cs", "rb", "php", "swift", "kt", "scala", "sh", "bash",
    "toml", "yaml", "yml", "json", "html", "css", "sql",
  ];

  if (!ext) return "unknown";
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "txt";
  if (ext === "md" || ext === "markdown") return "md";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (codeExts.includes(ext)) return "code";
  return "unknown";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
