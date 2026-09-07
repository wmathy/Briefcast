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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl sm:text-4xl">Library</h1>
        <div className="flex flex-wrap items-center gap-2">
          {follows.length > 0 ? <RefreshLibraryButton /> : null}
          <Link
            href="/discover"
            className="tap pressable inline-flex items-center rounded-full bg-accent px-4 text-sm font-medium text-bg"
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
          <>
          <p className="text-xs text-muted">Ready to play</p>
          <ul className="space-y-3">
            {queue.map((episode) => (
              <li key={episode.id}>
                <Link
                  href={`/episodes/${episode.id}`}
                  className="card-link block min-h-11 rounded-2xl border border-line bg-bg-raised p-4"
                >
                  <p className="text-xs uppercase tracking-wider text-accent">{episode.show.title}</p>
                  <p className="font-medium leading-snug">{episode.title}</p>
                  <p className="mt-1 text-sm text-muted">{formatBriefDate(episode.publishedAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted">Following</h2>
        {follows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted">
            Nothing here
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {follows.map(({ show, briefLength }) => (
              <li key={show.id}>
                <Link
                  href={`/shows/${show.id}`}
                  className="card-link flex min-h-11 gap-3 rounded-2xl border border-line bg-bg-card p-3 sm:p-4"
                >
                  {show.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={show.artworkUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-16 sm:w-16" />
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded-xl bg-bg sm:h-16 sm:w-16" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{show.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{show.artist}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
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
