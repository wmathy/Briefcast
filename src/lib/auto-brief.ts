import { getPrisma } from "@/lib/db";
import { hasXaiKey } from "@/lib/env";
import { generateEpisodeBrief, purgeNotesOnlyBriefs } from "@/lib/generate";
import { FULL_TRANSCRIPT_UNAVAILABLE } from "@/lib/transcript-complete";
import {
  AUTO_BRIEF_LIMIT,
  episodeNeedsSpokenBrief,
  takeAutoBriefBatch,
} from "@/lib/auto-brief-policy";
import { collectWindowedAutoBriefIds, recapNeedsRewrite } from "@/lib/queue";
import { syncShowEpisodes } from "@/lib/podcasts";

export {
  AUTO_BRIEF_LIMIT,
  episodeNeedsSpokenBrief,
  isCronRequestAuthorized,
  takeAutoBriefBatch,
} from "@/lib/auto-brief-policy";

export async function latestEpisodeNeedingBrief(showId: string) {
  const prisma = getPrisma();
  const ids = await collectWindowedAutoBriefIds({ showId });
  const id = ids[0];
  return id ? { id } : null;
}

export async function syncShowAndPickAutoBriefs(showId: string, feedUrl: string, userId?: string) {
  const sync = await syncShowEpisodes(showId, feedUrl);
  const autoBriefIds = await collectWindowedAutoBriefIds({ showId, userId });
  return { ...sync, autoBriefIds };
}

export async function generateAutoBriefs(
  episodeIds: string[],
  options?: { userId?: string },
) {
  if (!hasXaiKey()) {
    return {
      attempted: 0,
      generated: 0,
      skipped: episodeIds.length,
      errors: [] as string[],
      reason: "missing-xai-key" as const,
    };
  }

  const prisma = getPrisma();
  let generated = 0;
  let skipped = 0;
  let inProgress = 0;
  const errors: string[] = [];

  for (const id of episodeIds) {
    const episode = await prisma.episode.findUnique({
      where: { id },
      include: { brief: true, recapAudio: true, show: true },
    });
    if (!episode) {
      errors.push(`Episode ${id} was not found.`);
      continue;
    }
    if (!episodeNeedsSpokenBrief(episode) && !recapNeedsRewrite(episode)) {
      skipped += 1;
      continue;
    }
    try {
      const result = await generateEpisodeBrief(id, { userId: options?.userId, force: recapNeedsRewrite(episode) });
      if (result.reason === "transcript-in-progress") {
        inProgress += 1;
        continue;
      }
      if (result.published) {
        generated += 1;
      } else {
        skipped += 1;
        if (result.reason === "no-full-transcript") {
          errors.push(`${episode.show.title}: ${FULL_TRANSCRIPT_UNAVAILABLE}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generate failed.";
      errors.push(`${episode.show.title}: ${message}`);
    }
  }

  return {
    attempted: episodeIds.length,
    generated,
    skipped,
    inProgress,
    errors,
    reason:
      inProgress > 0
        ? ("transcript-in-progress" as const)
        : generated === 0 && errors.some((item) => item.includes(FULL_TRANSCRIPT_UNAVAILABLE))
          ? ("no-full-transcript" as const)
          : null,
  };
}

export async function collectFollowedAutoBriefIds(options?: {
  userId?: string;
  showId?: string;
}) {
  const prisma = getPrisma();
  const shows = await prisma.show.findMany({
    where: options?.showId
      ? { id: options.showId }
      : options?.userId
        ? { follows: { some: { userId: options.userId } } }
        : { follows: { some: {} } },
    select: { id: true, feedUrl: true, title: true },
  });

  let created = 0;
  let fetched = 0;
  const autoBriefIds: string[] = [];
  const syncErrors: string[] = [];

  for (const show of shows) {
    try {
      const result = await syncShowAndPickAutoBriefs(show.id, show.feedUrl, options?.userId);
      created += result.created;
      fetched += result.fetched;
      autoBriefIds.push(...result.autoBriefIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : "RSS sync failed.";
      syncErrors.push(`${show.title}: ${message}`);
    }
  }

  return {
    shows: shows.length,
    fetchedShows: shows.length,
    fetched,
    created,
    autoBriefIds: [...new Set(autoBriefIds)],
    syncErrors,
  };
}

/** One pipeline for follow, Library/show check, and cron. */
export async function refreshFollowedBriefs(options?: {
  userId?: string;
  showId?: string;
}) {
  await purgeNotesOnlyBriefs();
  const poll = await collectFollowedAutoBriefIds(options);
  const batch = takeAutoBriefBatch(poll.autoBriefIds, AUTO_BRIEF_LIMIT);
  const generation = await generateAutoBriefs(batch.toGenerate, { userId: options?.userId });
  const remaining = batch.remaining + (generation.inProgress ?? 0);
  return {
    ...poll,
    ...generation,
    generating: batch.toGenerate.length,
    remaining,
    errors: [...poll.syncErrors, ...generation.errors],
  };
}
