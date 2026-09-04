import { describe, expect, it } from "vitest";
import { PIPELINE_MAX_HOPS, pipelineHopUrl, pipelineShouldHop } from "./pipeline-hop";

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
      "https://briefcast-git-preview.vercel.app/api/cron/continue?hop=2&userId=user-1&showId=show-1",
    );
    expect(PIPELINE_MAX_HOPS).toBe(80);
  });
});
