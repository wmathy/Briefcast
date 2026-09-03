import { mpeg1Layer3FrameLength, stripId3v1, stripId3v2 } from "@/lib/tts";

/** ~2 MB ≈ 2 minutes at 128 kbps. 8 MB chunks were timing out the 300s STT turn. */
export const STT_CHUNK_BYTES = 2 * 1024 * 1024;

function findFrameNear(buffer: Buffer, hint: number): number {
  const start = Math.max(0, hint - 4096);
  const end = Math.min(buffer.length - 4, hint + 4096);
  for (let i = hint; i < end; i += 1) {
    if (mpeg1Layer3FrameLength(buffer, i)) return i;
  }
  for (let i = hint; i >= start; i -= 1) {
    if (mpeg1Layer3FrameLength(buffer, i)) return i;
  }
  return hint;
}

/** Split a downloaded episode so STT covers the entire file, not only the first segment. */
export function splitBufferForStt(buffer: Buffer, maxBytes = STT_CHUNK_BYTES): Buffer[] {
  const audio = stripId3v1(stripId3v2(buffer));
  if (audio.length === 0) return [];
  if (audio.length <= maxBytes) return [audio];

  const chunks: Buffer[] = [];
  let offset = 0;
  while (offset < audio.length) {
    if (audio.length - offset <= maxBytes) {
      chunks.push(audio.subarray(offset));
      break;
    }
    let end = offset + maxBytes;
    const synced = findFrameNear(audio, end);
    if (synced > offset + Math.floor(maxBytes * 0.5)) {
      end = synced;
    }
    chunks.push(audio.subarray(offset, end));
    offset = end;
  }
  return chunks.filter((chunk) => chunk.length > 0);
}
