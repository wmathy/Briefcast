import { describe, expect, it } from "vitest";
import {
  BRIEF_LENGTH_SPECS,
  DEFAULT_BRIEF_LENGTH,
  countWords,
  estimateSpokenMinutesAt1x,
  formatBriefLengthLabel,
  formatBriefLengthShort,
  isSourceTooThin,
  maxBriefLength,
  mergeConfidenceNote,
  parseBriefLength,
  resolveBriefLength,
  sourceLimitedNote,
  spokenRecapInBand,
} from "./brief-length";

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

describe("parseBriefLength", () => {
  it("keeps valid lengths and defaults everything else to medium", () => {
    expect(parseBriefLength("short")).toBe("short");
    expect(parseBriefLength("medium")).toBe("medium");
    expect(parseBriefLength("long")).toBe("long");
    expect(parseBriefLength("huge")).toBe(DEFAULT_BRIEF_LENGTH);
    expect(parseBriefLength(undefined)).toBe("medium");
  });
});

describe("resolveBriefLength", () => {
  it("uses the requesting follower's length when present", () => {
    expect(
      resolveBriefLength({
        userFollowLength: "short",
        followerLengths: ["long", "medium"],
      }),
    ).toBe("short");
  });

  it("lets different follows keep different lengths", () => {
    expect(resolveBriefLength({ userFollowLength: "short" })).toBe("short");
    expect(resolveBriefLength({ userFollowLength: "long" })).toBe("long");
  });

  it("when no user is specified, uses the longest requested follow length", () => {
    expect(resolveBriefLength({ followerLengths: ["short", "long", "medium"] })).toBe("long");
    expect(maxBriefLength(["short", "medium"])).toBe("medium");
    expect(maxBriefLength([])).toBe("medium");
  });
});

describe("spoken length bands at 1x", () => {
  it("maps ~150 words/minute onto the Short, Medium, and Long windows", () => {
    expect(estimateSpokenMinutesAt1x(words(600))).toBeCloseTo(4, 5);
    expect(estimateSpokenMinutesAt1x(words(1500))).toBeCloseTo(10, 5);
    expect(estimateSpokenMinutesAt1x(words(3750))).toBeCloseTo(25, 5);

    expect(spokenRecapInBand(words(450), "short")).toBe(true);
    expect(spokenRecapInBand(words(750), "short")).toBe(true);
    expect(spokenRecapInBand(words(449), "short")).toBe(false);

    expect(spokenRecapInBand(words(1200), "medium")).toBe(true);
    expect(spokenRecapInBand(words(1800), "medium")).toBe(true);
    expect(spokenRecapInBand(words(1199), "medium")).toBe(false);

    expect(spokenRecapInBand(words(3000), "long")).toBe(true);
    expect(spokenRecapInBand(words(4500), "long")).toBe(true);
    expect(spokenRecapInBand(words(2999), "long")).toBe(false);

    expect(BRIEF_LENGTH_SPECS.short.minutes).toEqual({ min: 3, max: 5 });
    expect(BRIEF_LENGTH_SPECS.medium.minutes).toEqual({ min: 8, max: 12 });
    expect(BRIEF_LENGTH_SPECS.long.minutes).toEqual({ min: 20, max: 30 });
  });

  it("does not treat playback speed as a way to hit a longer band", () => {
    const mediumWords = words(1500);
    expect(estimateSpokenMinutesAt1x(mediumWords)).toBe(10);
    expect(estimateSpokenMinutesAt1x(mediumWords) / 1.2).toBeCloseTo(8.333, 2);
    expect(spokenRecapInBand(mediumWords, "long")).toBe(false);
  });
});

describe("thin sources", () => {
  it("marks a notes-only blurb as too thin for Medium or Long", () => {
    const notes = "Host and guest talk about tariffs and one joke about Canada.";
    expect(countWords(notes)).toBeLessThan(BRIEF_LENGTH_SPECS.medium.spokenWords.min);
    expect(isSourceTooThin(notes, "short")).toBe(true);
    expect(isSourceTooThin(notes, "medium")).toBe(true);
    expect(isSourceTooThin(notes, "long")).toBe(true);
    expect(isSourceTooThin(words(2000), "medium")).toBe(false);
    expect(isSourceTooThin(words(5000), "long")).toBe(false);
  });

  it("explains the limit without inventing a longer recap", () => {
    const note = sourceLimitedNote("long");
    expect(note).toContain("too limited");
    expect(note).toContain("Long");
    expect(note).toContain("nothing extra was invented");
    expect(mergeConfidenceNote("Official show notes only.", "long", true)).toContain(
      "Official show notes only.",
    );
    expect(mergeConfidenceNote("Official show notes only.", "long", true)).toContain("too limited");
  });
});

describe("labels", () => {
  it("shows length and the 1x duration band", () => {
    expect(formatBriefLengthLabel("short")).toBe("Short · 3–5 min at 1x");
    expect(formatBriefLengthLabel("medium")).toBe("Medium · 8–12 min at 1x");
    expect(formatBriefLengthLabel("long")).toBe("Long · 20–30 min at 1x");
    expect(formatBriefLengthShort("medium")).toBe("Medium");
  });
});
