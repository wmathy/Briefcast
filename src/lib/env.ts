import { createHash, timingSafeEqual } from "node:crypto";
import path from "node:path";

export const AUTH_COOKIE = "briefcast_session";
export const DEFAULT_PLAYBACK_RATE = 1.2;
/** Synthesize at 1x so Short/Medium/Long duration bands are real, not faked by speed. */
export const TTS_SPEED = 1;
export const TTS_VOICE_ID = "eve";
export const XAI_API_BASE = "https://api.x.ai/v1";
export const XAI_CHAT_MODELS = ["grok-4.6", "grok-4", "grok-3-latest"] as const;

export function hasXaiKey(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

export function requireXaiKey(): string {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) {
    throw new MissingXaiKeyError();
  }
  return key;
}

export class MissingXaiKeyError extends Error {
  constructor() {
    super(
      "Add XAI_API_KEY to generate written briefs and spoken recaps. Get a key at https://console.x.ai/",
    );
    this.name = "MissingXaiKeyError";
  }
}

export function authSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "briefcast-dev-only-change-me"
  );
}

/** Shared secret for the no-email password recovery form. Unset means recovery is disabled. */
export function recoverySecret(): string | null {
  const value = process.env.RECOVERY_SECRET?.trim();
  return value ? value : null;
}

export function isRecoveryEnabled(): boolean {
  return recoverySecret() !== null;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function recoverySecretMatches(candidate: string): boolean {
  const expected = recoverySecret();
  if (!expected) return false;
  return timingSafeEqual(sha256(candidate), sha256(expected));
}

export function sqliteFilePath(): string {
  if (process.env.VERCEL) {
    return "/tmp/briefcast.db";
  }
  if (process.env.DATABASE_URL?.startsWith("file:")) {
    return process.env.DATABASE_URL.slice("file:".length);
  }
  return path.join(process.cwd(), "prisma", "dev.db");
}

export function sqliteUrl(): string {
  return `file:${sqliteFilePath()}`;
}

export function databaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;
  return sqliteUrl();
}

export function isPostgresDatabaseUrl(url = databaseUrl()): boolean {
  return /^postgres(ql)?:\/\//i.test(url);
}

export function databaseProvider(url = databaseUrl()): "postgresql" | "sqlite" {
  return isPostgresDatabaseUrl(url) ? "postgresql" : "sqlite";
}
