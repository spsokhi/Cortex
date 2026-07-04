import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import { PERSONAS, type Persona } from "@/data/personas";

interface PersonaState {
  activePersonaId: string | null;
  customPersonas: Persona[];

  setActivePersona: (id: string | null) => void;
  addPersona: (persona: Omit<Persona, "id">) => Persona;
  updatePersona: (id: string, updates: Partial<Omit<Persona, "id">>) => void;
  deletePersona: (id: string) => void;
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      activePersonaId: null,
      customPersonas: [],

      setActivePersona: (id) => set({ activePersonaId: id }),

      addPersona: (persona) => {
        const created: Persona = { ...persona, id: `custom-${nanoid(8)}` };
        set((state) => ({ customPersonas: [...state.customPersonas, created] }));
        return created;
      },

      updatePersona: (id, updates) =>
        set((state) => ({
          customPersonas: state.customPersonas.map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
        })),

      deletePersona: (id) =>
        set((state) => ({
          customPersonas: state.customPersonas.filter((p) => p.id !== id),
          activePersonaId: state.activePersonaId === id ? null : state.activePersonaId,
        })),
    }),
    { name: "cortex-persona" },
  ),
);

/** Look up a persona by id across built-ins and user-created ones. */
export function findPersona(id: string | null | undefined): Persona | null {
  if (!id) return null;
  return (
    PERSONAS.find((p) => p.id === id) ??
    usePersonaStore.getState().customPersonas.find((p) => p.id === id) ??
    null
  );
}
