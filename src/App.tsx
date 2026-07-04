import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/app/layout/AppLayout";
import { ChatRoute } from "@/app/routes/Chat";
import { FilesRoute } from "@/app/routes/Files";
import { DocumentsRoute } from "@/app/routes/Documents";
import { ModelsRoute } from "@/app/routes/Models";
import { CodeRoute } from "@/app/routes/Code";
import { NotesRoute } from "@/app/routes/Notes";
import { SettingsRoute } from "@/app/routes/Settings";
import { NotificationStack } from "@/components/common/NotificationStack";
import { CommandPalette } from "@/components/common/CommandPalette";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useModels } from "@/hooks/useModels";
import { useSettingsStore } from "@/stores/settingsStore";
import { applyHistoryRetention } from "@/services/privacy";

function ThemeApplier() {
  const theme = useSettingsStore((s) => s.settings.appearance.theme);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (prefersDark: boolean) => {
      if (theme === "light" || (theme === "system" && !prefersDark)) {
        root.classList.add("light");
      } else {
        root.classList.remove("light");
      }
    };

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme(mq.matches);

    if (theme === "system") {
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  return null;
}

function AppBootstrap() {
  useModels(); // Kick off model polling at top level

  useEffect(() => {
    // Disable context menu in production Tauri builds
    if (typeof window.__TAURI_INTERNALS__ !== "undefined") {
      document.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    // Enforce "clear history" / retention policies on previous sessions' data
    applyHistoryRetention();
  }, []);

  return null;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppBootstrap />
        <ThemeApplier />
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/chat" replace />} />
            <Route path="chat" element={<ChatRoute />} />
            <Route path="chat/:id" element={<ChatRoute />} />
            <Route path="files" element={<FilesRoute />} />
            <Route path="documents" element={<DocumentsRoute />} />
            <Route path="code" element={<CodeRoute />} />
            <Route path="models" element={<ModelsRoute />} />
            <Route path="notes" element={<NotesRoute />} />
            <Route path="settings" element={<SettingsRoute />} />
          </Route>
        </Routes>
        <NotificationStack />
        <CommandPalette />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
