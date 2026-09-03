import { describe, expect, it } from "vitest";
import { audioHttpResponse } from "./audio-http";

const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

describe("audioHttpResponse", () => {
  it("serves the full file with Accept-Ranges and Content-Length", () => {
    const result = audioHttpResponse(bytes, "audio/mpeg", null);
    expect(result.status).toBe(200);
    expect(result.body).toEqual(bytes);
    expect(result.headers["Accept-Ranges"]).toBe("bytes");
    expect(result.headers["Content-Length"]).toBe("8");
  });

  it("serves a byte range so the player can seek", () => {
    const result = audioHttpResponse(bytes, "audio/mpeg", "bytes=2-5");
    expect(result.status).toBe(206);
    expect(Array.from(result.body)).toEqual([3, 4, 5, 6]);
    expect(result.headers["Content-Range"]).toBe("bytes 2-5/8");
    expect(result.headers["Content-Length"]).toBe("4");
  });

  it("rejects an unsatisfiable range", () => {
    const result = audioHttpResponse(bytes, "audio/mpeg", "bytes=20-30");
    expect(result.status).toBe(416);
    expect(result.headers["Content-Range"]).toBe("bytes */8");
  });
});
