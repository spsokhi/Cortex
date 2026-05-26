import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

export interface SavedPrompt {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

interface PromptState {
  prompts: SavedPrompt[];
  addPrompt: (name: string, content: string) => void;
  removePrompt: (id: string) => void;
}

export const usePromptStore = create<PromptState>()(
  persist(
    (set) => ({
      prompts: [],
      addPrompt: (name, content) =>
        set((state) => ({
          prompts: [
            { id: nanoid(), name: name.trim(), content: content.trim(), createdAt: Date.now() },
            ...state.prompts,
          ],
        })),
      removePrompt: (id) =>
        set((state) => ({ prompts: state.prompts.filter((p) => p.id !== id) })),
    }),
    { name: "cortex-prompts" },
  ),
);
