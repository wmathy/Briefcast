import { describe, expect, it } from "vitest";
import { durationHintForRecap, resolveRecapDuration } from "./recap-duration";

describe("durationHintForRecap", () => {
  it("prefers stored audio seconds over spoken-word estimate", () => {
    expect(durationHintForRecap({ durationSeconds: 540, spokenRecap: "word ".repeat(150) })).toBe(540);
  });

  it("estimates from spoken recap words at 150 wpm when audio length is missing", () => {
    expect(durationHintForRecap({ spokenRecap: "word ".repeat(150) })).toBe(60);
    expect(durationHintForRecap({})).toBeUndefined();
  });
});

describe("resolveRecapDuration", () => {
  it("keeps a sane reported duration and replaces an early half-length read", () => {
    expect(resolveRecapDuration(600, 600)).toBe(600);
    expect(resolveRecapDuration(280, 600)).toBe(600);
    expect(resolveRecapDuration(Number.NaN, 90)).toBe(90);
    expect(resolveRecapDuration(Number.NaN)).toBe(0);
  });
});
