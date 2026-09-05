import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WIPE_BRIEFS_CONFIRM } from "./wipe-briefs";

describe("preview brief wipe", () => {
  it("is a confirmed one-shot, not an anonymous public delete", () => {
    const route = readFileSync(path.join(__dirname, "../app/api/admin/wipe-briefs/route.ts"), "utf8");
    const script = readFileSync(path.join(__dirname, "../../scripts/wipe-preview-briefs.mjs"), "utf8");
    expect(WIPE_BRIEFS_CONFIRM).toBe("WIPE_ALL_BRIEFS");
    expect(route).toContain("getCurrentUser");
    expect(route).toContain("WIPE_BRIEFS_CONFIRM");
    expect(route).toContain('VERCEL_ENV === "production"');
    expect(route).not.toContain("after(");
    expect(script).toContain("CONFIRM_WIPE_BRIEFS");
    expect(script).toContain("postgresql");
  });
});
