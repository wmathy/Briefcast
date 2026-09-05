import { describe, expect, it } from "vitest";
import {
  refreshContinueDelayMs,
  refreshHasMore,
  refreshShouldContinue,
  refreshStatusLabel,
} from "./refresh-status";

describe("refreshStatusLabel", () => {
  it("reports a finished auto-brief, not a pending background write", () => {
    expect(refreshStatusLabel({ generated: 1, created: 1, canGenerate: true })).toBe(
      "Added 1 · wrote 1",
    );
    expect(refreshStatusLabel({ generated: 2, canGenerate: true })).toBe("Wrote 2");
  });

  it("says when more shows still need a recap instead of pretending it is done", () => {
    expect(refreshStatusLabel({ generated: 3, remaining: 2, canGenerate: true })).toBe(
      "Wrote 3 · 2 left",
    );
    expect(refreshHasMore({ remaining: 2, generated: 3 })).toBe(true);
    expect(refreshHasMore({ remaining: 0, generated: 3 })).toBe(false);
    expect(refreshHasMore({ remaining: 2, generated: 0 })).toBe(true);
    expect(refreshHasMore({ reason: "transcript-in-progress", generated: 0, remaining: 1 })).toBe(true);
    expect(refreshStatusLabel({ reason: "transcript-in-progress" })).toBe("Transcribing…");
    expect(
      refreshStatusLabel({
        reason: "transcript-in-progress",
        focusTitle: "#2549 - Jared Diamond",
      }),
    ).toBe("Transcribing #2549 - Jared Diamond…");
    expect(refreshShouldContinue(504, { generated: 0 })).toBe(true);
    expect(refreshShouldContinue(500, { generated: 0 })).toBe(true);
    expect(refreshShouldContinue(401, { error: "Sign in required." })).toBe(false);
    expect(
      refreshShouldContinue(200, {
        remaining: 1,
        generated: 0,
        reason: "no-full-transcript",
      }),
    ).toBe(false);
    expect(refreshShouldContinue(200, { remaining: 1, generated: 0, errors: ["xAI TTS timed out"] })).toBe(true);
    expect(refreshShouldContinue(200, { remaining: 1, reason: "transcript-in-progress", continuing: true })).toBe(
      true,
    );
    expect(refreshContinueDelayMs({ continuing: true, reason: "transcript-in-progress" })).toBeGreaterThanOrEqual(
      15_000,
    );
    expect(refreshHasMore({ reason: "audio-pending", generated: 0, remaining: 1 })).toBe(true);
    expect(refreshStatusLabel({ reason: "audio-pending" })).toBe("Writing audio…");
  });

  it("surfaces a failed write instead of silent skip", () => {
    expect(refreshStatusLabel({ generated: 0, errors: ["Up First: xAI TTS error 400"] })).toContain(
      "xAI TTS error",
    );
  });

  it("does not pretend a brief was written when the transcript is missing", () => {
    expect(refreshStatusLabel({ reason: "no-full-transcript", generated: 0 })).toBe(
      "No full transcript yet",
    );
  });

  it("is honest when the xAI key is missing", () => {
    expect(refreshStatusLabel({ reason: "missing-xai-key", created: 3 })).toContain("XAI_API_KEY");
  });
});
