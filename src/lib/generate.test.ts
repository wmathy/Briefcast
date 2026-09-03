import { describe, expect, it } from "vitest";
import { shouldRewriteExistingBrief } from "./generate";

describe("shouldRewriteExistingBrief", () => {
  it("always rewrites on manual Generate", () => {
    expect(
      shouldRewriteExistingBrief({
        existingSourceType: "shownotes",
        hasAudio: true,
        nextSourceType: "shownotes",
        force: true,
      }),
    ).toBe(true);
  });

  it("rewrites a notes-only brief when a full transcript is now available", () => {
    expect(
      shouldRewriteExistingBrief({
        existingSourceType: "shownotes",
        hasAudio: true,
        nextSourceType: "transcript",
        force: false,
      }),
    ).toBe(true);
  });

  it("does not rewrite an existing notes brief when the source is still notes", () => {
    expect(
      shouldRewriteExistingBrief({
        existingSourceType: "shownotes",
        hasAudio: true,
        nextSourceType: "shownotes",
        force: false,
      }),
    ).toBe(false);
  });

  it("writes when there is no stored brief or audio yet", () => {
    expect(
      shouldRewriteExistingBrief({
        existingSourceType: null,
        hasAudio: false,
        nextSourceType: "shownotes",
        force: false,
      }),
    ).toBe(true);
  });
});
