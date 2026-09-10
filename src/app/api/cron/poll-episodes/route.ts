import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/auto-brief";
import { requestOrigin, scheduleRefreshPipeline } from "@/lib/pipeline-hop";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Hobby allows one daily cron. This ACK-first wake starts RSS detect + STT hops
 * via scheduleRefreshPipeline (full 300s budget, then await the next hop 202).
 * External schedulers (GitHub Actions every 15m) should hit this same path so
 * a dead hop chain resumes without opening Library.
 */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const continuing = scheduleRefreshPipeline({
    origin: requestOrigin(request),
    hop: 0,
  });
  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      continuing,
      remaining: 1,
      progressed: true,
    },
    { status: 202 },
  );
}
