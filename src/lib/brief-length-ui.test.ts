import { readFileSync } from "node:fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("per-follow length UI", () => {
  it("lets Discover pick Short / Medium / Long when following", () => {
    const source = readFileSync(path.join(__dirname, "../components/SearchShows.tsx"), "utf8");
    expect(source).toContain("BriefLengthPicker");
    expect(source).toContain("briefLength");
    expect(source).toContain("defaultLength");
  });

  it("lets the show page change length without unfollowing", () => {
    const source = readFileSync(path.join(__dirname, "../app/shows/[id]/page.tsx"), "utf8");
    expect(source).toContain("ShowBriefLengthControl");
    expect(source).toContain("initialLength");
    expect(source).toContain("initialVoice");
    expect(source).toContain("voices");
  });

  it("puts a compact Voice select next to Short / Medium / Long", () => {
    const control = readFileSync(path.join(__dirname, "../components/ShowBriefLengthControl.tsx"), "utf8");
    const picker = readFileSync(path.join(__dirname, "../components/TtsVoicePicker.tsx"), "utf8");
    expect(control).toContain("TtsVoicePicker");
    expect(control).toContain("ttsVoice");
    expect(picker).toContain("<select");
    expect(picker).toContain("Voice");
    expect(picker).not.toContain("choose a narrator");
    expect(picker).not.toContain("radio");
  });

  it("lets the show page change length without a helper paragraph", () => {
    const source = readFileSync(
      path.join(__dirname, "../components/ShowBriefLengthControl.tsx"),
      "utf8",
    );
    expect(source).toContain("BriefLengthPicker");
    expect(source).not.toContain("Applies the next time you Generate");
    expect(source).not.toContain("Existing briefs");
  });
});
