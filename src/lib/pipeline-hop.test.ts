import { describe, expect, it } from "vitest";
import {
  HOP_ACK_MS,
  PIPELINE_MAX_HOPS,
  isPipelineHopAuthorized,
  pipelineHopHeaders,
  pipelineHopSecret,
  pipelineHopUrl,
  pipelineShouldHop,
} from "./pipeline-hop";

describe("pipelineShouldHop", () => {
  it("hops when this turn advanced STT, wrote a brief, or published audio", () => {
    expect(pipelineShouldHop({ remaining: 1, progressed: true, reason: "transcript-in-progress" })).toBe(true);
    expect(pipelineShouldHop({ remaining: 1, progressed: true, reason: "audio-pending" })).toBe(true);
    expect(pipelineShouldHop({ remaining: 3, generated: 1, progressed: true })).toBe(true);
  });

  it("retries the next hop after a failed step instead of dying silently", () => {
    expect(pipelineShouldHop({ remaining: 1, progressed: false, errors: ["xAI TTS error 503"] })).toBe(true);
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

  it("stops when the key is missing or the window is empty", () => {
    expect(pipelineShouldHop({ remaining: 2, progressed: true, reason: "missing-xai-key" })).toBe(false);
    expect(pipelineShouldHop({ remaining: 0, progressed: true, generated: 1 })).toBe(false);
  });

  it("does not hop-spin when the newest episode has no full transcript", () => {
    expect(
      pipelineShouldHop({
        remaining: 1,
        progressed: false,
        errors: ["The Tucker Carlson Show: Full transcript not available yet — no brief"],
        reason: "no-full-transcript",
      }),
    ).toBe(false);
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

  function restore() {
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
    if (originalAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalAuth;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }

  it("uses AUTH_SECRET on Vercel when CRON_SECRET is unset so Preview hops are not 401", () => {
    delete process.env.CRON_SECRET;
    process.env.AUTH_SECRET = "preview-auth";
    process.env.VERCEL = "1";
    expect(pipelineHopSecret()).toBe("preview-auth");
    expect(pipelineHopHeaders()).toEqual({ authorization: "Bearer preview-auth" });
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
});
