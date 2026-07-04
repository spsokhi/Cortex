import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDiskStorage } from "@/services/storage/persistStorage";
import type { IndexedFile, FileCollection } from "@/types/files";

interface FileState {
  files: IndexedFile[];
  collections: FileCollection[];
  activeCollectionId: string | null;
  selectedFileIds: Set<string>;
  searchQuery: string;
  isIndexing: boolean;
  indexingProgress: number;

  // Actions
  setFiles: (files: IndexedFile[]) => void;
  addFile: (file: IndexedFile) => void;
  updateFile: (id: string, updates: Partial<IndexedFile>) => void;
  removeFile: (id: string) => void;
  addCollection: (collection: FileCollection) => void;
  updateCollection: (id: string, updates: Partial<FileCollection>) => void;
  removeCollection: (id: string) => void;
  setActiveCollection: (id: string | null) => void;
  toggleFileSelection: (id: string) => void;
  clearSelection: () => void;
  setSearchQuery: (query: string) => void;
  setIndexing: (indexing: boolean, progress?: number) => void;

  // Computed
  filteredFiles: () => IndexedFile[];
  selectedFiles: () => IndexedFile[];
}

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      files: [],
      collections: [],
      activeCollectionId: null,
      selectedFileIds: new Set(),
      searchQuery: "",
      isIndexing: false,
      indexingProgress: 0,

      setFiles: (files) => set({ files }),

      addFile: (file) =>
        set((state) => ({
          files: state.files.some((f) => f.id === file.id)
            ? state.files.map((f) => (f.id === file.id ? file : f))
            : [...state.files, file],
        })),

      updateFile: (id, updates) =>
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id ? { ...f, ...updates, updatedAt: Date.now() } : f,
          ),
        })),

      removeFile: (id) =>
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
          selectedFileIds: new Set([...state.selectedFileIds].filter((fid) => fid !== id)),
        })),

      addCollection: (collection) =>
        set((state) => ({ collections: [...state.collections, collection] })),

      updateCollection: (id, updates) =>
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        })),

      removeCollection: (id) =>
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== id),
          activeCollectionId: state.activeCollectionId === id ? null : state.activeCollectionId,
        })),

      setActiveCollection: (id) => set({ activeCollectionId: id }),

      toggleFileSelection: (id) =>
        set((state) => {
          const next = new Set(state.selectedFileIds);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return { selectedFileIds: next };
        }),

      clearSelection: () => set({ selectedFileIds: new Set() }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setIndexing: (indexing, progress = 0) =>
        set({ isIndexing: indexing, indexingProgress: progress }),

      filteredFiles: () => {
        const { files, searchQuery, activeCollectionId, collections } = get();
        let result = files;

        if (activeCollectionId) {
          const col = collections.find((c) => c.id === activeCollectionId);
          if (col) result = result.filter((f) => col.fileIds.includes(f.id));
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          result = result.filter(
            (f) =>
              f.name.toLowerCase().includes(q) ||
              f.tags.some((t) => t.toLowerCase().includes(q)),
          );
        }

        return result;
      },

      selectedFiles: () => {
        const { files, selectedFileIds } = get();
        return files.filter((f) => selectedFileIds.has(f.id));
      },
    }),
    {
      name: "cortex-file-store",
      storage: createDiskStorage<{
        files: IndexedFile[];
        collections: FileCollection[];
      }>("cortex-files.json"),
      partialize: (state) => ({
        files: state.files,
        collections: state.collections,
      }),
    },
  ),
);
