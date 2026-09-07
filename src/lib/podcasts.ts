import { getPrisma } from "@/lib/db";
import { canonicalItunesFeedUrl, lookupPodcast, resolveItunesPodcast, type ItunesPodcast } from "@/lib/itunes";
import { fetchRssEpisodes } from "@/lib/rss";

export type SyncedEpisode = {
  id: string;
  publishedAt: Date;
};

export async function upsertShowFromItunes(podcast: ItunesPodcast) {
  const resolved = await resolveItunesPodcast(podcast);
  const prisma = getPrisma();
  return prisma.show.upsert({
    where: { itunesId: resolved.itunesId },
    update: {
      title: resolved.title,
      artist: resolved.artist,
      feedUrl: resolved.feedUrl,
      artworkUrl: resolved.artworkUrl,
      description: resolved.description,
    },
    create: {
      itunesId: resolved.itunesId,
      title: resolved.title,
      artist: resolved.artist,
      feedUrl: resolved.feedUrl,
      artworkUrl: resolved.artworkUrl,
      description: resolved.description,
    },
  });
}

async function resolvedShowFeedUrl(showId: string, feedUrl: string): Promise<string> {
  const prisma = getPrisma();
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: { itunesId: true, feedUrl: true },
  });
  const candidate = feedUrl || show?.feedUrl || "";
  const known = show ? canonicalItunesFeedUrl(show.itunesId, candidate) : candidate || null;
  if (known) {
    if (show && known !== show.feedUrl) {
      await prisma.show.update({ where: { id: showId }, data: { feedUrl: known } });
    }
    return known;
  }
  if (show) {
    const lookedUp = await lookupPodcast(show.itunesId);
    if (lookedUp?.feedUrl) {
      await prisma.show.update({ where: { id: showId }, data: { feedUrl: lookedUp.feedUrl } });
      return lookedUp.feedUrl;
    }
  }
  return candidate;
}

export async function syncShowEpisodes(showId: string, feedUrl: string, limit?: number | null) {
  const prisma = getPrisma();
  const resolvedFeedUrl = await resolvedShowFeedUrl(showId, feedUrl);
  const episodes = await fetchRssEpisodes(resolvedFeedUrl, limit);
  const existing = await prisma.episode.findMany({
    where: { showId },
    select: { id: true, guid: true, transcriptUrl: true, link: true, audioUrl: true, durationSeconds: true },
  });
  const have = new Map(existing.map((episode) => [episode.guid, episode]));
  const toCreate = episodes.filter((episode) => !have.has(episode.guid));
  const toRefresh = episodes.filter((episode) => {
    const row = have.get(episode.guid);
    if (!row) return false;
    return (
      (episode.transcriptUrl && episode.transcriptUrl !== row.transcriptUrl) ||
      (episode.link && episode.link !== row.link) ||
      (episode.audioUrl && !row.audioUrl) ||
      (episode.durationSeconds != null && episode.durationSeconds !== row.durationSeconds)
    );
  });

  if (toCreate.length > 0) {
    await prisma.episode.createMany({
      skipDuplicates: true,
      data: toCreate.map((episode) => ({
        showId,
        guid: episode.guid,
        title: episode.title,
        publishedAt: episode.publishedAt,
        link: episode.link,
        audioUrl: episode.audioUrl,
        transcriptUrl: episode.transcriptUrl,
        durationSeconds: episode.durationSeconds,
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
        durationSeconds: episode.durationSeconds ?? row.durationSeconds,
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
