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
  return (data.results ?? [])
    .filter((item) => item.feedUrl && (item.collectionId || item.trackId))
    .map((item) => ({
      itunesId: String(item.collectionId ?? item.trackId),
      title: item.collectionName ?? item.trackName ?? "Untitled podcast",
      artist: item.artistName ?? "Unknown",
      feedUrl: item.feedUrl!,
      artworkUrl: item.artworkUrl600 ?? item.artworkUrl100 ?? null,
      description: "",
    }));
}
