import { getPrisma } from "@/lib/db";
import { loadEpisodeSource } from "@/lib/sources";
import { writeBriefFromSource } from "@/lib/brief";
import { xaiTtsMp3 } from "@/lib/xai";
import { TTS_SPEED, hasXaiKey, MissingXaiKeyError } from "@/lib/env";
import { fetchRssEpisodes } from "@/lib/rss";

export async function generateEpisodeBrief(episodeId: string) {
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
  });

  const brief = await writeBriefFromSource({
    showTitle: episode.show.title,
    episodeTitle: episode.title,
    publishedAt: episode.publishedAt,
    episodeLink: episode.link,
    knownGuest: episode.guest,
    source,
  });

  const guest = brief.guest ?? episode.guest;
  const spoken = brief.spokenRecap.trim();
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
        confidenceNote: source.confidenceNote,
        guest,
      },
      create: {
        episodeId: episode.id,
        overview: brief.overview,
        segmentsJson: JSON.stringify(brief.segments),
        takeawaysJson: JSON.stringify(brief.takeaways),
        spokenRecap: spoken,
        sourceType: source.sourceType,
        confidenceNote: source.confidenceNote,
        guest,
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

  return { episodeId: episode.id, sourceType: source.sourceType };
}
