import { getPrisma } from "@/lib/db";

/** Real generated briefs (written + spoken audio) for followed shows, newest episode first. */
export async function getFollowedBriefQueue(userId: string) {
  const prisma = getPrisma();
  return prisma.episode.findMany({
    where: {
      brief: { isNot: null },
      recapAudio: { isNot: null },
      show: { follows: { some: { userId } } },
    },
    include: { show: true, brief: true, recapAudio: true },
    orderBy: { publishedAt: "desc" },
  });
}

export async function countUnbriefedFollowedEpisodes(userId: string) {
  const prisma = getPrisma();
  return prisma.episode.count({
    where: {
      OR: [{ brief: { is: null } }, { recapAudio: { is: null } }],
      show: { follows: { some: { userId } } },
    },
  });
}

export async function countLatestFollowedNeedingBrief(userId: string) {
  const prisma = getPrisma();
  const follows = await prisma.follow.findMany({
    where: { userId },
    select: { showId: true },
  });
  let needing = 0;
  for (const follow of follows) {
    const latest = await prisma.episode.findFirst({
      where: { showId: follow.showId },
      orderBy: { publishedAt: "desc" },
      include: { brief: true, recapAudio: true },
    });
    if (latest && (!latest.brief || !latest.recapAudio)) {
      needing += 1;
    }
  }
  return needing;
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
