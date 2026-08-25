import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

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
