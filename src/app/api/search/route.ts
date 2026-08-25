import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchPodcasts } from "@/lib/itunes";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to search podcasts." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  try {
    const results = await searchPodcasts(q);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
