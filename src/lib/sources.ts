import { hasXaiKey } from "@/lib/env";
import { looksLikeTranscriptUrl } from "@/lib/html";
import { isCompleteEpisodeTranscript } from "@/lib/transcript-complete";
import {
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
import { transcribeEpisodeDurable, TranscriptInProgressError } from "@/lib/stt-job";

export type EpisodeSource = {
  text: string;
  sourceType: "transcript";
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

/** Keep start, middle, and end so the model can cover a 3-hour episode inside one request. */
export function briefPromptSource(text: string, max = 90_000): string {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.4);
  const mid = Math.floor(max * 0.3);
  const tail = max - head - mid;
  const midStart = Math.max(head, Math.floor((text.length - mid) / 2));
  return [
    text.slice(0, head),
    "\n\n[... middle of episode ...]\n\n",
    text.slice(midStart, midStart + mid),
    "\n\n[... later in episode ...]\n\n",
    text.slice(Math.max(midStart + mid, text.length - tail)),
  ].join("");
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
  durationSeconds?: number | null;
  showTitle?: string | null;
  episodeTitle?: string | null;
  episodeId?: string | null;
}): Promise<EpisodeSource | null> {
  const notes = input.description.trim();
  const tried = new Set<string>();
  let attempts = 0;

  const accept = (text: string, coveredAudioSeconds?: number | null): EpisodeSource | null => {
    const complete = isCompleteEpisodeTranscript({
      text,
      notes,
      durationSeconds: input.durationSeconds,
      coveredAudioSeconds,
    });
    return complete.ok ? transcriptSource(text) : null;
  };

  const tryUrl = async (url: string, trust: "official" | "discovered"): Promise<EpisodeSource | null> => {
    if (!url || tried.has(url) || attempts >= MAX_FETCH_ATTEMPTS) return null;
    tried.add(url);
    attempts += 1;
    const transcript = await fetchTranscript(url);
    if (!isUsableTranscript(transcript, notes, trust) || !transcript) return null;
    return accept(transcript);
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

  // Long (or unknown-length) files with audio go straight to chunked STT.
  // YouTube / page / directory discovery can burn the 300s budget first.
  const skipSlowDiscovery = Boolean(
    input.audioUrl && ((input.durationSeconds ?? 0) >= 15 * 60 || input.durationSeconds == null),
  );
  if (skipSlowDiscovery) {
    return transcribeEpisodeAudio(input, accept);
  }

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
  if (
    !alreadyTriedOfficialNpr &&
    input.showTitle &&
    input.episodeTitle &&
    attempts < MAX_FETCH_ATTEMPTS
  ) {
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

  return transcribeEpisodeAudio(input, accept);
}

async function transcribeEpisodeAudio(
  input: {
    audioUrl?: string | null;
    showTitle?: string | null;
    episodeTitle?: string | null;
    durationSeconds?: number | null;
    episodeId?: string | null;
  },
  accept: (text: string, coveredAudioSeconds?: number | null) => EpisodeSource | null,
): Promise<EpisodeSource | null> {
  if (!input.audioUrl || !hasXaiKey()) return null;
  const keyterms = [input.showTitle, input.episodeTitle].filter((value): value is string => Boolean(value));
  try {
    const result = input.episodeId
      ? await transcribeEpisodeDurable({
          episodeId: input.episodeId,
          audioUrl: input.audioUrl,
          keyterms,
          durationSeconds: input.durationSeconds,
        })
      : await xaiSttFromAudioUrl(input.audioUrl, keyterms, { durationSeconds: input.durationSeconds });
    if (!result) return null;
    const covered = result.duration > 0 ? result.duration : null;
    return accept(result.text, covered);
  } catch (error) {
    if (error instanceof TranscriptInProgressError) throw error;
    console.error("[stt] transcribe failed:", error instanceof Error ? error.message : error);
    return null;
  }
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
