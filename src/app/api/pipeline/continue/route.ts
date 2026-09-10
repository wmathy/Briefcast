import { after } from "next/server";
import { NextResponse } from "next/server";
import { refreshFollowedBriefs } from "@/lib/auto-brief";
import {
  PIPELINE_MAX_HOPS,
  dispatchPipelineHop,
  isPipelineHopAuthorized,
  pipelineShouldHop,
  requestOrigin,
} from "@/lib/pipeline-hop";
import { runPipelineTurn } from "@/lib/pipeline-turn";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseHop(value: string | null): number {
  const hop = Number(value ?? "1");
  return Number.isFinite(hop) && hop >= 1 ? Math.floor(hop) : 1;
}

export async function POST(request: Request) {
  if (!isPipelineHopAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const hop = parseHop(url.searchParams.get("hop"));
  if (hop > PIPELINE_MAX_HOPS) {
    return NextResponse.json({ ok: true, stopped: "hop-cap", hop });
  }

  const userId = url.searchParams.get("userId") ?? undefined;
  const showId = url.searchParams.get("showId") ?? undefined;
  const origin = requestOrigin(request);

  after(() =>
    runPipelineTurn(async () => {
      try {
        const result = await refreshFollowedBriefs({
          userId,
          showId,
          skipFeedSync: true,
        });
        console.info("[pipeline] continue turn", {
          hop,
          progressed: result.progressed,
          remaining: result.remaining,
          reason: result.reason,
          generated: result.generated,
        });
        if (pipelineShouldHop(result) && hop < PIPELINE_MAX_HOPS) {
          await dispatchPipelineHop({ origin, hop: hop + 1, userId, showId });
        }
      } catch (error) {
        console.error("[pipeline] continue failed", error instanceof Error ? error.message : error);
        if (hop < PIPELINE_MAX_HOPS) {
          await dispatchPipelineHop({ origin, hop: hop + 1, userId, showId });
        }
      }
    }),
  );

  return NextResponse.json({ ok: true, accepted: true, hop }, { status: 202 });
}

/** External cron-job.org / curl wakes often only GET. Same ACK + after() hop as POST. */
export async function GET(request: Request) {
  return POST(request);
}
