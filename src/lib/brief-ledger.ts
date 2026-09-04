import { getPrisma } from "@/lib/db";
import { recapNeedsRewrite } from "@/lib/queue";
import { parseTtsVoice } from "@/lib/tts-voice";

export type EpisodeIdentity = {
  id: string;
  title: string;
  publishedAt: Date;
  link: string | null;
};

export function episodeIdentity(episode: EpisodeIdentity): string {
  const day = episode.publishedAt.toISOString().slice(0, 10);
  return `${episode.id}:${day}:${episode.title}:${episode.link ?? ""}`;
}

export function latestIsAlreadyBriefed(input: {
  latestId: string | null;
  lastBriefedEpisodeId: string | null;
  latestNeedsWork: boolean;
}): boolean {
  if (!input.latestId || !input.lastBriefedEpisodeId) return false;
  if (input.latestId !== input.lastBriefedEpisodeId) return false;
  return !input.latestNeedsWork;
}

export async function markShowBriefed(showId: string, episodeId: string) {
  const prisma = getPrisma();
  await prisma.follow.updateMany({
    where: { showId },
    data: { lastBriefedEpisodeId: episodeId, lastBriefedAt: new Date() },
  });
}

export async function detectLatestUnbriefedEpisode(input: {
  showId: string;
  ttsVoice?: string | null;
}): Promise<{ latest: EpisodeIdentity | null; alreadyDone: boolean }> {
  const prisma = getPrisma();
  const latest = await prisma.episode.findFirst({
    where: { showId: input.showId },
    orderBy: { publishedAt: "desc" },
    include: { brief: true, recapAudio: true },
  });
  if (!latest) return { latest: null, alreadyDone: true };

  const follow = await prisma.follow.findFirst({
    where: { showId: input.showId },
    select: { lastBriefedEpisodeId: true, ttsVoice: true },
    orderBy: { createdAt: "desc" },
  });
  const voice = parseTtsVoice(input.ttsVoice ?? follow?.ttsVoice);
  const needsWork = recapNeedsRewrite(latest, voice);
  const alreadyDone = latestIsAlreadyBriefed({
    latestId: latest.id,
    lastBriefedEpisodeId: follow?.lastBriefedEpisodeId ?? null,
    latestNeedsWork: needsWork,
  });
  return {
    latest: {
      id: latest.id,
      title: latest.title,
      publishedAt: latest.publishedAt,
      link: latest.link,
    },
    alreadyDone,
  };
}
