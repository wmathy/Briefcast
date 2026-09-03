import { getPrisma } from "@/lib/db";
import {
  AUTO_BRIEF_BACKFILL,
  followWindowStart,
} from "@/lib/queue-window";
import { spokenRecapInBand, parseBriefLength, recapAudioInBand } from "@/lib/brief-length";

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

async function windowedUnbriefedIds(input: {
  showId: string;
  followedAt: Date;
}): Promise<string[]> {
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
  return rows.filter((row) => recapNeedsRewrite(row)).map((row) => row.id);
}

export async function countUnbriefedFollowedEpisodes(userId: string) {
  const prisma = getPrisma();
  const follows = await prisma.follow.findMany({
    where: { userId },
    select: { showId: true, createdAt: true },
  });
  let count = 0;
  for (const follow of follows) {
    const ids = await windowedUnbriefedIds({ showId: follow.showId, followedAt: follow.createdAt });
    count += ids.length;
  }
  return count;
}

export async function collectWindowedAutoBriefIds(input: {
  userId?: string;
  showId?: string;
}): Promise<string[]> {
  const prisma = getPrisma();
  const follows = await prisma.follow.findMany({
    where: {
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.showId ? { showId: input.showId } : {}),
    },
    select: { showId: true, createdAt: true },
  });

  const earliest = new Map<string, Date>();
  for (const follow of follows) {
    const current = earliest.get(follow.showId);
    if (!current || follow.createdAt < current) earliest.set(follow.showId, follow.createdAt);
  }

  const ids: string[] = [];
  for (const [showId, followedAt] of earliest) {
    ids.push(...(await windowedUnbriefedIds({ showId, followedAt })));
  }
  return [...new Set(ids)];
}

export async function countLatestFollowedNeedingBrief(userId: string) {
  const ids = await collectWindowedAutoBriefIds({ userId });
  return ids.length;
}

export function recapNeedsRewrite(episode: {
  brief?: {
    sourceType?: string | null;
    spokenRecap?: string | null;
    briefLength?: string | null;
    sourceLimited?: boolean | null;
  } | null;
  recapAudio?: { durationSeconds?: number | null } | null;
}): boolean {
  const brief = episode.brief;
  if (!brief || brief.sourceType !== "transcript" || !episode.recapAudio) return true;
  if (brief.sourceLimited) return false;
  const length = parseBriefLength(brief.briefLength);
  if (brief.spokenRecap && !spokenRecapInBand(brief.spokenRecap, length)) return true;
  const audioSeconds = episode.recapAudio.durationSeconds;
  if (audioSeconds && audioSeconds > 0 && !recapAudioInBand(audioSeconds, length)) return true;
  return false;
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
