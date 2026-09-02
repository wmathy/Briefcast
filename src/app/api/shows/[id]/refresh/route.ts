import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { generateAutoBriefs, syncShowAndPickAutoBriefs } from "@/lib/auto-brief";
import { hasXaiKey } from "@/lib/env";

export const maxDuration = 300;

export async function POST(
  _request: Request,
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
    include: { show: true },
  });
  if (!follow) {
    return NextResponse.json({ error: "Follow this show to check for episodes." }, { status: 403 });
  }

  try {
    const result = await syncShowAndPickAutoBriefs(follow.show.id, follow.show.feedUrl);
    if (result.autoBriefIds.length > 0) {
      after(async () => {
        await generateAutoBriefs(result.autoBriefIds);
      });
    }
    return NextResponse.json({
      fetched: result.fetched,
      created: result.created,
      generating: result.autoBriefIds.length,
      canGenerate: hasXaiKey(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RSS refresh failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
