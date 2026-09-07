import { NextResponse } from "next/server";
import { findBundledSeed } from "@/lib/db";
import { getPrisma } from "@/lib/db";
import { databaseProvider, hasXaiKey } from "@/lib/env";
import { collectWindowedFollowedWork } from "@/lib/queue";

export async function GET() {
  const provider = databaseProvider();
  try {
    const prisma = getPrisma();
    const [shows, episodes, briefs, follows, users, followRows, sttRows] = await Promise.all([
      prisma.show.count(),
      prisma.episode.count(),
      prisma.brief.count(),
      prisma.follow.count(),
      prisma.user.count(),
      prisma.follow.findMany({ select: { userId: true } }),
      prisma.sttJob.findMany({ select: { status: true } }),
    ]);
    const followTally = new Map<string, number>();
    for (const row of followRows) {
      followTally.set(row.userId, (followTally.get(row.userId) ?? 0) + 1);
    }
    const stt: Record<string, number> = {};
    for (const row of sttRows) {
      stt[row.status] = (stt[row.status] ?? 0) + 1;
    }
    let newestNeeding: Array<{
      id: string;
      kind: string;
      showTitle: string;
      title: string;
      hasSource: boolean;
      hasAudioUrl: boolean;
      hasTranscriptUrl: boolean;
      durationSeconds: number | null;
      sttStatus: string | null;
    }> = [];
    try {
      newestNeeding = (await collectWindowedFollowedWork({})).map((item) => ({
        id: item.id,
        kind: item.kind,
        showTitle: item.showTitle,
        title: item.title,
        hasSource: item.hasSource,
        hasAudioUrl: item.hasAudioUrl,
        hasTranscriptUrl: item.hasTranscriptUrl,
        durationSeconds: item.durationSeconds,
        sttStatus: item.sttStatus,
      }));
    } catch (error) {
      console.error("[health] newest window failed", error instanceof Error ? error.message : error);
    }
    return NextResponse.json({
      ok: true,
      hasXaiKey: hasXaiKey(),
      provider,
      durable: provider === "postgresql",
      seed: provider === "sqlite" ? findBundledSeed() : null,
      shows,
      episodes,
      briefs,
      follows,
      users,
      followCounts: [...followTally.values()].sort((a, b) => b - a),
      stt,
      newestNeeding,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        hasXaiKey: hasXaiKey(),
        provider,
        durable: provider === "postgresql",
        seed: provider === "sqlite" ? findBundledSeed() : null,
        error: error instanceof Error ? error.message : "Database failed.",
      },
      { status: 500 },
    );
  }
}
