import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WIPE_BRIEFS_CONFIRM } from "./wipe-briefs";

describe("preview brief wipe", () => {
  it("is a confirmed CLI one-shot, not a public HTTP delete", () => {
    const script = readFileSync(path.join(__dirname, "../../scripts/wipe-preview-briefs.mjs"), "utf8");
    const helper = readFileSync(path.join(__dirname, "wipe-briefs.ts"), "utf8");
    expect(WIPE_BRIEFS_CONFIRM).toBe("WIPE_ALL_BRIEFS");
    expect(script).toContain("CONFIRM_WIPE_BRIEFS");
    expect(script).toContain("postgresql");
    expect(script).toContain('DELETE FROM "Brief"');
    expect(script).toContain('DELETE FROM "RecapAudio"');
    expect(script).toContain('DELETE FROM "SttJob"');
    expect(script).not.toContain('DELETE FROM "User"');
    expect(script).not.toContain('DELETE FROM "Episode"');
    expect(helper).toContain("lastBriefedEpisodeId: null");
    expect(
      existsSync(path.join(__dirname, "../app/api/admin/wipe-briefs/route.ts")),
    ).toBe(false);
  });
});
