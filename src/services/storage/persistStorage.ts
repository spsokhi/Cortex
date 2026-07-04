/**
 * Disk-backed zustand persist storage for large data (chats, files, notes).
 *
 * localStorage caps out around 5–10 MB, which indexed files (text + chunks +
 * embeddings) and a growing chat history blow through. This adapter persists
 * to a JSON file in the app data directory via tauri-plugin-store instead.
 *
 * Design notes:
 * - Writes are debounced (with a max-wait bound) because zustand persist
 *   fires on every state change — including once per streamed token. Holding
 *   the object reference and serializing only on flush makes streaming cheap.
 * - setItem is ignored until the first getItem completes, so a state change
 *   during startup can never overwrite the on-disk data before hydration.
 * - Data persisted by older versions is migrated out of localStorage on
 *   first read, then removed from localStorage.
 * - Outside Tauri (browser dev, tests) it falls back to localStorage or, if
 *   that is unavailable, plain memory.
 */
import { LazyStore } from "@tauri-apps/plugin-store";
import type { PersistStorage, StorageValue } from "zustand/middleware";

export interface KvBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && window.__TAURI_INTERNALS__ != null;
}

function tauriBackend(file: string): KvBackend {
  const store = new LazyStore(file, { defaults: {}, autoSave: false });
  return {
    get: (key) => store.get(key),
    set: async (key, value) => {
      await store.set(key, value);
      await store.save();
    },
    remove: async (key) => {
      await store.delete(key);
      await store.save();
    },
  };
}

function browserBackend(): KvBackend {
  const hasLocalStorage = typeof localStorage !== "undefined";
  const memory = new Map<string, unknown>();
  return {
    get: (key) => {
      if (!hasLocalStorage) return Promise.resolve(memory.get(key));
      const raw = localStorage.getItem(key);
      return Promise.resolve(raw ? (JSON.parse(raw) as unknown) : undefined);
    },
    set: (key, value) => {
      if (hasLocalStorage) localStorage.setItem(key, JSON.stringify(value));
      else memory.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      if (hasLocalStorage) localStorage.removeItem(key);
      else memory.delete(key);
      return Promise.resolve();
    },
  };
}

export interface DiskStorageOptions {
  /** Quiet-period before a write hits disk (default 500 ms) */
  debounceMs?: number;
  /** Upper bound on write postponement during continuous updates (default 3000 ms) */
  maxWaitMs?: number;
  /** Override the storage backend (used in tests) */
  backend?: KvBackend;
}

export function createDiskStorage<S>(
  file: string,
  options: DiskStorageOptions = {},
): PersistStorage<S> {
  const { debounceMs = 500, maxWaitMs = 3000 } = options;
  const backend = options.backend ?? (isTauri() ? tauriBackend(file) : browserBackend());

  let ready = false;
  let pending: { key: string; value: StorageValue<S> } | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let writeChain: Promise<void> = Promise.resolve();

  const clearTimers = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (deadlineTimer) clearTimeout(deadlineTimer);
    debounceTimer = null;
    deadlineTimer = null;
  };

  const flush = () => {
    clearTimers();
    if (!pending) return;
    const { key, value } = pending;
    pending = null;
    writeChain = writeChain
      .then(() => backend.set(key, value))
      .catch((err) => console.error(`[storage] failed to persist "${key}":`, err));
  };

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flush);
  }

  return {
    getItem: async (name) => {
      try {
        let value = (await backend.get(name)) as StorageValue<S> | undefined | null;
        if (value == null && isTauri() && typeof localStorage !== "undefined") {
          const legacy = localStorage.getItem(name);
          if (legacy) {
            value = JSON.parse(legacy) as StorageValue<S>;
            await backend.set(name, value);
            localStorage.removeItem(name);
          }
        }
        return value ?? null;
      } finally {
        ready = true;
      }
    },

    setItem: (name, value) => {
      if (!ready) return;
      pending = { key: name, value };
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, debounceMs);
      if (!deadlineTimer) deadlineTimer = setTimeout(flush, maxWaitMs);
    },

    removeItem: async (name) => {
      pending = null;
      clearTimers();
      await backend.remove(name);
    },
  };
}
