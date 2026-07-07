import { useSyncExternalStore } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

let query: MediaQueryList | null = null;
function prefersDarkQuery() {
  return (query ??= window.matchMedia("(prefers-color-scheme: dark)"));
}

function subscribe(callback: () => void) {
  const q = prefersDarkQuery();
  q.addEventListener("change", callback);
  return () => q.removeEventListener("change", callback);
}

/**
 * Reactive "is the UI currently light?" — tracks both the appearance
 * setting and, for theme "system", live OS preference changes.
 */
export function useIsLightTheme(): boolean {
  const theme = useSettingsStore((s) => s.settings.appearance.theme);
  const prefersDark = useSyncExternalStore(subscribe, () => prefersDarkQuery().matches);
  return theme === "light" || (theme === "system" && !prefersDark);
}
