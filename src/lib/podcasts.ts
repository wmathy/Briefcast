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
    select: { guid: true },
  });
  const have = new Set(existing.map((episode) => episode.guid));
  const toCreate = episodes.filter((episode) => !have.has(episode.guid));

  if (toCreate.length > 0) {
    await prisma.episode.createMany({
      data: toCreate.map((episode) => ({
        showId,
        guid: episode.guid,
        title: episode.title,
        publishedAt: episode.publishedAt,
        link: episode.link,
        audioUrl: episode.audioUrl,
        description: episode.description,
        guest: episode.guest,
      })),
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
