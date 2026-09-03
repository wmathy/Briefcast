import { afterEach, describe, expect, it } from "vitest";
import { briefPromptSource, loadEpisodeSource } from "./sources";

const originalFetch = globalThis.fetch;
const originalKey = process.env.XAI_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.XAI_API_KEY;
  else process.env.XAI_API_KEY = originalKey;
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status = 200, contentType = "text/plain") {
  return new Response(body, { status, headers: { "Content-Type": contentType } });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    return handler(url, init);
  }) as typeof fetch;
  return calls;
}

const notes = "Jesse Michels is the creator and host of American Alchemy, a YouTube series exploring science.";

function longSpoken(seed: string): string {
  return Array.from(
    { length: 80 },
    (_, i) => `HOST: ${seed} Additional spoken sentence ${i} about the conversation, the footage, and the labs.`,
  ).join("\n");
}

const spokenTranscript = longSpoken(
  "[0:03] Joe Rogan podcast. Check it out. [0:08] The Joe Rogan Experience. [0:14] Okay. Hi, Jesse. Hello, Joe.",
);

const nprTranscriptHtml = `<html><body class="no-transcript">
  <div aria-label="Transcript"><span>Transcript</span>
  <p>ANNOUNCER: This is Planet Money from NPR.</p>
  <p>KENNY MALONE: I have never heard my Planet Money co-host this nervous before.</p>
  <p>ERIKA BERAS: OK. Can everyone in your car hear me?</p>
  <p>MALONE: No, this is just me. Today we pitch the board game to the buyers.</p>
  ${Array.from({ length: 70 }, (_, i) => `<p>MALONE: Later we walk through buyer decision ${i} inside the big-box room.</p>`).join("")}
  </div>
  <footer>Support public media</footer>
</body></html>`;

describe("loadEpisodeSource", () => {
  it("uses an RSS podcast:transcript file when it is fetchable", async () => {
    const calls = mockFetch((url) => {
      if (url === "https://example.com/episode.vtt") {
        return textResponse(
          `00:00:01.000 --> 00:00:04.000\nHOST: Welcome to the official transcript of today's show. We stay with the published captions only.\n${longSpoken("We stay with the published captions only.")}`,
          200,
          "text/vtt",
        );
      }
      return textResponse("missing", 404);
    });

    const source = await loadEpisodeSource({
      description: notes,
      transcriptUrl: "https://example.com/episode.vtt",
      episodeLink: "https://www.npr.org/2026/08/21/nx-s1-5940897/buyer-boardgame",
      durationSeconds: 180,
      showTitle: "Planet Money",
      episodeTitle: "Who decides what big box sells?",
    });

    expect(source.sourceType).toBe("transcript");
    expect(source.confidenceNote).toBeNull();
    expect(source.text).toContain("official transcript");
    expect(calls[0]).toBe("https://example.com/episode.vtt");
    expect(calls).not.toContain("https://www.youtube.com/youtubei/v1/search?prettyPrint=false");
  });

  it("uses an official NPR transcripts page when RSS has no transcript", async () => {
    mockFetch((url) => {
      if (url === "https://www.npr.org/transcripts/nx-s1-5940897") {
        return textResponse(nprTranscriptHtml, 200, "text/html");
      }
      return textResponse("missing", 404);
    });

    const source = await loadEpisodeSource({
      description: "There is a room where the fates of retail products are decided.",
      transcriptUrl: null,
      episodeLink: "https://www.npr.org/2026/08/21/nx-s1-5940897/buyer-boardgame-bigbox-target-walmart",
      durationSeconds: 180,
      showTitle: "Planet Money",
      episodeTitle: "Who decides what big box sells? Our GAME got us answers",
    });

    expect(source.sourceType).toBe("transcript");
    expect(source.text).toContain("KENNY MALONE:");
    expect(source.text).not.toContain("Support public media");
    expect(source.confidenceNote).toBeNull();
  });

  it("publishes nothing when the NPR transcripts page has no spoken text", async () => {
    mockFetch((url) => {
      if (url.includes("npr.org")) {
        return textResponse(
          `<html><body class="no-transcript"><div aria-label="Transcript"><span>Transcript</span></div><footer>Newsletter</footer></body></html>`,
          200,
          "text/html",
        );
      }
      if (url.includes("youtube.com/youtubei")) return jsonResponse({});
      return textResponse("missing", 404);
    });

    const source = await loadEpisodeSource({
      description: notes,
      episodeLink: "https://www.npr.org/2026/08/23/nx-s1-5940802/palmyra",
      durationSeconds: 820,
      showTitle: "Up First from NPR",
      episodeTitle: "A visit to the remote Pacific island ecosystem losing protections",
    });

    expect(source).toBeNull();
  });

  it("uses public YouTube captions for a JRE-style episode with no RSS transcript", async () => {
    const calls = mockFetch((url) => {
      if (url.includes("youtube.com/youtubei/v1/search")) {
        return jsonResponse({
          contents: {
            videoRenderer: {
              videoId: "33Fc_mLqY90",
              title: { runs: [{ text: "Joe Rogan Experience #2545 - Jesse Michels" }] },
            },
          },
        });
      }
      if (url === "https://youtube-transcript.ai/transcript/33Fc_mLqY90.txt") {
        return textResponse(`# Transcript: Joe Rogan Experience #2545 - Jesse Michels\n\n${spokenTranscript}`);
      }
      return textResponse("missing", 404);
    });

    const source = await loadEpisodeSource({
      description: notes,
      transcriptUrl: null,
      episodeLink: null,
      durationSeconds: 180,
      showTitle: "The Joe Rogan Experience",
      episodeTitle: "#2545 - Jesse Michels",
    });

    expect(source.sourceType).toBe("transcript");
    expect(source.text).toContain("Hi, Jesse");
    expect(source.confidenceNote).toBeNull();
    expect(calls.some((url) => url.includes("youtube.com/youtubei/v1/search"))).toBe(true);
    expect(calls).toContain("https://youtube-transcript.ai/transcript/33Fc_mLqY90.txt");
  });

  it("does not brief from a mismatched YouTube clip, then uses a public transcript page", async () => {
    const paragraphs = Array.from({ length: 8 }, (_, i) => {
      const line =
        i === 0
          ? longSpoken("Hi, Jesse. Welcome back onto the show for a long conversation.")
          : `Guest line ${i} about the footage and the labs.`;
      return `<p class="hsp-paragraph-words">${line}</p>`;
    }).join("");

    mockFetch((url) => {
      if (url.includes("youtube.com/youtubei/v1/search")) {
        return jsonResponse({
          contents: {
            videoRenderer: {
              videoId: "clipclipcli",
              title: { runs: [{ text: "Joe Rogan Experience #2545 Highlights" }] },
            },
          },
        });
      }
      if (url === "https://podcasts.happyscribe.com/the-joe-rogan-experience/2545-jesse-michels") {
        return textResponse(`<div class="episode-transcription-body">${paragraphs}</div>`, 200, "text/html");
      }
      return textResponse("missing", 404);
    });

    const source = await loadEpisodeSource({
      description: notes,
      durationSeconds: 180,
      showTitle: "The Joe Rogan Experience",
      episodeTitle: "#2545 - Jesse Michels",
    });

    expect(source.sourceType).toBe("transcript");
    expect(source.text).toContain("Welcome back onto the show");
    expect(source.confidenceNote).toBeNull();
  });

  it("uses a YouTube watch URL from the description without searching", async () => {
    mockFetch((url) => {
      if (url === "https://youtube-transcript.ai/transcript/33Fc_mLqY90.txt") {
        return textResponse(spokenTranscript);
      }
      return textResponse("missing", 404);
    });

    const source = await loadEpisodeSource({
      description: `${notes}\nWatch: https://www.youtube.com/watch?v=33Fc_mLqY90`,
      durationSeconds: 180,
      showTitle: "The Joe Rogan Experience",
      episodeTitle: "#2545 - Jesse Michels",
    });

    expect(source.sourceType).toBe("transcript");
    expect(source.text).toContain("Hi, Jesse");
  });

  it("transcribes episode audio when published NPR pages have no spoken text", async () => {
    process.env.XAI_API_KEY = "test-key";
    const spoken = longSpoken("HOST: From the episode audio we later discuss stockpiles and the deadlock.");
    const calls = mockFetch((url) => {
      if (url.includes("api.x.ai/v1/stt")) {
        return jsonResponse({ text: spoken, duration: 180 });
      }
      if (url.includes("npr.org")) {
        return textResponse(
          `<html><body class="no-transcript"><div aria-label="Transcript"><span>Transcript</span></div></body></html>`,
          200,
          "text/html",
        );
      }
      return textResponse("missing", 404);
    });

    const source = await loadEpisodeSource({
      description: notes,
      episodeLink: "https://www.npr.org/2026/09/03/nx-s1-5955302/pentagon-exodus",
      audioUrl: "https://example.com/up-first.mp3",
      durationSeconds: 180,
      showTitle: "Up First from NPR",
      episodeTitle: "Pentagon Exodus",
    });

    expect(source.sourceType).toBe("transcript");
    expect(source.confidenceNote).toBeNull();
    expect(source.text).toContain("stockpiles");
    expect(calls.some((url) => url.includes("api.x.ai/v1/stt"))).toBe(true);
  });

  it("slices a long transcript for the LLM prompt but keeps start, middle, and end", () => {
    const text = `START-${"a".repeat(50_000)}-MID-${"b".repeat(50_000)}-END-${"c".repeat(50_000)}`;
    const sliced = briefPromptSource(text, 90_000);
    expect(sliced.length).toBeLessThan(text.length);
    expect(sliced.length).toBeLessThanOrEqual(90_000 + 80);
    expect(sliced.startsWith("START-")).toBe(true);
    expect(sliced).toContain("[... middle of episode ...]");
    expect(sliced).toContain("[... later in episode ...]");
    expect(sliced.includes("END-") || sliced.endsWith("c".repeat(20))).toBe(true);
    expect(sliced).toContain("c".repeat(100));
  });

  it("keeps a long official transcript instead of truncating at the old 80k cap", async () => {
    const body = "HOST: Spoken line about later topics in the episode. ".repeat(4000);
    expect(body.length).toBeGreaterThan(80_000);
    mockFetch((url) => {
      if (url === "https://example.com/full.txt") return textResponse(body);
      return textResponse("missing", 404);
    });

    const source = await loadEpisodeSource({
      description: notes,
      transcriptUrl: "https://example.com/full.txt",
      durationSeconds: 1800,
    });

    expect(source.sourceType).toBe("transcript");
    expect(source.text.length).toBeGreaterThan(80_000);
    expect(source.text).not.toContain("[Source truncated for length.]");
  });

  it("returns null when no complete transcript can be fetched", async () => {
    mockFetch(() => textResponse("missing", 404));

    const source = await loadEpisodeSource({
      description: notes,
      transcriptUrl: "https://example.com/missing.json",
      episodeLink: null,
      durationSeconds: 820,
      showTitle: "A show without public captions",
      episodeTitle: "Tuesday news roundup",
    });

    expect(source).toBeNull();
  });
});
