import { afterEach, describe, expect, it } from "vitest";
import {
  activeRecapEpisodeId,
  claimRecapPlayback,
  releaseRecapPlayback,
  resetRecapPlaybackForTests,
} from "./recap-playback";

describe("shared recap playback claim", () => {
  afterEach(() => {
    resetRecapPlaybackForTests();
  });

  it("stops the previous episode when another card starts", () => {
    const first: string[] = [];
    const second: string[] = [];
    claimRecapPlayback("a", () => first.push("stop"));
    expect(activeRecapEpisodeId()).toBe("a");
    claimRecapPlayback("b", () => second.push("stop"));
    expect(first).toEqual(["stop"]);
    expect(second).toEqual([]);
    expect(activeRecapEpisodeId()).toBe("b");
  });

  it("does not stop the same episode when it reclaims", () => {
    let stops = 0;
    const stop = () => {
      stops += 1;
    };
    claimRecapPlayback("a", stop);
    claimRecapPlayback("a", stop);
    expect(stops).toBe(0);
    releaseRecapPlayback("a");
    expect(activeRecapEpisodeId()).toBeNull();
  });
});
