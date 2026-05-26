import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StatsState {
  totalMessages: number;
  totalTokens: number;
  totalWords: number;
  modelUsage: Record<string, number>;
  personaUsage: Record<string, number>;
  firstUsed: number | null;

  track: (opts: {
    messages?: number;
    tokens?: number;
    words?: number;
    modelId?: string;
    personaId?: string | null;
  }) => void;
  reset: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      totalMessages: 0,
      totalTokens: 0,
      totalWords: 0,
      modelUsage: {},
      personaUsage: {},
      firstUsed: null,

      track: ({ messages = 0, tokens = 0, words = 0, modelId, personaId }) =>
        set((state) => ({
          totalMessages: state.totalMessages + messages,
          totalTokens: state.totalTokens + tokens,
          totalWords: state.totalWords + words,
          firstUsed: state.firstUsed ?? (messages > 0 ? Date.now() : null),
          modelUsage: modelId
            ? { ...state.modelUsage, [modelId]: (state.modelUsage[modelId] ?? 0) + 1 }
            : state.modelUsage,
          personaUsage: personaId
            ? { ...state.personaUsage, [personaId]: (state.personaUsage[personaId] ?? 0) + 1 }
            : state.personaUsage,
        })),

      reset: () =>
        set({
          totalMessages: 0,
          totalTokens: 0,
          totalWords: 0,
          modelUsage: {},
          personaUsage: {},
          firstUsed: null,
        }),
    }),
    { name: "cortex-stats" },
  ),
);
