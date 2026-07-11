import { create } from "zustand";
import type { NotificationPayload } from "@/types/system";
import { nanoid } from "nanoid";

type SidebarTab = "chat" | "files" | "code" | "notes" | "models" | "settings";
type PanelState = "expanded" | "collapsed";

interface UIState {
  sidebarTab: SidebarTab;
  sidebarState: PanelState;
  rightPanelOpen: boolean;
  notifications: NotificationPayload[];
  commandPaletteOpen: boolean;
  shortcutsHelpOpen: boolean;
  /** Message currently being read aloud via TTS, if any */
  speakingMessageId: string | null;
  searchOpen: boolean;
  settingsOpen: boolean;
  modelManagerOpen: boolean;
  dropZoneActive: boolean;
  filePreviewId: string | null;

  // Actions
  setSidebarTab: (tab: SidebarTab) => void;
  setSidebarState: (state: PanelState) => void;
  toggleSidebar: () => void;
  setRightPanel: (open: boolean) => void;
  addNotification: (n: Omit<NotificationPayload, "id">) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setCommandPalette: (open: boolean) => void;
  setShortcutsHelp: (open: boolean) => void;
  setSpeakingMessage: (id: string | null) => void;
  setSearchOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setModelManagerOpen: (open: boolean) => void;
  setDropZoneActive: (active: boolean) => void;
  setFilePreview: (id: string | null) => void;

  // Toast helper
  toast: (type: NotificationPayload["type"], title: string, message?: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarTab: "chat",
  sidebarState: "expanded",
  rightPanelOpen: false,
  notifications: [],
  commandPaletteOpen: false,
  shortcutsHelpOpen: false,
  speakingMessageId: null,
  searchOpen: false,
  settingsOpen: false,
  modelManagerOpen: false,
  dropZoneActive: false,
  filePreviewId: null,

  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setSidebarState: (state) => set({ sidebarState: state }),
  toggleSidebar: () =>
    set((s) => ({
      sidebarState: s.sidebarState === "expanded" ? "collapsed" : "expanded",
    })),
  setRightPanel: (open) => set({ rightPanelOpen: open }),

  addNotification: (n) => {
    const notification: NotificationPayload = { ...n, id: nanoid() };
    set((state) => ({
      notifications: [...state.notifications, notification],
    }));
    if (n.duration !== 0) {
      setTimeout(
        () => {
          set((state) => ({
            notifications: state.notifications.filter((x) => x.id !== notification.id),
          }));
        },
        n.duration ?? 4000,
      );
    }
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearNotifications: () => set({ notifications: [] }),

  setCommandPalette: (open) => set({ commandPaletteOpen: open }),
  setShortcutsHelp: (open) => set({ shortcutsHelpOpen: open }),
  setSpeakingMessage: (id) => set({ speakingMessageId: id }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setModelManagerOpen: (open) => set({ modelManagerOpen: open }),
  setDropZoneActive: (active) => set({ dropZoneActive: active }),
  setFilePreview: (id) => set({ filePreviewId: id }),

  toast: (type, title, message) => {
    const notification: NotificationPayload = { id: nanoid(), type, title, message };
    set((state) => ({ notifications: [...state.notifications, notification] }));
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== notification.id),
      }));
    }, 4000);
  },
}));
