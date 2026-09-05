import { getPrisma } from "@/lib/db";
import { orderAutoBriefQueue, type AutoBriefKind } from "@/lib/auto-brief-policy";
import {
  AUTO_BRIEF_BACKFILL,
  followWindowStart,
} from "@/lib/queue-window";
import { spokenRecapInBand, parseBriefLength, recapAudioInBand } from "@/lib/brief-length";
import { DEFAULT_TTS_VOICE, parseTtsVoice } from "@/lib/tts-voice";

export { orderAutoBriefQueue, orderIdsByPublishedAt } from "@/lib/auto-brief-policy";

export type WindowedBriefWork = {
  id: string;
  publishedAt: Date;
  kind: AutoBriefKind;
};

export function isPublishedReadyBrief(episode: {
  brief?: { sourceType?: string | null } | null;
  recapAudio?: unknown;
}): boolean {
  return Boolean(episode.brief && episode.brief.sourceType === "transcript" && episode.recapAudio);
}

/** Real generated briefs (written + spoken audio) for followed shows, newest episode first. */
export async function getFollowedBriefQueue(userId: string) {
  const prisma = getPrisma();
  return prisma.episode.findMany({
    where: {
      brief: { is: { sourceType: "transcript" } },
      recapAudio: { isNot: null },
      show: { follows: { some: { userId } } },
    },
    include: { show: true, brief: true, recapAudio: true },
    orderBy: { publishedAt: "desc" },
  });
}

async function windowedFollowedWork(input: {
  showId: string;
  followedAt: Date;
  ttsVoice?: string | null;
  briefLength?: string | null;
}): Promise<WindowedBriefWork[]> {
  const prisma = getPrisma();
  const newest = await prisma.episode.findMany({
    where: { showId: input.showId },
    orderBy: { publishedAt: "desc" },
    take: AUTO_BRIEF_BACKFILL,
    select: { id: true },
  });
  const newestIds = newest.map((row) => row.id);
  const rows = await prisma.episode.findMany({
    where: {
      showId: input.showId,
      OR: [{ publishedAt: { gte: followWindowStart(input.followedAt) } }, { id: { in: newestIds } }],
    },
    orderBy: { publishedAt: "desc" },
    include: { brief: true, recapAudio: true },
  });
  const items: WindowedBriefWork[] = [];
  for (const row of rows) {
    if (!isPublishedReadyBrief(row)) {
      items.push({ id: row.id, publishedAt: row.publishedAt, kind: "unbriefed" });
      continue;
    }
    if (recapNeedsRewrite(row, input.ttsVoice, input.briefLength)) {
      items.push({ id: row.id, publishedAt: row.publishedAt, kind: "rewrite" });
    }
  }
  return items;
}

export async function countUnbriefedFollowedEpisodes(userId: string) {
  const prisma = getPrisma();
  const follows = await prisma.follow.findMany({
    where: { userId },
    select: { showId: true, createdAt: true, ttsVoice: true, briefLength: true },
  });
  let count = 0;
  for (const follow of follows) {
    const items = await windowedFollowedWork({
      showId: follow.showId,
      followedAt: follow.createdAt,
      ttsVoice: follow.ttsVoice,
      briefLength: follow.briefLength,
    });
    count += items.filter((item) => item.kind === "unbriefed").length;
  }
  return count;
}

export async function collectWindowedFollowedWork(input: {
  userId?: string;
  showId?: string;
}): Promise<WindowedBriefWork[]> {
  const prisma = getPrisma();
  const follows = await prisma.follow.findMany({
    where: {
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.showId ? { showId: input.showId } : {}),
    },
    select: { showId: true, createdAt: true, ttsVoice: true, briefLength: true, userId: true },
  });

  const earliest = new Map<
    string,
    { followedAt: Date; ttsVoice: string; briefLength: string }
  >();
  for (const follow of follows) {
    const current = earliest.get(follow.showId);
    if (!current || follow.createdAt < current.followedAt) {
      earliest.set(follow.showId, {
        followedAt: follow.createdAt,
        ttsVoice: follow.ttsVoice,
        briefLength: follow.briefLength,
      });
    }
  }

  const items: WindowedBriefWork[] = [];
  for (const [showId, meta] of earliest) {
    items.push(
      ...(await windowedFollowedWork({
        showId,
        followedAt: meta.followedAt,
        ttsVoice: meta.ttsVoice,
        briefLength: meta.briefLength,
      })),
    );
  }
  return items;
}

export async function collectWindowedAutoBriefIds(input: {
  userId?: string;
  showId?: string;
}): Promise<string[]> {
  return orderAutoBriefQueue(await collectWindowedFollowedWork(input));
}

export async function countLatestFollowedNeedingBrief(userId: string) {
  const items = await collectWindowedFollowedWork({ userId });
  return items.filter((item) => item.kind === "unbriefed").length;
}

export type RecapRewriteReason = "missing" | "voice" | "length" | null;

export function recapRewriteReason(
  episode: {
    brief?: {
      sourceType?: string | null;
      spokenRecap?: string | null;
      briefLength?: string | null;
      sourceLimited?: boolean | null;
    } | null;
    recapAudio?: { durationSeconds?: number | null; voiceId?: string | null } | null;
  },
  requestedVoice?: string | null,
  requestedLength?: string | null,
): RecapRewriteReason {
  const brief = episode.brief;
  if (!brief || brief.sourceType !== "transcript" || !episode.recapAudio) return "missing";

  const voice = parseTtsVoice(requestedVoice ?? DEFAULT_TTS_VOICE);
  const storedVoice = parseTtsVoice(episode.recapAudio.voiceId ?? DEFAULT_TTS_VOICE);
  if (storedVoice !== voice) return "voice";
  if (brief.sourceLimited) return null;

  const length = parseBriefLength(requestedLength ?? brief.briefLength);
  const audioSeconds = episode.recapAudio.durationSeconds ?? 0;
  // Prefer playable duration. Words alone must not re-queue a Ready 8–12 min recap.
  if (audioSeconds > 0) {
    return recapAudioInBand(audioSeconds, length) ? null : "length";
  }
  if (brief.spokenRecap && !spokenRecapInBand(brief.spokenRecap, length)) return "length";
  return null;
}

export function recapNeedsRewrite(
  episode: {
    brief?: {
      sourceType?: string | null;
      spokenRecap?: string | null;
      briefLength?: string | null;
      sourceLimited?: boolean | null;
    } | null;
    recapAudio?: { durationSeconds?: number | null; voiceId?: string | null } | null;
  },
  requestedVoice?: string | null,
  requestedLength?: string | null,
): boolean {
  return recapRewriteReason(episode, requestedVoice, requestedLength) !== null;
}

export async function getFollowedShows(userId: string) {
  const prisma = getPrisma();
  return prisma.follow.findMany({
    where: { userId },
    include: {
      show: {
        include: {
          episodes: {
            orderBy: { publishedAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
