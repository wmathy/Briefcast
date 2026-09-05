import type { ReactNode } from "react";
import type { BriefSegment } from "@/lib/brief";
import { formatBriefDate } from "@/lib/brief";
import { formatBriefLengthShort, type BriefLength } from "@/lib/brief-length";
import { formatEpisodeClock } from "@/lib/format-time";

export function BriefView({
  episodeTitle,
  guest,
  publishedAt,
  durationSeconds,
  link,
  overview,
  segments,
  takeaways,
  briefLength,
  sourceLimited,
  player,
}: {
  episodeTitle: string;
  guest: string | null;
  publishedAt: Date;
  durationSeconds?: number | null;
  link: string | null;
  overview: string;
  segments: BriefSegment[];
  takeaways: string[];
  briefLength?: BriefLength | string | null;
  sourceLimited?: boolean;
  player?: ReactNode;
}) {
  const meta = [
    guest,
    formatBriefDate(publishedAt),
    formatEpisodeClock(durationSeconds),
    briefLength ? formatBriefLengthShort(briefLength) : null,
  ].filter(Boolean);

  return (
    <article className="space-y-6">
      <header className="space-y-2 border-b border-line pb-5">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{episodeTitle}</h1>
        <p className="text-sm text-muted">{meta.join(" · ")}</p>
        {link ? (
          <a className="tap pressable inline-flex items-center rounded-md text-sm text-accent underline" href={link} target="_blank" rel="noreferrer">
            Episode
          </a>
        ) : null}
      </header>

      {player}

      {sourceLimited ? (
        <p className="text-sm text-muted">Source was limited.</p>
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
    </article>
  );
}
