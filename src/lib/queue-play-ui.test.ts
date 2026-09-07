import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return readFileSync(path.join(__dirname, rel), "utf8");
}

describe("library queue play button", () => {
  it("is a 44px tap target with a circular listen-progress ring", () => {
    const button = read("../components/QueuePlayButton.tsx");
    expect(button).toContain("tap pressable");
    expect(button).toContain("h-11 w-11");
    expect(button).toContain("strokeDasharray");
    expect(button).toContain("strokeDashoffset");
    expect(button).toContain("Play recap");
    expect(button).toContain("Pause recap");
    expect(button).toContain("PlayPauseGlyph");
    expect(button).toContain('preload: "none"');
    expect(button).toContain("`/api/audio/${episodeId}`");
    expect(read("../app/globals.css")).toContain(".queue-play");
  });

  it("sits on the title row and does not replace the episode link", () => {
    const card = read("../components/QueueCard.tsx");
    expect(card).toContain("flex items-center gap-3");
    expect(card).toContain("QueuePlayButton");
    expect(card).toContain("`/episodes/${episodeId}`");
    expect(card.indexOf("<QueuePlayButton")).toBeGreaterThan(card.indexOf("font-medium leading-snug"));
  });

  it("drives the shared recap player used by the episode AudioPlayer", () => {
    const hook = read("../components/useRecapAudio.ts");
    expect(hook).toContain("writeListenProgress");
    expect(hook).toContain("readListenProgress");
    expect(hook).toContain("useSyncExternalStore");
    expect(hook).toContain("claimRecapPlayback");
    expect(hook).toContain("isListenComplete");
    expect(read("../components/AudioPlayer.tsx")).toContain("useRecapAudio");
    expect(read("../app/episodes/[id]/page.tsx")).toContain("episodeId={episode.id}");
  });

  it("does not change Check, Find a podcast, auto-brief, or the transcript gate", () => {
    const library = read("../app/library/page.tsx");
    expect(library).toContain("RefreshLibraryButton");
    expect(library).toContain("Find a podcast");
    expect(library).toContain("AutoGenerateLatest");
    expect(library).toContain("countLatestFollowedNeedingBrief");
    expect(library).toContain("FULL_TRANSCRIPT_UNAVAILABLE");
    expect(library).toContain("getFollowedBriefQueue");
    expect(read("./queue.ts")).toContain("recapAudio: { isNot: null }");
    expect(read("./queue.ts")).toContain('sourceType: "transcript"');
    expect(read("./pipeline-hop.ts")).toContain("scheduleRefreshPipeline");
  });
});
