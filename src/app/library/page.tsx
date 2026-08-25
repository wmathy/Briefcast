import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { SEED_EPISODES } from "@/lib/seed-data";
import { formatBriefDate } from "@/lib/brief";

export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const prisma = getPrisma();
  const follows = await prisma.follow.findMany({
    where: { userId: user.id },
    include: {
      show: {
        include: {
          episodes: {
            orderBy: { publishedAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const samples = await prisma.episode.findMany({
    where: { id: { in: SEED_EPISODES.map((episode) => episode.id) } },
    include: { show: true, brief: true },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Library</h1>
          <p className="mt-2 text-muted">Shows you chose. Nothing we pre-picked as the product.</p>
        </div>
        <Link
          href="/discover"
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-deep"
        >
          Find a podcast
        </Link>
      </div>

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

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted">Sample briefs</h2>
        <p className="text-sm text-muted">
          Two real public episodes with prewritten notes-only briefs, so you can open the reader
          before adding <code className="text-ink">XAI_API_KEY</code>.
        </p>
        <ul className="space-y-3">
          {samples.map((episode) => (
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
      </section>
    </div>
  );
}
