import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return readFileSync(path.join(__dirname, rel), "utf8");
}

describe("automatic brief generation is one awaited pipeline", () => {
  it("follow, refresh, and cron all await refreshFollowedBriefs", () => {
    for (const file of [
      "../app/api/follows/route.ts",
      "../app/api/queue/refresh/route.ts",
      "../app/api/shows/[id]/refresh/route.ts",
      "../app/api/cron/poll-episodes/route.ts",
    ]) {
      const source = read(file);
      expect(source).not.toContain("after(");
      expect(source).toContain("refreshFollowedBriefs");
    }
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

describe("briefs come from the full episode transcript", () => {
  it("stores RSS transcript URLs and does not rescan only 40 feed items", () => {
    const generate = read("./generate.ts");
    expect(generate).toContain("episode.transcriptUrl");
    expect(generate).toContain("audioUrl: episode.audioUrl");
    expect(generate).not.toContain("fetchRssEpisodes(episode.show.feedUrl, 40)");
    expect(read("./podcasts.ts")).toContain("transcriptUrl: episode.transcriptUrl");
  });

  it("labels notes-only briefs instead of pretending they covered the episode", () => {
    const view = read("../components/BriefView.tsx");
    expect(view).toContain("Notes-only source");
    expect(view).toContain("not the entire episode");
    expect(view).toContain("full episode transcript");
    expect(read("../app/library/page.tsx")).toContain("notes-only (not the full episode)");
  });
});

describe("episode player sits above the summary", () => {
  it("passes the player into BriefView before overview text", () => {
    expect(read("../app/episodes/[id]/page.tsx")).toContain("player={player}");
    const view = read("../components/BriefView.tsx");
    expect(view.indexOf("{player}")).toBeLessThan(view.indexOf("Overview"));
  });
});
