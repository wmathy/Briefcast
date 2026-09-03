/** Official xAI unary TTS cap: POST /v1/tts accepts at most 15,000 characters. */
export const XAI_TTS_MAX_CHARS = 15_000;

/**
 * Chunk well below 15k. xAI can end a long unary request early; smaller chunks
 * plus stitching keeps Short/Medium/Long recaps complete.
 */
export const XAI_TTS_CHUNK_CHARS = 4_000;

const SENTENCE_BREAK = /[.!?]["')\]]?\s+/g;

export function splitTextForTts(
  text: string,
  maxChars = XAI_TTS_CHUNK_CHARS,
): string[] {
  if (maxChars < 1) {
    throw new Error("TTS chunk size must be at least 1 character.");
  }
  if (maxChars > XAI_TTS_MAX_CHARS) {
    throw new Error(`TTS chunk size cannot exceed the xAI ${XAI_TTS_MAX_CHARS} character cap.`);
  }

  const source = text.trim();
  if (!source) return [];
  if (source.length <= maxChars) return [source];

  const chunks: string[] = [];
  let remaining = source;

  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    const cut = findBreak(window);
    const chunk = remaining.slice(0, cut).trim();
    if (!chunk) {
      chunks.push(remaining.slice(0, maxChars));
      remaining = remaining.slice(maxChars).trim();
      continue;
    }
    chunks.push(chunk);
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function findBreak(window: string): number {
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph >= Math.floor(window.length * 0.4)) {
    return paragraph + 2;
  }

  let sentence = -1;
  SENTENCE_BREAK.lastIndex = 0;
  let match = SENTENCE_BREAK.exec(window);
  while (match) {
    sentence = match.index + match[0].length;
    match = SENTENCE_BREAK.exec(window);
  }
  if (sentence >= Math.floor(window.length * 0.4)) {
    return sentence;
  }

  const space = window.lastIndexOf(" ");
  if (space >= Math.floor(window.length * 0.4)) {
    return space + 1;
  }

  return window.length;
}

export function stripId3v2(buffer: Buffer): Buffer {
  if (buffer.length < 10) return buffer;
  if (buffer.subarray(0, 3).toString("ascii") !== "ID3") return buffer;
  const size =
    ((buffer[6] & 0x7f) << 21) |
    ((buffer[7] & 0x7f) << 14) |
    ((buffer[8] & 0x7f) << 7) |
    (buffer[9] & 0x7f);
  const end = 10 + size;
  if (end > buffer.length) return buffer;
  return buffer.subarray(end);
}

export function stripId3v1(buffer: Buffer): Buffer {
  if (buffer.length < 128) return buffer;
  if (buffer.subarray(buffer.length - 128, buffer.length - 125).toString("ascii") !== "TAG") {
    return buffer;
  }
  return buffer.subarray(0, buffer.length - 128);
}

const MPEG1_LAYER3_BITRATE = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG1_SAMPLE_RATE = [44100, 48000, 32000];

export function mpeg1Layer3FrameLength(buffer: Buffer, offset: number): number | null {
  if (offset + 4 > buffer.length) return null;
  if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) return null;
  const version = (buffer[offset + 1] >> 3) & 0x03;
  const layer = (buffer[offset + 1] >> 1) & 0x03;
  if (version !== 3 || layer !== 1) return null;
  const bitrate = MPEG1_LAYER3_BITRATE[(buffer[offset + 2] >> 4) & 0x0f];
  const sampleRate = MPEG1_SAMPLE_RATE[(buffer[offset + 2] >> 2) & 0x03];
  if (!bitrate || !sampleRate) return null;
  const padding = (buffer[offset + 2] >> 1) & 0x01;
  return Math.floor((144 * bitrate * 1000) / sampleRate) + padding;
}

/** Drop Xing/Info/VBRI headers so a concat file is not declared as only the first chunk. */
export function stripXingOrVbriFrame(buffer: Buffer): Buffer {
  const audio = stripId3v1(stripId3v2(buffer));
  const frameLength = mpeg1Layer3FrameLength(audio, 0);
  if (!frameLength || frameLength > audio.length) return audio;
  const frame = audio.subarray(0, frameLength);
  if (frame.includes(Buffer.from("Xing")) || frame.includes(Buffer.from("Info")) || frame.includes(Buffer.from("VBRI"))) {
    return audio.subarray(frameLength);
  }
  return audio;
}

const MPEG1_SAMPLES_PER_FRAME = 1152;

function mpeg1ChannelCount(header: Buffer): number {
  return ((header[3] >> 6) & 0x03) === 3 ? 1 : 2;
}

function xingTagOffset(channels: number): number {
  return 4 + (channels === 1 ? 17 : 32);
}

export function countMpeg1Layer3Frames(buffer: Buffer): {
  frames: number;
  sampleRate: number;
  header: Buffer;
  consumed: number;
} | null {
  if (buffer.length < 4) return null;
  const header = Buffer.from(buffer.subarray(0, 4));
  const sampleRate = MPEG1_SAMPLE_RATE[(header[2] >> 2) & 0x03];
  if (!sampleRate) return null;

  let offset = 0;
  let frames = 0;
  while (offset + 4 <= buffer.length) {
    const length = mpeg1Layer3FrameLength(buffer, offset);
    if (!length) break;
    frames += 1;
    offset += length;
  }
  if (frames === 0) return null;
  return { frames, sampleRate, header, consumed: offset };
}

/** Prepend a Xing frame whose frame/byte counts match the full file, not the first chunk. */
export function writeFullFileXing(audio: Buffer): Buffer {
  const payload = stripXingOrVbriFrame(audio);
  const counted = countMpeg1Layer3Frames(payload);
  if (!counted || counted.consumed < payload.length * 0.95) return payload;

  const frameLength = mpeg1Layer3FrameLength(counted.header, 0);
  const xingAt = xingTagOffset(mpeg1ChannelCount(counted.header));
  if (!frameLength || frameLength < xingAt + 16 + 100) return payload;

  const totalFrames = counted.frames + 1;
  const totalBytes = frameLength + payload.length;
  const frame = Buffer.alloc(frameLength);
  counted.header.copy(frame, 0, 0, 4);
  frame.write("Xing", xingAt);
  frame.writeUInt32BE(7, xingAt + 4);
  frame.writeUInt32BE(totalFrames, xingAt + 8);
  frame.writeUInt32BE(totalBytes, xingAt + 12);
  for (let index = 0; index < 100; index += 1) {
    frame[xingAt + 16 + index] = Math.min(255, Math.round((index / 99) * 255));
  }
  return Buffer.concat([frame, payload]);
}

/** Strip leftover chunk Xing and write one header for the true full length. */
export function normalizeMp3ForPlayback(buffer: Buffer): Buffer {
  return writeFullFileXing(buffer);
}

export function concatMp3(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  const frames = buffers.map((buffer) => stripXingOrVbriFrame(buffer)).filter((part) => part.length > 0);
  if (frames.length === 0) return Buffer.alloc(0);
  const joined = frames.length === 1 ? frames[0] : Buffer.concat(frames);
  return writeFullFileXing(joined);
}

/** Frame-accurate duration when the file is MPEG1 Layer III; else CBR byte estimate. */
export function mp3PlaybackDurationSeconds(buffer: Buffer, bitRate = 128_000): number {
  const payload = stripXingOrVbriFrame(buffer);
  const counted = countMpeg1Layer3Frames(payload);
  if (counted && counted.consumed >= payload.length * 0.95) {
    return (counted.frames * MPEG1_SAMPLES_PER_FRAME) / counted.sampleRate;
  }
  return estimateMp3DurationSeconds(payload, bitRate);
}

/** CBR duration estimate used only in tests / sanity checks (128 kbps xAI default). */
export function estimateMp3DurationSeconds(buffer: Buffer, bitRate = 128_000): number {
  if (bitRate <= 0) return 0;
  return (stripXingOrVbriFrame(buffer).length * 8) / bitRate;
}
