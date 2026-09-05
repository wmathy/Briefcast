import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNOWN_ITUNES_FEEDS,
  canonicalItunesFeedUrl,
  looksLikeNonRssCatalogUrl,
} from "./itunes";

describe("iTunes feedUrl resolution", () => {
  it("wires Candace Apple id 1750591415 to the working Megaphone RSS", () => {
    expect(KNOWN_ITUNES_FEEDS["1750591415"]).toBe("https://feeds.megaphone.fm/candace");
    expect(canonicalItunesFeedUrl("1750591415", "https://podcasts.apple.com/us/podcast/candace/id1750591415")).toBe(
      "https://feeds.megaphone.fm/candace",
    );
    expect(canonicalItunesFeedUrl("1750591415")).toBe("https://feeds.megaphone.fm/candace");
  });

  it("does not treat an Apple or Spotify catalog page as RSS", () => {
    expect(looksLikeNonRssCatalogUrl("https://podcasts.apple.com/us/podcast/candace/id1750591415")).toBe(true);
    expect(looksLikeNonRssCatalogUrl("https://open.spotify.com/show/abc")).toBe(true);
    expect(looksLikeNonRssCatalogUrl("https://feeds.megaphone.fm/candace")).toBe(false);
    expect(canonicalItunesFeedUrl("999", "https://podcasts.apple.com/us/podcast/x/id999")).toBeNull();
    expect(canonicalItunesFeedUrl("999", "https://feeds.npr.org/510318/podcast.xml")).toBe(
      "https://feeds.npr.org/510318/podcast.xml",
    );
  });

  it("search and follow persist the resolved feedUrl", () => {
    const itunes = readFileSync(path.join(__dirname, "itunes.ts"), "utf8");
    const podcasts = readFileSync(path.join(__dirname, "podcasts.ts"), "utf8");
    expect(itunes).toContain("canonicalItunesFeedUrl");
    expect(itunes).toContain("lookupPodcast");
    expect(podcasts).toContain("resolveItunesPodcast");
    expect(podcasts).toContain("skipDuplicates");
    expect(podcasts).toContain("resolvedShowFeedUrl");
  });
});
