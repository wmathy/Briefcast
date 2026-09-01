import { NextResponse } from "next/server";
import { recoverUserPassword, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    secret?: string;
  };

  const result = await recoverUserPassword({
    email: body.email ?? "",
    password: body.password ?? "",
    secret: body.secret ?? "",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await setSessionCookie(result.user);
  return NextResponse.json({ id: result.user.id, email: result.user.email });
}
