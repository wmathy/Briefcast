import { NextResponse } from "next/server";
import {
  generateAutoBriefs,
  isCronRequestAuthorized,
  pollFollowedShowsAndGenerate,
} from "@/lib/auto-brief";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const poll = await pollFollowedShowsAndGenerate();
  const generation = await generateAutoBriefs(poll.autoBriefIds);

  return NextResponse.json({
    ok: true,
    shows: poll.shows,
    created: poll.created,
    generating: poll.autoBriefIds,
    generated: generation.generated,
    skipped: generation.skipped,
    reason: generation.reason,
    errors: [...poll.syncErrors, ...generation.errors],
  });
}
