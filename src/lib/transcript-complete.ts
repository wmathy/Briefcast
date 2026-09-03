import { countWords } from "@/lib/brief-length";
import { looksLikeSpokenTranscript } from "@/lib/transcripts";

export const FULL_TRANSCRIPT_UNAVAILABLE = "Full transcript not available yet — no brief";
export const FULL_TRANSCRIPT_UNAVAILABLE_SHORT = "No full transcript yet";

/** Floor vs episode duration. Below this, the text cannot cover the audio. */
export const COMPLETE_WPM_FLOOR = 100;

export const EXPECTED_WPM = 150;

export function parseDurationSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) {
    const seconds = Number(text);
    return seconds > 0 ? Math.round(seconds) : null;
  }
  const parts = text.split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? Math.round(total) : null;
}

export function minWordsForFullEpisode(durationSeconds: number): number {
  return Math.floor(durationSeconds * (COMPLETE_WPM_FLOOR / 60));
}

export function expectedWordsForEpisode(durationSeconds: number): number {
  return Math.round(durationSeconds * (EXPECTED_WPM / 60));
}

function hasSpeakerOrTimestamps(text: string): boolean {
  const speakerLabels = text.match(/^[ \t]*[A-Z][A-Z0-9 .,'’\-]{0,40}:/gm) ?? [];
  if (speakerLabels.length >= 3) return true;
  const timestamps = text.match(/\[\d{1,2}:\d{2}(?::\d{2})?\]|\b\d{2}:\d{2}:\d{2}\b/g) ?? [];
  return timestamps.length >= 5;
}

export function isPublishedTranscriptBrief(brief?: { sourceType?: string | null } | null): boolean {
  return brief?.sourceType === "transcript";
}

export function isCompleteEpisodeTranscript(input: {
  text: string;
  notes?: string | null;
  durationSeconds?: number | null;
  coveredAudioSeconds?: number | null;
}): { ok: boolean; reason: string; words: number; minWords: number | null } {
  const text = input.text.trim();
  const words = countWords(text);
  const notes = (input.notes ?? "").trim();
  const noteWords = countWords(notes);
  const duration = input.durationSeconds && input.durationSeconds > 0 ? input.durationSeconds : null;
  const minFromDuration = duration && duration >= 45 ? minWordsForFullEpisode(duration) : null;
  const covered =
    input.coveredAudioSeconds && input.coveredAudioSeconds > 0 ? input.coveredAudioSeconds : null;

  if (covered != null && duration && duration >= 45) {
    if (covered < duration * 0.85) {
      return {
        ok: false,
        reason: "partial-audio-coverage",
        words,
        minWords: minFromDuration,
      };
    }
  }

  if (words < 200) {
    return { ok: false, reason: "too-short", words, minWords: minFromDuration ?? 200 };
  }

  if (noteWords > 40 && words < noteWords * 2.5) {
    return { ok: false, reason: "notes-length", words, minWords: Math.ceil(noteWords * 2.5) };
  }

  if (noteWords > 80) {
    const sample = notes.slice(0, Math.min(180, notes.length));
    if (sample && text.includes(sample) && words < noteWords * 3) {
      return { ok: false, reason: "matches-notes", words, minWords: noteWords * 3 };
    }
  }

  if (duration && duration >= 45 && minFromDuration) {
    if (words < minFromDuration) {
      return { ok: false, reason: "below-duration-words", words, minWords: minFromDuration };
    }
  } else {
    if (!hasSpeakerOrTimestamps(text) && !looksLikeSpokenTranscript(text)) {
      return { ok: false, reason: "not-spoken", words, minWords: 800 };
    }
    if (words < 800) {
      return { ok: false, reason: "no-duration-too-short", words, minWords: 800 };
    }
  }

  if (!looksLikeSpokenTranscript(text) && words < (minFromDuration ?? 1500)) {
    return { ok: false, reason: "not-spoken", words, minWords: minFromDuration ?? 1500 };
  }

  return { ok: true, reason: "complete", words, minWords: minFromDuration };
}
