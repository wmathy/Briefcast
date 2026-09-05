import { describe, expect, it } from "vitest";
import {
  AUTO_BRIEF_LIMIT,
  AUTO_BRIEF_LOOKAHEAD,
  episodeNeedsSpokenBrief,
  isCronRequestAuthorized,
  isUnfinishedSttJob,
  orderAutoBriefQueue,
  orderIdsByPublishedAt,
  shouldAdvanceOlderEpisode,
  takeAutoBriefBatch,
} from "./auto-brief-policy";
import { STT_CHUNKS_PER_TURN } from "./stt-job";

describe("episodeNeedsSpokenBrief", () => {
  it("treats a seed brief with no spoken audio as still needing generation", () => {
    expect(episodeNeedsSpokenBrief({ brief: { id: "seed" }, recapAudio: null })).toBe(true);
    expect(episodeNeedsSpokenBrief({ brief: { id: "real", sourceType: "transcript" }, recapAudio: { id: "mp3" } })).toBe(
      false,
    );
    expect(episodeNeedsSpokenBrief({ brief: { id: "notes", sourceType: "shownotes" }, recapAudio: { id: "mp3" } })).toBe(
      true,
    );
  });
});

describe("takeAutoBriefBatch", () => {
  it("does not silently drop extra shows — leftover ids are remaining", () => {
    const batch = takeAutoBriefBatch(["a", "b", "c", "d", "e"], 3);
    expect(batch.toGenerate).toEqual(["a", "b", "c"]);
    expect(batch.remaining).toBe(2);
    expect(AUTO_BRIEF_LIMIT).toBe(1);
    expect(AUTO_BRIEF_LOOKAHEAD).toBe(1);
  });

  it("dedupes and ignores empty ids", () => {
    expect(takeAutoBriefBatch(["a", "a", ""], 2)).toEqual({ toGenerate: ["a"], remaining: 0 });
  });
});

describe("orderIdsByPublishedAt", () => {
  it("sorts globally newest-first so one show’s backlog cannot bury another show’s latest", () => {
    expect(
      orderIdsByPublishedAt([
        { id: "tucker-old", publishedAt: new Date("2026-08-01T00:00:00.000Z") },
        { id: "jre-newest", publishedAt: new Date("2026-09-04T18:00:00.000Z") },
        { id: "tucker-new", publishedAt: new Date("2026-09-03T00:00:00.000Z") },
        { id: "jre-newest", publishedAt: new Date("2026-09-04T18:00:00.000Z") },
      ]),
    ).toEqual(["jre-newest", "tucker-new", "tucker-old"]);
  });
});

describe("orderAutoBriefQueue", () => {
  it("briefs never-published newest episodes before Ready length/voice rewrites", () => {
    expect(
      orderAutoBriefQueue([
        { id: "mma-185-ready", publishedAt: new Date("2026-09-02T00:00:00.000Z"), kind: "rewrite" },
        { id: "jre-2549", publishedAt: new Date("2026-09-03T00:00:00.000Z"), kind: "unbriefed" },
        { id: "tucker-newest", publishedAt: new Date("2026-09-04T00:00:00.000Z"), kind: "unbriefed" },
        { id: "jre-2548-ready", publishedAt: new Date("2026-09-01T00:00:00.000Z"), kind: "rewrite" },
      ]),
    ).toEqual(["tucker-newest", "jre-2549", "mma-185-ready", "jre-2548-ready"]);
  });
});

describe("newest unfinished STT wins over starting an older episode", () => {
  it("does not start an older episode while the newer job is locked and unfinished", () => {
    expect(
      shouldAdvanceOlderEpisode({ newerHasUnfinishedStt: true, newerSttBusy: true }),
    ).toBe(false);
    expect(
      shouldAdvanceOlderEpisode({ newerHasUnfinishedStt: false, newerSttBusy: false }),
    ).toBe(true);
  });

  it("treats pending/running jobs as unfinished and complete text as done", () => {
    expect(isUnfinishedSttJob({ status: "pending", text: "" })).toBe(true);
    expect(isUnfinishedSttJob({ status: "running", text: "partial" })).toBe(true);
    expect(isUnfinishedSttJob({ status: "complete", text: "x".repeat(81) })).toBe(false);
    expect(isUnfinishedSttJob({ status: "failed", text: "nope" })).toBe(false);
    expect(isUnfinishedSttJob(null)).toBe(false);
  });
});

describe("STT chunks per hop", () => {
  it("runs two 2MB slices per turn and still splits brief+TTS onto the next hop", () => {
    expect(STT_CHUNKS_PER_TURN).toBe(2);
    expect(AUTO_BRIEF_LIMIT).toBe(1);
  });
});

describe("isCronRequestAuthorized", () => {
  const originalSecret = process.env.CRON_SECRET;
  const originalVercel = process.env.VERCEL;

  function restore() {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }

  it("accepts the Bearer CRON_SECRET header", () => {
    process.env.CRON_SECRET = "poll-secret";
    const request = new Request("http://localhost/api/cron/poll-episodes", {
      headers: { authorization: "Bearer poll-secret" },
    });
    expect(isCronRequestAuthorized(request)).toBe(true);
    restore();
  });

  it("rejects a missing or wrong secret when CRON_SECRET is set", () => {
    process.env.CRON_SECRET = "poll-secret";
    expect(isCronRequestAuthorized(new Request("http://localhost/api/cron/poll-episodes"))).toBe(
      false,
    );
    expect(
      isCronRequestAuthorized(
        new Request("http://localhost/api/cron/poll-episodes", {
          headers: { authorization: "Bearer nope" },
        }),
      ),
    ).toBe(false);
    restore();
  });

  it("refuses anonymous calls on Vercel when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    process.env.VERCEL = "1";
    expect(isCronRequestAuthorized(new Request("http://localhost/api/cron/poll-episodes"))).toBe(
      false,
    );
    restore();
  });

  it("allows local calls when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL;
    expect(isCronRequestAuthorized(new Request("http://localhost/api/cron/poll-episodes"))).toBe(
      true,
    );
    restore();
  });
});
