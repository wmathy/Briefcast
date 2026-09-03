import { describe, expect, it } from "vitest";
import { AUTO_BRIEF_BACKFILL, episodeIsInBriefWindow, followWindowStart } from "./queue-window";
import { recapNeedsRewrite } from "./queue";
import { assertRecapInBand, recapAudioInBand, RecapBandError } from "./brief-length";

describe("brief window", () => {
  it("includes episodes since follow plus a 5-episode backfill", () => {
    expect(AUTO_BRIEF_BACKFILL).toBe(5);
    const followedAt = new Date("2026-09-01T15:00:00.000Z");
    expect(followWindowStart(followedAt).toISOString()).toBe("2026-09-01T00:00:00.000Z");

    const newestIds = ["new1", "new2", "new3", "new4", "new5"];
    expect(
      episodeIsInBriefWindow({
        episodeId: "archive",
        publishedAt: new Date("2020-01-01T00:00:00.000Z"),
        followedAt,
        newestIds,
      }),
    ).toBe(false);
    expect(
      episodeIsInBriefWindow({
        episodeId: "new3",
        publishedAt: new Date("2020-01-01T00:00:00.000Z"),
        followedAt,
        newestIds,
      }),
    ).toBe(true);
    expect(
      episodeIsInBriefWindow({
        episodeId: "today",
        publishedAt: new Date("2026-09-02T00:00:00.000Z"),
        followedAt,
        newestIds,
      }),
    ).toBe(true);
  });
});

describe("recapNeedsRewrite", () => {
  it("does not treat the full RSS archive as pending work when a real Medium recap exists", () => {
    expect(
      recapNeedsRewrite({
        brief: {
          sourceType: "transcript",
          spokenRecap: Array.from({ length: 1500 }, (_, i) => `word${i}`).join(" "),
          briefLength: "medium",
          sourceLimited: false,
        },
        recapAudio: { durationSeconds: 10 * 60 },
      }),
    ).toBe(false);
  });

  it("re-queues audio when the follow voice no longer matches the stored recap", () => {
    expect(
      recapNeedsRewrite(
        {
          brief: {
            sourceType: "transcript",
            spokenRecap: Array.from({ length: 1500 }, (_, i) => `word${i}`).join(" "),
            briefLength: "medium",
            sourceLimited: false,
          },
          recapAudio: { durationSeconds: 10 * 60, voiceId: "eve" },
        },
        "ara",
      ),
    ).toBe(true);
    expect(
      recapNeedsRewrite(
        {
          brief: {
            sourceType: "transcript",
            spokenRecap: Array.from({ length: 1500 }, (_, i) => `word${i}`).join(" "),
            briefLength: "medium",
            sourceLimited: false,
          },
          recapAudio: { durationSeconds: 10 * 60, voiceId: "ara" },
        },
        "ara",
      ),
    ).toBe(false);
  });

  it("rewrites a published brief whose spoken recap is far below the band", () => {
    expect(
      recapNeedsRewrite({
        brief: {
          sourceType: "transcript",
          spokenRecap: "Joe and Jesse open with a UFO clip.",
          briefLength: "medium",
          sourceLimited: false,
        },
        recapAudio: { durationSeconds: 98 },
      }),
    ).toBe(true);
  });
});

describe("recap audio band", () => {
  it("accepts Medium audio inside 8–12 minutes and rejects 1:38", () => {
    expect(recapAudioInBand(98, "medium")).toBe(false);
    expect(recapAudioInBand(10 * 60, "medium")).toBe(true);
    expect(() =>
      assertRecapInBand({
        spokenText: Array.from({ length: 1500 }, (_, i) => `word${i}`).join(" "),
        audioSeconds: 98,
        length: "medium",
        sourceLimited: false,
      }),
    ).toThrow(RecapBandError);
  });
});
