import { describe, expect, it } from "vitest";
import {
  FUNCTION_LIMIT_MS,
  HOP_RESERVE_MS,
  TURN_BUDGET_MS,
  pipelineTurnElapsedMs,
  pipelineTurnHasBudget,
  runPipelineTurn,
} from "./pipeline-turn";

describe("pipeline turn budget", () => {
  it("reserves leftover time so the hop 202 can be awaited inside 300s", () => {
    expect(FUNCTION_LIMIT_MS).toBe(300_000);
    expect(HOP_RESERVE_MS).toBeGreaterThanOrEqual(25_000);
    expect(TURN_BUDGET_MS).toBe(FUNCTION_LIMIT_MS - HOP_RESERVE_MS);
  });

  it("tracks elapsed time only inside runPipelineTurn", async () => {
    expect(pipelineTurnElapsedMs()).toBe(0);
    expect(pipelineTurnHasBudget()).toBe(true);
    await runPipelineTurn(async () => {
      expect(pipelineTurnHasBudget()).toBe(true);
      expect(pipelineTurnElapsedMs()).toBeGreaterThanOrEqual(0);
      expect(pipelineTurnElapsedMs()).toBeLessThan(1_000);
    });
  });
});
