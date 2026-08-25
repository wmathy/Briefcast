import { describe, expect, it } from "vitest";
import { extractGuest, stripHtml } from "./html";

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
