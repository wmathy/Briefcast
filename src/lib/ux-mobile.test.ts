import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return readFileSync(path.join(__dirname, rel), "utf8");
}

describe("mobile press and loading feedback", () => {
  it("defines 44px tap targets and immediate pressed states", () => {
    const css = read("../app/globals.css");
    expect(css).toContain("touch-action: manipulation");
    expect(css).toContain(".tap");
    expect(css).toContain("min-height: 2.75rem");
    expect(css).toContain(".pressable:active:not(:disabled)");
    expect(css).toContain(".card-link:active");
    expect(css).toContain("@media (hover: hover) and (pointer: fine)");
  });

  it("marks Check, Generate, and refresh busy while in flight", () => {
    expect(read("../components/RefreshLibraryButton.tsx")).toContain("aria-busy={pending}");
    expect(read("../components/RefreshLibraryButton.tsx")).toContain("tap pressable");
    expect(read("../components/RefreshLibraryButton.tsx")).toContain("Checking…");
    expect(read("../components/RefreshButton.tsx")).toContain("aria-busy={pending}");
    expect(read("../components/RefreshButton.tsx")).toContain("Continuing…");
    expect(read("../components/GenerateButton.tsx")).toContain("aria-busy={pending}");
    expect(read("../components/GenerateButton.tsx")).toContain("Working…");
  });

  it("keeps hop backup loop messaging live without blocking the page", () => {
    const source = read("../components/AutoGenerateLatest.tsx");
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Continuing…");
    expect(source).not.toContain("Could not write.");
  });

  it("does not hide Unfollow or playback speed behind hover", () => {
    const unfollow = read("../components/UnfollowButton.tsx");
    expect(unfollow).toContain("tap pressable");
    expect(unfollow).toContain("aria-busy={pending}");
    expect(unfollow).not.toContain("hover:underline");
    expect(unfollow).not.toContain("hover:text-danger");

    const player = read("../components/AudioPlayer.tsx");
    expect(player).toContain("border border-line");
    expect(player).not.toContain("hover:text-ink");
  });

  it("makes length and voice controls thumb-sized with busy state", () => {
    expect(read("../components/BriefLengthPicker.tsx")).toContain("tap pressable");
    expect(read("../components/TtsVoicePicker.tsx")).toContain("min-h-11");
    expect(read("../components/ShowBriefLengthControl.tsx")).toContain("aria-busy={pending}");
  });
});
