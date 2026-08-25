import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { setSessionCookie, validateEmail, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = validateEmail(body.email ?? "");
  if (!email || !body.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  await setSessionCookie({ id: user.id, email: user.email });
  return NextResponse.json({ id: user.id, email: user.email });
}
