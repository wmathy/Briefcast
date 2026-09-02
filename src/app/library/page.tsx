import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatBriefDate } from "@/lib/brief";
import { countUnbriefedFollowedEpisodes, getFollowedBriefQueue, getFollowedShows } from "@/lib/queue";
import { RefreshLibraryButton } from "@/components/RefreshLibraryButton";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [follows, queue, unbriefed] = await Promise.all([
    getFollowedShows(user.id),
    getFollowedBriefQueue(user.id),
    countUnbriefedFollowedEpisodes(user.id),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Library</h1>
          <p className="mt-2 text-muted">Shows you chose. Briefs appear here when those shows publish.</p>
        </div>
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
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted">Queue</h2>
        <p className="text-sm text-muted">Briefs for podcasts you follow, newest episode first.</p>
        {unbriefed > 0 ? (
          <p className="text-sm text-muted">
            {unbriefed} followed episode{unbriefed === 1 ? "" : "s"} {unbriefed === 1 ? "has" : "have"} no
            brief yet. New ones are written automatically.
          </p>
        ) : null}
        {queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-6 text-muted">
            {follows.length === 0
              ? "Follow a podcast to start a queue. Briefcast does not pre-load sample briefs."
              : "No briefs yet. New episodes from shows you follow are written automatically."}
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
          <div className="rounded-2xl border border-dashed border-line p-6 text-muted">
            You are not following any shows yet. Search iTunes and follow the ones you already listen to.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {follows.map(({ show }) => (
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
                    {show.episodes[0] ? (
                      <p className="mt-1 truncate text-xs text-muted">Latest: {show.episodes[0].title}</p>
                    ) : null}
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
