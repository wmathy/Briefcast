import { describe, expect, it } from "vitest";
import { formatDiarizedTranscript } from "./xai";

describe("formatDiarizedTranscript", () => {
  it("groups words by speaker so the brief sees dialogue, not a blob", () => {
    const text = formatDiarizedTranscript({
      text: "Hello from the host and the guest talking later.",
      words: [
        { text: "Hello", speaker: 0 },
        { text: "from", speaker: 0 },
        { text: "the", speaker: 0 },
        { text: "host.", speaker: 0 },
        { text: "And", speaker: 1 },
        { text: "the", speaker: 1 },
        { text: "guest", speaker: 1 },
        { text: "talking", speaker: 1 },
        { text: "later.", speaker: 1 },
      ],
    });
    expect(text).toContain("Speaker 1: Hello from the host.");
    expect(text).toContain("Speaker 2: And the guest talking later.");
  });

  it("falls back to the plain text when there is no diarization", () => {
    expect(formatDiarizedTranscript({ text: "A short official caption file with enough characters to pass." })).toBe(
      "A short official caption file with enough characters to pass.",
    );
  });
});
