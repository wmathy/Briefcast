import { getPrisma } from "@/lib/db";
import { hasXaiKey } from "@/lib/env";
import { generateEpisodeBrief } from "@/lib/generate";
import {
  AUTO_BRIEF_LIMIT,
  episodeNeedsSpokenBrief,
  pickAutoBriefEpisodeIds,
} from "@/lib/auto-brief-policy";
import { syncShowEpisodes, type SyncedEpisode } from "@/lib/podcasts";

export {
  AUTO_BRIEF_LIMIT,
  FOLLOW_AUTO_BRIEF_LIMIT,
  collectAutoBriefJobs,
  episodeNeedsSpokenBrief,
  isCronRequestAuthorized,
  pickAutoBriefEpisodeIds,
} from "@/lib/auto-brief-policy";

export async function syncShowAndPickAutoBriefs(
  showId: string,
  feedUrl: string,
  options?: { limit?: number },
) {
  const prisma = getPrisma();
  const existingEpisodeCount = await prisma.episode.count({ where: { showId } });
  const sync = await syncShowEpisodes(showId, feedUrl);
  const latestNeedingBrief = await prisma.episode.findFirst({
    where: {
      showId,
      OR: [{ brief: { is: null } }, { recapAudio: { is: null } }],
    },
    orderBy: { publishedAt: "desc" },
    select: { id: true },
  });
  const autoBriefIds = pickAutoBriefEpisodeIds({
    initialImport: existingEpisodeCount === 0,
    newlyCreated: sync.createdEpisodes,
    latestUnbriefedId: latestNeedingBrief?.id ?? null,
    limit: options?.limit,
  });
  return { ...sync, autoBriefIds };
}

export async function generateAutoBriefs(
  episodeIds: string[],
  options?: { limit?: number; userId?: string },
) {
  const limit = options?.limit ?? AUTO_BRIEF_LIMIT;
  const attemptedIds = episodeIds.slice(0, limit);
  if (!hasXaiKey()) {
    return {
      attempted: 0,
      generated: 0,
      skipped: attemptedIds.length,
      errors: [] as string[],
      reason: "missing-xai-key" as const,
    };
  }

  const prisma = getPrisma();
  let generated = 0;
  const errors: string[] = [];

  for (const id of attemptedIds) {
    const episode = await prisma.episode.findUnique({
      where: { id },
      include: { brief: true, recapAudio: true },
    });
    if (!episode || !episodeNeedsSpokenBrief(episode)) continue;
    try {
      await generateEpisodeBrief(id, { userId: options?.userId });
      generated += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Generate failed.");
    }
  }

  return { attempted: attemptedIds.length, generated, skipped: 0, errors, reason: null };
}

export async function pollFollowedShowsAndGenerate(options?: {
  userId?: string;
  showId?: string;
  limit?: number;
}) {
  const prisma = getPrisma();
  const limit = options?.limit ?? AUTO_BRIEF_LIMIT;
  const shows = await prisma.show.findMany({
    where: options?.showId
      ? { id: options.showId }
      : options?.userId
        ? { follows: { some: { userId: options.userId } } }
        : { follows: { some: {} } },
    select: { id: true, feedUrl: true, title: true },
  });

  const createdEpisodes: SyncedEpisode[] = [];
  const autoBriefIds: string[] = [];
  const syncErrors: string[] = [];

  for (const show of shows) {
    try {
      const result = await syncShowAndPickAutoBriefs(show.id, show.feedUrl);
      createdEpisodes.push(...result.createdEpisodes);
      autoBriefIds.push(...result.autoBriefIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : "RSS sync failed.";
      syncErrors.push(`${show.title}: ${message}`);
    }
  }

  const uniqueIds = [...new Set(autoBriefIds)].slice(0, limit);
  return {
    shows: shows.length,
    fetchedShows: shows.length,
    created: createdEpisodes.length,
    autoBriefIds: uniqueIds,
    syncErrors,
  };
}
