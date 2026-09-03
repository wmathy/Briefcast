import { describe, expect, it } from "vitest";
import { limitFeedItems } from "./rss";

describe("limitFeedItems", () => {
  const items = ["a", "b", "c", "d"];

  it("keeps the entire RSS feed when no limit is passed", () => {
    expect(limitFeedItems(items)).toEqual(items);
    expect(limitFeedItems(items, null)).toEqual(items);
  });

  it("does not silently cap a show at 20 episodes", () => {
    const feed = Array.from({ length: 47 }, (_, index) => `ep-${index}`);
    expect(limitFeedItems(feed)).toHaveLength(47);
    expect(limitFeedItems(feed, 20)).toHaveLength(20);
  });
});
