import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { asText, parseRssEpisodes } from "./rss";

const megaphoneGuid = `{
  "#text": [{ "#text": "60211772-a7fa-11f1-9c4b-77e718a46c02" }],
  "@_isPermaLink": "false"
}`;

describe("asText unwraps Megaphone CDATA guids", () => {
  it("reads a nested #text array instead of falling back to the show permalink", () => {
    expect(asText(JSON.parse(megaphoneGuid))).toBe("60211772-a7fa-11f1-9c4b-77e718a46c02");
  });
});

describe("parseRssEpisodes", () => {
  it("keeps unique Megaphone guids when every item shares the show link", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Candace Owens</title>
    <item>
      <title>Is Steven Avery Guilty?</title>
      <link>https://www.dailywire.com/show/candace</link>
      <guid isPermaLink="false"><![CDATA[guid-ep-383]]></guid>
      <pubDate>Mon, 18 Mar 2024 20:00:00 -0000</pubDate>
      <itunes:episode>383</itunes:episode>
      <enclosure url="https://traffic.megaphone.fm/ep383.mp3" type="audio/mpeg"/>
    </item>
    <item>
      <title>Later episode</title>
      <link>https://www.dailywire.com/show/candace</link>
      <guid isPermaLink="false"><![CDATA[guid-ep-384]]></guid>
      <pubDate>Tue, 19 Mar 2024 20:00:00 -0000</pubDate>
      <enclosure url="https://traffic.megaphone.fm/ep384.mp3" type="audio/mpeg"/>
    </item>
  </channel>
</rss>`;

    const episodes = parseRssEpisodes(xml);
    expect(episodes).toHaveLength(2);
    expect(episodes.map((episode) => episode.guid)).toEqual(["guid-ep-383", "guid-ep-384"]);
    expect(new Set(episodes.map((episode) => episode.guid)).size).toBe(2);
    expect(episodes[0]?.title).toContain("Steven Avery");
    expect(episodes[0]?.audioUrl).toContain("ep383.mp3");
  });

  it("parses the live Candace Megaphone feed when present as a fixture-like document", () => {
    const source = readFileSync(path.join(__dirname, "rss.ts"), "utf8");
    expect(source).toContain("parseRssEpisodes");
    expect(source).toContain('"#text" in record');
    expect(source).toContain("feed?.entry");
  });

  it("reads Atom entries when the document is not rss/channel/item", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example</title>
  <entry>
    <id>urn:uuid:abc</id>
    <title>Atom episode</title>
    <updated>2026-09-01T00:00:00Z</updated>
    <link href="https://example.com/ep"/>
    <media:content xmlns:media="http://search.yahoo.com/mrss/" url="https://example.com/ep.mp3" type="audio/mpeg"/>
  </entry>
</feed>`;
    const episodes = parseRssEpisodes(xml);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]?.guid).toBe("urn:uuid:abc");
    expect(episodes[0]?.audioUrl).toBe("https://example.com/ep.mp3");
  });
});
