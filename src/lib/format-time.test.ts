import { describe, expect, it } from "vitest";
import { formatEpisodeClock, formatPlayerTime } from "./format-time";

describe("formatPlayerTime", () => {
  it("formats minutes and hours", () => {
    expect(formatPlayerTime(0)).toBe("0:00");
    expect(formatPlayerTime(65)).toBe("1:05");
    expect(formatPlayerTime(3723)).toBe("1:02:03");
  });
});

describe("formatEpisodeClock", () => {
  it("rounds episode length to minutes", () => {
    expect(formatEpisodeClock(null)).toBeNull();
    expect(formatEpisodeClock(820)).toBe("14 min");
  });
});
