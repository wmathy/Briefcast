import { hasXaiKey } from "@/lib/env";
import { looksLikeTranscriptUrl } from "@/lib/html";
import {
  SHOWNOTES_CONFIDENCE_NOTE,
  collectYoutubeSearchVideos,
  extractPageDiscoveries,
  extractTranscriptUrlsFromText,
  extractYoutubeVideoIds,
  isUsableTranscript,
  nprTranscriptUrls,
  parseTranscriptPayload,
  publicDirectoryUrls,
  youtubeCaptionUrls,
  youtubeTitlesMatch,
} from "@/lib/transcripts";
import { xaiSttFromAudioUrl } from "@/lib/xai";

export type EpisodeSource = {
  text: string;
  sourceType: "transcript" | "shownotes";
  confidenceNote: string | null;
};

/** Long enough for a 3-hour episode at conversational pace. */
export const MAX_SOURCE_CHARS = 400_000;
const MAX_FETCH_ATTEMPTS = 12;
const FETCH_TIMEOUT_MS = 12_000;

const BRIEFCAST_UA = "Briefcast/0.1 (+https://github.com/wmathy/Briefcast)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Briefcast/0.1";

function trimSource(text: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  return `${text.slice(0, MAX_SOURCE_CHARS)}\n\n[Source truncated for length.]`;
}

function shownotesSource(description: string): EpisodeSource {
  const notes = description.trim();
  return {
    text: trimSource(notes || "No official show notes were available."),
    sourceType: "shownotes",
    confidenceNote: SHOWNOTES_CONFIDENCE_NOTE,
  };
}

function transcriptSource(text: string): EpisodeSource {
  return {
    text: trimSource(text),
    sourceType: "transcript",
    confidenceNote: null,
  };
}

function userAgentFor(url: string): string {
  try {
    const host = new URL(url).hostname;
    if (
      host.includes("youtube.com") ||
      host.includes("youtu.be") ||
      host.includes("youtube-transcript.ai") ||
      host.includes("happyscribe.com") ||
      host.includes("podscripts.co")
    ) {
      return BROWSER_UA;
    }
  } catch {
    // keep default
  }
  return BRIEFCAST_UA;
}

async function fetchRaw(url: string, init: RequestInit = {}): Promise<{ text: string; contentType: string } | null> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": userAgentFor(url),
        Accept: "text/plain, application/json, text/vtt, application/x-subrip, text/html, application/xml",
        "Accept-Language": "en-US,en;q=0.9",
        ...init.headers,
      },
    });
    if (!response.ok) return null;
    const text = await response.text();
    return { text, contentType: response.headers.get("content-type") ?? "" };
  } catch {
    return null;
  }
}

export async function fetchTranscript(url: string): Promise<string | null> {
  const raw = await fetchRaw(url);
  if (!raw) return null;
  const text = parseTranscriptPayload(raw.text, raw.contentType, url);
  return text.trim().length > 80 ? text : null;
}

type Candidate = {
  url: string;
  trust: "official" | "discovered";
};

export async function loadEpisodeSource(input: {
  description: string;
  transcriptUrl?: string | null;
  episodeLink?: string | null;
  audioUrl?: string | null;
  showTitle?: string | null;
  episodeTitle?: string | null;
}): Promise<EpisodeSource> {
  const notes = input.description.trim();
  const tried = new Set<string>();
  let attempts = 0;

  const tryUrl = async (url: string, trust: "official" | "discovered"): Promise<EpisodeSource | null> => {
    if (!url || tried.has(url) || attempts >= MAX_FETCH_ATTEMPTS) return null;
    tried.add(url);
    attempts += 1;
    const transcript = await fetchTranscript(url);
    if (isUsableTranscript(transcript, notes, trust)) {
      return transcriptSource(transcript!);
    }
    return null;
  };

  const tryCandidates = async (candidates: Candidate[]): Promise<EpisodeSource | null> => {
    for (const candidate of candidates) {
      const hit = await tryUrl(candidate.url, candidate.trust);
      if (hit) return hit;
    }
    return null;
  };

  const officialUrls = [input.transcriptUrl, input.episodeLink].filter(
    (url): url is string => Boolean(url && looksLikeTranscriptUrl(url)),
  );
  const fromDescription = extractTranscriptUrlsFromText(input.description);
  const fromNpr = nprTranscriptUrls(input.episodeLink);

  const firstPass = await tryCandidates([
    ...officialUrls.map((url) => ({ url, trust: "official" as const })),
    ...fromDescription.map((url) => ({ url, trust: "official" as const })),
    ...fromNpr.map((url) => ({ url, trust: "official" as const })),
  ]);
  if (firstPass) return firstPass;

  for (const videoId of extractYoutubeVideoIds(input.description)) {
    const hit = await tryYoutubeCaptions(videoId, tryUrl);
    if (hit) return hit;
  }

  if (input.episodeLink && !looksLikeTranscriptUrl(input.episodeLink) && attempts < MAX_FETCH_ATTEMPTS) {
    tried.add(input.episodeLink);
    attempts += 1;
    const page = await fetchRaw(input.episodeLink);
    if (page) {
      const discovered = extractPageDiscoveries(page.text, input.episodeLink);
      const fromPage = await tryCandidates(discovered.transcriptUrls.map((url) => ({ url, trust: "official" as const })));
      if (fromPage) return fromPage;
      for (const videoId of discovered.youtubeIds) {
        const hit = await tryYoutubeCaptions(videoId, tryUrl);
        if (hit) return hit;
      }
    }
  }

  const alreadyTriedOfficialNpr = fromNpr.length > 0;
  if (!alreadyTriedOfficialNpr && input.showTitle && input.episodeTitle && attempts < MAX_FETCH_ATTEMPTS) {
    const videoId = await searchYoutubeVideoId(input.showTitle, input.episodeTitle);
    if (videoId) {
      const hit = await tryYoutubeCaptions(videoId, tryUrl);
      if (hit) return hit;
    }

    const directories = await tryCandidates(
      publicDirectoryUrls(input.showTitle, input.episodeTitle).map((url) => ({
        url,
        trust: "discovered" as const,
      })),
    );
    if (directories) return directories;
  }

  const fromAudio = await transcribeEpisodeAudio(input);
  if (fromAudio) return fromAudio;

  return shownotesSource(notes);
}

async function transcribeEpisodeAudio(input: {
  audioUrl?: string | null;
  showTitle?: string | null;
  episodeTitle?: string | null;
}): Promise<EpisodeSource | null> {
  if (!input.audioUrl || !hasXaiKey()) return null;
  try {
    const text = await xaiSttFromAudioUrl(
      input.audioUrl,
      [input.showTitle, input.episodeTitle].filter((value): value is string => Boolean(value)),
    );
    if (text && text.trim().length > 80) {
      return transcriptSource(text);
    }
  } catch {
    return null;
  }
  return null;
}

async function tryYoutubeCaptions(
  videoId: string,
  tryUrl: (url: string, trust: "official" | "discovered") => Promise<EpisodeSource | null>,
): Promise<EpisodeSource | null> {
  for (const url of youtubeCaptionUrls(videoId)) {
    const hit = await tryUrl(url, "discovered");
    if (hit) return hit;
  }
  return null;
}

async function searchYoutubeVideoId(showTitle: string, episodeTitle: string): Promise<string | null> {
  const query = `${showTitle} ${episodeTitle}`.replace(/\s+/g, " ").trim();
  const payload = JSON.stringify({
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20240827.01.00",
        hl: "en",
        gl: "US",
      },
    },
    query,
  });

  const raw = await fetchRaw("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  if (!raw) return null;

  let data: unknown = null;
  try {
    data = JSON.parse(raw.text);
  } catch {
    return null;
  }

  const videos = collectYoutubeSearchVideos(data);
  const match = videos.find((video) => youtubeTitlesMatch(showTitle, episodeTitle, video.title));
  return match?.id ?? null;
}
