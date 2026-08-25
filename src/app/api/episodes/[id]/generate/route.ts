import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateEpisodeBrief } from "@/lib/generate";
import { MissingXaiKeyError } from "@/lib/env";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const result = await generateEpisodeBrief(id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MissingXaiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Generate failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
