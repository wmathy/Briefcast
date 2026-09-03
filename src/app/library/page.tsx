import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatBriefDate } from "@/lib/brief";
import {
  countLatestFollowedNeedingBrief,
  countUnbriefedFollowedEpisodes,
  getFollowedBriefQueue,
  getFollowedShows,
} from "@/lib/queue";
import { formatBriefLengthShort } from "@/lib/brief-length";
import { FULL_TRANSCRIPT_UNAVAILABLE_SHORT } from "@/lib/transcript-complete";
import { RefreshLibraryButton } from "@/components/RefreshLibraryButton";
import { AutoGenerateLatest } from "@/components/AutoGenerateLatest";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [follows, queue, unbriefed, latestNeeding] = await Promise.all([
    getFollowedShows(user.id),
    getFollowedBriefQueue(user.id),
    countUnbriefedFollowedEpisodes(user.id),
    countLatestFollowedNeedingBrief(user.id),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Library</h1>
        <div className="flex flex-wrap items-center gap-3">
          {follows.length > 0 ? <RefreshLibraryButton /> : null}
          <Link
            href="/discover"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-deep"
          >
            Find a podcast
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted">Queue</h2>
          {unbriefed > 0 ? (
            <p className="text-xs text-muted">
              {unbriefed} waiting
            </p>
          ) : null}
        </div>
        <AutoGenerateLatest needed={latestNeeding > 0} />
        {queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted">
            {follows.length === 0 ? "Follow a show" : FULL_TRANSCRIPT_UNAVAILABLE_SHORT}
          </div>
        ) : (
          <ul className="space-y-3">
            {queue.map((episode) => (
              <li key={episode.id}>
                <Link
                  href={`/episodes/${episode.id}`}
                  className="block rounded-2xl border border-line bg-bg-raised p-4 hover:border-accent"
                >
                  <p className="text-xs uppercase tracking-wider text-accent">{episode.show.title}</p>
                  <p className="font-medium">{episode.title}</p>
                  <p className="text-sm text-muted">{formatBriefDate(episode.publishedAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted">Following</h2>
        {follows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted">
            Nothing here
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {follows.map(({ show, briefLength }) => (
              <li key={show.id}>
                <Link
                  href={`/shows/${show.id}`}
                  className="flex gap-3 rounded-2xl border border-line bg-bg-card p-3 hover:border-accent"
                >
                  {show.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={show.artworkUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-bg" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{show.title}</p>
                    <p className="truncate text-sm text-muted">{show.artist}</p>
                    <p className="mt-1 truncate text-xs text-muted">
                      {formatBriefLengthShort(briefLength)}
                      {show.episodes[0] ? ` · ${show.episodes[0].title}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
