import { getPrisma } from "@/lib/db";
import { loadEpisodeSource } from "@/lib/sources";
import { mergeConfidenceNote, writeBriefFromSource } from "@/lib/brief";
import { xaiTtsMp3 } from "@/lib/xai";
import { TTS_SPEED, hasXaiKey, MissingXaiKeyError } from "@/lib/env";
import { fetchRssEpisodes } from "@/lib/rss";
import {
  countWords,
  parseBriefLength,
  resolveBriefLength,
  type BriefLength,
} from "@/lib/brief-length";

export async function resolveEpisodeBriefLength(
  showId: string,
  userId?: string,
): Promise<BriefLength> {
  const prisma = getPrisma();
  const userFollow = userId
    ? await prisma.follow.findUnique({
        where: { userId_showId: { userId, showId } },
        select: { briefLength: true },
      })
    : null;
  const follows = await prisma.follow.findMany({
    where: { showId },
    select: { briefLength: true },
  });
  return resolveBriefLength({
    userFollowLength: userFollow?.briefLength,
    followerLengths: follows.map((follow) => parseBriefLength(follow.briefLength)),
  });
}

export async function generateEpisodeBrief(
  episodeId: string,
  options?: { userId?: string; briefLength?: BriefLength },
) {
  if (!hasXaiKey()) {
    throw new MissingXaiKeyError();
  }

  const prisma = getPrisma();
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { show: true },
  });
  if (!episode) {
    throw new Error("Episode not found.");
  }

  const briefLength =
    options?.briefLength ?? (await resolveEpisodeBriefLength(episode.showId, options?.userId));

  let transcriptUrl: string | null = null;
  try {
    const feedItems = await fetchRssEpisodes(episode.show.feedUrl, 40);
    transcriptUrl = feedItems.find((item) => item.guid === episode.guid)?.transcriptUrl ?? null;
  } catch {
    transcriptUrl = null;
  }

  const source = await loadEpisodeSource({
    description: episode.description,
    transcriptUrl,
    episodeLink: episode.link,
    showTitle: episode.show.title,
    episodeTitle: episode.title,
  });

  const brief = await writeBriefFromSource({
    showTitle: episode.show.title,
    episodeTitle: episode.title,
    publishedAt: episode.publishedAt,
    episodeLink: episode.link,
    knownGuest: episode.guest,
    source,
    briefLength,
  });

  const guest = brief.guest ?? episode.guest;
  const spoken = brief.spokenRecap.trim();
  const confidenceNote = mergeConfidenceNote(source.confidenceNote, brief.briefLength, brief.sourceLimited);
  const audio = await xaiTtsMp3(spoken, TTS_SPEED);

  await prisma.$transaction([
    prisma.brief.upsert({
      where: { episodeId: episode.id },
      update: {
        overview: brief.overview,
        segmentsJson: JSON.stringify(brief.segments),
        takeawaysJson: JSON.stringify(brief.takeaways),
        spokenRecap: spoken,
        sourceType: source.sourceType,
        confidenceNote,
        guest,
        briefLength: brief.briefLength,
        sourceLimited: brief.sourceLimited,
      },
      create: {
        episodeId: episode.id,
        overview: brief.overview,
        segmentsJson: JSON.stringify(brief.segments),
        takeawaysJson: JSON.stringify(brief.takeaways),
        spokenRecap: spoken,
        sourceType: source.sourceType,
        confidenceNote,
        guest,
        briefLength: brief.briefLength,
        sourceLimited: brief.sourceLimited,
      },
    }),
    prisma.recapAudio.upsert({
      where: { episodeId: episode.id },
      update: { mimeType: "audio/mpeg", data: new Uint8Array(audio) },
      create: { episodeId: episode.id, mimeType: "audio/mpeg", data: new Uint8Array(audio) },
    }),
    prisma.episode.update({
      where: { id: episode.id },
      data: { guest },
    }),
  ]);

  return {
    episodeId: episode.id,
    sourceType: source.sourceType,
    briefLength: brief.briefLength,
    sourceLimited: brief.sourceLimited,
    spokenWords: countWords(spoken),
  };
}
