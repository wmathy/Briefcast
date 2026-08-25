import { z } from "zod";
import { xaiChatJson } from "@/lib/xai";
import type { EpisodeSource } from "@/lib/sources";

export const briefSegmentSchema = z.object({
  title: z.string(),
  speaker: z.enum(["host", "guest", "both", "unknown"]).default("unknown"),
  summary: z.string(),
});

export const generatedBriefSchema = z.object({
  guest: z.string().nullable().optional(),
  overview: z.string(),
  segments: z.array(briefSegmentSchema).min(1),
  takeaways: z.array(z.string()).min(4).max(6),
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

export async function writeBriefFromSource(input: {
  showTitle: string;
  episodeTitle: string;
  publishedAt: Date;
  episodeLink: string | null;
  knownGuest: string | null;
  source: EpisodeSource;
}): Promise<GeneratedBrief> {
  const prompt = `Write a faithful episode brief from the SOURCE TEXT only.

Rules:
- Do not invent quotes, guests, topics, or details that are not in the source.
- If a guest is not clearly named, set guest to null.
- Overview must be exactly two sentences.
- Main segments must stay in source order. Mark speaker as host, guest, both, or unknown.
- Provide 4 to 6 takeaways, each grounded in the source.
- spokenRecap is a natural spoken version of the same brief, still faithful, no extra opinions.

Show: ${input.showTitle}
Episode title: ${input.episodeTitle}
Date: ${input.publishedAt.toISOString().slice(0, 10)}
Link: ${input.episodeLink ?? "none"}
Known guest hint (may be null): ${input.knownGuest ?? "null"}
Source type: ${input.source.sourceType}
${input.source.confidenceNote ?? ""}

SOURCE TEXT:
${input.source.text}

Return JSON:
{
  "guest": string | null,
  "overview": string,
  "segments": [{"title": string, "speaker": "host"|"guest"|"both"|"unknown", "summary": string}],
  "takeaways": [string, string, string, string],
  "spokenRecap": string
}`;

  const raw = await xaiChatJson(prompt);
  const brief = parseBriefJson(raw);
  if (!brief.spokenRecap.trim()) {
    brief.spokenRecap = spokenRecapFromBrief({
      showTitle: input.showTitle,
      episodeTitle: input.episodeTitle,
      guest: brief.guest,
      overview: brief.overview,
      segments: brief.segments,
      takeaways: brief.takeaways,
    });
  }
  return brief;
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
