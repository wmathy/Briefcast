import { NextResponse } from "next/server";
import { isCronRequestAuthorized, refreshFollowedBriefs } from "@/lib/auto-brief";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshFollowedBriefs();
  return NextResponse.json({
    ok: true,
    shows: result.shows,
    created: result.created,
    generating: result.generating,
    generated: result.generated,
    remaining: result.remaining,
    skipped: result.skipped,
    reason: result.reason,
    errors: result.errors,
  });
}
