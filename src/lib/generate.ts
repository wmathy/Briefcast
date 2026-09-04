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
  recapAudioInBand,
  resolveBriefLength,
  spokenRecapInBand,
  type BriefLength,
} from "@/lib/brief-length";
import { mp3PlaybackDurationSeconds } from "@/lib/tts";
import { TranscriptInProgressError } from "@/lib/stt-job";
import { recapNeedsRewrite } from "@/lib/queue";
import { markShowBriefed } from "@/lib/brief-ledger";
import { DEFAULT_TTS_VOICE, parseTtsVoice } from "@/lib/tts-voice";

export async function resolveEpisodeTtsVoice(showId: string, userId?: string): Promise<string> {
  const prisma = getPrisma();
  if (userId) {
    const follow = await prisma.follow.findUnique({
      where: { userId_showId: { userId, showId } },
      select: { ttsVoice: true },
    });
    if (follow) return parseTtsVoice(follow.ttsVoice);
  }
  const follow = await prisma.follow.findFirst({
    where: { showId },
    select: { ttsVoice: true },
    orderBy: { createdAt: "desc" },
  });
  return parseTtsVoice(follow?.ttsVoice);
}

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

export function canReuseWrittenBrief(input: {
  existingSourceType?: string | null;
  spokenRecap?: string | null;
  storedLength?: string | null;
  sourceLimited?: boolean | null;
  requestedLength: BriefLength;
}): boolean {
  if (input.existingSourceType !== "transcript" || !input.spokenRecap?.trim()) return false;
  if (parseBriefLength(input.storedLength) !== input.requestedLength) return false;
  if (input.sourceLimited) return true;
  return spokenRecapInBand(input.spokenRecap, input.requestedLength);
}

export function canReuseRecapAudio(input: {
  audioSeconds?: number | null;
  sourceLimited?: boolean | null;
  requestedLength: BriefLength;
  storedVoice?: string | null;
  requestedVoice?: string | null;
}): boolean {
  const requestedVoice = parseTtsVoice(input.requestedVoice ?? DEFAULT_TTS_VOICE);
  if (parseTtsVoice(input.storedVoice ?? DEFAULT_TTS_VOICE) !== requestedVoice) return false;
  const seconds = input.audioSeconds;
  if (!seconds || seconds <= 0) return false;
  if (input.sourceLimited) return true;
  return recapAudioInBand(seconds, input.requestedLength);
}

export function planBriefGeneration(input: {
  hasCompleteTranscript: boolean;
  existingSourceType?: string | null;
  spokenRecap?: string | null;
  storedLength?: string | null;
  sourceLimited?: boolean | null;
  audioSeconds?: number | null;
  requestedLength: BriefLength;
  storedVoice?: string | null;
  requestedVoice?: string | null;
}): "already-published" | "tts-only" | "write-then-tts" | "keep-existing" | "unavailable" {
  const reuseWritten = canReuseWrittenBrief(input);
  const reuseAudio = canReuseRecapAudio(input);
  if (reuseWritten && reuseAudio) return "already-published";
  if (reuseWritten) return "tts-only";
  if (input.hasCompleteTranscript) return "write-then-tts";
  return isPublishedTranscriptBrief({ sourceType: input.existingSourceType })
    ? "keep-existing"
    : "unavailable";
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
  // Publisher transcript is optional. Rogan/Tucker have audio + duration but no
  // transcriptUrl — do not re-download a multi-thousand-item feed on every turn.
  if (input.storedAudio) {
    return {
      transcriptUrl: input.storedUrl ?? null,
      durationSeconds: input.storedDuration ?? null,
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
  const ttsVoice = await resolveEpisodeTtsVoice(episode.showId, options?.userId);

  const reusePlan = planBriefGeneration({
    hasCompleteTranscript: false,
    existingSourceType: episode.brief?.sourceType,
    spokenRecap: episode.brief?.spokenRecap,
    storedLength: episode.brief?.briefLength,
    sourceLimited: episode.brief?.sourceLimited,
    audioSeconds: episode.recapAudio?.durationSeconds,
    requestedLength: briefLength,
    storedVoice: episode.recapAudio?.voiceId,
    requestedVoice: ttsVoice,
  });

  if (reusePlan === "already-published") {
    return {
      episodeId: episode.id,
      published: true,
      skipped: true,
      reason: "already-published" as const,
      message: null,
      sourceType: "transcript" as const,
      briefLength: parseBriefLength(episode.brief?.briefLength ?? briefLength),
      sourceLimited: episode.brief?.sourceLimited ?? false,
      spokenWords: countWords(episode.brief?.spokenRecap ?? ""),
      audioSeconds: episode.recapAudio?.durationSeconds ?? null,
    };
  }

  if (reusePlan === "tts-only" && episode.brief) {
    return persistRecapAudioAfterTts({
      episodeId: episode.id,
      showId: episode.showId,
      spoken: episode.brief.spokenRecap,
      briefLength: parseBriefLength(episode.brief.briefLength ?? briefLength),
      sourceLimited: episode.brief.sourceLimited,
      sourceType: "transcript",
      voiceId: ttsVoice,
    });
  }

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
        sttBusy: Boolean(error.progress.busy),
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

  // Persist the written brief before TTS so a 300s timeout keeps the draft.
  // The next continue pass only synthesizes audio.
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

  const oldWordsOutOfBand =
    episode.brief?.spokenRecap &&
    !episode.brief.sourceLimited &&
    !spokenRecapInBand(episode.brief.spokenRecap, parseBriefLength(episode.brief.briefLength ?? briefLength));
  if (oldWordsOutOfBand) {
    await prisma.recapAudio.deleteMany({ where: { episodeId: episode.id } });
  }

  return {
    episodeId: episode.id,
    published: false,
    skipped: true,
    reason: "audio-pending" as const,
    message: "Writing audio…",
    sourceType: "transcript" as const,
    briefLength: brief.briefLength,
    sourceLimited: brief.sourceLimited,
    spokenWords: countWords(spoken),
  };
}

async function persistRecapAudioAfterTts(input: {
  episodeId: string;
  showId: string;
  spoken: string;
  briefLength: BriefLength;
  sourceLimited: boolean;
  sourceType: "transcript";
  voiceId: string;
}) {
  const prisma = getPrisma();
  const voiceId = parseTtsVoice(input.voiceId);
  const audio = await xaiTtsMp3(input.spoken, TTS_SPEED, voiceId);
  const audioSeconds = mp3PlaybackDurationSeconds(audio);
  try {
    assertRecapInBand({
      spokenText: input.spoken,
      audioSeconds,
      length: input.briefLength,
      sourceLimited: input.sourceLimited,
    });
  } catch (error) {
    if (error instanceof RecapBandError) {
      console.error("[recap]", error.message);
      throw error;
    }
    throw error;
  }

  await prisma.recapAudio.upsert({
    where: { episodeId: input.episodeId },
    update: {
      mimeType: "audio/mpeg",
      data: new Uint8Array(audio),
      durationSeconds: Math.round(audioSeconds),
      voiceId,
    },
    create: {
      episodeId: input.episodeId,
      mimeType: "audio/mpeg",
      data: new Uint8Array(audio),
      durationSeconds: Math.round(audioSeconds),
      voiceId,
    },
  });
  await markShowBriefed(input.showId, input.episodeId);

  return {
    episodeId: input.episodeId,
    published: true,
    skipped: false,
    reason: null,
    message: null,
    sourceType: input.sourceType,
    briefLength: input.briefLength,
    sourceLimited: input.sourceLimited,
    spokenWords: countWords(input.spoken),
    audioSeconds: Math.round(audioSeconds),
  };
}
