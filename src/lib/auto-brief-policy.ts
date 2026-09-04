/** Max heavy STT/TTS jobs one request runs. Locked episodes are skipped first. */
export const AUTO_BRIEF_LIMIT = 1;
export const AUTO_BRIEF_LOOKAHEAD = 8;

export function orderIdsByPublishedAt(
  items: { id: string; publishedAt: Date | number }[],
): string[] {
  return [...items]
    .filter((item) => Boolean(item.id))
    .sort((a, b) => {
      const tb = typeof b.publishedAt === "number" ? b.publishedAt : b.publishedAt.getTime();
      const ta = typeof a.publishedAt === "number" ? a.publishedAt : a.publishedAt.getTime();
      return tb - ta;
    })
    .map((item) => item.id)
    .filter((id, index, all) => all.indexOf(id) === index);
}

export function isUnfinishedSttJob(job: { status: string; text?: string | null } | null | undefined): boolean {
  if (!job) return false;
  if (job.status === "failed") return false;
  if (job.status === "complete" && (job.text?.length ?? 0) > 80) return false;
  return true;
}

/** Do not start STT on an older episode while a newer unfinished job is locked. */
export function shouldAdvanceOlderEpisode(input: {
  newerHasUnfinishedStt: boolean;
  newerSttBusy: boolean;
}): boolean {
  if (input.newerHasUnfinishedStt) return false;
  return !input.newerSttBusy;
}

export function episodeNeedsSpokenBrief(episode: {
  brief?: { sourceType?: string | null } | null;
  recapAudio?: unknown;
}): boolean {
  if (!episode.brief || episode.brief.sourceType !== "transcript" || !episode.recapAudio) {
    return true;
  }
  return false;
}

export function takeAutoBriefBatch(ids: string[], limit = AUTO_BRIEF_LIMIT) {
  const unique = [...new Set(ids.filter(Boolean))];
  return {
    toGenerate: unique.slice(0, limit),
    remaining: Math.max(0, unique.length - limit),
  };
}

export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization");
  if (secret) {
    return header === `Bearer ${secret}`;
  }
  return !process.env.VERCEL;
}
