/** Cap generations per poll so a cron/request stays inside function time limits. */
export const AUTO_BRIEF_LIMIT = 2;

/** First follow writes the latest episode in the same request so the queue is not empty. */
export const FOLLOW_AUTO_BRIEF_LIMIT = 1;

export function episodeNeedsSpokenBrief(episode: {
  brief?: unknown;
  recapAudio?: unknown;
}): boolean {
  return !episode.brief || !episode.recapAudio;
}

export type CreatedEpisodeRef = {
  id: string;
  publishedAt: Date;
};

export type AutoBriefPickInput = {
  initialImport: boolean;
  newlyCreated: CreatedEpisodeRef[];
  latestUnbriefedId: string | null;
  limit?: number;
};

export function pickAutoBriefEpisodeIds(input: AutoBriefPickInput): string[] {
  const limit = input.limit ?? AUTO_BRIEF_LIMIT;
  const newestCreated = [...input.newlyCreated].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );

  if (input.initialImport) {
    const id = newestCreated[0]?.id ?? input.latestUnbriefedId;
    return id ? [id].slice(0, limit) : [];
  }

  const ids = newestCreated.map((episode) => episode.id);
  if (ids.length === 0 && input.latestUnbriefedId) {
    ids.push(input.latestUnbriefedId);
  }
  return [...new Set(ids)].slice(0, limit);
}

export function collectAutoBriefJobs(
  shows: Array<{
    existingEpisodeCount: number;
    createdEpisodes: CreatedEpisodeRef[];
    latestUnbriefedId: string | null;
  }>,
  limit = AUTO_BRIEF_LIMIT,
): string[] {
  const ids: string[] = [];
  for (const show of shows) {
    ids.push(
      ...pickAutoBriefEpisodeIds({
        initialImport: show.existingEpisodeCount === 0,
        newlyCreated: show.createdEpisodes,
        latestUnbriefedId: show.latestUnbriefedId,
      }),
    );
  }
  return [...new Set(ids)].slice(0, limit);
}

export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization");
  if (secret) {
    return header === `Bearer ${secret}`;
  }
  // Unset secret: allow local/dev only. On Vercel, cron requests send CRON_SECRET.
  return !process.env.VERCEL;
}
