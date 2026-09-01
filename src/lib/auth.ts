import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { AUTH_COOKIE, authSecret, recoverySecret, recoverySecretMatches } from "@/lib/env";
import { getPrisma } from "@/lib/db";

export const RECOVERY_NOT_ENABLED = "Password recovery is not enabled yet.";
export const RECOVERY_FAILED =
  "Could not reset that password. Check the email and recovery secret.";

export type SessionUser = {
  id: string;
  email: string;
};

function secretKey() {
  return new TextEncoder().encode(authSecret());
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function readSession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const session = await readSession(token);
  if (!session) return null;
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true },
  });
  if (user) return user;

  const byEmail = await prisma.user.findUnique({
    where: { email: session.email },
    select: { id: true, email: true },
  });
  if (byEmail) return byEmail;

  try {
    await prisma.user.create({
      data: {
        id: session.id,
        email: session.email,
        passwordHash: "unusable-replica",
      },
    });
  } catch {
    // another request may have created the replica row
  }
  return session;
}

export function validateEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export type RecoverPasswordResult =
  | { ok: true; user: SessionUser }
  | { ok: false; status: number; error: string };

export async function recoverUserPassword(input: {
  email: string;
  password: string;
  secret: string;
}): Promise<RecoverPasswordResult> {
  const email = validateEmail(input.email);
  if (!email) {
    return { ok: false, status: 400, error: "Enter a valid email address." };
  }
  const passwordError = validatePassword(input.password);
  if (passwordError) {
    return { ok: false, status: 400, error: passwordError };
  }
  if (!recoverySecret()) {
    return { ok: false, status: 503, error: RECOVERY_NOT_ENABLED };
  }
  if (!input.secret.trim()) {
    return { ok: false, status: 400, error: "Recovery secret is required." };
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!recoverySecretMatches(input.secret) || !user) {
    return { ok: false, status: 401, error: RECOVERY_FAILED };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.password) },
    select: { id: true, email: true },
  });
  return { ok: true, user: updated };
}
