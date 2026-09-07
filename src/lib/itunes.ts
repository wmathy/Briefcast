export type ItunesPodcast = {
  itunesId: string;
  title: string;
  artist: string;
  feedUrl: string;
  artworkUrl: string | null;
  description: string;
};

type ItunesResult = {
  collectionId?: number;
  trackId?: number;
  collectionName?: string;
  trackName?: string;
  artistName?: string;
  feedUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
};

/** Apple catalog IDs whose public RSS is known (search/lookup can omit or stale-out feedUrl). */
export const KNOWN_ITUNES_FEEDS: Record<string, string> = {
  "1750591415": "https://feeds.megaphone.fm/candace",
};

export function looksLikeNonRssCatalogUrl(url: string): boolean {
  return /podcasts\.apple\.com|open\.spotify\.com|music\.amazon\.|podcasts\.google\./i.test(url);
}

export function canonicalItunesFeedUrl(itunesId: string, feedUrl?: string | null): string | null {
  if (KNOWN_ITUNES_FEEDS[itunesId]) return KNOWN_ITUNES_FEEDS[itunesId];
  const trimmed = feedUrl?.trim() ?? "";
  if (!trimmed || looksLikeNonRssCatalogUrl(trimmed)) return null;
  return trimmed;
}

function mapItunesResult(item: ItunesResult): ItunesPodcast | null {
  const itunesId = String(item.collectionId ?? item.trackId ?? "");
  if (!itunesId) return null;
  const feedUrl = canonicalItunesFeedUrl(itunesId, item.feedUrl);
  if (!feedUrl) return null;
  return {
    itunesId,
    title: item.collectionName ?? item.trackName ?? "Untitled podcast",
    artist: item.artistName ?? "Unknown",
    feedUrl,
    artworkUrl: item.artworkUrl600 ?? item.artworkUrl100 ?? null,
    description: "",
  };
}

export async function lookupPodcast(itunesId: string): Promise<ItunesPodcast | null> {
  const id = itunesId.trim();
  if (!id) return null;

  const url = new URL("https://itunes.apple.com/lookup");
  url.searchParams.set("id", id);
  url.searchParams.set("entity", "podcast");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (response.ok) {
    const data = (await response.json()) as { results?: ItunesResult[] };
    for (const item of data.results ?? []) {
      const mapped = mapItunesResult({
        ...item,
        collectionId: item.collectionId ?? (Number(id) || undefined),
      });
      if (mapped) return mapped;
    }
  }

  const fallback = canonicalItunesFeedUrl(id);
  if (!fallback) return null;
  return {
    itunesId: id,
    title: id === "1750591415" ? "Candace" : "Untitled podcast",
    artist: id === "1750591415" ? "Candace Owens" : "Unknown",
    feedUrl: fallback,
    artworkUrl: null,
    description: "",
  };
}

export async function resolveItunesPodcast(podcast: ItunesPodcast): Promise<ItunesPodcast> {
  const known = canonicalItunesFeedUrl(podcast.itunesId, podcast.feedUrl);
  if (known) return { ...podcast, feedUrl: known };
  const lookedUp = await lookupPodcast(podcast.itunesId);
  if (lookedUp?.feedUrl) return { ...podcast, feedUrl: lookedUp.feedUrl, title: podcast.title || lookedUp.title };
  return podcast;
}

export async function searchPodcasts(term: string): Promise<ItunesPodcast[]> {
  const query = term.trim();
  if (!query) return [];

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("media", "podcast");
  url.searchParams.set("entity", "podcast");
  url.searchParams.set("limit", "20");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    throw new Error(`iTunes Search failed (${response.status})`);
  }

  const data = (await response.json()) as { results?: ItunesResult[] };
  const mapped: ItunesPodcast[] = [];
  for (const item of data.results ?? []) {
    const itunesId = String(item.collectionId ?? item.trackId ?? "");
    if (!itunesId) continue;
    const direct = mapItunesResult(item);
    if (direct) {
      mapped.push(direct);
      continue;
    }
    if (KNOWN_ITUNES_FEEDS[itunesId] || item.collectionId || item.trackId) {
      const lookedUp = await lookupPodcast(itunesId);
      if (lookedUp) mapped.push({ ...lookedUp, title: item.collectionName ?? item.trackName ?? lookedUp.title });
    }
  }

  return mapped;
}
