/**
 * Scalar columns for queue, page, and scheduling reads.
 * `RecapAudio.data` is the MP3 blob (multi-megabyte) and `SttJob.text` is the
 * transcript body. Callers that only need duration, voice, or STT progress
 * must use these selects. The audio route is the one read of `data`. Transcript
 * text is loaded only while a job is reading or appending it.
 */
export const recapAudioMetadataSelect = {
  id: true,
  episodeId: true,
  mimeType: true,
  durationSeconds: true,
  voiceId: true,
  createdAt: true,
} as const;

export const sttJobMetadataSelect = {
  status: true,
  updatedAt: true,
  lockedAt: true,
  chunkCount: true,
  nextByte: true,
  totalBytes: true,
  coveredSeconds: true,
  error: true,
} as const;
