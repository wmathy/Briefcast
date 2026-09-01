import { decodeEntities, looksLikeTranscriptUrl, stripHtml } from "@/lib/html";

export const SHOWNOTES_CONFIDENCE_NOTE =
  "This brief is based on official show notes, not a full transcript. Quotes and topics not present in the notes were not added.";

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[#]+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractYoutubeVideoIds(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    /(?:youtube\.com\/watch\?(?:[^#\s"'<>]*&)?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const id = match[1];
      if (YOUTUBE_ID.test(id) && !found.includes(id)) found.push(id);
    }
  }
  return found;
}

export function extractTranscriptUrlsFromText(text: string): string[] {
  const urls = text.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  const cleaned = urls.map((url) => url.replace(/[).,;]+$/g, ""));
  return cleaned.filter((url) => looksLikeTranscriptUrl(url) && !extractYoutubeVideoIds(url).length);
}

export function nprTranscriptUrls(episodeLink?: string | null): string[] {
  if (!episodeLink) return [];
  try {
    const url = new URL(episodeLink);
    if (!/(^|\.)npr\.org$/i.test(url.hostname)) return [];
    const fromTranscriptPath = url.pathname.match(/\/transcripts\/([^/]+)/i);
    if (fromTranscriptPath?.[1]) {
      return [`https://www.npr.org/transcripts/${fromTranscriptPath[1]}`];
    }
    const fromStory = url.pathname.match(
      /\/(?:\d{4}\/\d{2}\/\d{2}\/)?((?:[a-z]{2}-s\d+-\d+)|\d{7,})/i,
    );
    if (fromStory?.[1]) {
      return [`https://www.npr.org/transcripts/${fromStory[1]}`];
    }
  } catch {
    return [];
  }
  return [];
}

export function publicDirectoryUrls(showTitle: string, episodeTitle: string): string[] {
  const showSlug = slugifySegment(showTitle);
  const episodeSlug = slugifySegment(episodeTitle);
  if (!showSlug || !episodeSlug) return [];
  return [
    `https://podcasts.happyscribe.com/${showSlug}/${episodeSlug}`,
    `https://podscripts.co/podcasts/${showSlug}/${episodeSlug}`,
  ];
}

export function youtubeCaptionUrls(videoId: string): string[] {
  return [
    `https://youtube-transcript.ai/transcript/${videoId}.txt`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=vtt`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=vtt`,
  ];
}

export function episodeNumber(title: string): string | null {
  const hash = title.match(/#(\d{2,5})\b/);
  if (hash?.[1]) return hash[1];
  const labeled = title.match(/\b(?:episode|ep\.?)\s*(\d{2,5})\b/i);
  if (labeled?.[1]) return labeled[1];
  return null;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[#:|/]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(value: string): string[] {
  return normalizeTitle(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !["the", "and", "for", "with", "from"].includes(token));
}

export function youtubeTitlesMatch(showTitle: string, episodeTitle: string, videoTitle: string): boolean {
  const video = normalizeTitle(videoTitle);
  if (!video) return false;
  if (/\b(highlights?|best of|clips?|shorts?|reacts?)\b/.test(video) && !/\b(highlights?|best of|clips?|shorts?)\b/.test(normalizeTitle(episodeTitle))) {
    return false;
  }

  const number = episodeNumber(episodeTitle) ?? episodeNumber(showTitle);
  if (number && !new RegExp(`\\b${number}\\b`).test(video)) return false;

  const episodeTokens = significantTokens(episodeTitle);
  const showTokens = significantTokens(showTitle);
  const videoTokens = new Set(significantTokens(videoTitle));

  if (episodeTokens.length) {
    const hits = episodeTokens.filter((token) => videoTokens.has(token)).length;
    if (hits / episodeTokens.length < 0.7) return false;
  }

  if (showTokens.length) {
    const hits = showTokens.filter((token) => videoTokens.has(token) || video.includes(token)).length;
    if (hits < Math.min(2, showTokens.length)) return false;
  }

  return episodeTokens.length > 0 || showTokens.length > 0;
}

export function collectYoutubeSearchVideos(data: unknown): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const record = node as Record<string, unknown>;
    const renderer = record.videoRenderer as Record<string, unknown> | undefined;
    if (renderer && typeof renderer.videoId === "string" && YOUTUBE_ID.test(renderer.videoId)) {
      const title = titleFromRenderer(renderer.title);
      if (!seen.has(renderer.videoId)) {
        seen.add(renderer.videoId);
        out.push({ id: renderer.videoId, title });
      }
    }
    for (const value of Object.values(record)) walk(value);
  };

  walk(data);
  return out;
}

function titleFromRenderer(title: unknown): string {
  if (!title || typeof title !== "object") return "";
  const record = title as Record<string, unknown>;
  if (typeof record.simpleText === "string") return record.simpleText;
  if (Array.isArray(record.runs)) {
    return record.runs
      .map((run) => (run && typeof run === "object" && typeof (run as { text?: unknown }).text === "string" ? (run as { text: string }).text : ""))
      .join("");
  }
  return "";
}

export function looksLikeSpokenTranscript(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 80) return false;
  const speakerLabels = trimmed.match(/^[ \t]*[A-Z][A-Z0-9 .,'’\-]{0,40}:/gm) ?? [];
  if (speakerLabels.length >= 3) return true;
  const timestamps = trimmed.match(/\[\d{1,2}:\d{2}(?::\d{2})?\]|\b\d{2}:\d{2}:\d{2}\b/g) ?? [];
  if (timestamps.length >= 5 && trimmed.length > 400) return true;
  if (trimmed.length > 3000 && /\b(I|we|you|I'm|we're)\b/i.test(trimmed)) return true;
  return false;
}

export function isUsableTranscript(text: string | null, notes: string, trust: "official" | "discovered"): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 80) return false;
  if (trust === "official") return true;

  const note = notes.trim();
  if (note.length > 80 && trimmed.length < note.length * 1.25) {
    const sample = note.slice(0, Math.min(180, note.length));
    if (sample && trimmed.includes(sample)) return false;
  }
  if (trimmed.length >= 1500) return true;
  return looksLikeSpokenTranscript(trimmed);
}

function extractHappyScribe(html: string): string | null {
  const parts = [...html.matchAll(/class="[^"]*hsp-paragraph-words[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
  return parts.length >= 8 ? parts.join("\n") : null;
}

function extractPodscripts(html: string): string | null {
  const parts = [...html.matchAll(/class="[^"]*transcript-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
  return parts.length >= 8 ? parts.join("\n") : null;
}

function extractNprTranscript(html: string): string | null {
  const tagged = html.match(/<[^>]*aria-label="Transcript"[^>]*>/i);
  const start = tagged?.index ?? html.search(/aria-label="Transcript"/i);
  if (start < 0) return null;
  const fromOpenTag = html.slice(start);
  const afterTag = fromOpenTag.replace(/^<[^>]+>/, "");
  const cut = afterTag.split(/<footer\b|id="footer"|class="[^"]*\bfooter\b/i)[0] ?? afterTag;
  const text = stripHtml(cut.replace(/<svg[\s\S]*?<\/svg>/gi, "")).replace(/^Transcript\s*/i, "").trim();
  return looksLikeSpokenTranscript(text) ? text : null;
}

function cleanCaptionText(raw: string): string {
  return decodeEntities(raw)
    .replace(/^#+\s.*$/gm, "")
    .replace(/^Source video:.*$/gm, "")
    .replace(/^Language:.*$/gm, "")
    .replace(/^Interactive version.*$/gm, "")
    .replace(/^##\s*Transcript\s*$/gm, "")
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, "")
    .replace(/^\d+\s*$/gm, "")
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s-->\s\d{2}:\d{2}:\d{2}[.,]\d{3}.*$/gm, "")
    .replace(/>>\s*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseTranscriptPayload(raw: string, contentType: string, sourceUrl = ""): string {
  const type = contentType.toLowerCase();
  const host = (() => {
    try {
      return new URL(sourceUrl).hostname;
    } catch {
      return "";
    }
  })();

  if (type.includes("json") || raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
    const fromJson = parseJsonTranscript(raw);
    if (fromJson) return fromJson;
  }

  const looksHtml = type.includes("html") || /<html|<p|<div|<span/i.test(raw);
  if (looksHtml) {
    if (host.includes("happyscribe.com")) {
      const extracted = extractHappyScribe(raw);
      if (extracted) return extracted;
    }
    if (host.includes("podscripts.co")) {
      const extracted = extractPodscripts(raw);
      if (extracted) return extracted;
    }
    if (host.includes("npr.org")) {
      const extracted = extractNprTranscript(raw);
      if (extracted) return extracted;
    }
    if (host.includes("happyscribe.com") || host.includes("podscripts.co")) {
      return "";
    }
    if (host.includes("npr.org") && /\/transcripts\//i.test(sourceUrl)) {
      return "";
    }
    return stripHtml(raw);
  }

  return cleanCaptionText(raw);
}

function parseJsonTranscript(raw: string): string | null {
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
    return null;
  }
  return null;
}

export function extractPageDiscoveries(html: string, pageUrl: string): { transcriptUrls: string[]; youtubeIds: string[] } {
  const transcriptUrls = new Set<string>();
  const youtubeIds = new Set(extractYoutubeVideoIds(html));

  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1];
    try {
      const absolute = new URL(href, pageUrl).href;
      if (looksLikeTranscriptUrl(absolute)) transcriptUrls.add(absolute);
    } catch {
      // ignore malformed hrefs
    }
  }

  for (const url of nprTranscriptUrls(pageUrl)) transcriptUrls.add(url);
  return { transcriptUrls: [...transcriptUrls], youtubeIds: [...youtubeIds] };
}
