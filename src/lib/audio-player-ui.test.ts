import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("brief audio player", () => {
  it("uses a seekable scrubber with elapsed and remaining times", () => {
    const source = readFileSync(path.join(__dirname, "../components/AudioPlayer.tsx"), "utf8");
    expect(source).toContain('type="range"');
    expect(source).toContain("durationHint");
    expect(source).toContain("formatPlayerTime");
    expect(source).not.toContain("Spoken recap · Eve");
    expect(source).not.toContain("controls");
  });
});
