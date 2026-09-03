import { describe, expect, it } from "vitest";
import { shouldPublishBrief } from "./generate";

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
