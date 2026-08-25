import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
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

  return new NextResponse(Buffer.from(audio.data), {
    headers: {
      "Content-Type": audio.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
