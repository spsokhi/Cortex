import { useState } from "react";
import { motion } from "framer-motion";
import { StickyNote, Plus, Trash2, Search } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/utils/cn";
import { formatRelativeTime } from "@/utils/format";
import { useNotesStore } from "@/stores/notesStore";

export function NotesRoute() {
  const { notes, activeNoteId, createNote, updateNote, deleteNote, setActiveNote } = useNotesStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isPreview, setIsPreview] = useState(false);

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  const filteredNotes = searchQuery
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.content.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : notes;

  return (
    <motion.div
      key="notes"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full"
    >
      {/* Notes list */}
      <div className="w-56 flex-shrink-0 border-r border-cortex-border bg-cortex-surface flex flex-col">
        <div className="p-3 border-b border-cortex-border">
          <button
            onClick={createNote}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-cortex-accent/10 text-cortex-accent border border-cortex-accent/20 hover:bg-cortex-accent/20 text-xs font-medium transition-colors"
          >
            <Plus size={13} />
            New note
          </button>
          <div className="relative mt-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cortex-text-dim" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-3 py-1.5 bg-cortex-surface-3 border border-cortex-border rounded-lg text-xs text-cortex-text placeholder-cortex-text-dim outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {filteredNotes.length === 0 && (
            <div className="text-center py-8 text-cortex-text-dim text-xs">
              {notes.length === 0 ? "No notes yet" : "No results"}
            </div>
          )}
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              onClick={() => setActiveNote(note.id)}
              className={cn(
                "w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors group",
                activeNoteId === note.id ? "bg-cortex-accent/10" : "hover:bg-cortex-surface-3",
              )}
            >
              <StickyNote
                size={13}
                className={cn(
                  "mt-0.5 flex-shrink-0",
                  activeNoteId === note.id ? "text-cortex-accent" : "text-cortex-text-muted",
                )}
              />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs font-medium truncate",
                  activeNoteId === note.id ? "text-cortex-accent" : "text-cortex-text",
                )}>
                  {note.title}
                </p>
                <p className="text-2xs text-cortex-text-dim mt-0.5">
                  {formatRelativeTime(note.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-cortex-text-dim hover:text-cortex-error transition-all"
              >
                <Trash2 size={11} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Editor area */}
      {activeNote ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-cortex-border bg-cortex-surface/50">
            <input
              value={activeNote.title}
              onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
              className="flex-1 bg-transparent text-sm font-medium text-cortex-text outline-none placeholder-cortex-text-dim"
              placeholder="Note title"
            />
            <div className="flex items-center gap-3">
              <span className="text-2xs text-cortex-success">auto-saved</span>
              <button
                onClick={() => setIsPreview((v) => !v)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                  isPreview
                    ? "bg-cortex-accent/10 text-cortex-accent"
                    : "text-cortex-text-muted hover:text-cortex-text",
                )}
              >
                {isPreview ? "Edit" : "Preview"}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isPreview ? (
              <div className="max-w-2xl mx-auto px-8 py-6 prose-cortex selectable text-sm leading-relaxed text-cortex-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeNote.content}
                </ReactMarkdown>
              </div>
            ) : (
              <TextareaAutosize
                value={activeNote.content}
                onChange={(e) => updateNote(activeNote.id, { content: e.target.value })}
                className={cn(
                  "w-full max-w-2xl mx-auto block px-8 py-6",
                  "bg-transparent text-sm text-cortex-text font-mono leading-relaxed",
                  "resize-none outline-none selectable placeholder-cortex-text-dim",
                )}
                placeholder="Start writing in Markdown…"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <StickyNote size={40} className="mx-auto mb-3 text-cortex-text-dim opacity-30" />
            <p className="text-sm text-cortex-text-muted">Select a note or create one</p>
            <button
              onClick={createNote}
              className="mt-3 flex items-center gap-1.5 cortex-button-primary text-sm mx-auto"
            >
              <Plus size={13} />
              New note
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
