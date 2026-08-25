import { createPrismaClient } from "../src/lib/db";
import { SEED_EPISODES, SEED_SHOWS } from "../src/lib/seed-data";

async function main() {
  const prisma = createPrismaClient();

  for (const show of SEED_SHOWS) {
    await prisma.show.upsert({
      where: { itunesId: show.itunesId },
      update: {
        title: show.title,
        artist: show.artist,
        feedUrl: show.feedUrl,
        artworkUrl: show.artworkUrl,
        description: show.description,
      },
      create: show,
    });
  }

  for (const episode of SEED_EPISODES) {
    await prisma.episode.upsert({
      where: { id: episode.id },
      update: {
        title: episode.title,
        publishedAt: episode.publishedAt,
        link: episode.link,
        description: episode.description,
        guest: episode.guest,
        seeded: true,
      },
      create: {
        id: episode.id,
        showId: episode.showId,
        guid: episode.guid,
        title: episode.title,
        publishedAt: episode.publishedAt,
        link: episode.link,
        audioUrl: episode.audioUrl,
        description: episode.description,
        guest: episode.guest,
        seeded: true,
      },
    });

    await prisma.brief.upsert({
      where: { episodeId: episode.id },
      update: {
        overview: episode.brief.overview,
        segmentsJson: JSON.stringify(episode.brief.segments),
        takeawaysJson: JSON.stringify(episode.brief.takeaways),
        spokenRecap: episode.brief.spokenRecap,
        sourceType: episode.brief.sourceType,
        confidenceNote: episode.brief.confidenceNote,
        guest: episode.brief.guest,
      },
      create: {
        episodeId: episode.id,
        overview: episode.brief.overview,
        segmentsJson: JSON.stringify(episode.brief.segments),
        takeawaysJson: JSON.stringify(episode.brief.takeaways),
        spokenRecap: episode.brief.spokenRecap,
        sourceType: episode.brief.sourceType,
        confidenceNote: episode.brief.confidenceNote,
        guest: episode.brief.guest,
      },
    });
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
