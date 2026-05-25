import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Search, FolderOpen, FileText, File, Image,
  Code2, Trash2, RefreshCw, CheckCircle2, Clock, AlertCircle,
  Eye,
} from "lucide-react";
import { useFileStore } from "@/stores/fileStore";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/utils/cn";
import { formatBytes, formatRelativeTime } from "@/utils/format";
import type { IndexedFile } from "@/types/files";
import { getFileType } from "@/types/files";
import { nanoid } from "nanoid";

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText size={16} className="text-red-400" />,
  txt: <FileText size={16} className="text-cortex-text-muted" />,
  md: <FileText size={16} className="text-blue-400" />,
  markdown: <FileText size={16} className="text-blue-400" />,
  code: <Code2 size={16} className="text-green-400" />,
  image: <Image size={16} className="text-purple-400" />,
  unknown: <File size={16} className="text-cortex-text-dim" />,
};

const STATUS_ICONS = {
  indexed: <CheckCircle2 size={12} className="text-cortex-success" />,
  indexing: <RefreshCw size={12} className="text-cortex-info animate-spin" />,
  pending: <Clock size={12} className="text-cortex-warning" />,
  error: <AlertCircle size={12} className="text-cortex-error" />,
  skipped: <File size={12} className="text-cortex-text-dim" />,
};

export function FilesRoute() {
  const { files, addFile, removeFile, searchQuery, setSearchQuery, filteredFiles } =
    useFileStore();
  const { toast } = useUIStore();
  const [sortBy, setSortBy] = useState<"name" | "size" | "date">("date");

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        const type = getFileType(file.name);
        const fileId = nanoid();
        const newFile: IndexedFile = {
          id: fileId,
          name: file.name,
          path: file.name,
          type,
          size: file.size,
          mimeType: file.type,
          indexStatus: "pending",
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        addFile(newFile);

        // Read and chunk text content for RAG
        if (type !== "image" && type !== "unknown") {
          useFileStore.getState().updateFile(fileId, { indexStatus: "indexing" });

          const reader = new FileReader();
          reader.onload = (e) => {
            const text = (e.target?.result as string) ?? "";
            const chunks = chunkText(text, 600, 80);
            useFileStore.getState().updateFile(fileId, {
              indexStatus: "indexed",
              content: text,
              chunks,
              chunkCount: chunks.length,
              indexedAt: Date.now(),
            });
          };
          reader.onerror = () => {
            useFileStore.getState().updateFile(fileId, {
              indexStatus: "error",
              error: "Failed to read file",
            });
          };
          reader.readAsText(file);
        } else {
          useFileStore.getState().updateFile(fileId, {
            indexStatus: "skipped",
            error: type === "image" ? "Image content not indexed" : undefined,
          });
        }
      }
      toast("success", `${acceptedFiles.length} file${acceptedFiles.length > 1 ? "s" : ""} added`);
    },
    [addFile, toast],
  );

  // Tauri blocks native drag-drop — prevent default so react-dropzone can handle it
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: false,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "text/markdown": [".md", ".markdown"],
      "text/x-python": [".py"],
      "text/javascript": [".js", ".ts"],
      "image/*": [".jpg", ".jpeg", ".png", ".webp"],
    },
  });

  const displayFiles = filteredFiles().sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "size") return b.size - a.size;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <motion.div
      key="files"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border bg-cortex-surface/50 flex-shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-cortex-text">Files & Documents</h1>
          <p className="text-xs text-cortex-text-muted mt-0.5">
            {files.length} file{files.length !== 1 ? "s" : ""} indexed for RAG
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="cortex-input text-xs py-1.5 pr-7"
          >
            <option value="date">By date</option>
            <option value="name">By name</option>
            <option value="size">By size</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn(
            "relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all",
            isDragActive
              ? "border-cortex-accent bg-cortex-accent/5 scale-[1.01]"
              : "border-cortex-border hover:border-cortex-accent/40 hover:bg-cortex-surface-2",
          )}
        >
          <input {...getInputProps()} />
          <Upload
            size={24}
            className={cn(
              "mb-3 transition-colors",
              isDragActive ? "text-cortex-accent" : "text-cortex-text-dim",
            )}
          />
          <p className="text-sm font-medium text-cortex-text">
            {isDragActive ? "Drop files here" : "Drop files or click to browse"}
          </p>
          <p className="text-xs text-cortex-text-muted mt-1">
            PDF, TXT, Markdown, Python, TypeScript, Images
          </p>
        </div>

        {/* Search */}
        {files.length > 0 && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cortex-text-dim" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files…"
              className="cortex-input w-full pl-9 text-sm"
            />
          </div>
        )}

        {/* File list */}
        {displayFiles.length === 0 && files.length > 0 && (
          <p className="text-center text-sm text-cortex-text-dim py-8">
            No files match your search.
          </p>
        )}

        <AnimatePresence>
          {displayFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onDelete={() => removeFile(file.id)}
            />
          ))}
        </AnimatePresence>

        {files.length === 0 && (
          <div className="text-center py-12 text-cortex-text-dim">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">No files yet</p>
            <p className="text-xs mt-1">
              Drop files above to index them for AI search
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
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

function FileCard({ file, onDelete }: { file: IndexedFile; onDelete: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="group flex items-center gap-3 p-3.5 rounded-xl border border-cortex-border bg-cortex-surface-2 hover:border-cortex-accent/20 transition-all"
    >
      {/* Icon */}
      <div className="w-9 h-9 rounded-lg bg-cortex-surface-3 border border-cortex-border flex items-center justify-center flex-shrink-0">
        {FILE_ICONS[file.type] ?? FILE_ICONS.unknown}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-cortex-text font-medium truncate">{file.name}</p>
          {STATUS_ICONS[file.indexStatus]}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-2xs text-cortex-text-dim">{formatBytes(file.size)}</span>
          {file.chunkCount && (
            <span className="text-2xs text-cortex-text-dim">{file.chunkCount} chunks</span>
          )}
          <span className="text-2xs text-cortex-text-dim">
            {formatRelativeTime(file.updatedAt)}
          </span>
        </div>
        {file.error && (
          <p className="text-2xs text-cortex-error mt-0.5">{file.error}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-cortex-text-dim hover:text-cortex-error hover:bg-cortex-error/10 transition-colors"
          title="Remove file"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}
