import { describe, expect, it } from "vitest";
import { extractGuest, looksLikeTranscriptUrl, stripHtml } from "./html";

describe("stripHtml", () => {
  it("turns NPR-style notes into readable text", () => {
    const text = stripHtml("Line one<br>Line two<br/><p>Paragraph</p>");
    expect(text).toContain("Line one");
    expect(text).toContain("Line two");
    expect(text).not.toContain("<br");
  });
});

describe("extractGuest", () => {
  it("finds an explicit guest label", () => {
    expect(extractGuest("A talk with guest Lauren Sommer", "")).toBe("Lauren Sommer");
  });

  it("does not invent a guest when none is named", () => {
    expect(extractGuest("Tariff War With Canada", "Three news stories.")).toBeNull();
  });
});

describe("looksLikeTranscriptUrl", () => {
  it("recognizes RSS files and publisher transcript pages", () => {
    expect(looksLikeTranscriptUrl("https://example.com/ep.vtt")).toBe(true);
    expect(looksLikeTranscriptUrl("https://www.npr.org/transcripts/nx-s1-5940897")).toBe(true);
  });

  it("does not treat a normal episode permalink as a transcript", () => {
    expect(looksLikeTranscriptUrl("https://www.npr.org/2026/08/21/nx-s1-5940897/buyer-boardgame")).toBe(false);
  });
});
