"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ItunesPodcast } from "@/lib/itunes";

export function SearchShows() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItunesPodcast[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [followingId, setFollowingId] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = (await response.json()) as { results?: ItunesPodcast[]; error?: string };
    setSearching(false);
    if (!response.ok) {
      setError(data.error ?? "Search failed.");
      return;
    }
    setResults(data.results ?? []);
  }

  async function follow(podcast: ItunesPodcast) {
    setFollowingId(podcast.itunesId);
    setError(null);
    const response = await fetch("/api/follows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(podcast),
    });
    const data = (await response.json()) as { showId?: string; error?: string; warning?: string };
    setFollowingId(null);
    if (!response.ok || !data.showId) {
      setError(data.error ?? "Could not follow that show.");
      return;
    }
    router.push(`/shows/${data.showId}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search iTunes for a podcast you follow…"
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 outline-none ring-accent focus:ring-2"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="rounded-full bg-accent px-5 py-2.5 font-medium text-bg hover:bg-accent-deep disabled:opacity-60"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <ul className="space-y-3">
        {results.map((podcast) => (
          <li
            key={podcast.itunesId}
            className="flex items-center gap-3 rounded-2xl border border-line bg-bg-card p-3"
          >
            {podcast.artworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={podcast.artworkUrl}
                alt=""
                className="h-16 w-16 rounded-xl object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-bg" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{podcast.title}</p>
              <p className="truncate text-sm text-muted">{podcast.artist}</p>
            </div>
            <button
              type="button"
              disabled={followingId === podcast.itunesId}
              onClick={() => follow(podcast)}
              className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent"
            >
              {followingId === podcast.itunesId ? "Following…" : "Follow"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
