import { describe, expect, it } from "vitest";
import {
  XAI_TTS_CHUNK_CHARS,
  XAI_TTS_MAX_CHARS,
  concatMp3,
  estimateMp3DurationSeconds,
  splitTextForTts,
  stripId3v1,
  stripId3v2,
} from "./tts";
import { BRIEF_LENGTH_SPECS, countWords } from "./brief-length";

function sentenceBlock(chars: number): string {
  const sentence = "This is a spoken sentence about the episode. ";
  let out = "";
  while (out.length < chars) out += sentence;
  return out.slice(0, chars).replace(/\s+\S*$/, ".") + " Next thought continues here.";
}

describe("xAI TTS character cap", () => {
  it("documents the official 15,000 character unary limit", () => {
    expect(XAI_TTS_MAX_CHARS).toBe(15_000);
    expect(XAI_TTS_CHUNK_CHARS).toBeLessThanOrEqual(XAI_TTS_MAX_CHARS);
  });

  it("keeps a Medium recap in one request and splits a Long recap instead of truncating", () => {
    const medium = "word ".repeat(BRIEF_LENGTH_SPECS.medium.spokenWords.max).trim();
    expect(medium.length).toBeLessThan(XAI_TTS_MAX_CHARS);
    expect(splitTextForTts(medium)).toEqual([medium]);

    const long = sentenceBlock(22_000);
    expect(long.length).toBeGreaterThan(XAI_TTS_MAX_CHARS);
    const chunks = splitTextForTts(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= XAI_TTS_CHUNK_CHARS)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toContain("spoken sentence");
    expect(countWords(chunks.join(" "))).toBeGreaterThanOrEqual(countWords(long) - 2);
    expect(chunks.join("")).not.toEqual(long.slice(0, XAI_TTS_MAX_CHARS));
    expect(chunks.reduce((sum, chunk) => sum + chunk.length, 0)).toBeGreaterThan(XAI_TTS_MAX_CHARS);
  });

  it("never drops the tail of a recap that exceeds 15,000 characters", () => {
    const tailMarker = "UNIQUE_TAIL_MARKER_SHOULD_SURVIVE_CHUNKING";
    const text = `${"Alpha sentence. ".repeat(1200)}${tailMarker}`;
    expect(text.length).toBeGreaterThan(XAI_TTS_MAX_CHARS);
    const chunks = splitTextForTts(text);
    expect(chunks.at(-1)).toContain(tailMarker);
    expect(text.includes(tailMarker)).toBe(true);
    expect(text.slice(0, XAI_TTS_MAX_CHARS).includes(tailMarker)).toBe(false);
  });
});

describe("concatMp3", () => {
  it("stitches chunks and strips extra ID3 tags so one file remains playable", () => {
    const id3v2 = Buffer.alloc(10 + 4);
    id3v2.write("ID3", 0);
    id3v2[6] = 0;
    id3v2[7] = 0;
    id3v2[8] = 0;
    id3v2[9] = 4;
    id3v2.write("META", 10);

    const id3v1 = Buffer.alloc(128);
    id3v1.write("TAG", 0);

    const first = Buffer.concat([id3v2, Buffer.from("AAAA"), id3v1]);
    const second = Buffer.concat([id3v2, Buffer.from("BBBB"), id3v1]);
    const joined = concatMp3([first, second]);

    expect(joined.subarray(0, 3).toString("ascii")).toBe("ID3");
    expect(stripId3v2(joined).subarray(0, 8).toString("ascii")).toBe("AAAABBBB");
    expect(stripId3v1(joined).subarray(-4).toString("ascii")).toBe("BBBB");
  });

  it("estimates CBR duration from payload size", () => {
    const oneSecond = Buffer.alloc(16_000);
    expect(estimateMp3DurationSeconds(oneSecond, 128_000)).toBe(1);
  });
});
