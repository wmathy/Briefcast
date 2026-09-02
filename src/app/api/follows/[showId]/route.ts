import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { parseBriefLength } from "@/lib/brief-length";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ showId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { showId } = await context.params;
  const body = (await request.json()) as { briefLength?: string };
  const briefLength = parseBriefLength(body.briefLength);
  const prisma = getPrisma();
  const result = await prisma.follow.updateMany({
    where: { userId: user.id, showId },
    data: { briefLength },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Follow this show to set a brief length." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, briefLength });
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
