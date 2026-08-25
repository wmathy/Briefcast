import { NextResponse } from "next/server";
import { findBundledSeed } from "@/lib/db";
import { getPrisma } from "@/lib/db";
import { hasXaiKey, sqliteFilePath } from "@/lib/env";

export async function GET() {
  try {
    const prisma = getPrisma();
    const [shows, episodes, briefs] = await Promise.all([
      prisma.show.count(),
      prisma.episode.count(),
      prisma.brief.count(),
    ]);
    return NextResponse.json({
      ok: true,
      hasXaiKey: hasXaiKey(),
      dbPath: sqliteFilePath(),
      seed: findBundledSeed(),
      shows,
      episodes,
      briefs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        hasXaiKey: hasXaiKey(),
        dbPath: sqliteFilePath(),
        seed: findBundledSeed(),
        error: error instanceof Error ? error.message : "Database failed.",
      },
      { status: 500 },
    );
  }
}
