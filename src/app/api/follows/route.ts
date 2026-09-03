import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { refreshFollowedBriefs } from "@/lib/auto-brief";
import { upsertShowFromItunes } from "@/lib/podcasts";
import { parseBriefLength } from "@/lib/brief-length";

export const maxDuration = 300;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to follow a show." }, { status: 401 });
  }

  const body = (await request.json()) as {
    itunesId?: string;
    title?: string;
    artist?: string;
    feedUrl?: string;
    artworkUrl?: string | null;
    description?: string;
    briefLength?: string;
  };

  if (!body.itunesId || !body.title || !body.feedUrl) {
    return NextResponse.json({ error: "itunesId, title, and feedUrl are required." }, { status: 400 });
  }

  const show = await upsertShowFromItunes({
    itunesId: body.itunesId,
    title: body.title,
    artist: body.artist ?? "Unknown",
    feedUrl: body.feedUrl,
    artworkUrl: body.artworkUrl ?? null,
    description: body.description ?? "",
  });

  const briefLength = parseBriefLength(body.briefLength);
  const prisma = getPrisma();
  await prisma.follow.upsert({
    where: { userId_showId: { userId: user.id, showId: show.id } },
    update: { briefLength },
    create: { userId: user.id, showId: show.id, briefLength },
  });

  try {
    const result = await refreshFollowedBriefs({ userId: user.id, showId: show.id });
    const warning =
      result.reason === "missing-xai-key"
        ? "Followed. Add XAI_API_KEY to write the latest brief automatically."
        : result.errors[0];
    return NextResponse.json({
      showId: show.id,
      briefLength,
      fetched: result.fetched,
      created: result.created,
      generated: result.generated,
      remaining: result.remaining,
      errors: result.errors,
      warning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Followed, but episode sync failed.";
    return NextResponse.json({ showId: show.id, briefLength, warning: message });
  }
}
