import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { formatBriefDate } from "@/lib/brief";
import { RefreshButton } from "@/components/RefreshButton";
import { UnfollowButton } from "@/components/UnfollowButton";
import { ShowBriefLengthControl } from "@/components/ShowBriefLengthControl";
import { parseBriefLength } from "@/lib/brief-length";
import { FULL_TRANSCRIPT_UNAVAILABLE_SHORT, isPublishedTranscriptBrief } from "@/lib/transcript-complete";

export const dynamic = "force-dynamic";

export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const prisma = getPrisma();
  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      episodes: { orderBy: { publishedAt: "desc" }, include: { brief: true, recapAudio: true } },
      follows: { where: { userId: user.id } },
    },
  });
  if (!show) notFound();

  const following = show.follows.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {show.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={show.artworkUrl} alt="" className="h-24 w-24 rounded-2xl object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl">{show.title}</h1>
          <p className="text-muted">{show.artist}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {following ? <RefreshButton showId={show.id} /> : null}
          {following ? <UnfollowButton showId={show.id} /> : null}
        </div>
      </div>

      {following ? (
        <ShowBriefLengthControl
          showId={show.id}
          initialLength={parseBriefLength(show.follows[0]?.briefLength)}
        />
      ) : null}

      <h2 className="text-xs uppercase tracking-[0.18em] text-muted">Episodes</h2>

      {show.episodes.length === 0 ? (
        <p className="text-sm text-muted">No episodes yet</p>
      ) : (
        <ul className="space-y-3">
          {show.episodes.map((episode) => (
            <li key={episode.id}>
              <Link
                href={`/episodes/${episode.id}`}
                className="block rounded-2xl border border-line bg-bg-card p-4 hover:border-accent"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-medium">{episode.title}</h2>
                  <span className="text-xs text-muted">{formatBriefDate(episode.publishedAt)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {isPublishedTranscriptBrief(episode.brief) ? "Ready" : FULL_TRANSCRIPT_UNAVAILABLE_SHORT}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
