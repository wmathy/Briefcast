import { getPrisma } from "@/lib/db";
import { hasXaiKey } from "@/lib/env";
import { generateEpisodeBrief, purgeNotesOnlyBriefs, resolveEpisodeTtsVoice } from "@/lib/generate";
import { FULL_TRANSCRIPT_UNAVAILABLE } from "@/lib/transcript-complete";
import {
  AUTO_BRIEF_LIMIT,
  AUTO_BRIEF_LOOKAHEAD,
  episodeNeedsSpokenBrief,
  takeAutoBriefBatch,
} from "@/lib/auto-brief-policy";
import { collectWindowedAutoBriefIds, recapNeedsRewrite } from "@/lib/queue";
import { syncShowEpisodes } from "@/lib/podcasts";

export {
  AUTO_BRIEF_LIMIT,
  AUTO_BRIEF_LOOKAHEAD,
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
      inProgress: 0,
      progressed: false,
      errors: [] as string[],
      reason: "missing-xai-key" as const,
    };
  }

  const prisma = getPrisma();
  let generated = 0;
  let skipped = 0;
  let inProgress = 0;
  let progressed = false;
  let progressReason: "transcript-in-progress" | "audio-pending" | null = null;
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
    const requestedVoice = await resolveEpisodeTtsVoice(episode.showId, options?.userId);
    if (!episodeNeedsSpokenBrief(episode) && !recapNeedsRewrite(episode, requestedVoice)) {
      skipped += 1;
      continue;
    }
    try {
      const result = await generateEpisodeBrief(id, {
        userId: options?.userId,
        force: recapNeedsRewrite(episode, requestedVoice),
      });
      if (result.reason === "transcript-in-progress" && "sttBusy" in result && result.sttBusy) {
        inProgress += 1;
        progressReason = "transcript-in-progress";
        continue;
      }
      if (result.reason === "transcript-in-progress" || result.reason === "audio-pending") {
        inProgress += 1;
        progressed = true;
        progressReason = result.reason;
        break;
      }
      if (result.published) {
        generated += 1;
        progressed = true;
        break;
      }
      skipped += 1;
      if (result.reason === "no-full-transcript") {
        errors.push(`${episode.show.title}: ${FULL_TRANSCRIPT_UNAVAILABLE}`);
        continue;
      }
      break;
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
    progressed,
    errors,
    reason:
      progressReason ??
      (generated === 0 && errors.some((item) => item.includes(FULL_TRANSCRIPT_UNAVAILABLE))
        ? ("no-full-transcript" as const)
        : null),
  };
}

export async function collectFollowedAutoBriefIds(options?: {
  userId?: string;
  showId?: string;
  skipFeedSync?: boolean;
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
      if (options?.skipFeedSync) {
        autoBriefIds.push(...(await collectWindowedAutoBriefIds({ showId: show.id, userId: options.userId })));
        continue;
      }
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
  skipFeedSync?: boolean;
}) {
  await purgeNotesOnlyBriefs();
  const poll = await collectFollowedAutoBriefIds(options);
  const batch = takeAutoBriefBatch(poll.autoBriefIds, AUTO_BRIEF_LOOKAHEAD);
  const generation = await generateAutoBriefs(batch.toGenerate, { userId: options?.userId });
  // Recount after this turn so a persisted draft whose TTS timed out stays queued.
  const stillNeeded = await collectWindowedAutoBriefIds({
    userId: options?.userId,
    showId: options?.showId,
  });
  return {
    ...poll,
    ...generation,
    generating: batch.toGenerate.length,
    remaining: stillNeeded.length,
    errors: [...poll.syncErrors, ...generation.errors],
  };
}
