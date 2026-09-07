export type AudioHttpResult = {
  status: number;
  body: Uint8Array;
  headers: Record<string, string>;
};

function baseHeaders(mimeType: string): Record<string, string> {
  return {
    "Content-Type": mimeType || "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
}

export function audioHttpResponse(
  data: Uint8Array,
  mimeType: string,
  rangeHeader: string | null,
): AudioHttpResult {
  const headers = baseHeaders(mimeType);
  const length = data.length;

  if (!rangeHeader) {
    return {
      status: 200,
      body: data,
      headers: { ...headers, "Content-Length": String(length) },
    };
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return {
      status: 416,
      body: new Uint8Array(),
      headers: { ...headers, "Content-Range": `bytes */${length}` },
    };
  }

  const hasStart = match[1] !== "";
  const hasEnd = match[2] !== "";
  let start = hasStart ? Number(match[1]) : 0;
  let end = hasEnd ? Number(match[2]) : length - 1;

  if (!hasStart && hasEnd) {
    const suffix = Number(match[2]);
    start = Math.max(0, length - suffix);
    end = length - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= length) {
    return {
      status: 416,
      body: new Uint8Array(),
      headers: { ...headers, "Content-Range": `bytes */${length}` },
    };
  }

  end = Math.min(end, length - 1);
  const slice = data.subarray(start, end + 1);
  return {
    status: 206,
    body: slice,
    headers: {
      ...headers,
      "Content-Length": String(slice.length),
      "Content-Range": `bytes ${start}-${end}/${length}`,
    },
  };
}
