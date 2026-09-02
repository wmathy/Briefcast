import type { BriefSegment } from "@/lib/brief";
import { formatBriefDate } from "@/lib/brief";
import { formatBriefLengthLabel, type BriefLength } from "@/lib/brief-length";

export function BriefView({
  showTitle,
  episodeTitle,
  guest,
  publishedAt,
  link,
  overview,
  segments,
  takeaways,
  sourceType,
  confidenceNote,
  briefLength,
  sourceLimited,
}: {
  showTitle: string;
  episodeTitle: string;
  guest: string | null;
  publishedAt: Date;
  link: string | null;
  overview: string;
  segments: BriefSegment[];
  takeaways: string[];
  sourceType: string;
  confidenceNote: string | null;
  briefLength?: BriefLength | string | null;
  sourceLimited?: boolean;
}) {
  return (
    <article className="space-y-8">
      <header className="space-y-2 border-b border-line pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">{showTitle}</p>
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{episodeTitle}</h1>
        <p className="text-sm text-muted">
          {guest ? `Guest: ${guest}` : "Guest: not named in source"} · {formatBriefDate(publishedAt)}
          {briefLength ? ` · ${formatBriefLengthLabel(briefLength)}` : ""}
        </p>
        {link ? (
          <a className="text-sm text-accent underline-offset-2 hover:underline" href={link} target="_blank" rel="noreferrer">
            Official episode link
          </a>
        ) : null}
      </header>

      {sourceLimited ? (
        <p className="rounded-2xl border border-line bg-bg-raised px-4 py-3 text-sm text-muted">
          Source was limited for this length. The brief stays faithful to the available transcript
          or notes and does not invent extra material.
        </p>
      ) : null}

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">Overview</h2>
        <p className="text-lg leading-8 text-ink">{overview}</p>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-muted">Main segments</h2>
        <ol className="space-y-4">
          {segments.map((segment, index) => (
            <li key={`${segment.title}-${index}`} className="rounded-2xl border border-line bg-bg-card p-4">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-ink">
                  {index + 1}. {segment.title}
                </h3>
                <span className="text-xs uppercase tracking-wider text-muted">{segment.speaker}</span>
              </div>
              <p className="leading-7 text-muted">{segment.summary}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-muted">Takeaways</h2>
        <ul className="space-y-2">
          {takeaways.map((item) => (
            <li key={item} className="flex gap-3 leading-7">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted">
        Source: {sourceType === "transcript" ? "transcript" : "official show notes"}
        {confidenceNote ? ` · ${confidenceNote}` : ""}
      </p>
    </article>
  );
}
