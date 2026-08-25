import { describe, expect, it } from "vitest";
import { parseBriefJson, spokenRecapFromBrief } from "./brief";

const sample = {
  guest: "Lauren Sommer",
  overview: "First sentence. Second sentence.",
  segments: [
    { title: "Access", speaker: "guest", summary: "Sommer visited Palmyra." },
  ],
  takeaways: ["One", "Two", "Three", "Four"],
  spokenRecap: "A spoken recap.",
};

describe("parseBriefJson", () => {
  it("accepts a faithful brief payload", () => {
    expect(parseBriefJson(JSON.stringify(sample)).takeaways).toHaveLength(4);
  });

  it("rejects briefs that invent an empty takeaway list", () => {
    expect(() => parseBriefJson(JSON.stringify({ ...sample, takeaways: ["only one"] }))).toThrow();
  });
});

describe("spokenRecapFromBrief", () => {
  it("includes show, title, and takeaways", () => {
    const spoken = spokenRecapFromBrief({
      showTitle: "Up First from NPR",
      episodeTitle: "Palmyra",
      guest: "Lauren Sommer",
      overview: sample.overview,
      segments: sample.segments as { title: string; speaker: "guest"; summary: string }[],
      takeaways: sample.takeaways,
    });
    expect(spoken).toContain("Up First from NPR");
    expect(spoken).toContain("Lauren Sommer");
    expect(spoken).toContain("Takeaways");
  });
});
