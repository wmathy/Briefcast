import { describe, expect, it } from "vitest";
import {
  collectYoutubeSearchVideos,
  extractYoutubeVideoIds,
  isUsableTranscript,
  nprTranscriptUrls,
  parseTranscriptPayload,
  publicDirectoryUrls,
  youtubeTitlesMatch,
} from "./transcripts";

describe("extractYoutubeVideoIds", () => {
  it("reads watch, short, and youtu.be links", () => {
    const text = [
      "See https://www.youtube.com/watch?v=33Fc_mLqY90",
      "https://youtu.be/33Fc_mLqY90",
      "https://www.youtube.com/embed/abcdefghijk",
    ].join("\n");
    expect(extractYoutubeVideoIds(text)).toEqual(["33Fc_mLqY90", "abcdefghijk"]);
  });

  it("does not treat channel handles as video ids", () => {
    expect(extractYoutubeVideoIds("www.youtube.com/@JesseMichels https://www.youtube.com/@JoeRogan")).toEqual([]);
  });
});

describe("nprTranscriptUrls", () => {
  it("builds a transcripts URL from a story permalink", () => {
    expect(
      nprTranscriptUrls("https://www.npr.org/2026/08/21/nx-s1-5940897/buyer-boardgame-bigbox-target-walmart"),
    ).toEqual(["https://www.npr.org/transcripts/nx-s1-5940897"]);
  });

  it("keeps an official transcripts permalink", () => {
    expect(nprTranscriptUrls("https://www.npr.org/transcripts/534736290")).toEqual([
      "https://www.npr.org/transcripts/534736290",
    ]);
  });

  it("ignores non-NPR links", () => {
    expect(nprTranscriptUrls("https://open.spotify.com/episode/abc")).toEqual([]);
  });
});

describe("publicDirectoryUrls", () => {
  it("slugifies JRE-style titles", () => {
    expect(publicDirectoryUrls("The Joe Rogan Experience", "#2545 - Jesse Michels")).toEqual([
      "https://podcasts.happyscribe.com/the-joe-rogan-experience/2545-jesse-michels",
      "https://podscripts.co/podcasts/the-joe-rogan-experience/2545-jesse-michels",
    ]);
  });
});

describe("youtubeTitlesMatch", () => {
  it("accepts the official JRE upload for the same episode number and guest", () => {
    expect(
      youtubeTitlesMatch(
        "The Joe Rogan Experience",
        "#2545 - Jesse Michels",
        "Joe Rogan Experience #2545 - Jesse Michels",
      ),
    ).toBe(true);
  });

  it("rejects a different episode number or a highlights clip", () => {
    expect(
      youtubeTitlesMatch(
        "The Joe Rogan Experience",
        "#2545 - Jesse Michels",
        "Joe Rogan Experience #2331 - Jesse Michels",
      ),
    ).toBe(false);
    expect(
      youtubeTitlesMatch(
        "The Joe Rogan Experience",
        "#2545 - Jesse Michels",
        "Joe Rogan Experience #2545 Highlights",
      ),
    ).toBe(false);
  });
});

describe("collectYoutubeSearchVideos", () => {
  it("walks nested videoRenderer objects", () => {
    const videos = collectYoutubeSearchVideos({
      contents: {
        itemSectionRenderer: {
          contents: [
            {
              videoRenderer: {
                videoId: "33Fc_mLqY90",
                title: { runs: [{ text: "Joe Rogan Experience #2545 - Jesse Michels" }] },
              },
            },
          ],
        },
      },
    });
    expect(videos).toEqual([{ id: "33Fc_mLqY90", title: "Joe Rogan Experience #2545 - Jesse Michels" }]);
  });
});

describe("parseTranscriptPayload", () => {
  it("extracts NPR dialogue after the Transcript label", () => {
    const html = `<html><body class="no-transcript">
      <div aria-label="Transcript"><span>Transcript</span>
      <p>ANNOUNCER: This is Planet Money from NPR.</p>
      <p>KENNY MALONE: I have never heard my co-host this nervous.</p>
      <p>ERIKA BERAS: Can everyone in your car hear me?</p>
      <p>MALONE: No, this is just me talking about the buyer board.</p>
      </div>
      <footer>Donate to NPR</footer>
    </body></html>`;
    const text = parseTranscriptPayload(html, "text/html", "https://www.npr.org/transcripts/nx-s1-5940897");
    expect(text).toContain("KENNY MALONE:");
    expect(text).not.toContain("Donate to NPR");
    expect(text).not.toContain("aria-label");
  });

  it("returns empty for an NPR transcripts page with no spoken text", () => {
    const html = `<html><body class="no-transcript">
      <div aria-label="Transcript"><span>Transcript</span></div>
      <footer>Subscribe to the newsletter. Support public media.</footer>
    </body></html>`;
    expect(parseTranscriptPayload(html, "text/html", "https://www.npr.org/transcripts/nx-s1-5940897")).toBe("");
  });

  it("joins HappyScribe paragraph words", () => {
    const paragraphs = Array.from({ length: 8 }, (_, i) => {
      const line = i === 0 ? "Hi, Jesse. Welcome back to the show." : `Spoken line number ${i} about the topic.`;
      return `<p class="hsp-paragraph-words">${line}</p>`;
    }).join("");
    const html = `<div class="episode-transcription-body">${paragraphs}</div>`;
    const text = parseTranscriptPayload(html, "text/html", "https://podcasts.happyscribe.com/the-joe-rogan-experience/2545-jesse-michels");
    expect(text).toContain("Hi, Jesse.");
    expect(text).toContain("Spoken line number 7");
  });

  it("decodes YouTube caption markup", () => {
    const raw = "# Transcript: Demo\n\n[0:03] &gt;&gt; The Joe Rogan Experience.\n[0:08] Hi, Jesse.";
    expect(parseTranscriptPayload(raw, "text/markdown", "https://youtube-transcript.ai/transcript/33Fc_mLqY90.txt")).toContain(
      "The Joe Rogan Experience.",
    );
    expect(parseTranscriptPayload(raw, "text/markdown", "https://youtube-transcript.ai/transcript/33Fc_mLqY90.txt")).not.toContain(
      "&gt;",
    );
  });

  it("keeps JSON podcast transcripts", () => {
    const raw = JSON.stringify({
      transcript: "HOST: Welcome.\nGUEST: Thanks for having me onto the program today.",
    });
    expect(parseTranscriptPayload(raw, "application/json", "https://example.com/ep.json")).toContain("HOST: Welcome.");
  });
});

describe("isUsableTranscript", () => {
  it("accepts a short official RSS file", () => {
    expect(
      isUsableTranscript(
        "HOST: A short official caption file with enough characters to pass the minimum length check.",
        "",
        "official",
      ),
    ).toBe(true);
  });

  it("rejects discovered text that is just the show notes", () => {
    const notes = "Jesse Michels is the creator and host of American Alchemy, a YouTube series.";
    expect(isUsableTranscript(notes, notes, "discovered")).toBe(false);
  });
});
