import { getPrisma } from "@/lib/db";
import type { ItunesPodcast } from "@/lib/itunes";
import { fetchRssEpisodes } from "@/lib/rss";

export type SyncedEpisode = {
  id: string;
  publishedAt: Date;
};

export async function upsertShowFromItunes(podcast: ItunesPodcast) {
  const prisma = getPrisma();
  return prisma.show.upsert({
    where: { itunesId: podcast.itunesId },
    update: {
      title: podcast.title,
      artist: podcast.artist,
      feedUrl: podcast.feedUrl,
      artworkUrl: podcast.artworkUrl,
      description: podcast.description,
    },
    create: {
      itunesId: podcast.itunesId,
      title: podcast.title,
      artist: podcast.artist,
      feedUrl: podcast.feedUrl,
      artworkUrl: podcast.artworkUrl,
      description: podcast.description,
    },
  });
}

export async function syncShowEpisodes(showId: string, feedUrl: string, limit?: number | null) {
  const prisma = getPrisma();
  const episodes = await fetchRssEpisodes(feedUrl, limit);
  const existing = await prisma.episode.findMany({
    where: { showId },
    select: { id: true, guid: true, transcriptUrl: true, link: true, audioUrl: true },
  });
  const have = new Map(existing.map((episode) => [episode.guid, episode]));
  const toCreate = episodes.filter((episode) => !have.has(episode.guid));
  const toRefresh = episodes.filter((episode) => {
    const row = have.get(episode.guid);
    if (!row) return false;
    return (
      (episode.transcriptUrl && episode.transcriptUrl !== row.transcriptUrl) ||
      (episode.link && episode.link !== row.link) ||
      (episode.audioUrl && !row.audioUrl)
    );
  });

  if (toCreate.length > 0) {
    await prisma.episode.createMany({
      data: toCreate.map((episode) => ({
        showId,
        guid: episode.guid,
        title: episode.title,
        publishedAt: episode.publishedAt,
        link: episode.link,
        audioUrl: episode.audioUrl,
        transcriptUrl: episode.transcriptUrl,
        description: episode.description,
        guest: episode.guest,
      })),
    });
  }

  for (const episode of toRefresh) {
    const row = have.get(episode.guid);
    if (!row) continue;
    await prisma.episode.update({
      where: { id: row.id },
      data: {
        transcriptUrl: episode.transcriptUrl ?? row.transcriptUrl,
        link: episode.link ?? row.link,
        audioUrl: episode.audioUrl ?? row.audioUrl,
      },
    });
  }

  const createdEpisodes: SyncedEpisode[] =
    toCreate.length === 0
      ? []
      : await prisma.episode.findMany({
          where: { showId, guid: { in: toCreate.map((episode) => episode.guid) } },
          select: { id: true, publishedAt: true },
        });

  return { fetched: episodes.length, created: createdEpisodes.length, createdEpisodes };
}
