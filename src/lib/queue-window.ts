/** Auto-brief considers only the newest episode per followed show, then one global target. */
export const AUTO_BRIEF_BACKFILL = 1;

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

/** Auto Check/cron/hops keep one target: the newest episode that still needs a spoken brief. */
export function takeSingleNewestWork<T extends { id: string }>(ids: readonly T[] | readonly string[]): string[] {
  const first = ids[0];
  if (!first) return [];
  const id = typeof first === "string" ? first : first.id;
  return id ? [id] : [];
}
