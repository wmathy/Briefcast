import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { syncShowEpisodes } from "@/lib/podcasts";

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
    const result = await syncShowEpisodes(follow.show.id, follow.show.feedUrl);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "RSS refresh failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
