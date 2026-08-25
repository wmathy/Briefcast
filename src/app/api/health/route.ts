import { NextResponse } from "next/server";
import { findBundledSeed } from "@/lib/db";
import { getPrisma } from "@/lib/db";
import { databaseProvider, hasXaiKey } from "@/lib/env";

export async function GET() {
  const provider = databaseProvider();
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
      provider,
      durable: provider === "postgresql",
      seed: provider === "sqlite" ? findBundledSeed() : null,
      shows,
      episodes,
      briefs,
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
