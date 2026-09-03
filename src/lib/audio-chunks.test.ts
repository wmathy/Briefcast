import { describe, expect, it } from "vitest";
import { splitBufferForStt } from "./audio-chunks";

describe("splitBufferForStt", () => {
  it("keeps a small file as one chunk so short episodes are not split", () => {
    const buffer = Buffer.alloc(1024, 1);
    expect(splitBufferForStt(buffer, 8 * 1024 * 1024)).toHaveLength(1);
  });

  it("covers every byte of a large file across chunks", () => {
    const buffer = Buffer.alloc(20 * 1024 * 1024, 7);
    const chunks = splitBufferForStt(buffer, 8 * 1024 * 1024);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.reduce((sum, chunk) => sum + chunk.length, 0)).toBe(buffer.length);
  });
});
