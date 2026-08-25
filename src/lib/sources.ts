import { looksLikeTranscriptUrl, stripHtml } from "@/lib/html";

export type EpisodeSource = {
  text: string;
  sourceType: "transcript" | "shownotes";
  confidenceNote: string | null;
};

const MAX_SOURCE_CHARS = 80_000;

function trimSource(text: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  return `${text.slice(0, MAX_SOURCE_CHARS)}\n\n[Source truncated for length.]`;
}

function parseTranscriptPayload(raw: string, contentType: string): string {
  const type = contentType.toLowerCase();
  if (type.includes("json") || raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
    try {
      const data = JSON.parse(raw) as unknown;
      if (typeof data === "string") return data;
      if (Array.isArray(data)) {
        return data
          .map((row) => {
            if (typeof row === "string") return row;
            if (row && typeof row === "object") {
              const item = row as Record<string, unknown>;
              const speaker = typeof item.speaker === "string" ? item.speaker : "";
              const body =
                (typeof item.text === "string" && item.text) ||
                (typeof item.body === "string" && item.body) ||
                "";
              return speaker ? `${speaker}: ${body}` : body;
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");
      }
      if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;
        if (typeof record.transcript === "string") return record.transcript;
        if (typeof record.text === "string") return record.text;
      }
    } catch {
      // fall through to plain text
    }
  }
  if (type.includes("html") || /<html|<p|<div/i.test(raw)) {
    return stripHtml(raw);
  }
  return raw
    .replace(/^\d+\s*$/gm, "")
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s-->\s\d{2}:\d{2}:\d{2}[.,]\d{3}.*$/gm, "")
    .trim();
}

export async function fetchTranscript(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/plain, application/json, text/vtt, application/x-subrip, text/html",
        "User-Agent": "Briefcast/0.1 (+https://github.com/wmathy/Briefcast)",
      },
    });
    if (!response.ok) return null;
    const raw = await response.text();
    const text = parseTranscriptPayload(raw, response.headers.get("content-type") ?? "");
    return text.trim().length > 80 ? text : null;
  } catch {
    return null;
  }
}

export async function loadEpisodeSource(input: {
  description: string;
  transcriptUrl?: string | null;
  episodeLink?: string | null;
}): Promise<EpisodeSource> {
  const candidates = [input.transcriptUrl, input.episodeLink].filter(
    (url): url is string => Boolean(url && looksLikeTranscriptUrl(url)),
  );

  for (const url of candidates) {
    const transcript = await fetchTranscript(url);
    if (transcript) {
      return {
        text: trimSource(transcript),
        sourceType: "transcript",
        confidenceNote: null,
      };
    }
  }

  const notes = input.description.trim();
  return {
    text: trimSource(notes || "No official show notes were available."),
    sourceType: "shownotes",
    confidenceNote:
      "This brief is based on official show notes, not a full transcript. Quotes and topics not present in the notes were not added.",
  };
}
