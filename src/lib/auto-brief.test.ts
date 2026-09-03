import { describe, expect, it } from "vitest";
import {
  AUTO_BRIEF_LIMIT,
  episodeNeedsSpokenBrief,
  isCronRequestAuthorized,
  takeAutoBriefBatch,
} from "./auto-brief-policy";

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
    expect(AUTO_BRIEF_LIMIT).toBe(3);
  });

  it("dedupes and ignores empty ids", () => {
    expect(takeAutoBriefBatch(["a", "a", ""], 2)).toEqual({ toGenerate: ["a"], remaining: 0 });
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
