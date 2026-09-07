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

  it("shows each follow's brief length", () => {
    expect(source).toContain("formatBriefLengthShort");
    expect(source).toContain("briefLength");
  });

  it("does not list notes-only cards as real briefs", () => {
    expect(source).toContain("FULL_TRANSCRIPT_UNAVAILABLE");
    expect(source).not.toContain("notes-only (not the full episode)");
  });

  it("auto-writes the latest brief instead of waiting for a Generate click", () => {
    expect(source).toContain("AutoGenerateLatest");
    expect(source).toContain("countLatestFollowedNeedingBrief");
  });

  it("uses the unbriefed counter for waiting, not the Ready play queue", () => {
    expect(source).toContain("countUnbriefedFollowedEpisodes");
    expect(source).toContain("waiting");
    expect(source).toContain("getFollowedBriefQueue");
    expect(source).toContain("Ready to play");
  });

  it("stacks Library actions and uses pressable cards on small screens", () => {
    expect(source).toContain("flex-col gap-4 sm:flex-row");
    expect(source).toContain("tap pressable");
    expect(source).toContain("Find a podcast");
    expect(source).toContain("QueueCard");
    expect(source).not.toContain("hover:border-accent");
  });

  it("puts an in-card recap play control on Ready queue rows only", () => {
    expect(source).toContain("getFollowedBriefQueue");
    expect(source).toContain("QueueCard");
    expect(source).toContain("durationHintForRecap");
    expect(source).toContain("AutoGenerateLatest");
    expect(source).toContain("RefreshLibraryButton");
    const card = readFileSync(path.join(__dirname, "../components/QueueCard.tsx"), "utf8");
    expect(card).toContain("card-link");
    expect(card).toContain("QueuePlayButton");
    expect(card).toContain("items-center");
    expect(card).toContain("font-medium leading-snug");
  });
});


