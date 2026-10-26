import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { recapAudioMetadataSelect, sttJobMetadataSelect } from "./prisma-select";

function read(rel: string) {
  return readFileSync(path.join(__dirname, rel), "utf8");
}

const metadataSources = [
  "./queue.ts",
  "./auto-brief.ts",
  "./generate.ts",
  "./brief-ledger.ts",
  "./prisma-select.ts",
  "../app/library/page.tsx",
  "../app/shows/[id]/page.tsx",
  "../app/episodes/[id]/page.tsx",
];

describe("metadata queries skip recap blobs and transcript bodies", () => {
  it("keeps RecapAudio.data and SttJob.text out of the shared selects", () => {
    expect(recapAudioMetadataSelect).toMatchObject({
      id: true,
      durationSeconds: true,
      voiceId: true,
    });
    expect(recapAudioMetadataSelect).not.toHaveProperty("data");
    expect(sttJobMetadataSelect).toMatchObject({
      status: true,
      updatedAt: true,
      lockedAt: true,
      chunkCount: true,
      nextByte: true,
      totalBytes: true,
      coveredSeconds: true,
    });
    expect(sttJobMetadataSelect).not.toHaveProperty("text");
  });

  it("does not include full recap audio or STT rows from queue, page, or brief scheduling reads", () => {
    for (const file of metadataSources) {
      const source = read(file);
      expect(source, file).not.toMatch(/recapAudio:\s*true/);
      expect(source, file).not.toMatch(/sttJob:\s*true/);
      expect(source, file).not.toMatch(/\bdata:\s*true/);
      expect(source, file).not.toMatch(/\btext:\s*true/);
    }
  });

  it("loads MP3 bytes only on the audio route and still reads transcript text while appending STT", () => {
    const audio = read("../app/api/audio/[episodeId]/route.ts");
    expect(audio).toContain("data: true");
    expect(audio).toContain("mimeType: true");
    const stt = read("./stt-job.ts");
    expect(stt).toContain("text: current.text");
    expect(stt).toContain("job.text.length > 80");
  });

  it("keeps the full-transcript publish gate", () => {
    expect(read("./transcript-complete.ts")).toContain("export function isCompleteEpisodeTranscript");
    expect(read("./queue.ts")).toContain('sourceType: "transcript"');
    expect(read("./generate.ts")).toContain('sourceType: "transcript"');
    expect(read("./auto-brief.ts")).toContain('LENGTH("text")');
    expect(read("./auto-brief.ts")).not.toContain("text: true");
  });

  it("scans the followed window once for the Library waiting count and auto-brief flag", () => {
    const page = read("../app/library/page.tsx");
    expect(page).toContain("loadFollowedBriefCounts");
    expect(page).not.toContain("countUnbriefedFollowedEpisodes");
    expect(page).not.toContain("countLatestFollowedNeedingBrief");
    expect(read("./queue.ts")).toContain("excludeIds");
  });
});
