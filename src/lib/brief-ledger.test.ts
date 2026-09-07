import { describe, expect, it } from "vitest";
import { episodeIdentity, latestIsAlreadyBriefed } from "./brief-ledger";

describe("episodeIdentity", () => {
  it("includes id, date, title, and URL so a new episode does not match the ledger", () => {
    const publishedAt = new Date("2026-09-03T15:00:00.000Z");
    expect(
      episodeIdentity({
        id: "ep-1",
        title: "MMA Show",
        publishedAt,
        link: "https://example.com/1",
      }),
    ).toBe("ep-1:2026-09-03:MMA Show:https://example.com/1");
  });
});

describe("latestIsAlreadyBriefed", () => {
  it("is a no-op only when the latest id matches the ledger and needs no work", () => {
    expect(
      latestIsAlreadyBriefed({
        latestId: "ep-1",
        lastBriefedEpisodeId: "ep-1",
        latestNeedsWork: false,
      }),
    ).toBe(true);
    expect(
      latestIsAlreadyBriefed({
        latestId: "ep-2",
        lastBriefedEpisodeId: "ep-1",
        latestNeedsWork: false,
      }),
    ).toBe(false);
    expect(
      latestIsAlreadyBriefed({
        latestId: "ep-1",
        lastBriefedEpisodeId: "ep-1",
        latestNeedsWork: true,
      }),
    ).toBe(false);
    expect(
      latestIsAlreadyBriefed({
        latestId: "ep-1",
        lastBriefedEpisodeId: null,
        latestNeedsWork: false,
      }),
    ).toBe(false);
  });
});
