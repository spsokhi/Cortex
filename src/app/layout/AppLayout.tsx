import { Outlet } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { TitleBar } from "./TitleBar";
import { useUIStore } from "@/stores/uiStore";

export function AppLayout() {
  const sidebarState = useUIStore((s) => s.sidebarState);
  const sidebarExpanded = sidebarState === "expanded";

  return (
    <div className="flex flex-col h-full bg-cortex-bg overflow-hidden">
      {/* Custom title bar (Tauri removes native one) */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <main
          className="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-cortex-ease"
          style={{ marginLeft: sidebarExpanded ? 0 : 0 }}
        >
          <AnimatePresence mode="wait">
            <Outlet />
          </AnimatePresence>
        </main>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
