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
      expect(source).toContain("schedulePipelineHopIfNeeded");
    }
  });

  it("chains remaining work through /api/pipeline/continue instead of waiting for Check", () => {
    const continueRoute = read("../app/api/pipeline/continue/route.ts");
    expect(continueRoute).toContain("skipFeedSync: true");
    expect(continueRoute).toContain("refreshFollowedBriefs");
    expect(continueRoute).toContain("dispatchPipelineHop");
    expect(read("../../vercel.json")).toContain("15 8 * * *");
    expect(read("./generate.ts")).toContain("markShowBriefed");
    expect(read("./xai.ts")).toContain("attempt <= 3");
    expect(read("./stt-job.ts")).toContain("STT_CHUNKS_PER_TURN = 2");
    expect(read("./stt-job.ts")).toContain("Even the last chunk returns in-progress");
    expect(read("./queue.ts")).toContain("orderIdsByPublishedAt");
    expect(read("./auto-brief.ts")).toContain("shouldAdvanceOlderEpisode");
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
    expect(read("../app/shows/[id]/page.tsx")).toContain("Episodes");
    expect(read("../app/shows/[id]/page.tsx")).toContain("show.episodes.map");
  });
});

describe("briefs come from the full episode transcript", () => {
  it("stores RSS transcript URLs and does not rescan only 40 feed items", () => {
    const generate = read("./generate.ts");
    expect(generate).toContain("episode.transcriptUrl");
    expect(generate).toContain("storedAudio: episode.audioUrl");
    expect(generate).toContain("audioUrl: rss.audioUrl");
    expect(generate).not.toContain("fetchRssEpisodes(episode.show.feedUrl, 40)");
    expect(read("./podcasts.ts")).toContain("transcriptUrl: episode.transcriptUrl");
  });

  it("does not publish notes-only briefs", () => {
    expect(read("./generate.ts")).toContain("no-full-transcript");
    expect(read("./generate.ts")).toContain("purgeNotesOnlyBriefs");
    expect(read("./queue.ts")).toContain('sourceType: "transcript"');
    expect(read("../app/episodes/[id]/page.tsx")).toContain("FULL_TRANSCRIPT_UNAVAILABLE");
    expect(read("../app/library/page.tsx")).toContain("FULL_TRANSCRIPT_UNAVAILABLE");
    expect(read("../app/library/page.tsx")).not.toContain("notes-only (not the full episode)");
  });

  it("persists the written brief before TTS so a timeout can resume audio-only", () => {
    const generate = read("./generate.ts");
    const write = generate.indexOf("const brief = await writeBriefFromSource");
    const upsert = generate.indexOf("prisma.brief.upsert", write);
    const pending = generate.indexOf("audio-pending", upsert);
    expect(write).toBeGreaterThan(-1);
    expect(upsert).toBeGreaterThan(write);
    expect(pending).toBeGreaterThan(upsert);
    expect(generate).toContain('return "tts-only"');
    expect(generate).toContain('reason: "audio-pending"');
    expect(read("./sources.ts")).toContain("briefPromptSource");
    expect(read("./brief.ts")).toContain("briefPromptSource(input.source.text)");
    expect(read("./auto-brief.ts")).toContain("stillNeeded");
    expect(read("../components/AutoGenerateLatest.tsx")).toContain("refreshShouldContinue");
    expect(read("./xai.ts")).toContain("voice_id: voiceId");
    expect(read("./xai.ts")).not.toContain('voice_id: "eve"');
  });
});

describe("episode player sits above the summary", () => {
  it("passes the player into BriefView before overview text", () => {
    expect(read("../app/episodes/[id]/page.tsx")).toContain("player={player}");
    const view = read("../components/BriefView.tsx");
    expect(view.indexOf("{player}")).toBeLessThan(view.indexOf("Overview"));
  });
});
