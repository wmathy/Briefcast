import { XMLParser } from "fast-xml-parser";
import { extractGuest, stripHtml } from "@/lib/html";

export type RssEpisode = {
  guid: string;
  title: string;
  publishedAt: Date;
  link: string | null;
  audioUrl: string | null;
  description: string;
  guest: string | null;
  transcriptUrl: string | null;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "#text",
  isArray: (name) => ["item", "podcast:transcript"].includes(name),
});

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record["#text"] === "string") return record["#text"];
    if (typeof record._ === "string") return record._;
  }
  return "";
}

function enclosureUrl(item: Record<string, unknown>): string | null {
  const enclosure = item.enclosure as Record<string, unknown> | undefined;
  if (enclosure && typeof enclosure["@_url"] === "string") {
    return enclosure["@_url"];
  }
  return null;
}

function transcriptUrl(item: Record<string, unknown>): string | null {
  const transcripts = item["podcast:transcript"];
  if (Array.isArray(transcripts)) {
    for (const entry of transcripts) {
      if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>)["@_url"] === "string") {
        return (entry as Record<string, string>)["@_url"];
      }
    }
  }
  return null;
}

export async function fetchRssEpisodes(feedUrl: string, limit = 20): Promise<RssEpisode[]> {
  const response = await fetch(feedUrl, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "Briefcast/0.1 (+https://github.com/wmathy/Briefcast)",
    },
    next: { revalidate: 120 },
  });
  if (!response.ok) {
    throw new Error(`RSS fetch failed (${response.status})`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: Record<string, unknown>[] } };
  };
  const items = parsed.rss?.channel?.item ?? [];

  return items.slice(0, limit).map((item) => {
    const title = asText(item.title) || asText(item["itunes:title"]) || "Untitled episode";
    const description = stripHtml(
      asText(item["content:encoded"]) || asText(item.description) || asText(item["itunes:summary"]),
    );
    const guid = asText(item.guid) || asText(item.link) || title;
    const publishedAt = new Date(asText(item.pubDate) || Date.now());
    return {
      guid,
      title,
      publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
      link: asText(item.link) || null,
      audioUrl: enclosureUrl(item),
      description,
      guest: extractGuest(title, description),
      transcriptUrl: transcriptUrl(item),
    };
  });
}
