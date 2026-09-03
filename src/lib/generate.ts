import { getPrisma } from "@/lib/db";
import { loadEpisodeSource } from "@/lib/sources";
import { mergeConfidenceNote, writeBriefFromSource } from "@/lib/brief";
import { xaiTtsMp3 } from "@/lib/xai";
import { TTS_SPEED, hasXaiKey, MissingXaiKeyError } from "@/lib/env";
import { fetchRssEpisodes } from "@/lib/rss";
import {
  FULL_TRANSCRIPT_UNAVAILABLE,
  isPublishedTranscriptBrief,
} from "@/lib/transcript-complete";
import {
  assertRecapInBand,
  countWords,
  parseBriefLength,
  RecapBandError,
  resolveBriefLength,
  type BriefLength,
} from "@/lib/brief-length";
import { mp3PlaybackDurationSeconds } from "@/lib/tts";
import { TranscriptInProgressError } from "@/lib/stt-job";
import { recapNeedsRewrite } from "@/lib/queue";

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

export function shouldPublishBrief(input: {
  hasCompleteTranscript: boolean;
  existingSourceType?: string | null;
  force: boolean;
}): "publish" | "keep-existing" | "unavailable" {
  if (!input.hasCompleteTranscript) {
    return isPublishedTranscriptBrief({ sourceType: input.existingSourceType })
      ? "keep-existing"
      : "unavailable";
  }
  if (input.existingSourceType === "transcript" && !input.force) {
    return "keep-existing";
  }
  return "publish";
}

export async function purgeNotesOnlyBriefs() {
  const prisma = getPrisma();
  const notes = await prisma.brief.findMany({
    where: { sourceType: { not: "transcript" } },
    select: { episodeId: true },
  });
  if (notes.length === 0) return 0;
  const episodeIds = notes.map((row) => row.episodeId);
  await prisma.$transaction([
    prisma.recapAudio.deleteMany({ where: { episodeId: { in: episodeIds } } }),
    prisma.brief.deleteMany({ where: { episodeId: { in: episodeIds } } }),
  ]);
  return notes.length;
}

async function resolveRssMeta(input: {
  storedUrl?: string | null;
  storedDuration?: number | null;
  storedAudio?: string | null;
  guid: string;
  feedUrl: string;
}): Promise<{ transcriptUrl: string | null; durationSeconds: number | null; audioUrl: string | null }> {
  if (input.storedUrl && input.storedDuration && input.storedAudio) {
    return {
      transcriptUrl: input.storedUrl,
      durationSeconds: input.storedDuration,
      audioUrl: input.storedAudio,
    };
  }
  try {
    const feedItems = await fetchRssEpisodes(input.feedUrl);
    const item = feedItems.find((row) => row.guid === input.guid);
    return {
      transcriptUrl: input.storedUrl ?? item?.transcriptUrl ?? null,
      durationSeconds: input.storedDuration ?? item?.durationSeconds ?? null,
      audioUrl: input.storedAudio ?? item?.audioUrl ?? null,
    };
  } catch {
    return {
      transcriptUrl: input.storedUrl ?? null,
      durationSeconds: input.storedDuration ?? null,
      audioUrl: input.storedAudio ?? null,
    };
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

  const rss = await resolveRssMeta({
    storedUrl: episode.transcriptUrl,
    storedDuration: episode.durationSeconds,
    storedAudio: episode.audioUrl,
    guid: episode.guid,
    feedUrl: episode.show.feedUrl,
  });

  let source;
  try {
    source = await loadEpisodeSource({
      description: episode.description,
      transcriptUrl: rss.transcriptUrl,
      episodeLink: episode.link,
      audioUrl: rss.audioUrl,
      durationSeconds: rss.durationSeconds,
      showTitle: episode.show.title,
      episodeTitle: episode.title,
      episodeId: episode.id,
    });
  } catch (error) {
    if (error instanceof TranscriptInProgressError) {
      return {
        episodeId: episode.id,
        published: isPublishedTranscriptBrief(episode.brief),
        skipped: true,
        reason: "transcript-in-progress" as const,
        message: "Transcribing…",
        sourceType: episode.brief?.sourceType ?? null,
        briefLength,
        sourceLimited: false,
        spokenWords: countWords(episode.brief?.spokenRecap ?? ""),
        sttChunks: error.progress.chunks,
        sttBytes: error.progress.nextByte,
        sttTotalBytes: error.progress.totalBytes,
      };
    }
    throw error;
  }

  const force = (options?.force ?? true) || recapNeedsRewrite(episode);
  const decision = shouldPublishBrief({
    hasCompleteTranscript: Boolean(source),
    existingSourceType: episode.brief?.sourceType,
    force,
  });

  if (decision === "unavailable") {
    if (episode.brief && !isPublishedTranscriptBrief(episode.brief)) {
      await prisma.$transaction([
        prisma.recapAudio.deleteMany({ where: { episodeId: episode.id } }),
        prisma.brief.deleteMany({ where: { episodeId: episode.id } }),
      ]);
    }
    return {
      episodeId: episode.id,
      published: false,
      skipped: true,
      reason: "no-full-transcript" as const,
      message: FULL_TRANSCRIPT_UNAVAILABLE,
      sourceType: null,
      briefLength,
      sourceLimited: false,
      spokenWords: 0,
    };
  }

  if (decision === "keep-existing" || !source) {
    return {
      episodeId: episode.id,
      published: isPublishedTranscriptBrief(episode.brief),
      skipped: true,
      reason: isPublishedTranscriptBrief(episode.brief) ? ("already-published" as const) : ("no-full-transcript" as const),
      message: isPublishedTranscriptBrief(episode.brief) ? null : FULL_TRANSCRIPT_UNAVAILABLE,
      sourceType: episode.brief?.sourceType ?? null,
      briefLength: parseBriefLength(episode.brief?.briefLength ?? briefLength),
      sourceLimited: episode.brief?.sourceLimited ?? false,
      spokenWords: countWords(episode.brief?.spokenRecap ?? ""),
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
  const audioSeconds = mp3PlaybackDurationSeconds(audio);
  try {
    assertRecapInBand({
      spokenText: spoken,
      audioSeconds,
      length: brief.briefLength,
      sourceLimited: brief.sourceLimited,
    });
  } catch (error) {
    if (error instanceof RecapBandError) {
      console.error("[recap]", error.message);
      throw error;
    }
    throw error;
  }

  await prisma.$transaction([
    prisma.brief.upsert({
      where: { episodeId: episode.id },
      update: {
        overview: brief.overview,
        segmentsJson: JSON.stringify(brief.segments),
        takeawaysJson: JSON.stringify(brief.takeaways),
        spokenRecap: spoken,
        sourceType: "transcript",
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
        sourceType: "transcript",
        confidenceNote,
        guest,
        briefLength: brief.briefLength,
        sourceLimited: brief.sourceLimited,
      },
    }),
    prisma.recapAudio.upsert({
      where: { episodeId: episode.id },
      update: {
        mimeType: "audio/mpeg",
        data: new Uint8Array(audio),
        durationSeconds: Math.round(audioSeconds),
      },
      create: {
        episodeId: episode.id,
        mimeType: "audio/mpeg",
        data: new Uint8Array(audio),
        durationSeconds: Math.round(audioSeconds),
      },
    }),
    prisma.episode.update({
      where: { id: episode.id },
      data: {
        guest,
        transcriptUrl: rss.transcriptUrl ?? episode.transcriptUrl,
        audioUrl: rss.audioUrl ?? episode.audioUrl,
        durationSeconds: rss.durationSeconds ?? episode.durationSeconds,
      },
    }),
  ]);

  return {
    episodeId: episode.id,
    published: true,
    skipped: false,
    reason: null,
    message: null,
    sourceType: "transcript" as const,
    briefLength: brief.briefLength,
    sourceLimited: brief.sourceLimited,
    spokenWords: countWords(spoken),
    audioSeconds: Math.round(audioSeconds),
  };
}
