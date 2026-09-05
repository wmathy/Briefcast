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

  it("gives play, speed, and the scrubber 44px touch targets", () => {
    const source = readFileSync(path.join(__dirname, "../components/AudioPlayer.tsx"), "utf8");
    const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");
    expect(source).toContain("h-11 w-11");
    expect(source).toContain("tap pressable");
    expect(source).toContain("w-11");
    expect(source).not.toContain("hover:text-ink");
    expect(css).toContain("height: 2.75rem");
    expect(css).toContain("width: 22px");
  });
});
