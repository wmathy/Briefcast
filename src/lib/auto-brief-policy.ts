/** Max heavy STT/TTS jobs one request runs. Locked episodes are skipped first. */
export const AUTO_BRIEF_LIMIT = 1;
export const AUTO_BRIEF_LOOKAHEAD = 8;

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
