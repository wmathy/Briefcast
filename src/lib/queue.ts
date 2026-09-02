import { getPrisma } from "@/lib/db";

/** Briefs for shows the user follows, newest episode first. Seed/demo cards are not included unless followed. */
export async function getFollowedBriefQueue(userId: string) {
  const prisma = getPrisma();
  return prisma.episode.findMany({
    where: {
      brief: { isNot: null },
      show: { follows: { some: { userId } } },
    },
    include: { show: true, brief: true },
    orderBy: { publishedAt: "desc" },
  });
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
