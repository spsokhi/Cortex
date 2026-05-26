import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PersonaState {
  activePersonaId: string | null;
  setActivePersona: (id: string | null) => void;
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      activePersonaId: null,
      setActivePersona: (id) => set({ activePersonaId: id }),
    }),
    { name: "cortex-persona" },
  ),
);
