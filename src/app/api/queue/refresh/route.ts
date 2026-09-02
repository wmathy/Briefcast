import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateAutoBriefs, pollFollowedShowsAndGenerate } from "@/lib/auto-brief";
import { hasXaiKey } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const poll = await pollFollowedShowsAndGenerate({ userId: user.id });
    if (poll.autoBriefIds.length > 0) {
      after(async () => {
        await generateAutoBriefs(poll.autoBriefIds, { userId: user.id });
      });
    }
    return NextResponse.json({
      created: poll.created,
      generating: poll.autoBriefIds.length,
      canGenerate: hasXaiKey(),
      errors: poll.syncErrors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RSS refresh failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
