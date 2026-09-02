import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("library homepage queue", () => {
  const source = readFileSync(path.join(__dirname, "../app/library/page.tsx"), "utf8");

  it("does not render seeded sample/demo brief cards", () => {
    expect(source).not.toContain("SEED_EPISODES");
    expect(source).not.toContain("Sample briefs");
    expect(source).not.toContain("seed-data");
  });

  it("loads the followed-show brief queue newest-first helper", () => {
    expect(source).toContain("getFollowedBriefQueue");
    expect(source).toContain("countUnbriefedFollowedEpisodes");
    expect(source).toContain("Queue");
  });
});
