import { describe, expect, it } from "vitest";
import {
  FULL_TRANSCRIPT_UNAVAILABLE,
  isCompleteEpisodeTranscript,
  isPublishedTranscriptBrief,
  minWordsForFullEpisode,
  parseDurationSeconds,
} from "./transcript-complete";

const spoken = Array.from(
  { length: 140 },
  (_, i) => `HOST: Later in the episode we cover topic ${i} with the guest in detail.`,
).join("\n");

describe("parseDurationSeconds", () => {
  it("reads seconds, clock times, and itunes-style values", () => {
    expect(parseDurationSeconds(820)).toBe(820);
    expect(parseDurationSeconds("820")).toBe(820);
    expect(parseDurationSeconds("13:40")).toBe(820);
    expect(parseDurationSeconds("1:02:03")).toBe(3723);
    expect(parseDurationSeconds("")).toBeNull();
  });
});

describe("isCompleteEpisodeTranscript", () => {
  it("accepts a spoken transcript that covers a 13-minute episode", () => {
    const result = isCompleteEpisodeTranscript({
      text: spoken,
      notes: "The Pentagon is losing experienced leaders.",
      durationSeconds: 820,
    });
    expect(result.ok).toBe(true);
    expect(result.words).toBeGreaterThan(minWordsForFullEpisode(820));
  });

  it("rejects show notes even when they are long enough to look like a blurb", () => {
    const notes =
      "The Pentagon is losing experienced leaders under Defense Secretary Pete Hegseth. President Trump says Venezuela is not ready for elections. Jurors in the Lindsay Clancy trial are deadlocked after five days.";
    const result = isCompleteEpisodeTranscript({
      text: notes,
      notes,
      durationSeconds: 820,
    });
    expect(result.ok).toBe(false);
    expect(["too-short", "notes-length", "below-duration-words", "matches-notes"]).toContain(result.reason);
  });

  it("rejects an STT result that only covers the first minutes of the audio", () => {
    const result = isCompleteEpisodeTranscript({
      text: spoken,
      durationSeconds: 1800,
      coveredAudioSeconds: 180,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("partial-audio-coverage");
  });

  it("treats only transcript-sourced briefs as published", () => {
    expect(isPublishedTranscriptBrief({ sourceType: "transcript" })).toBe(true);
    expect(isPublishedTranscriptBrief({ sourceType: "shownotes" })).toBe(false);
    expect(isPublishedTranscriptBrief(null)).toBe(false);
    expect(FULL_TRANSCRIPT_UNAVAILABLE).toContain("no brief");
  });
});
