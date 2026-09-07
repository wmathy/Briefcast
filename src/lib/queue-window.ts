/** Auto-brief considers only the newest episode per followed show, then one global target. */
export const AUTO_BRIEF_BACKFILL = 1;
/** Skip a locked STT job so another follow’s newest can finish. Matches stt-job lock. */
export const STT_LOCK_MS = 6 * 60 * 1000;
/** Rotate off a newest episode whose STT has not advanced for this long. */
export const STT_STALL_MS = 6 * 60 * 60 * 1000;

export type FinishableWork = {
  id: string;
  publishedAt: Date | number;
  kind: "unbriefed" | "rewrite";
  hasSource?: boolean;
  hasAudioUrl?: boolean;
  hasTranscriptUrl?: boolean;
  durationSeconds?: number | null;
  sttStatus?: string | null;
  sttUpdatedAt?: Date | number | null;
  sttLockedAt?: Date | number | null;
};

export function followWindowStart(followedAt: Date): Date {
  return new Date(
    Date.UTC(followedAt.getUTCFullYear(), followedAt.getUTCMonth(), followedAt.getUTCDate()),
  );
}

export function episodeIsInBriefWindow(input: {
  episodeId: string;
  publishedAt: Date;
  followedAt: Date;
  newestIds: readonly string[];
}): boolean {
  return input.newestIds.slice(0, AUTO_BRIEF_BACKFILL).includes(input.episodeId);
}

function asTime(value: Date | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.getTime();
}

export function sttLockIsFresh(lockedAt: Date | number | null | undefined, now = Date.now()): boolean {
  if (lockedAt == null) return false;
  return now - asTime(lockedAt) < STT_LOCK_MS;
}

export function sttIsStalled(updatedAt: Date | number | null | undefined, now = Date.now()): boolean {
  if (updatedAt == null) return false;
  return now - asTime(updatedAt) >= STT_STALL_MS;
}

/** Auto Check/cron/hops keep one target: the newest episode that still needs a spoken brief. */
export function takeSingleNewestWork<T extends { id: string }>(ids: readonly T[] | readonly string[]): string[] {
  const first = ids[0];
  if (!first) return [];
  const id = typeof first === "string" ? first : first.id;
  return id ? [id] : [];
}

function newestFirst<T extends { publishedAt: Date | number }>(items: T[]): T[] {
  return [...items].sort((a, b) => asTime(b.publishedAt) - asTime(a.publishedAt));
}

/**
 * One target among each follow’s newest. Prefer a public transcript (finishes this hop),
 * then an in-progress STT job, then the shortest remaining audio. Skip a fresh lock or a
 * stalled STT so a 3-hour JRE cannot block Candace/Tucker for days.
 */
export function pickFinishableNewest(items: FinishableWork[], now = Date.now()): string[] {
  const unbriefed = items.filter((item) => item.kind === "unbriefed");
  const rewrite = items.filter((item) => item.kind === "rewrite");
  const available = unbriefed.filter(
    (item) => !(item.sttStatus === "running" && sttLockIsFresh(item.sttLockedAt, now)),
  );

  const withAudio = available.filter((item) => item.hasAudioUrl);
  const withTranscript = withAudio.filter((item) => item.hasTranscriptUrl);
  if (withTranscript.length > 0) {
    return takeSingleNewestWork(newestFirst(withTranscript));
  }

  const progressing = withAudio.filter(
    (item) =>
      item.sttUpdatedAt &&
      item.sttStatus !== "failed" &&
      !sttIsStalled(item.sttUpdatedAt, now),
  );
  if (progressing.length > 0) {
    return takeSingleNewestWork(newestFirst(progressing));
  }

  const startable = withAudio.filter((item) => !sttIsStalled(item.sttUpdatedAt, now));
  if (startable.length > 0) {
    const shortest = [...startable].sort((a, b) => {
      const durationA = a.durationSeconds && a.durationSeconds > 0 ? a.durationSeconds : Number.MAX_SAFE_INTEGER;
      const durationB = b.durationSeconds && b.durationSeconds > 0 ? b.durationSeconds : Number.MAX_SAFE_INTEGER;
      if (durationA !== durationB) return durationA - durationB;
      return asTime(b.publishedAt) - asTime(a.publishedAt);
    });
    return shortest[0] ? [shortest[0].id] : [];
  }

  const stalled = withAudio;
  if (stalled.length > 0) {
    return takeSingleNewestWork(newestFirst(stalled));
  }

  const transcriptOnly = available.filter((item) => item.hasTranscriptUrl);
  if (transcriptOnly.length > 0) {
    return takeSingleNewestWork(newestFirst(transcriptOnly));
  }

  if (rewrite.length > 0) {
    return takeSingleNewestWork(newestFirst(rewrite));
  }

  if (available.length > 0) {
    return takeSingleNewestWork(newestFirst(available));
  }
  return [];
}
