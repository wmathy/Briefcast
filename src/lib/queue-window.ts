/** Newest episodes that are always eligible, even if they predate the follow. */
export const AUTO_BRIEF_BACKFILL = 5;

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
  if (input.newestIds.includes(input.episodeId)) return true;
  return input.publishedAt.getTime() >= followWindowStart(input.followedAt).getTime();
}

