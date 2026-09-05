import { NextResponse } from "next/server";
import { isCronRequestAuthorized, refreshFollowedBriefs } from "@/lib/auto-brief";
import { requestOrigin, schedulePipelineHopIfNeeded } from "@/lib/pipeline-hop";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshFollowedBriefs();
  const continuing = schedulePipelineHopIfNeeded(result, { origin: requestOrigin(request), hop: 0 });
  return NextResponse.json({
    ok: true,
    shows: result.shows,
    created: result.created,
    generating: result.generating,
    generated: result.generated,
    remaining: result.remaining,
    skipped: result.skipped,
    progressed: result.progressed,
    continuing,
    reason: result.reason,
    errors: result.errors,
  });
}
