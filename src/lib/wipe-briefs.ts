import { getPrisma } from "@/lib/db";
import { databaseUrl } from "@/lib/env";

export const WIPE_BRIEFS_CONFIRM = "WIPE_ALL_BRIEFS";

export function databaseHostLabel(): string | null {
  try {
    return new URL(databaseUrl()).hostname || null;
  } catch {
    return null;
  }
}

export async function wipeAllBriefArtifacts() {
  const prisma = getPrisma();
  const [briefs, recapAudio, sttJobs, ledgerRows, users, shows, follows, episodes] =
    await Promise.all([
      prisma.brief.count(),
      prisma.recapAudio.count(),
      prisma.sttJob.count(),
      prisma.follow.count({
        where: { OR: [{ lastBriefedEpisodeId: { not: null } }, { lastBriefedAt: { not: null } }] },
      }),
      prisma.user.count(),
      prisma.show.count(),
      prisma.follow.count(),
      prisma.episode.count(),
    ]);

  const deletedAudio = await prisma.recapAudio.deleteMany();
  const deletedBriefs = await prisma.brief.deleteMany();
  const deletedStt = await prisma.sttJob.deleteMany();
  const clearedLedger = await prisma.follow.updateMany({
    data: { lastBriefedEpisodeId: null, lastBriefedAt: null },
  });

  const after = {
    briefs: await prisma.brief.count(),
    recapAudio: await prisma.recapAudio.count(),
    sttJobs: await prisma.sttJob.count(),
    ledgerRows: await prisma.follow.count({
      where: { OR: [{ lastBriefedEpisodeId: { not: null } }, { lastBriefedAt: { not: null } }] },
    }),
    users: await prisma.user.count(),
    shows: await prisma.show.count(),
    follows: await prisma.follow.count(),
    episodes: await prisma.episode.count(),
  };

  return {
    host: databaseHostLabel(),
    before: { briefs, recapAudio, sttJobs, ledgerRows, users, shows, follows, episodes },
    deleted: {
      briefs: deletedBriefs.count,
      recapAudio: deletedAudio.count,
      sttJobs: deletedStt.count,
      ledgerCleared: clearedLedger.count,
    },
    after,
  };
}
