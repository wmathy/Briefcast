import { describe, expect, it } from "vitest";
import { canReuseWrittenBrief, planBriefGeneration, shouldPublishBrief } from "./generate";

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

describe("shouldPublishBrief", () => {
  it("never publishes when there is no complete transcript", () => {
    expect(
      shouldPublishBrief({
        hasCompleteTranscript: false,
        existingSourceType: "shownotes",
        force: true,
      }),
    ).toBe("unavailable");
    expect(
      shouldPublishBrief({
        hasCompleteTranscript: false,
        existingSourceType: null,
        force: true,
      }),
    ).toBe("unavailable");
  });

  it("keeps an existing transcript brief if a later attempt cannot fetch one", () => {
    expect(
      shouldPublishBrief({
        hasCompleteTranscript: false,
        existingSourceType: "transcript",
        force: false,
      }),
    ).toBe("keep-existing");
  });

  it("publishes when a complete transcript is available", () => {
    expect(
      shouldPublishBrief({
        hasCompleteTranscript: true,
        existingSourceType: "shownotes",
        force: false,
      }),
    ).toBe("publish");
    expect(
      shouldPublishBrief({
        hasCompleteTranscript: true,
        existingSourceType: "transcript",
        force: true,
      }),
    ).toBe("publish");
  });

  it("does not rewrite an existing transcript brief on auto-write", () => {
    expect(
      shouldPublishBrief({
        hasCompleteTranscript: true,
        existingSourceType: "transcript",
        force: false,
      }),
    ).toBe("keep-existing");
  });
});

describe("planBriefGeneration", () => {
  it("synthesizes audio only when a transcript brief is already in the word band", () => {
    expect(
      planBriefGeneration({
        hasCompleteTranscript: true,
        existingSourceType: "transcript",
        spokenRecap: words(1500),
        storedLength: "medium",
        sourceLimited: false,
        audioSeconds: null,
        requestedLength: "medium",
      }),
    ).toBe("tts-only");
  });

  it("does not reuse a 1:38 Medium recap — rewrite the spoken brief", () => {
    expect(
      canReuseWrittenBrief({
        existingSourceType: "transcript",
        spokenRecap: "Joe and Jesse open with a UFO clip.",
        storedLength: "medium",
        sourceLimited: false,
        requestedLength: "medium",
      }),
    ).toBe(false);
    expect(
      planBriefGeneration({
        hasCompleteTranscript: true,
        existingSourceType: "transcript",
        spokenRecap: "Joe and Jesse open with a UFO clip.",
        storedLength: "medium",
        sourceLimited: false,
        audioSeconds: 98,
        requestedLength: "medium",
      }),
    ).toBe("write-then-tts");
  });

  it("never plans a notes-only publish", () => {
    expect(
      planBriefGeneration({
        hasCompleteTranscript: false,
        existingSourceType: "shownotes",
        spokenRecap: words(200),
        storedLength: "medium",
        sourceLimited: true,
        audioSeconds: 90,
        requestedLength: "medium",
      }),
    ).toBe("unavailable");
  });

  it("re-runs TTS only when the follow voice changes", () => {
    expect(
      planBriefGeneration({
        hasCompleteTranscript: true,
        existingSourceType: "transcript",
        spokenRecap: words(1500),
        storedLength: "medium",
        sourceLimited: false,
        audioSeconds: 10 * 60,
        requestedLength: "medium",
        storedVoice: "eve",
        requestedVoice: "ara",
      }),
    ).toBe("tts-only");
  });

  it("skips work when spoken words and measured audio are both in band", () => {
    expect(
      planBriefGeneration({
        hasCompleteTranscript: true,
        existingSourceType: "transcript",
        spokenRecap: words(1500),
        storedLength: "medium",
        sourceLimited: false,
        audioSeconds: 10 * 60,
        requestedLength: "medium",
      }),
    ).toBe("already-published");
  });
});
