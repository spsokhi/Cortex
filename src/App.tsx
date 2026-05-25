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
import { useModels } from "@/hooks/useModels";

function AppBootstrap() {
  useModels(); // Kick off model polling at top level

  useEffect(() => {
    // Disable context menu in production Tauri builds
    if (typeof window.__TAURI_INTERNALS__ !== "undefined") {
      document.addEventListener("contextmenu", (e) => e.preventDefault());
    }
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
    <BrowserRouter>
      <AppBootstrap />
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
  );
}
