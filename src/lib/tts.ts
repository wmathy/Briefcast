/** Official xAI unary TTS cap: POST /v1/tts accepts at most 15,000 characters. */
export const XAI_TTS_MAX_CHARS = 15_000;

/** Leave headroom so a chunk never trips the 15k hard cap. */
export const XAI_TTS_CHUNK_CHARS = 14_000;

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

export function concatMp3(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];
  return Buffer.concat(
    buffers.map((buffer, index) => {
      let out = buffer;
      if (index > 0) out = stripId3v2(out);
      if (index < buffers.length - 1) out = stripId3v1(out);
      return out;
    }),
  );
}

/** CBR duration estimate used only in tests / sanity checks (128 kbps xAI default). */
export function estimateMp3DurationSeconds(buffer: Buffer, bitRate = 128_000): number {
  if (bitRate <= 0) return 0;
  return (stripId3v1(stripId3v2(buffer)).length * 8) / bitRate;
}
