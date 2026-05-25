import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, MessageSquare, Upload, Search, Cpu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFileStore } from "@/stores/fileStore";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { cn } from "@/utils/cn";
import { formatBytes, formatRelativeTime } from "@/utils/format";
import type { IndexedFile } from "@/types/files";

export function DocumentsRoute() {
  const { files } = useFileStore();
  const { createConversation } = useChatStore();
  const { activeModelId } = useModelStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<IndexedFile | null>(null);

  const indexedFiles = files.filter((f) => f.indexStatus === "indexed");
  const filtered = searchQuery
    ? indexedFiles.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : indexedFiles;

  const handleChatWithDoc = (file: IndexedFile) => {
    const conv = createConversation(
      activeModelId,
      `Chat: ${file.name}`,
    );
    navigate(`/chat/${conv.id}`);
  };

  return (
    <motion.div
      key="documents"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-cortex-border bg-cortex-surface/50 flex-shrink-0">
        <h1 className="text-sm font-semibold text-cortex-text">Document Q&A</h1>
        <p className="text-xs text-cortex-text-muted mt-0.5">
          Chat with your indexed documents using RAG
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {indexedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-cortex-surface-3 border border-cortex-border flex items-center justify-center">
              <FileText size={28} className="text-cortex-text-dim" />
            </div>
            <div>
              <p className="text-sm font-medium text-cortex-text">No documents indexed</p>
              <p className="text-xs text-cortex-text-muted mt-1">
                Go to the Files tab to upload and index documents
              </p>
            </div>
            <button
              onClick={() => navigate("/files")}
              className="flex items-center gap-2 cortex-button-primary text-sm"
            >
              <Upload size={14} />
              Upload files
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cortex-text-dim" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search indexed documents…"
                className="cortex-input w-full pl-9 text-sm"
              />
            </div>

            {/* Document grid */}
            <div className="grid grid-cols-1 gap-2">
              {filtered.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "group flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                    selectedFile?.id === file.id
                      ? "border-cortex-accent/40 bg-cortex-accent/5"
                      : "border-cortex-border bg-cortex-surface-2 hover:border-cortex-accent/20",
                  )}
                  onClick={() => setSelectedFile(file)}
                >
                  <div className="w-10 h-10 rounded-xl bg-cortex-surface-3 border border-cortex-border flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-cortex-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cortex-text truncate">{file.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-2xs text-cortex-text-dim">{formatBytes(file.size)}</span>
                      {file.chunkCount && (
                        <span className="text-2xs text-cortex-text-dim">{file.chunkCount} chunks</span>
                      )}
                      <span className="text-2xs text-cortex-text-dim">
                        Indexed {formatRelativeTime(file.indexedAt ?? file.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleChatWithDoc(file); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cortex-accent/10 text-cortex-accent hover:bg-cortex-accent/20 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  >
                    <MessageSquare size={12} />
                    Chat
                  </button>
                </div>
              ))}
            </div>

            {/* Semantic search panel */}
            {selectedFile && (
              <div className="mt-4 p-4 rounded-xl border border-cortex-accent/20 bg-cortex-accent/5">
                <p className="text-xs font-medium text-cortex-accent mb-3">
                  Chatting with: {selectedFile.name}
                </p>
                <button
                  onClick={() => handleChatWithDoc(selectedFile)}
                  className="flex items-center gap-2 cortex-button-primary text-sm w-full justify-center"
                >
                  <Cpu size={14} />
                  Start Document Q&A Session
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
