import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { BriefView } from "@/components/BriefView";
import { AudioPlayer } from "@/components/AudioPlayer";
import { GenerateButton } from "@/components/GenerateButton";
import { hasXaiKey } from "@/lib/env";
import type { BriefSegment } from "@/lib/brief";
import { formatBriefLengthLabel, parseBriefLength } from "@/lib/brief-length";

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const prisma = getPrisma();
  const episode = await prisma.episode.findUnique({
    where: { id },
    include: { show: true, brief: true, recapAudio: true },
  });
  if (!episode) notFound();
  if (!user && !episode.seeded) redirect("/login");

  const follow = user
    ? await prisma.follow.findUnique({
        where: { userId_showId: { userId: user.id, showId: episode.showId } },
      })
    : null;
  const followLength = follow ? parseBriefLength(follow.briefLength) : null;
  const storedBriefLength = episode.brief ? parseBriefLength(episode.brief.briefLength) : null;
  const nextLength = followLength ?? storedBriefLength;
  const lengthChanged = Boolean(followLength && storedBriefLength && followLength !== storedBriefLength);

  const segments = episode.brief
    ? (JSON.parse(episode.brief.segmentsJson) as BriefSegment[])
    : [];
  const takeaways = episode.brief ? (JSON.parse(episode.brief.takeawaysJson) as string[]) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link href={`/shows/${episode.show.id}`} className="text-sm text-muted hover:text-ink">
        ← {episode.show.title}
      </Link>

      {episode.brief ? (
        <BriefView
          showTitle={episode.show.title}
          episodeTitle={episode.title}
          guest={episode.brief.guest}
          publishedAt={episode.publishedAt}
          link={episode.link}
          overview={episode.brief.overview}
          segments={segments}
          takeaways={takeaways}
          sourceType={episode.brief.sourceType}
          confidenceNote={episode.brief.confidenceNote}
          briefLength={episode.brief.briefLength}
          sourceLimited={episode.brief.sourceLimited}
        />
      ) : (
        <div className="space-y-3">
          <h1 className="font-display text-4xl">{episode.title}</h1>
          <p className="text-muted">No brief yet. Generate one from the transcript or official show notes.</p>
        </div>
      )}

      {lengthChanged && followLength ? (
        <p className="rounded-2xl border border-line bg-bg-card px-4 py-3 text-sm text-muted">
          This follow is now {formatBriefLengthLabel(followLength)}. Generate again to rewrite the
          brief and spoken recap. Changing length does not regenerate automatically.
        </p>
      ) : null}

      {episode.recapAudio ? (
        <AudioPlayer
          src={`/api/audio/${episode.id}`}
          title={`${episode.show.title} · ${episode.title}`}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          No spoken recap stored yet. Generation uses Grok Voice (xAI TTS) only.
        </div>
      )}

      <GenerateButton
        episodeId={episode.id}
        hasXaiKey={hasXaiKey()}
        briefLength={nextLength ?? undefined}
      />
    </div>
  );
}
