import { describe, expect, it } from "vitest";
import {
  AUTO_BRIEF_LIMIT,
  collectAutoBriefJobs,
  isCronRequestAuthorized,
  pickAutoBriefEpisodeIds,
} from "./auto-brief-policy";

const older = new Date("2026-08-01T00:00:00.000Z");
const newer = new Date("2026-09-01T00:00:00.000Z");

describe("pickAutoBriefEpisodeIds", () => {
  it("on first follow, generates only the newest imported episode", () => {
    expect(
      pickAutoBriefEpisodeIds({
        initialImport: true,
        newlyCreated: [
          { id: "old", publishedAt: older },
          { id: "new", publishedAt: newer },
        ],
        latestUnbriefedId: "old",
      }),
    ).toEqual(["new"]);
  });

  it("on first follow with an empty feed, uses the latest unbriefed episode if one exists", () => {
    expect(
      pickAutoBriefEpisodeIds({
        initialImport: true,
        newlyCreated: [],
        latestUnbriefedId: "already-there",
      }),
    ).toEqual(["already-there"]);
  });

  it("after a show is already synced, generates newly published episodes newest first", () => {
    expect(
      pickAutoBriefEpisodeIds({
        initialImport: false,
        newlyCreated: [
          { id: "old", publishedAt: older },
          { id: "new", publishedAt: newer },
        ],
        latestUnbriefedId: "new",
        limit: 2,
      }),
    ).toEqual(["new", "old"]);
  });

  it("when no new RSS items appear, backfills the latest episode that still has no brief", () => {
    expect(
      pickAutoBriefEpisodeIds({
        initialImport: false,
        newlyCreated: [],
        latestUnbriefedId: "latest-without-brief",
      }),
    ).toEqual(["latest-without-brief"]);
  });

  it("does not pick anything when there is nothing new and every episode already has a brief", () => {
    expect(
      pickAutoBriefEpisodeIds({
        initialImport: false,
        newlyCreated: [],
        latestUnbriefedId: null,
      }),
    ).toEqual([]);
  });

  it("caps how many briefs one poll will start", () => {
    expect(
      pickAutoBriefEpisodeIds({
        initialImport: false,
        newlyCreated: [
          { id: "a", publishedAt: newer },
          { id: "b", publishedAt: older },
          { id: "c", publishedAt: new Date("2026-07-01T00:00:00.000Z") },
        ],
        latestUnbriefedId: null,
        limit: AUTO_BRIEF_LIMIT,
      }),
    ).toHaveLength(AUTO_BRIEF_LIMIT);
  });
});

describe("collectAutoBriefJobs", () => {
  it("walks every followed show and caps the global generate list", () => {
    const ids = collectAutoBriefJobs(
      [
        {
          existingEpisodeCount: 4,
          createdEpisodes: [{ id: "show-a-new", publishedAt: newer }],
          latestUnbriefedId: "show-a-new",
        },
        {
          existingEpisodeCount: 0,
          createdEpisodes: [
            { id: "show-b-old", publishedAt: older },
            { id: "show-b-new", publishedAt: newer },
          ],
          latestUnbriefedId: "show-b-new",
        },
        {
          existingEpisodeCount: 8,
          createdEpisodes: [],
          latestUnbriefedId: "show-c-latest",
        },
      ],
      2,
    );
    expect(ids).toEqual(["show-a-new", "show-b-new"]);
  });

  it("does not invent jobs for shows nobody follows (empty input)", () => {
    expect(collectAutoBriefJobs([])).toEqual([]);
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
