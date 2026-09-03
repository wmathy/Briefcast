import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { refreshFollowedBriefs } from "@/lib/auto-brief";
import { hasXaiKey } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const result = await refreshFollowedBriefs({ userId: user.id });
    return NextResponse.json({
      created: result.created,
      fetchedShows: result.fetchedShows,
      generating: result.generating,
      generated: result.generated,
      remaining: result.remaining,
      skipped: result.skipped,
      canGenerate: hasXaiKey(),
      reason: result.reason,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RSS refresh failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
