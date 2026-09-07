import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { hasXaiKey } from "@/lib/env";
import { requestOrigin, scheduleRefreshPipeline } from "@/lib/pipeline-hop";

export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  const prisma = getPrisma();
  const follow = await prisma.follow.findUnique({
    where: { userId_showId: { userId: user.id, showId: id } },
  });
  if (!follow) {
    return NextResponse.json({ error: "Follow this show to check for episodes." }, { status: 403 });
  }

  scheduleRefreshPipeline({
    origin: requestOrigin(request),
    hop: 0,
    userId: user.id,
    showId: id,
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
