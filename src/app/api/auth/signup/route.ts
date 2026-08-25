import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { hashPassword, setSessionCookie, validateEmail, validatePassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = validateEmail(body.email ?? "");
  if (!email) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const passwordError = validatePassword(body.password ?? "");
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(body.password!) },
  });
  await setSessionCookie({ id: user.id, email: user.email });
  return NextResponse.json({ id: user.id, email: user.email });
}
