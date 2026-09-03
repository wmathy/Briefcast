import { getPrisma } from "@/lib/db";
import { STT_CHUNK_BYTES } from "@/lib/audio-chunks";
import { fetchAudioSlice, sttBufferChunk, xaiSttFromAudioUrl, type SttResult } from "@/lib/xai";

export const STT_CHUNKS_PER_TURN = 1;
const LOCK_STALE_MS = 4 * 60 * 1000;

export class TranscriptInProgressError extends Error {
  constructor(
    public readonly progress: {
      chunks: number;
      nextByte: number;
      totalBytes: number | null;
      coveredSeconds: number;
    },
  ) {
    super("transcript-in-progress");
    this.name = "TranscriptInProgressError";
  }
}

type JobRow = {
  episodeId: string;
  audioUrl: string;
  nextByte: number;
  totalBytes: number | null;
  chunkCount: number;
  coveredSeconds: number;
  text: string;
  status: string;
  error: string | null;
  lockedAt: Date | null;
};

function asResult(job: JobRow): SttResult {
  return { text: job.text, duration: job.coveredSeconds, chunks: job.chunkCount };
}

function lockIsFresh(job: JobRow): boolean {
  if (job.status !== "running" || !job.lockedAt) return false;
  return Date.now() - job.lockedAt.getTime() < LOCK_STALE_MS;
}

export async function transcribeEpisodeDurable(input: {
  episodeId: string;
  audioUrl: string;
  keyterms: string[];
  durationSeconds?: number | null;
}): Promise<SttResult> {
  const prisma = getPrisma();
  let job = await prisma.sttJob.findUnique({ where: { episodeId: input.episodeId } });

  if (job && job.audioUrl !== input.audioUrl) {
    await prisma.sttJob.delete({ where: { episodeId: input.episodeId } });
    job = null;
  }

  if (job?.status === "complete" && job.text.length > 80) {
    return asResult(job);
  }

  if (job && lockIsFresh(job)) {
    throw new TranscriptInProgressError({
      chunks: job.chunkCount,
      nextByte: job.nextByte,
      totalBytes: job.totalBytes,
      coveredSeconds: job.coveredSeconds,
    });
  }

  if (!job) {
    job = await prisma.sttJob.create({
      data: {
        episodeId: input.episodeId,
        audioUrl: input.audioUrl,
        status: "running",
        lockedAt: new Date(),
      },
    });
  } else {
    job = await prisma.sttJob.update({
      where: { episodeId: input.episodeId },
      data: { status: "running", lockedAt: new Date(), error: null },
    });
  }

  try {
    const next = await advanceJob(job, input.keyterms, input.durationSeconds);
    // Even the last chunk returns in-progress so this 300s turn does not also
    // write the brief and run TTS. The next continue reads the completed job.
    throw new TranscriptInProgressError({
      chunks: next.chunkCount,
      nextByte: next.nextByte,
      totalBytes: next.totalBytes,
      coveredSeconds: next.coveredSeconds,
    });
  } catch (error) {
    if (error instanceof TranscriptInProgressError) throw error;
    const message = error instanceof Error ? error.message : "STT failed.";
    await prisma.sttJob.update({
      where: { episodeId: input.episodeId },
      data: { status: "failed", error: message, lockedAt: null },
    });
    throw error;
  }
}

async function advanceJob(
  job: JobRow,
  keyterms: string[],
  durationSeconds?: number | null,
): Promise<JobRow> {
  const prisma = getPrisma();
  let current = job;

  for (let turn = 0; turn < STT_CHUNKS_PER_TURN; turn += 1) {
    if (current.totalBytes != null && current.nextByte >= current.totalBytes && current.text.length > 80) {
      return prisma.sttJob.update({
        where: { episodeId: current.episodeId },
        data: { status: "complete", lockedAt: null },
      });
    }

    const slice = await fetchAudioSlice(current.audioUrl, current.nextByte, STT_CHUNK_BYTES);
    if (!slice) {
      if (current.totalBytes != null && current.nextByte >= current.totalBytes && current.text.length > 80) {
        return prisma.sttJob.update({
          where: { episodeId: current.episodeId },
          data: { status: "complete", lockedAt: null },
        });
      }
      if (current.chunkCount === 0) {
        const fallback = await xaiSttFromAudioUrl(current.audioUrl, keyterms, { durationSeconds });
        if (fallback) {
          return prisma.sttJob.update({
            where: { episodeId: current.episodeId },
            data: {
              status: "complete",
              text: fallback.text,
              coveredSeconds: Math.round(fallback.duration),
              chunkCount: fallback.chunks,
              lockedAt: null,
            },
          });
        }
      }
      throw new Error("Could not download episode audio for STT.");
    }

    const result = await sttBufferChunk(slice.data, current.chunkCount, keyterms);
    if (!result) {
      throw new Error(`STT chunk ${current.chunkCount + 1} failed after retries.`);
    }

    const nextByte = current.nextByte + slice.data.length;
    const done = nextByte >= slice.totalBytes;
    current = await prisma.sttJob.update({
      where: { episodeId: current.episodeId },
      data: {
        text: current.text ? `${current.text}\n${result.text}` : result.text,
        coveredSeconds: current.coveredSeconds + Math.round(result.duration),
        chunkCount: current.chunkCount + 1,
        nextByte,
        totalBytes: slice.totalBytes,
        status: done ? "complete" : "running",
        lockedAt: done ? null : new Date(),
      },
    });
    console.info("[stt] progress", {
      episodeId: current.episodeId,
      chunks: current.chunkCount,
      nextByte: current.nextByte,
      totalBytes: current.totalBytes,
      coveredSeconds: current.coveredSeconds,
    });
    if (done) return current;
  }

  return prisma.sttJob.update({
    where: { episodeId: current.episodeId },
    data: { status: "pending", lockedAt: null },
  });
}
