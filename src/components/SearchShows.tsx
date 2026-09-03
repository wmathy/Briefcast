"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ItunesPodcast } from "@/lib/itunes";
import { DEFAULT_BRIEF_LENGTH, type BriefLength } from "@/lib/brief-length";
import { BriefLengthPicker } from "@/components/BriefLengthPicker";

export function SearchShows() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItunesPodcast[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [followingId, setFollowingId] = useState<string | null>(null);
  const [defaultLength, setDefaultLength] = useState<BriefLength>(DEFAULT_BRIEF_LENGTH);
  const [lengths, setLengths] = useState<Record<string, BriefLength>>({});

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
      body: JSON.stringify({
        ...podcast,
        briefLength: lengths[podcast.itunesId] ?? defaultLength,
      }),
    });
    const data = (await response.json()) as {
      showId?: string;
      error?: string;
      warning?: string;
      generated?: number;
      fetched?: number;
    };
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
      <div className="space-y-2 rounded-2xl border border-line bg-bg-card p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">New follow length</p>
        <BriefLengthPicker value={defaultLength} onChange={setDefaultLength} name="discover-default-length" />
        <p className="text-sm text-muted">
          Each show can use a different length. You can change it later on the show page. Existing
          briefs rewrite only when you Generate again.
        </p>
      </div>
      <ul className="space-y-3">
        {results.map((podcast) => (
          <li
            key={podcast.itunesId}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-bg-card p-3 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
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
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <BriefLengthPicker
                value={lengths[podcast.itunesId] ?? defaultLength}
                onChange={(value) =>
                  setLengths((current) => ({ ...current, [podcast.itunesId]: value }))
                }
                disabled={followingId === podcast.itunesId}
                name={`follow-length-${podcast.itunesId}`}
              />
              <button
                type="button"
                disabled={followingId === podcast.itunesId}
                onClick={() => follow(podcast)}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent"
              >
                {followingId === podcast.itunesId ? "Following and writing brief…" : "Follow"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
