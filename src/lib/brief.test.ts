import { describe, expect, it } from "vitest";
import { clipSpokenRecapToMaxWords, buildBriefPrompt, parseBriefJson, spokenRecapFromBrief } from "./brief";
import { BRIEF_LENGTH_SPECS } from "./brief-length";

const sample = {
  guest: "Lauren Sommer",
  overview: "First sentence. Second sentence.",
  segments: [
    { title: "Access", speaker: "guest", summary: "Sommer visited Palmyra." },
  ],
  takeaways: ["One", "Two", "Three", "Four"],
  spokenRecap: "A spoken recap.",
};

describe("clipSpokenRecapToMaxWords", () => {
  it("cuts an overlong recap at a sentence so Medium stays in band", () => {
    const sentences = Array.from({ length: 250 }, (_, i) => `This is spoken sentence number ${i} about later topics.`).join(" ");
    expect(sentences.split(/\s+/).length).toBeGreaterThan(1800);
    const clipped = clipSpokenRecapToMaxWords(sentences, 1800);
    expect(clipped.split(/\s+/).length).toBeLessThanOrEqual(1800);
    expect(clipped.endsWith(".")).toBe(true);
  });
});

describe("parseBriefJson", () => {
  it("accepts a faithful brief payload", () => {
    expect(parseBriefJson(JSON.stringify(sample)).takeaways).toHaveLength(4);
  });

  it("rejects briefs with no takeaways", () => {
    expect(() => parseBriefJson(JSON.stringify({ ...sample, takeaways: [] }))).toThrow();
  });
});

describe("spokenRecapFromBrief", () => {
  it("covers the written brief so spoken audio is not a clipped teaser", () => {
    const spoken = spokenRecapFromBrief({
      showTitle: "Up First from NPR",
      episodeTitle: "Palmyra",
      guest: "Lauren Sommer",
      overview: sample.overview,
      segments: sample.segments as { title: string; speaker: "guest"; summary: string }[],
      takeaways: sample.takeaways,
    });
    expect(spoken).toContain(sample.overview);
    expect(spoken).toContain(sample.segments[0].summary);
    expect(spoken.length).toBeGreaterThan("A spoken recap.".length);
  });

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

describe("buildBriefPrompt", () => {
  const source = {
    text: "Host Ayesha talks with Lauren Sommer about Palmyra Atoll and fishing policy.",
    sourceType: "shownotes" as const,
    confidenceNote: "Official show notes only.",
  };
  const base = {
    showTitle: "Up First from NPR",
    episodeTitle: "Palmyra",
    publishedAt: new Date("2026-08-23T07:00:00.000Z"),
    episodeLink: "https://www.npr.org/example",
    knownGuest: "Lauren Sommer",
    source,
  };

  it("asks Short / Medium / Long prompts for the 1x word-count bands", () => {
    const short = buildBriefPrompt({ ...base, briefLength: "short" });
    const medium = buildBriefPrompt({ ...base, briefLength: "medium" });
    const long = buildBriefPrompt({ ...base, briefLength: "long" });

    expect(short).toContain(`${BRIEF_LENGTH_SPECS.short.spokenWords.min}–${BRIEF_LENGTH_SPECS.short.spokenWords.max} words`);
    expect(medium).toContain(`${BRIEF_LENGTH_SPECS.medium.spokenWords.min}–${BRIEF_LENGTH_SPECS.medium.spokenWords.max} words`);
    expect(long).toContain(`${BRIEF_LENGTH_SPECS.long.spokenWords.min}–${BRIEF_LENGTH_SPECS.long.spokenWords.max} words`);
    expect(long).toContain("20–30 min at 1x");
    expect(short).toContain("Do not invent");
    expect(long).toContain("Do not pad with filler");
    expect(medium).toContain("full episode transcript");
  });

  it("tells the model a transcript source is the full episode, not notes", () => {
    const prompt = buildBriefPrompt({
      ...base,
      source: {
        text: "HOST: Welcome.\nGUEST: We cover the second half of the interview in detail.",
        sourceType: "transcript",
        confidenceNote: null,
      },
    });
    expect(prompt).toContain("full episode transcript");
    expect(prompt).toContain("not a teaser");
    expect(prompt).not.toContain("official show notes only");
  });

  it("when the source is thin, forbids inventing a longer recap", () => {
    const prompt = buildBriefPrompt({ ...base, briefLength: "long", sourceLimited: true });
    expect(prompt).toContain("too thin");
    expect(prompt).toContain("Do not invent");
    expect(prompt).toContain("may be shorter");
  });
});
