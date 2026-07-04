import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModelInfo, ModelDownloadProgress } from "@/types/models";

interface ModelState {
  models: ModelInfo[];
  activeModelId: string;
  downloadQueue: ModelDownloadProgress[];
  ollamaConnected: boolean;
  isLoading: boolean;

  // Actions
  setModels: (models: ModelInfo[]) => void;
  setActiveModel: (modelId: string) => void;
  addToDownloadQueue: (progress: ModelDownloadProgress) => void;
  updateDownloadProgress: (modelName: string, progress: Partial<ModelDownloadProgress>) => void;
  removeFromDownloadQueue: (modelName: string) => void;
  setOllamaConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  updateModelStatus: (modelId: string, updates: Partial<ModelInfo>) => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      models: [],
      activeModelId: "llama3:8b",
      downloadQueue: [],
      ollamaConnected: false,
      isLoading: false,

      setModels: (models) => set({ models }),

      setActiveModel: (modelId) => set({ activeModelId: modelId }),

      addToDownloadQueue: (progress) =>
        set((state) => ({
          downloadQueue: [...state.downloadQueue, progress],
        })),

      updateDownloadProgress: (modelName, progress) =>
        set((state) => ({
          downloadQueue: state.downloadQueue.map((p) =>
            p.modelName === modelName ? { ...p, ...progress } : p,
          ),
        })),

      removeFromDownloadQueue: (modelName) =>
        set((state) => ({
          downloadQueue: state.downloadQueue.filter((p) => p.modelName !== modelName),
        })),

      setOllamaConnected: (connected) => set({ ollamaConnected: connected }),

      setLoading: (loading) => set({ isLoading: loading }),

      updateModelStatus: (modelId, updates) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === modelId ? { ...m, ...updates } : m,
          ),
        })),
    }),
    {
      name: "cortex-model-store",
      partialize: (state) => ({
        activeModelId: state.activeModelId,
      }),
    },
  ),
);
