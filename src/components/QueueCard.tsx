import Link from "next/link";
import { QueuePlayButton } from "@/components/QueuePlayButton";

export function QueueCard({
  episodeId,
  showTitle,
  title,
  dateLabel,
  durationHint,
}: {
  episodeId: string;
  showTitle: string;
  title: string;
  dateLabel: string;
  durationHint?: number;
}) {
  return (
    <article className="card-link relative rounded-2xl border border-line bg-bg-raised p-4">
      <Link
        href={`/episodes/${episodeId}`}
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={`${showTitle}: ${title}`}
      />
      <p className="text-xs uppercase tracking-wider text-accent">{showTitle}</p>
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 font-medium leading-snug">{title}</p>
        <QueuePlayButton episodeId={episodeId} durationHint={durationHint} />
      </div>
      <p className="mt-1 text-sm text-muted">{dateLabel}</p>
    </article>
  );
}
