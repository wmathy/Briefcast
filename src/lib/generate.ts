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

export function shouldRewriteExistingBrief(input: {
  existingSourceType?: string | null;
  hasAudio: boolean;
  nextSourceType: "transcript" | "shownotes";
  force: boolean;
}): boolean {
  if (input.force) return true;
  if (!input.existingSourceType || !input.hasAudio) return true;
  if (input.nextSourceType === "transcript") return true;
  return false;
}

async function resolveRssTranscriptUrl(input: {
  storedUrl?: string | null;
  guid: string;
  feedUrl: string;
}): Promise<string | null> {
  if (input.storedUrl) return input.storedUrl;
  try {
    const feedItems = await fetchRssEpisodes(input.feedUrl);
    return feedItems.find((item) => item.guid === input.guid)?.transcriptUrl ?? null;
  } catch {
    return null;
  }
}

export async function generateEpisodeBrief(
  episodeId: string,
  options?: { userId?: string; briefLength?: BriefLength; force?: boolean },
) {
  if (!hasXaiKey()) {
    throw new MissingXaiKeyError();
  }

  const prisma = getPrisma();
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { show: true, brief: true, recapAudio: true },
  });
  if (!episode) {
    throw new Error("Episode not found.");
  }

  const briefLength =
    options?.briefLength ?? (await resolveEpisodeBriefLength(episode.showId, options?.userId));

  const transcriptUrl = await resolveRssTranscriptUrl({
    storedUrl: episode.transcriptUrl,
    guid: episode.guid,
    feedUrl: episode.show.feedUrl,
  });

  const source = await loadEpisodeSource({
    description: episode.description,
    transcriptUrl,
    episodeLink: episode.link,
    audioUrl: episode.audioUrl,
    showTitle: episode.show.title,
    episodeTitle: episode.title,
  });

  const force = options?.force ?? true;
  if (
    !shouldRewriteExistingBrief({
      existingSourceType: episode.brief?.sourceType,
      hasAudio: Boolean(episode.recapAudio),
      nextSourceType: source.sourceType,
      force,
    })
  ) {
    return {
      episodeId: episode.id,
      sourceType: source.sourceType,
      briefLength: parseBriefLength(episode.brief?.briefLength ?? briefLength),
      sourceLimited: episode.brief?.sourceLimited ?? true,
      spokenWords: countWords(episode.brief?.spokenRecap ?? ""),
      skipped: true,
    };
  }

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
      data: {
        guest,
        transcriptUrl: transcriptUrl ?? episode.transcriptUrl,
      },
    }),
  ]);

  return {
    episodeId: episode.id,
    sourceType: source.sourceType,
    briefLength: brief.briefLength,
    sourceLimited: brief.sourceLimited,
    spokenWords: countWords(spoken),
    skipped: false,
  };
}
