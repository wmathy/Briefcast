import { z } from "zod";
import { xaiChatJson } from "@/lib/xai";
import type { EpisodeSource } from "@/lib/sources";
import {
  BRIEF_LENGTH_SPECS,
  DEFAULT_BRIEF_LENGTH,
  countWords,
  isSourceTooThin,
  mergeConfidenceNote,
  parseBriefLength,
  type BriefLength,
} from "@/lib/brief-length";

export const briefSegmentSchema = z.object({
  title: z.string(),
  speaker: z.enum(["host", "guest", "both", "unknown"]).default("unknown"),
  summary: z.string(),
});

export const generatedBriefSchema = z.object({
  guest: z.string().nullable().optional(),
  overview: z.string(),
  segments: z.array(briefSegmentSchema).min(1),
  takeaways: z.array(z.string()).min(1).max(12),
  spokenRecap: z.string(),
});

export type BriefSegment = z.infer<typeof briefSegmentSchema>;
export type GeneratedBrief = z.infer<typeof generatedBriefSchema>;

export function parseBriefJson(raw: string): GeneratedBrief {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as unknown;
  return generatedBriefSchema.parse(parsed);
}

export function spokenRecapFromBrief(brief: {
  showTitle: string;
  episodeTitle: string;
  guest?: string | null;
  overview: string;
  segments: BriefSegment[];
  takeaways: string[];
}): string {
  const guestLine = brief.guest ? ` Guest: ${brief.guest}.` : "";
  const segments = brief.segments
    .map((segment) => {
      const who =
        segment.speaker === "unknown" ? "" : ` ${segment.speaker === "both" ? "Host and guest" : capitalize(segment.speaker)}:`;
      return `${segment.title}.${who} ${segment.summary}`;
    })
    .join(" ");
  const takeaways = brief.takeaways.map((item, index) => `${index + 1}. ${item}`).join(" ");
  return `${brief.showTitle}. ${brief.episodeTitle}.${guestLine} ${brief.overview} Main segments: ${segments} Takeaways: ${takeaways}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildBriefPrompt(input: {
  showTitle: string;
  episodeTitle: string;
  publishedAt: Date;
  episodeLink: string | null;
  knownGuest: string | null;
  source: EpisodeSource;
  briefLength?: BriefLength;
  sourceLimited?: boolean;
}): string {
  const length = parseBriefLength(input.briefLength ?? DEFAULT_BRIEF_LENGTH);
  const spec = BRIEF_LENGTH_SPECS[length];
  const sourceLimited = input.sourceLimited ?? false;

  const lengthRules = sourceLimited
    ? `The SOURCE TEXT is too thin for a ${spec.label} brief (${spec.durationLabel}, ${spec.spokenWords.min}–${spec.spokenWords.max} spoken words at 1x). Write the most complete faithful brief the source supports. spokenRecap may be shorter than ${spec.spokenWords.min} words. Do not invent topics, quotes, or filler to reach the target.`
    : `Target a ${spec.label} brief. spokenRecap must be ${spec.spokenWords.min}–${spec.spokenWords.max} words so it runs about ${spec.durationLabel} (~150 words/minute at 1x). Do not speed up or slow down speech. Do not pad with filler or repeat yourself. Cover more of the source, with more segments and detail, when the length is Medium or Long.`;

  const transcriptRule =
    input.source.sourceType === "transcript"
      ? "The SOURCE TEXT is the full episode transcript (or a speech-to-text of the episode audio). Cover the whole episode — not a teaser, intro, or show-notes blurb. Medium and Long briefs must draw from later segments, not only the opening."
      : "The SOURCE TEXT is official show notes only. Do not pretend you heard the episode. Stay inside the notes.";

  return `Write a faithful episode brief from the SOURCE TEXT only.

Rules:
- Do not invent quotes, guests, topics, or details that are not in the source.
- ${transcriptRule}
- If a guest is not clearly named, set guest to null.
- Overview: ${spec.overviewSentences.min} to ${spec.overviewSentences.max} sentences. Longer lengths get a fuller overview, still only from the source.
- Main segments must stay in source order. Aim for ${spec.segments.min} to ${spec.segments.max} segments, each with more detail for longer lengths. Mark speaker as host, guest, both, or unknown. If the source cannot support that many, use fewer — never invent a segment.
- Provide ${spec.takeaways.min} to ${spec.takeaways.max} takeaways, each grounded in the source.
- spokenRecap is a natural spoken version of the same brief, still faithful, no extra opinions.
- ${lengthRules}

Show: ${input.showTitle}
Episode title: ${input.episodeTitle}
Date: ${input.publishedAt.toISOString().slice(0, 10)}
Link: ${input.episodeLink ?? "none"}
Known guest hint (may be null): ${input.knownGuest ?? "null"}
Source type: ${input.source.sourceType}
Requested length: ${spec.label} (${spec.durationLabel})
${input.source.confidenceNote ?? ""}

SOURCE TEXT:
${input.source.text}

Return JSON:
{
  "guest": string | null,
  "overview": string,
  "segments": [{"title": string, "speaker": "host"|"guest"|"both"|"unknown", "summary": string}],
  "takeaways": [string],
  "spokenRecap": string
}`;
}

export function buildSpokenRecapPrompt(input: {
  showTitle: string;
  episodeTitle: string;
  brief: GeneratedBrief;
  source: EpisodeSource;
  briefLength: BriefLength;
  sourceLimited: boolean;
}): string {
  const spec = BRIEF_LENGTH_SPECS[input.briefLength];
  const target = input.sourceLimited
    ? `Stay faithful and as complete as the source allows. Do not invent. The spoken recap may be shorter than ${spec.spokenWords.min} words.`
    : `Write ${spec.spokenWords.min}–${spec.spokenWords.max} words so the recap is about ${spec.durationLabel} at 1x (~150 words/minute). Do not pad, repeat, or invent.`;

  return `Rewrite only the spoken recap for this episode brief. Use the SOURCE TEXT and the written brief. Do not invent.

${target}

Show: ${input.showTitle}
Episode title: ${input.episodeTitle}
Guest: ${input.brief.guest ?? "null"}
Overview: ${input.brief.overview}
Segments: ${JSON.stringify(input.brief.segments)}
Takeaways: ${JSON.stringify(input.brief.takeaways)}
Source type: ${input.source.sourceType}

SOURCE TEXT:
${input.source.text}

Return JSON: { "spokenRecap": string }`;
}

const spokenOnlySchema = z.object({ spokenRecap: z.string().min(1) });

export async function writeBriefFromSource(input: {
  showTitle: string;
  episodeTitle: string;
  publishedAt: Date;
  episodeLink: string | null;
  knownGuest: string | null;
  source: EpisodeSource;
  briefLength?: BriefLength;
}): Promise<GeneratedBrief & { briefLength: BriefLength; sourceLimited: boolean }> {
  const briefLength = parseBriefLength(input.briefLength ?? DEFAULT_BRIEF_LENGTH);
  const sourceLimited = isSourceTooThin(input.source.text, briefLength);
  const prompt = buildBriefPrompt({ ...input, briefLength, sourceLimited });

  const raw = await xaiChatJson(prompt);
  const brief = parseBriefJson(raw);
  const fromWritten = spokenRecapFromBrief({
    showTitle: input.showTitle,
    episodeTitle: input.episodeTitle,
    guest: brief.guest,
    overview: brief.overview,
    segments: brief.segments,
    takeaways: brief.takeaways,
  });
  if (countWords(fromWritten) > countWords(brief.spokenRecap)) {
    brief.spokenRecap = fromWritten;
  }

  const expanded = await expandSpokenRecapIfShort({
    showTitle: input.showTitle,
    episodeTitle: input.episodeTitle,
    brief,
    source: input.source,
    briefLength,
    sourceLimited,
  });

  return { ...expanded, briefLength, sourceLimited };
}

export async function expandSpokenRecapIfShort(input: {
  showTitle: string;
  episodeTitle: string;
  brief: GeneratedBrief;
  source: EpisodeSource;
  briefLength: BriefLength;
  sourceLimited: boolean;
}): Promise<GeneratedBrief> {
  const spec = BRIEF_LENGTH_SPECS[input.briefLength];
  const words = countWords(input.brief.spokenRecap);
  const minAcceptable = Math.floor(spec.spokenWords.min * 0.85);
  if (input.sourceLimited || words >= minAcceptable) {
    return input.brief;
  }

  const raw = await xaiChatJson(buildSpokenRecapPrompt(input));
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = spokenOnlySchema.parse(JSON.parse(cleaned) as unknown);
  const nextWords = countWords(parsed.spokenRecap);
  if (nextWords <= words) {
    return input.brief;
  }
  return { ...input.brief, spokenRecap: parsed.spokenRecap.trim() };
}

export function formatBriefDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export { mergeConfidenceNote };
