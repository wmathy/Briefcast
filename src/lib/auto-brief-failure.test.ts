import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recapAudioMetadataSelect } from "./prisma-select";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  queryRaw: vi.fn(),
  generateEpisodeBrief: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    episode: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
    },
    $queryRaw: mocks.queryRaw,
  }),
}));

vi.mock("@/lib/generate", () => ({
  generateEpisodeBrief: mocks.generateEpisodeBrief,
  resolveEpisodeTtsVoice: async () => "eve",
  resolveEpisodeBriefLength: async () => "medium",
  purgeNotesOnlyBriefs: async () => 0,
}));

import { generateAutoBriefs } from "./auto-brief";

const previousKey = process.env.XAI_API_KEY;

function episode(id: string, showTitle: string) {
  return {
    id,
    title: id,
    showId: "show-1",
    show: { title: showTitle },
    brief: null,
    recapAudio: null,
  };
}

describe("generateAutoBriefs failures", () => {
  beforeEach(() => {
    process.env.XAI_API_KEY = "test-key";
    mocks.findMany.mockReset();
    mocks.findUnique.mockReset();
    mocks.queryRaw.mockReset();
    mocks.generateEpisodeBrief.mockReset();
    mocks.queryRaw.mockResolvedValue([]);
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousKey;
  });

  it("records a thrown episode and still generates the next id", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "ep-fail", publishedAt: new Date("2026-09-04T00:00:00.000Z") },
      { id: "ep-ok", publishedAt: new Date("2026-09-03T00:00:00.000Z") },
    ]);
    mocks.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === "ep-fail") return episode("ep-fail", "JRE");
      if (args.where.id === "ep-ok") return episode("ep-ok", "Tucker");
      return null;
    });
    mocks.generateEpisodeBrief.mockImplementation(async (id: string) => {
      if (id === "ep-fail") throw new Error("xAI TTS error 503");
      return { published: true, reason: null };
    });

    const result = await generateAutoBriefs(["ep-fail", "ep-ok"]);

    expect(result.failedIds).toEqual(["ep-fail"]);
    expect(result.unavailableIds).toContain("ep-fail");
    expect(result.generated).toBe(1);
    expect(result.errors).toEqual(["JRE: xAI TTS error 503"]);
    expect(mocks.generateEpisodeBrief.mock.calls.map((call) => call[0])).toEqual(["ep-fail", "ep-ok"]);
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          recapAudio: { select: recapAudioMetadataSelect },
        }),
      }),
    );
    const sql = mocks.queryRaw.mock.calls[0]?.[0] as { strings?: string[] };
    expect(sql.strings?.join(" ")).toContain('LENGTH("text")');
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["ep-fail", "ep-ok"] } },
      select: { id: true, publishedAt: true },
    });
  });

  it("returns empty failure lists when the API key is missing", async () => {
    delete process.env.XAI_API_KEY;
    const result = await generateAutoBriefs(["ep-1"]);
    expect(result.reason).toBe("missing-xai-key");
    expect(result.failedIds).toEqual([]);
    expect(result.unavailableIds).toEqual([]);
    expect(mocks.generateEpisodeBrief).not.toHaveBeenCalled();
  });
});
