import { describe, expect, it } from "vitest";
import { refreshHasMore, refreshStatusLabel } from "./refresh-status";

describe("refreshStatusLabel", () => {
  it("reports a finished auto-brief, not a pending background write", () => {
    expect(refreshStatusLabel({ generated: 1, created: 1, canGenerate: true })).toBe(
      "Added 1 · wrote 1 brief",
    );
    expect(refreshStatusLabel({ generated: 2, canGenerate: true })).toBe("Wrote 2 briefs");
  });

  it("says when more shows still need a recap instead of pretending it is done", () => {
    expect(refreshStatusLabel({ generated: 3, remaining: 2, canGenerate: true })).toBe(
      "Wrote 3 briefs. 2 more still need a recap.",
    );
    expect(refreshHasMore({ remaining: 2, generated: 3 })).toBe(true);
    expect(refreshHasMore({ remaining: 0, generated: 3 })).toBe(false);
    expect(refreshHasMore({ remaining: 2, generated: 0 })).toBe(false);
  });

  it("surfaces a failed write instead of silent skip", () => {
    expect(refreshStatusLabel({ generated: 0, errors: ["Up First: xAI TTS error 400"] })).toContain(
      "xAI TTS error",
    );
  });

  it("is honest when the xAI key is missing", () => {
    expect(refreshStatusLabel({ reason: "missing-xai-key", created: 3 })).toContain("XAI_API_KEY");
  });
});
