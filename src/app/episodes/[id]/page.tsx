import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { BriefView } from "@/components/BriefView";
import { AudioPlayer } from "@/components/AudioPlayer";
import { GenerateButton } from "@/components/GenerateButton";
import { hasXaiKey } from "@/lib/env";
import type { BriefSegment } from "@/lib/brief";
import { estimateSpokenMinutesAt1x, formatBriefLengthShort, parseBriefLength } from "@/lib/brief-length";
import { FULL_TRANSCRIPT_UNAVAILABLE_SHORT, isPublishedTranscriptBrief } from "@/lib/transcript-complete";

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const prisma = getPrisma();
  const episode = await prisma.episode.findUnique({
    where: { id },
    include: { show: true, brief: true, recapAudio: true },
  });
  if (!episode) notFound();

  const follow = await prisma.follow.findUnique({
    where: { userId_showId: { userId: user.id, showId: episode.showId } },
  });
  const followLength = follow ? parseBriefLength(follow.briefLength) : null;
  const published = isPublishedTranscriptBrief(episode.brief);
  const storedBriefLength = published && episode.brief ? parseBriefLength(episode.brief.briefLength) : null;
  const nextLength = followLength ?? storedBriefLength;
  const lengthChanged = Boolean(followLength && storedBriefLength && followLength !== storedBriefLength);

  const segments = published && episode.brief
    ? (JSON.parse(episode.brief.segmentsJson) as BriefSegment[])
    : [];
  const takeaways = published && episode.brief ? (JSON.parse(episode.brief.takeawaysJson) as string[]) : [];

  const durationHint =
    published && episode.brief?.spokenRecap
      ? Math.max(1, Math.round(estimateSpokenMinutesAt1x(episode.brief.spokenRecap) * 60))
      : undefined;

  const player =
    published && episode.recapAudio ? (
      <AudioPlayer src={`/api/audio/${episode.id}`} durationHint={durationHint} />
    ) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/shows/${episode.show.id}`} className="text-sm text-muted hover:text-ink">
        ← {episode.show.title}
      </Link>

      {lengthChanged && followLength ? (
        <p className="text-sm text-muted">
          Length is now {formatBriefLengthShort(followLength)}. Generate to rewrite.
        </p>
      ) : null}

      {published && episode.brief ? (
        <BriefView
          episodeTitle={episode.title}
          guest={episode.brief.guest}
          publishedAt={episode.publishedAt}
          durationSeconds={episode.durationSeconds}
          link={episode.link}
          overview={episode.brief.overview}
          segments={segments}
          takeaways={takeaways}
          briefLength={episode.brief.briefLength}
          sourceLimited={episode.brief.sourceLimited}
          player={player}
        />
      ) : (
        <div className="space-y-3">
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">{episode.title}</h1>
          <p className="text-muted">{FULL_TRANSCRIPT_UNAVAILABLE_SHORT}</p>
        </div>
      )}

      <GenerateButton
        episodeId={episode.id}
        hasXaiKey={hasXaiKey()}
        briefLength={nextLength ?? undefined}
        retryUnavailable={!published}
      />
    </div>
  );
}
