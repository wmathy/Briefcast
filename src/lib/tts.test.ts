import { describe, expect, it } from "vitest";
import {
  XAI_TTS_CHUNK_CHARS,
  XAI_TTS_MAX_CHARS,
  concatMp3,
  countMpeg1Layer3Frames,
  estimateMp3DurationSeconds,
  mpeg1Layer3FrameLength,
  mp3PlaybackDurationSeconds,
  splitTextForTts,
  stripXingOrVbriFrame,
  writeFullFileXing,
} from "./tts";
import { BRIEF_LENGTH_SPECS, countWords } from "./brief-length";

function sentenceBlock(chars: number): string {
  const sentence = "This is a spoken sentence about the episode. ";
  let out = "";
  while (out.length < chars) out += sentence;
  return out.slice(0, chars).replace(/\s+\S*$/, ".") + " Next thought continues here.";
}

describe("xAI TTS character cap", () => {
  it("chunks well below the official 15,000 character unary limit", () => {
    expect(XAI_TTS_MAX_CHARS).toBe(15_000);
    expect(XAI_TTS_CHUNK_CHARS).toBeLessThanOrEqual(4_000);
  });

  it("splits Medium and Long recaps instead of sending one clip-prone request", () => {
    const medium = "word ".repeat(BRIEF_LENGTH_SPECS.medium.spokenWords.max).trim();
    expect(medium.length).toBeGreaterThan(XAI_TTS_CHUNK_CHARS);
    expect(splitTextForTts(medium).length).toBeGreaterThan(1);
    expect(splitTextForTts(medium).every((chunk) => chunk.length <= XAI_TTS_CHUNK_CHARS)).toBe(true);

    const long = sentenceBlock(22_000);
    expect(long.length).toBeGreaterThan(XAI_TTS_MAX_CHARS);
    const chunks = splitTextForTts(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= XAI_TTS_CHUNK_CHARS)).toBe(true);
    expect(countWords(chunks.join(" "))).toBeGreaterThanOrEqual(countWords(long) - 2);
    expect(chunks.reduce((sum, chunk) => sum + chunk.length, 0)).toBeGreaterThan(XAI_TTS_MAX_CHARS);
  });

  it("never drops the tail of a recap that exceeds 15,000 characters", () => {
    const tailMarker = "UNIQUE_TAIL_MARKER_SHOULD_SURVIVE_CHUNKING";
    const text = `${"Alpha sentence. ".repeat(1200)}${tailMarker}`;
    expect(text.length).toBeGreaterThan(XAI_TTS_MAX_CHARS);
    const chunks = splitTextForTts(text);
    expect(chunks.at(-1)).toContain(tailMarker);
    expect(text.slice(0, XAI_TTS_MAX_CHARS).includes(tailMarker)).toBe(false);
  });
});

describe("concatMp3", () => {
  it("stitches payload bytes and strips ID3 so one file remains playable", () => {
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
    expect(joined.toString("ascii")).toBe("AAAABBBB");
  });

  it("drops a Xing duration header so playback is not clipped to the first chunk", () => {
    const bitrate128 = 9;
    const sr44100 = 0;
    const header = Buffer.from([0xff, 0xfb, (bitrate128 << 4) | (sr44100 << 2), 0x00]);
    const frameLength = mpeg1Layer3FrameLength(header, 0);
    expect(frameLength).toBeGreaterThan(4);
    const xing = Buffer.alloc(frameLength);
    header.copy(xing);
    xing.write("Xing", 36);
    const audio = Buffer.from("AUDIO");
    const stripped = stripXingOrVbriFrame(Buffer.concat([xing, audio]));
    expect(stripped.toString("ascii")).toBe("AUDIO");
    expect(concatMp3([Buffer.concat([xing, Buffer.from("ONE")]), Buffer.concat([xing, Buffer.from("TWO")])]).toString(
      "ascii",
    )).toBe("ONETWO");
  });

  it("estimates CBR duration from payload size", () => {
    const oneSecond = Buffer.alloc(16_000);
    expect(estimateMp3DurationSeconds(oneSecond, 128_000)).toBe(1);
  });

  it("writes a full-file Xing so duration is not the first chunk", () => {
    const bitrate128 = 9;
    const sr44100 = 0;
    const header = Buffer.from([0xff, 0xfb, (bitrate128 << 4) | (sr44100 << 2), 0x00]);
    const frameLength = mpeg1Layer3FrameLength(header, 0);
    expect(frameLength).toBeGreaterThan(4);

    function silentFrame(): Buffer {
      const frame = Buffer.alloc(frameLength);
      header.copy(frame);
      return frame;
    }

    const firstXing = Buffer.alloc(frameLength);
    header.copy(firstXing);
    firstXing.write("Xing", 36);
    firstXing.writeUInt32BE(1, 44);

    const chunkOne = Buffer.concat([firstXing, silentFrame(), silentFrame()]);
    const chunkTwo = Buffer.concat([firstXing, silentFrame(), silentFrame(), silentFrame()]);
    const joined = concatMp3([chunkOne, chunkTwo]);
    expect(joined.includes(Buffer.from("Xing"))).toBe(true);

    const payload = stripXingOrVbriFrame(joined);
    expect(countMpeg1Layer3Frames(payload)?.frames).toBe(5);
    expect(mp3PlaybackDurationSeconds(joined)).toBeCloseTo((5 * 1152) / 44100, 5);

    const rewritten = writeFullFileXing(payload);
    const xingFrame = rewritten.subarray(0, frameLength);
    expect(xingFrame.includes(Buffer.from("Xing"))).toBe(true);
    expect(xingFrame.readUInt32BE(40)).toBe(7);
    expect(xingFrame.readUInt32BE(44)).toBe(6);
  });
});
