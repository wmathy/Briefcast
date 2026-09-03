import { NextResponse } from "next/server";
import { audioHttpResponse } from "@/lib/audio-http";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { normalizeMp3ForPlayback } from "@/lib/tts";

export async function GET(
  request: Request,
  context: { params: Promise<{ episodeId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { episodeId } = await context.params;
  const prisma = getPrisma();
  const audio = await prisma.recapAudio.findUnique({ where: { episodeId } });
  if (!audio) {
    return NextResponse.json({ error: "No spoken recap yet." }, { status: 404 });
  }

  const normalized = normalizeMp3ForPlayback(Buffer.from(audio.data));
  const result = audioHttpResponse(
    new Uint8Array(normalized),
    audio.mimeType || "audio/mpeg",
    request.headers.get("range"),
  );

  return new NextResponse(Buffer.from(result.body), {
    status: result.status,
    headers: result.headers,
  });
}
