import { describe, expect, it } from "vitest";
import {
  AUTO_BRIEF_BACKFILL,
  episodeIsInBriefWindow,
  followWindowStart,
  pickFinishableNewest,
  selectWindowedAutoBriefIds,
  STT_STALL_MS,
  takeSingleNewestWork,
} from "./queue-window";
import { recapNeedsRewrite } from "./queue";
import { assertRecapInBand, recapAudioInBand, RecapBandError } from "./brief-length";

describe("brief window", () => {
  it("auto-briefs only the single newest episode, not a 5-show backfill", () => {
    expect(AUTO_BRIEF_BACKFILL).toBe(1);
    const followedAt = new Date("2026-09-01T15:00:00.000Z");
    expect(followWindowStart(followedAt).toISOString()).toBe("2026-09-01T00:00:00.000Z");

    const newestIds = ["tucker-newest"];
    expect(
      episodeIsInBriefWindow({
        episodeId: "jre-2549",
        publishedAt: new Date("2026-09-03T00:00:00.000Z"),
        followedAt,
        newestIds,
      }),
    ).toBe(false);
    expect(
      episodeIsInBriefWindow({
        episodeId: "tucker-newest",
        publishedAt: new Date("2026-09-04T00:00:00.000Z"),
        followedAt,
        newestIds,
      }),
    ).toBe(true);
    expect(takeSingleNewestWork(["tucker-newest", "jre-2549"])).toEqual(["tucker-newest"]);
    expect(takeSingleNewestWork([])).toEqual([]);
  });

  it("skips a fresh STT lock and prefers a public transcript or shorter audio", () => {
    const now = Date.parse("2026-09-07T12:00:00.000Z");
    expect(
      pickFinishableNewest(
        [
          {
            id: "jre-2549",
            publishedAt: now,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            durationSeconds: 10_800,
            sttStatus: "running",
            sttLockedAt: now - 60_000,
          },
          {
            id: "tucker-newest",
            publishedAt: now - 86_400_000,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            durationSeconds: 3_600,
          },
        ],
        now,
      ),
    ).toEqual(["tucker-newest"]);

    expect(
      pickFinishableNewest(
        [
          {
            id: "jre-2549",
            publishedAt: now,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            durationSeconds: 10_800,
          },
          {
            id: "candace-newest",
            publishedAt: now - 1_000,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            hasTranscriptUrl: true,
            durationSeconds: 2_400,
          },
        ],
        now,
      ),
    ).toEqual(["candace-newest"]);

    expect(
      pickFinishableNewest(
        [
          {
            id: "jre-2549",
            publishedAt: now,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            durationSeconds: 10_800,
          },
          {
            id: "tucker-newest",
            publishedAt: now - 1_000,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            durationSeconds: 2_400,
          },
        ],
        now,
      ),
    ).toEqual(["tucker-newest"]);
  });

  it("does not fall back to a freshly locked newest (that hop-spins the chain to death)", () => {
    const now = Date.parse("2026-09-07T12:00:00.000Z");
    expect(
      selectWindowedAutoBriefIds(
        [
          {
            id: "jre-2550",
            publishedAt: now,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            durationSeconds: 8733,
            sttStatus: "running",
            sttLockedAt: now - 60_000,
          },
        ],
        now,
      ),
    ).toEqual([]);
  });

  it("treats 45 minutes without STT progress as stalled, but not 10 minutes", () => {
    expect(STT_STALL_MS).toBe(30 * 60 * 1000);
    const now = Date.parse("2026-09-07T12:00:00.000Z");
    const candace = {
      id: "candace-newest",
      publishedAt: now - 1_000,
      kind: "unbriefed" as const,
      hasSource: true,
      hasAudioUrl: true,
      durationSeconds: 3_600,
    };
    expect(
      pickFinishableNewest(
        [
          {
            id: "jre-2550",
            publishedAt: now,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            durationSeconds: 10_800,
            sttStatus: "pending",
            sttUpdatedAt: now - 10 * 60 * 1000,
          },
          candace,
        ],
        now,
      ),
    ).toEqual(["jre-2550"]);
    expect(
      pickFinishableNewest(
        [
          {
            id: "jre-2550",
            publishedAt: now,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            durationSeconds: 10_800,
            sttStatus: "pending",
            sttUpdatedAt: now - 45 * 60 * 1000,
          },
          candace,
        ],
        now,
      ),
    ).toEqual(["candace-newest"]);
  });

  it("rotates off stalled STT so a new follow is not blocked for days", () => {
    const now = Date.parse("2026-09-07T12:00:00.000Z");
    expect(
      pickFinishableNewest(
        [
          {
            id: "jre-2549",
            publishedAt: now,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            durationSeconds: 10_800,
            sttStatus: "running",
            sttUpdatedAt: now - 7 * 60 * 60 * 1000,
            sttLockedAt: now - 7 * 60 * 60 * 1000,
          },
          {
            id: "candace-newest",
            publishedAt: now - 1_000,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            durationSeconds: 3_600,
          },
        ],
        now,
      ),
    ).toEqual(["candace-newest"]);
  });

  it("does not prefer a notes-only transcript URL over another follow’s audio", () => {
    const now = Date.parse("2026-09-07T12:00:00.000Z");
    expect(
      pickFinishableNewest(
        [
          {
            id: "jocko-newest",
            publishedAt: now,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: false,
            hasTranscriptUrl: true,
            durationSeconds: 1_245,
          },
          {
            id: "candace-newest",
            publishedAt: now - 1_000,
            kind: "unbriefed",
            hasSource: true,
            hasAudioUrl: true,
            durationSeconds: 3_675,
          },
        ],
        now,
      ),
    ).toEqual(["candace-newest"]);
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

  it("does not re-queue a Ready recap whose playable audio is in band", () => {
    expect(
      recapNeedsRewrite({
        brief: {
          sourceType: "transcript",
          spokenRecap: Array.from({ length: 1900 }, (_, i) => `word${i}`).join(" "),
          briefLength: "medium",
          sourceLimited: false,
        },
        recapAudio: { durationSeconds: 9 * 60 + 4, voiceId: "eve" },
      }),
    ).toBe(false);
  });

  it("rewrites Ready audio when follow length or voice actually changed", () => {
    const ready = {
      brief: {
        sourceType: "transcript" as const,
        spokenRecap: Array.from({ length: 1500 }, (_, i) => `word${i}`).join(" "),
        briefLength: "medium",
        sourceLimited: false,
      },
      recapAudio: { durationSeconds: 9 * 60 + 4, voiceId: "eve" },
    };
    expect(recapNeedsRewrite(ready, "eve", "long")).toBe(true);
    expect(recapNeedsRewrite(ready, "ara", "medium")).toBe(true);
    expect(recapNeedsRewrite(ready, "eve", "medium")).toBe(false);
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
