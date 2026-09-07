import { afterEach, describe, expect, it } from "vitest";
import {
  LISTEN_PROGRESS_STORAGE_KEY,
  isListenComplete,
  listenProgressPercent,
  parseListenProgress,
  readListenProgress,
  serializeListenProgress,
  upsertListenProgress,
  writeListenProgress,
} from "./listen-progress";

describe("listen progress math", () => {
  it("clamps the listened ratio to 0–1", () => {
    expect(listenProgressPercent(30, 120)).toBe(0.25);
    expect(listenProgressPercent(0, 120)).toBe(0);
    expect(listenProgressPercent(120, 120)).toBe(1);
    expect(listenProgressPercent(200, 100)).toBe(1);
    expect(listenProgressPercent(10, 0)).toBe(0);
    expect(listenProgressPercent(Number.NaN, 60)).toBe(0);
  });

  it("treats 98% as finished so replay starts over", () => {
    expect(isListenComplete(97, 100)).toBe(false);
    expect(isListenComplete(98, 100)).toBe(true);
    expect(isListenComplete(100, 100)).toBe(true);
  });
});

describe("listen progress storage shape", () => {
  it("round-trips a versioned localStorage payload", () => {
    const raw = serializeListenProgress({
      ep1: { currentTime: 42.5, duration: 600, updatedAt: 100 },
    });
    expect(JSON.parse(raw)).toEqual({
      v: 1,
      episodes: { ep1: { t: 42.5, d: 600, u: 100 } },
    });
    expect(parseListenProgress(raw)).toEqual({
      ep1: { currentTime: 42.5, duration: 600, updatedAt: 100 },
    });
  });

  it("ignores junk and unversioned blobs", () => {
    expect(parseListenProgress(null)).toEqual({});
    expect(parseListenProgress("{")).toEqual({});
    expect(parseListenProgress(JSON.stringify({ ep1: { currentTime: 1 } }))).toEqual({});
    expect(parseListenProgress(JSON.stringify({ v: 1, episodes: { bad: { t: "x" } } }))).toEqual({});
  });

  it("upserts one episode without dropping others", () => {
    const next = upsertListenProgress(
      { a: { currentTime: 1, duration: 10, updatedAt: 1 } },
      "b",
      20,
      80,
      9,
    );
    expect(next).toEqual({
      a: { currentTime: 1, duration: 10, updatedAt: 1 },
      b: { currentTime: 20, duration: 80, updatedAt: 9 },
    });
  });
});

describe("listen progress localStorage helpers", () => {
  afterEach(() => {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.removeItem(LISTEN_PROGRESS_STORAGE_KEY);
    }
  });

  it("returns null when window storage is unavailable", () => {
    expect(readListenProgress("ep")).toBeNull();
  });

  it("reads and writes through a localStorage stub", () => {
    const memory = new Map<string, string>();
    const stub = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };
    Object.defineProperty(globalThis, "localStorage", { value: stub, configurable: true });
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: stub },
      configurable: true,
    });

    writeListenProgress("ep-9", 15, 300);
    expect(readListenProgress("ep-9")).toMatchObject({ currentTime: 15, duration: 300 });
    expect(readListenProgress("missing")).toBeNull();
    expect(memory.get(LISTEN_PROGRESS_STORAGE_KEY)).toContain('"v":1');

    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
