import { estimateSpokenMinutesAt1x } from "@/lib/brief-length";

/** Prefer stored MP3 duration; fall back to spoken-recap word count at 1x. */
export function durationHintForRecap(input: {
  durationSeconds?: number | null;
  spokenRecap?: string | null;
}): number | undefined {
  if (input.durationSeconds && input.durationSeconds > 0) return input.durationSeconds;
  if (input.spokenRecap) {
    return Math.max(1, Math.round(estimateSpokenMinutesAt1x(input.spokenRecap) * 60));
  }
  return undefined;
}

/**
 * Browsers sometimes report ~half the real MP3 duration before Xing is parsed.
 * Trust the stored/hinted length when the reported value is far too short.
 */
export function resolveRecapDuration(reported: number, hint?: number): number {
  const finite = Number.isFinite(reported) && reported > 0;
  if (finite && hint && hint > 0 && reported + 0.25 < hint * 0.55) {
    return hint;
  }
  if (finite) return reported;
  return hint && hint > 0 ? hint : 0;
}
