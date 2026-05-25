import { useEffect, useRef, useState } from "react";
import type { SystemStats } from "@/types/system";

export function useSystem(pollIntervalMs = 3000) {
  const [stats, setStats] = useState<SystemStats>({
    cpuUsage: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    ollamaRunning: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        // Try Tauri IPC first; fall back to browser APIs
        if (typeof window.__TAURI_INTERNALS__ !== "undefined") {
          const { getSystemStats } = await import("@/services/ipc/commands");
          const s = await getSystemStats();
          setStats(s);
        } else {
          // Dev mode: simulate stats
          setStats((prev) => ({
            ...prev,
            cpuUsage: Math.random() * 60 + 10,
            memoryUsed: 8.2 * 1024 * 1024 * 1024,
            memoryTotal: 16 * 1024 * 1024 * 1024,
            ollamaRunning: true,
          }));
        }
      } catch {
        // Non-fatal
      }
    };

    void poll();
    intervalRef.current = setInterval(() => void poll(), pollIntervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollIntervalMs]);

  return stats;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}
