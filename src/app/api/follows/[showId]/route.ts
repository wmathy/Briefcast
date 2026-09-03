import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { parseBriefLength } from "@/lib/brief-length";
import { generateEpisodeBrief } from "@/lib/generate";
import { hasXaiKey } from "@/lib/env";
import { listTtsVoices, parseTtsVoice } from "@/lib/tts-voice";
import { isPublishedTranscriptBrief } from "@/lib/transcript-complete";

export const maxDuration = 300;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ showId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { showId } = await context.params;
  const body = (await request.json()) as { briefLength?: string; ttsVoice?: string };
  const prisma = getPrisma();
  const data: { briefLength?: string; ttsVoice?: string } = {};

  if (body.briefLength !== undefined) {
    data.briefLength = parseBriefLength(body.briefLength);
  }
  if (body.ttsVoice !== undefined) {
    const voices = await listTtsVoices();
    data.ttsVoice = parseTtsVoice(
      body.ttsVoice,
      voices.map((voice) => voice.id),
    );
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const result = await prisma.follow.updateMany({
    where: { userId: user.id, showId },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Follow this show to change its settings." }, { status: 404 });
  }

  const follow = await prisma.follow.findUnique({
    where: { userId_showId: { userId: user.id, showId } },
    select: { briefLength: true, ttsVoice: true },
  });

  let regeneratedEpisodeId: string | null = null;
  if (data.ttsVoice && hasXaiKey()) {
    const latest = await prisma.episode.findFirst({
      where: {
        showId,
        brief: { is: { sourceType: "transcript" } },
        recapAudio: { isNot: null },
      },
      orderBy: { publishedAt: "desc" },
      include: { brief: true },
    });
    if (latest && isPublishedTranscriptBrief(latest.brief)) {
      try {
        await generateEpisodeBrief(latest.id, { userId: user.id });
        regeneratedEpisodeId = latest.id;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Voice saved; audio will update next.";
        return NextResponse.json({
          ok: true,
          briefLength: follow?.briefLength,
          ttsVoice: follow?.ttsVoice,
          regeneratedEpisodeId: null,
          warning: message,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    briefLength: follow?.briefLength,
    ttsVoice: follow?.ttsVoice,
    regeneratedEpisodeId,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ showId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { showId } = await context.params;
  const prisma = getPrisma();
  await prisma.follow.deleteMany({ where: { userId: user.id, showId } });
  return NextResponse.json({ ok: true });
}
