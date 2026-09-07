import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasXaiKey } from "@/lib/env";
import { requestOrigin, scheduleRefreshPipeline } from "@/lib/pipeline-hop";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const skipFeedSync = new URL(request.url).searchParams.get("continue") === "1";
  scheduleRefreshPipeline({
    origin: requestOrigin(request),
    hop: 0,
    userId: user.id,
    skipFeedSync,
  });

  return NextResponse.json(
    {
      continuing: true,
      remaining: 1,
      progressed: true,
      canGenerate: hasXaiKey(),
    },
    { status: 202 },
  );
}
