import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshFollowedBriefs } from "@/lib/auto-brief";
import {
  HOP_ACK_MS,
  PIPELINE_MAX_HOPS,
  drainFollowedBriefs,
  isPipelineHopAuthorized,
  pipelineHopHeaders,
  pipelineHopSecret,
  pipelineHopUrl,
  pipelineShouldHop,
} from "./pipeline-hop";

vi.mock("@/lib/auto-brief", () => ({
  refreshFollowedBriefs: vi.fn(),
}));

describe("pipelineShouldHop", () => {
  it("hops when this turn advanced STT, wrote a brief, or published audio", () => {
    expect(pipelineShouldHop({ remaining: 1, progressed: true, reason: "transcript-in-progress" })).toBe(true);
    expect(pipelineShouldHop({ remaining: 1, progressed: true, reason: "audio-pending" })).toBe(true);
    expect(pipelineShouldHop({ remaining: 3, generated: 1, progressed: true })).toBe(true);
  });

  it("does not hop when a turn made no progress even if it recorded errors", () => {
    expect(
      pipelineShouldHop({
        remaining: 1,
        generated: 0,
        progressed: false,
        errors: ["xAI TTS error 503"],
      }),
    ).toBe(false);
  });

  it("does not spin when every candidate is only a locked STT job", () => {
    expect(
      pipelineShouldHop({
        remaining: 4,
        progressed: false,
        generated: 0,
        inProgress: 4,
        reason: "transcript-in-progress",
      }),
    ).toBe(false);
  });

  it("hops after skipping a busy STT lock so another follow’s newest can start", () => {
    expect(
      pipelineShouldHop({
        remaining: 1,
        progressed: false,
        skippedBusy: true,
        reason: "transcript-in-progress",
      }),
    ).toBe(true);
  });

  it("stops when the key is missing or the window is empty", () => {
    expect(pipelineShouldHop({ remaining: 2, progressed: true, reason: "missing-xai-key" })).toBe(false);
    expect(pipelineShouldHop({ remaining: 0, progressed: true, generated: 1 })).toBe(false);
  });

  it("does not hop-spin when the only remaining episode has no full transcript", () => {
    expect(
      pipelineShouldHop({
        remaining: 0,
        progressed: false,
        errors: ["The Tucker Carlson Show: Full transcript not available yet — no brief"],
        reason: "no-full-transcript",
      }),
    ).toBe(false);
  });

  it("hops to another follow after this newest had no usable transcript", () => {
    expect(
      pipelineShouldHop({
        remaining: 1,
        progressed: false,
        errors: ["Jocko Podcast: Full transcript not available yet — no brief"],
        reason: "no-full-transcript",
      }),
    ).toBe(true);
  });
});

describe("drainFollowedBriefs", () => {
  const refresh = vi.mocked(refreshFollowedBriefs);

  beforeEach(() => {
    refresh.mockReset();
  });

  it("excludes an episode that throws and still briefs the next follow", async () => {
    refresh.mockImplementation(async (options) => {
      const exclude = [...(options?.excludeIds ?? [])];
      if (!exclude.includes("ep-fail")) {
        return {
          remaining: 1,
          generated: 0,
          progressed: false,
          errors: ["JRE: xAI TTS error 503"],
          failedIds: ["ep-fail"],
          unavailableIds: ["ep-fail"],
        };
      }
      return {
        remaining: 0,
        generated: 1,
        progressed: true,
        errors: [],
        failedIds: [],
        unavailableIds: [],
      };
    });

    const result = await drainFollowedBriefs({ userId: "user-1" });

    expect(refresh.mock.calls.length).toBe(2);
    expect(refresh.mock.calls.length).toBeLessThan(PIPELINE_MAX_HOPS);
    const secondExclude = [...(refresh.mock.calls[1]?.[0]?.excludeIds ?? [])];
    expect(secondExclude).toContain("ep-fail");
    expect(result.generated).toBe(1);
    expect(result.progressed).toBe(true);
  });

  it("does not spin the hop cap when the only candidate throws", async () => {
    refresh.mockResolvedValue({
      remaining: 0,
      generated: 0,
      progressed: false,
      errors: ["JRE: xAI TTS error 503"],
      failedIds: ["ep-fail"],
      unavailableIds: ["ep-fail"],
    });

    const result = await drainFollowedBriefs({ userId: "user-1" });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.generated).toBe(0);
    expect(result.progressed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe("pipelineHopUrl", () => {
  it("targets this deployment origin so Preview hops stay on Preview", () => {
    expect(
      pipelineHopUrl({
        origin: "https://briefcast-git-preview.vercel.app",
        hop: 2,
        userId: "user-1",
        showId: "show-1",
      }),
    ).toBe(
      "https://briefcast-git-preview.vercel.app/api/pipeline/continue?hop=2&userId=user-1&showId=show-1",
    );
    expect(PIPELINE_MAX_HOPS).toBe(80);
    expect(HOP_ACK_MS).toBeGreaterThanOrEqual(25_000);
  });
});

describe("pipeline hop auth", () => {
  const originalCron = process.env.CRON_SECRET;
  const originalAuth = process.env.AUTH_SECRET;
  const originalVercel = process.env.VERCEL;
  const originalBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  function restore() {
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
    if (originalAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalAuth;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
    if (originalBypass === undefined) delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    else process.env.VERCEL_AUTOMATION_BYPASS_SECRET = originalBypass;
  }

  it("uses AUTH_SECRET on Vercel when CRON_SECRET is unset so Preview hops are not 401", () => {
    delete process.env.CRON_SECRET;
    process.env.AUTH_SECRET = "preview-auth";
    process.env.VERCEL = "1";
    expect(pipelineHopSecret()).toBe("preview-auth");
    expect(pipelineHopHeaders()).toMatchObject({ authorization: "Bearer preview-auth" });
    expect(
      isPipelineHopAuthorized(
        new Request("http://localhost/api/pipeline/continue", {
          headers: { authorization: "Bearer preview-auth" },
        }),
      ),
    ).toBe(true);
    expect(isPipelineHopAuthorized(new Request("http://localhost/api/pipeline/continue"))).toBe(false);
    restore();
  });

  it("sends the Vercel automation bypass so Preview protection does not 401 hops", () => {
    delete process.env.CRON_SECRET;
    process.env.AUTH_SECRET = "preview-auth";
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "bypass-secret";
    expect(pipelineHopHeaders()).toEqual({
      authorization: "Bearer preview-auth",
      "x-vercel-protection-bypass": "bypass-secret",
      "x-vercel-set-bypass-cookie": "true",
    });
    restore();
  });
});
