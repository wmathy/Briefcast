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
  const createdEpisodes: SyncedEpisode[] = [];

  for (const episode of episodes) {
    const existing = await prisma.episode.findUnique({
      where: { showId_guid: { showId, guid: episode.guid } },
      select: { id: true },
    });
    if (existing) {
      await prisma.episode.update({
        where: { id: existing.id },
        data: {
          title: episode.title,
          publishedAt: episode.publishedAt,
          link: episode.link,
          audioUrl: episode.audioUrl,
          description: episode.description,
          guest: episode.guest,
        },
      });
      continue;
    }
    const created = await prisma.episode.create({
      data: {
        showId,
        guid: episode.guid,
        title: episode.title,
        publishedAt: episode.publishedAt,
        link: episode.link,
        audioUrl: episode.audioUrl,
        description: episode.description,
        guest: episode.guest,
      },
    });
    createdEpisodes.push({ id: created.id, publishedAt: created.publishedAt });
  }

  return { fetched: episodes.length, created: createdEpisodes.length, createdEpisodes };
}
