export const LISTEN_PROGRESS_STORAGE_KEY = "briefcast.listen-progress.v1";
export const LISTEN_PROGRESS_EVENT = "briefcast:listen-progress";

export type ListenProgressEntry = {
  currentTime: number;
  duration: number;
  updatedAt: number;
};

export type ListenProgressMap = Record<string, ListenProgressEntry>;

type StoredV1 = {
  v: 1;
  episodes: Record<string, { t: number; d: number; u: number }>;
};

export function listenProgressPercent(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, currentTime / duration));
}

export function isListenComplete(currentTime: number, duration: number, threshold = 0.98): boolean {
  return listenProgressPercent(currentTime, duration) >= threshold;
}

export function parseListenProgress(raw: string | null | undefined): ListenProgressMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as Partial<StoredV1> & { episodes?: unknown };
    if (record.v !== 1 || !record.episodes || typeof record.episodes !== "object") return {};
    const map: ListenProgressMap = {};
    for (const [episodeId, value] of Object.entries(record.episodes)) {
      if (!episodeId || !value || typeof value !== "object") continue;
      const currentTime = Number((value as { t?: unknown }).t);
      const duration = Number((value as { d?: unknown }).d);
      const updatedAt = Number((value as { u?: unknown }).u);
      if (!Number.isFinite(currentTime) || currentTime < 0) continue;
      map[episodeId] = {
        currentTime,
        duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
      };
    }
    return map;
  } catch {
    return {};
  }
}

export function serializeListenProgress(map: ListenProgressMap): string {
  const episodes: StoredV1["episodes"] = {};
  for (const [episodeId, entry] of Object.entries(map)) {
    if (!episodeId) continue;
    episodes[episodeId] = {
      t: entry.currentTime,
      d: entry.duration,
      u: entry.updatedAt,
    };
  }
  return JSON.stringify({ v: 1, episodes } satisfies StoredV1);
}

export function upsertListenProgress(
  map: ListenProgressMap,
  episodeId: string,
  currentTime: number,
  duration: number,
  updatedAt = Date.now(),
): ListenProgressMap {
  if (!episodeId || !Number.isFinite(currentTime) || currentTime < 0) return map;
  return {
    ...map,
    [episodeId]: {
      currentTime,
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      updatedAt,
    },
  };
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let cachedRaw: string | null = null;
let cachedMap: ListenProgressMap = {};
const cachedEntries = new Map<string, ListenProgressEntry | null>();

function listenProgressMap(): ListenProgressMap {
  const store = storage();
  const raw = store?.getItem(LISTEN_PROGRESS_STORAGE_KEY) ?? null;
  if (raw === cachedRaw) return cachedMap;
  cachedRaw = raw;
  cachedMap = parseListenProgress(raw);
  cachedEntries.clear();
  return cachedMap;
}

function sameEntry(a: ListenProgressEntry | null, b: ListenProgressEntry | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.currentTime === b.currentTime && a.duration === b.duration && a.updatedAt === b.updatedAt;
}

export function readListenProgress(episodeId: string): ListenProgressEntry | null {
  if (!episodeId) return null;
  try {
    const next = listenProgressMap()[episodeId] ?? null;
    const prev = cachedEntries.get(episodeId) ?? null;
    if (cachedEntries.has(episodeId) && sameEntry(prev, next)) return prev;
    cachedEntries.set(episodeId, next);
    return next;
  } catch {
    return null;
  }
}

export function resetListenProgressCacheForTests(): void {
  cachedRaw = null;
  cachedMap = {};
  cachedEntries.clear();
}

export function writeListenProgress(episodeId: string, currentTime: number, duration: number): void {
  const store = storage();
  if (!store || !episodeId) return;
  try {
    const next = upsertListenProgress(
      parseListenProgress(store.getItem(LISTEN_PROGRESS_STORAGE_KEY)),
      episodeId,
      currentTime,
      duration,
    );
    store.setItem(LISTEN_PROGRESS_STORAGE_KEY, serializeListenProgress(next));
    cachedRaw = null;
    window.dispatchEvent(new Event(LISTEN_PROGRESS_EVENT));
  } catch {
    // Quota or private-mode failures should not break playback.
  }
}

export function subscribeListenProgress(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === LISTEN_PROGRESS_STORAGE_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LISTEN_PROGRESS_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LISTEN_PROGRESS_EVENT, onStoreChange);
  };
}
