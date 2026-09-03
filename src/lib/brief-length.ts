export const BRIEF_LENGTHS = ["short", "medium", "long"] as const;

export type BriefLength = (typeof BRIEF_LENGTHS)[number];

export const DEFAULT_BRIEF_LENGTH: BriefLength = "medium";

/** Spoken length is measured at 1x, ~150 words per minute. */
export const SPOKEN_WORDS_PER_MINUTE = 150;

export type BriefLengthSpec = {
  id: BriefLength;
  label: string;
  durationLabel: string;
  minutes: { min: number; max: number };
  spokenWords: { min: number; max: number };
  overviewSentences: { min: number; max: number };
  segments: { min: number; max: number };
  takeaways: { min: number; max: number };
};

export const BRIEF_LENGTH_SPECS: Record<BriefLength, BriefLengthSpec> = {
  short: {
    id: "short",
    label: "Short",
    durationLabel: "3–5 min at 1x",
    minutes: { min: 3, max: 5 },
    spokenWords: { min: 450, max: 750 },
    overviewSentences: { min: 2, max: 3 },
    segments: { min: 2, max: 5 },
    takeaways: { min: 4, max: 5 },
  },
  medium: {
    id: "medium",
    label: "Medium",
    durationLabel: "8–12 min at 1x",
    minutes: { min: 8, max: 12 },
    spokenWords: { min: 1200, max: 1800 },
    overviewSentences: { min: 3, max: 5 },
    segments: { min: 5, max: 10 },
    takeaways: { min: 4, max: 6 },
  },
  long: {
    id: "long",
    label: "Long",
    durationLabel: "20–30 min at 1x",
    minutes: { min: 20, max: 30 },
    spokenWords: { min: 3000, max: 4500 },
    overviewSentences: { min: 5, max: 8 },
    segments: { min: 8, max: 16 },
    takeaways: { min: 6, max: 10 },
  },
};

const LENGTH_RANK: Record<BriefLength, number> = {
  short: 0,
  medium: 1,
  long: 2,
};

export function isBriefLength(value: unknown): value is BriefLength {
  return value === "short" || value === "medium" || value === "long";
}

export function parseBriefLength(value: unknown): BriefLength {
  return isBriefLength(value) ? value : DEFAULT_BRIEF_LENGTH;
}

export function maxBriefLength(lengths: Iterable<unknown>): BriefLength {
  let best: BriefLength = DEFAULT_BRIEF_LENGTH;
  let found = false;
  for (const value of lengths) {
    if (!isBriefLength(value)) continue;
    if (!found || LENGTH_RANK[value] > LENGTH_RANK[best]) {
      best = value;
      found = true;
    }
  }
  return found ? best : DEFAULT_BRIEF_LENGTH;
}

export function resolveBriefLength(input: {
  userFollowLength?: string | null;
  followerLengths?: Iterable<unknown>;
}): BriefLength {
  if (isBriefLength(input.userFollowLength)) {
    return input.userFollowLength;
  }
  return maxBriefLength(input.followerLengths ?? []);
}

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches?.length ?? 0;
}

export function estimateSpokenMinutesAt1x(
  text: string,
  wpm = SPOKEN_WORDS_PER_MINUTE,
): number {
  if (wpm <= 0) return 0;
  return countWords(text) / wpm;
}

export function spokenRecapInBand(text: string, length: BriefLength): boolean {
  const words = countWords(text);
  const { min, max } = BRIEF_LENGTH_SPECS[length].spokenWords;
  return words >= min && words <= max;
}

export function isSourceTooThin(sourceText: string, length: BriefLength): boolean {
  return countWords(sourceText) < BRIEF_LENGTH_SPECS[length].spokenWords.min;
}

export function sourceLimitedNote(length: BriefLength): string {
  const spec = BRIEF_LENGTH_SPECS[length];
  return `The available source was too limited for a ${spec.label} brief (${spec.durationLabel}). This is the most faithful recap that source supports — nothing extra was invented.`;
}

export function formatBriefLengthLabel(length: unknown): string {
  const spec = BRIEF_LENGTH_SPECS[parseBriefLength(length)];
  return `${spec.label} · ${spec.durationLabel}`;
}

export function formatBriefLengthShort(length: unknown): string {
  return BRIEF_LENGTH_SPECS[parseBriefLength(length)].label;
}

export function mergeConfidenceNote(
  sourceNote: string | null | undefined,
  length: BriefLength,
  sourceLimited: boolean,
): string | null {
  const parts = [sourceNote?.trim() || null, sourceLimited ? sourceLimitedNote(length) : null].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" ") : null;
}
