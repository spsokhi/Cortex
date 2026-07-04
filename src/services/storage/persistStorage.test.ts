import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDiskStorage, type KvBackend } from "./persistStorage";
import type { StorageValue } from "zustand/middleware";

interface TestState {
  items: string[];
}

function memoryBackend() {
  const data = new Map<string, unknown>();
  const get = vi.fn((key: string) => Promise.resolve(data.get(key)));
  const set = vi.fn((key: string, value: unknown) => {
    data.set(key, value);
    return Promise.resolve();
  });
  const remove = vi.fn((key: string) => {
    data.delete(key);
    return Promise.resolve();
  });
  const backend: KvBackend = { get, set, remove };
  return { data, backend, get, set, remove };
}

const value = (items: string[]): StorageValue<TestState> => ({ state: { items }, version: 0 });

describe("createDiskStorage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ignores writes until hydration has read the disk", async () => {
    const { backend, set } = memoryBackend();
    const storage = createDiskStorage<TestState>("test.json", { backend });

    storage.setItem("key", value(["pre-hydration"]));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(set).not.toHaveBeenCalled();

    await storage.getItem("key");
    storage.setItem("key", value(["post-hydration"]));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("coalesces rapid writes into one flush with the latest value", async () => {
    const { backend, data, set } = memoryBackend();
    const storage = createDiskStorage<TestState>("test.json", { backend, debounceMs: 500 });
    await storage.getItem("key");

    for (let i = 0; i < 10; i++) storage.setItem("key", value([`v${i}`]));
    expect(set).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(600);
    expect(set).toHaveBeenCalledTimes(1);
    expect((data.get("key") as StorageValue<TestState>).state.items).toEqual(["v9"]);
  });

  it("flushes at maxWait even while writes keep arriving", async () => {
    const { backend, set } = memoryBackend();
    const storage = createDiskStorage<TestState>("test.json", {
      backend,
      debounceMs: 500,
      maxWaitMs: 2000,
    });
    await storage.getItem("key");

    // A write every 100 ms keeps resetting the debounce forever
    for (let i = 0; i < 30; i++) {
      storage.setItem("key", value([`v${i}`]));
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(set).toHaveBeenCalled();
  });

  it("removeItem cancels pending writes and deletes from the backend", async () => {
    const { backend, set, remove } = memoryBackend();
    const storage = createDiskStorage<TestState>("test.json", { backend });
    await storage.getItem("key");

    storage.setItem("key", value(["doomed"]));
    await storage.removeItem("key");
    await vi.advanceTimersByTimeAsync(10_000);

    expect(remove).toHaveBeenCalledWith("key");
    expect(set).not.toHaveBeenCalled();
  });

  it("migrates legacy localStorage data on first read (Tauri context)", async () => {
    const legacy = JSON.stringify(value(["from-localstorage"]));
    const removeItemSpy = vi.fn();
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {}, addEventListener: () => {} });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => legacy),
      removeItem: removeItemSpy,
      setItem: vi.fn(),
    });

    const { backend, data } = memoryBackend();
    const storage = createDiskStorage<TestState>("test.json", { backend });

    const result = (await storage.getItem("cortex-chat-store")) as StorageValue<TestState>;
    expect(result.state.items).toEqual(["from-localstorage"]);
    expect((data.get("cortex-chat-store") as StorageValue<TestState>).state.items).toEqual([
      "from-localstorage",
    ]);
    expect(removeItemSpy).toHaveBeenCalledWith("cortex-chat-store");
  });
});
