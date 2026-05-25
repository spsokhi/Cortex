import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppSettings } from "@/types/system";
import { DEFAULT_SETTINGS } from "@/types/system";

interface SettingsState {
  settings: AppSettings;
  isDirty: boolean;

  updateSettings: (updates: DeepPartial<AppSettings>) => void;
  resetSection: <K extends keyof AppSettings>(section: K) => void;
  resetAll: () => void;
  markSaved: () => void;
}

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as Array<keyof T>) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal !== undefined &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      typeof tgtVal === "object" &&
      tgtVal !== null
    ) {
      result[key] = deepMerge(tgtVal as object, srcVal as DeepPartial<object>) as T[keyof T];
    } else if (srcVal !== undefined) {
      result[key] = srcVal as T[keyof T];
    }
  }
  return result;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      isDirty: false,

      updateSettings: (updates) =>
        set((state) => ({
          settings: deepMerge(state.settings, updates),
          isDirty: true,
        })),

      resetSection: (section) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [section]: DEFAULT_SETTINGS[section],
          },
          isDirty: true,
        })),

      resetAll: () => set({ settings: DEFAULT_SETTINGS, isDirty: false }),

      markSaved: () => set({ isDirty: false }),
    }),
    {
      name: "cortex-settings",
    },
  ),
);
