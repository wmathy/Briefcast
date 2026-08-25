import path from "node:path";

export const AUTH_COOKIE = "briefcast_session";
export const DEFAULT_PLAYBACK_RATE = 1.2;
export const TTS_SPEED = 1.2;
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
