import { describe, expect, it } from "vitest";
import { refreshStatusLabel } from "./refresh-status";

describe("refreshStatusLabel", () => {
  it("reports a finished auto-brief, not a pending background write", () => {
    expect(refreshStatusLabel({ generated: 1, created: 1, canGenerate: true })).toBe(
      "Added 1 · wrote 1 brief",
    );
    expect(refreshStatusLabel({ generated: 2, canGenerate: true })).toBe("Wrote 2 briefs");
  });

  it("is honest when the xAI key is missing", () => {
    expect(refreshStatusLabel({ reason: "missing-xai-key", created: 3 })).toContain("XAI_API_KEY");
  });
});
