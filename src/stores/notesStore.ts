import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

interface NotesState {
  notes: Note[];
  activeNoteId: string | null;

  createNote: () => Note;
  updateNote: (id: string, updates: Partial<Pick<Note, "title" | "content">>) => void;
  deleteNote: (id: string) => void;
  setActiveNote: (id: string | null) => void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      activeNoteId: null,

      createNote: () => {
        const note: Note = {
          id: nanoid(),
          title: "Untitled note",
          content: "# Untitled note\n\nStart writing…",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ notes: [note, ...state.notes], activeNoteId: note.id }));
        return note;
      },

      updateNote: (id, updates) =>
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n,
          ),
        })),

      deleteNote: (id) =>
        set((state) => {
          const remaining = state.notes.filter((n) => n.id !== id);
          const nextActive =
            state.activeNoteId === id ? (remaining[0]?.id ?? null) : state.activeNoteId;
          return { notes: remaining, activeNoteId: nextActive };
        }),

      setActiveNote: (id) => set({ activeNoteId: id }),
    }),
    {
      name: "cortex-notes-store",
    },
  ),
);
