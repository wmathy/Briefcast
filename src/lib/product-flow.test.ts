import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return readFileSync(path.join(__dirname, rel), "utf8");
}

describe("automatic brief generation is in-request", () => {
  it("does not fire-and-forget follow or refresh generation", () => {
    expect(read("../app/api/follows/route.ts")).not.toContain("after(");
    expect(read("../app/api/queue/refresh/route.ts")).not.toContain("after(");
    expect(read("../app/api/shows/[id]/refresh/route.ts")).not.toContain("after(");
    expect(read("../app/api/follows/route.ts")).toContain("await generateAutoBriefs");
    expect(read("../app/api/queue/refresh/route.ts")).toContain("await generateAutoBriefs");
    expect(read("../app/api/shows/[id]/refresh/route.ts")).toContain("await generateAutoBriefs");
  });
});

describe("dashboard queue is spoken briefs only", () => {
  it("requires stored recap audio so seed text cards do not fill the home queue", () => {
    const source = read("./queue.ts");
    expect(source).toContain("recapAudio: { isNot: null }");
    expect(source).toContain("newest episode first");
  });
});

describe("show page lists the RSS catalog", () => {
  it("syncs the full feed and renders an episode count", () => {
    expect(read("./podcasts.ts")).toContain("fetchRssEpisodes(feedUrl, limit)");
    expect(read("./podcasts.ts")).not.toContain("limit = 20");
    expect(read("../app/shows/[id]/page.tsx")).toContain("from the show’s RSS feed");
  });
});
