import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { WIPE_BRIEFS_CONFIRM, wipeAllBriefArtifacts } from "@/lib/wipe-briefs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One-shot Preview wipe. Requires a signed-in session + confirm phrase. Not for Production URL. */
export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Wipe is disabled on Production." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== WIPE_BRIEFS_CONFIRM) {
    return NextResponse.json({ error: "Confirmation phrase does not match." }, { status: 400 });
  }

  const result = await wipeAllBriefArtifacts();
  return NextResponse.json({ ok: true, ...result });
}
