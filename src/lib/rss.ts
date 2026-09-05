import { XMLParser } from "fast-xml-parser";
import { extractGuest, stripHtml } from "@/lib/html";
import { parseDurationSeconds } from "@/lib/transcript-complete";

export type RssEpisode = {
  guid: string;
  title: string;
  publishedAt: Date;
  link: string | null;
  audioUrl: string | null;
  description: string;
  guest: string | null;
  transcriptUrl: string | null;
  durationSeconds: number | null;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "#text",
  isArray: (name) => ["item", "entry", "enclosure", "podcast:transcript"].includes(name),
});

/** Unwrap parser nodes, including Megaphone CDATA-in-attribute `#text` arrays. */
export function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join("\n");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("#text" in record) return asText(record["#text"]);
    if ("_" in record) return asText(record._);
    if (typeof record["@_href"] === "string") return record["@_href"].trim();
  }
  return "";
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (entry && typeof entry === "object") return entry as Record<string, unknown>;
    }
    return null;
  }
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return null;
}

function enclosureUrl(item: Record<string, unknown>): string | null {
  const candidates = [item.enclosure, item["media:content"], item["media:group"]];
  for (const candidate of candidates) {
    const list = Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
    for (const entry of list) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const url = asText(record["@_url"]) || asText(record.url);
      const type = asText(record["@_type"]) || asText(record.type);
      if (url && (!type || /audio|mpeg|mp3|m4a|aac/i.test(type) || url.includes(".mp3"))) {
        return url;
      }
      if (url) return url;
    }
  }
  return null;
}

function itemDurationSeconds(item: Record<string, unknown>): number | null {
  return parseDurationSeconds(item["itunes:duration"] ?? item.duration);
}

function transcriptUrl(item: Record<string, unknown>): string | null {
  const transcripts = item["podcast:transcript"];
  const list = Array.isArray(transcripts) ? transcripts : transcripts ? [transcripts] : [];
  for (const entry of list) {
    if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>)["@_url"] === "string") {
      return (entry as Record<string, string>)["@_url"];
    }
  }
  return null;
}

function rssItems(parsed: Record<string, unknown>): Record<string, unknown>[] {
  const rss = firstRecord(parsed.rss);
  const channel = firstRecord(rss?.channel);
  const rssItems = channel?.item;
  if (Array.isArray(rssItems)) return rssItems.filter((item) => item && typeof item === "object") as Record<string, unknown>[];

  const feed = firstRecord(parsed.feed);
  const entries = feed?.entry;
  if (Array.isArray(entries)) return entries.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
  return [];
}

function itemLink(item: Record<string, unknown>): string | null {
  return asText(item.link) || asText(item.id) || null;
}

function itemGuid(item: Record<string, unknown>, title: string, audioUrl: string | null, link: string | null): string {
  return asText(item.guid) || asText(item.id) || audioUrl || link || title;
}

function itemPublishedAt(item: Record<string, unknown>): Date {
  const publishedAt = new Date(asText(item.pubDate) || asText(item.published) || asText(item.updated) || Date.now());
  return Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt;
}

/** Omit limit (or pass null) to keep every item in the feed. */
export function limitFeedItems<T>(items: T[], limit?: number | null): T[] {
  if (limit == null || !Number.isFinite(limit) || limit < 0) return items;
  return items.slice(0, limit);
}

export function parseRssEpisodes(xml: string, limit?: number | null): RssEpisode[] {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const items = rssItems(parsed);
  const seen = new Set<string>();
  const episodes: RssEpisode[] = [];

  for (const item of limitFeedItems(items, limit)) {
    const title = asText(item.title) || asText(item["itunes:title"]) || "Untitled episode";
    const description = stripHtml(
      asText(item["content:encoded"]) || asText(item.description) || asText(item["itunes:summary"]) || asText(item.summary),
    );
    const audioUrl = enclosureUrl(item);
    const link = itemLink(item);
    const guid = itemGuid(item, title, audioUrl, link);
    if (!guid || seen.has(guid)) continue;
    seen.add(guid);
    episodes.push({
      guid,
      title,
      publishedAt: itemPublishedAt(item),
      link,
      audioUrl,
      description,
      guest: extractGuest(title, description),
      transcriptUrl: transcriptUrl(item),
      durationSeconds: itemDurationSeconds(item),
    });
  }

  return episodes;
}

export async function fetchRssEpisodes(feedUrl: string, limit?: number | null): Promise<RssEpisode[]> {
  const headers = {
    Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml",
    "User-Agent": "Briefcast/0.1 (+https://github.com/wmathy/Briefcast)",
  };
  let response = await fetch(feedUrl, {
    headers,
    next: { revalidate: 120 },
  });
  if (response.status === 403 || response.status === 401) {
    response = await fetch(feedUrl, {
      headers: {
        ...headers,
        "User-Agent": "Mozilla/5.0 (compatible; Briefcast/0.1; +https://github.com/wmathy/Briefcast)",
      },
      next: { revalidate: 120 },
    });
  }
  if (!response.ok) {
    throw new Error(`RSS fetch failed (${response.status})`);
  }

  const xml = await response.text();
  return parseRssEpisodes(xml, limit);
}
