import { after } from "next/server";
import { isCronRequestAuthorized } from "@/lib/auto-brief-policy";

/** One hop is one 300s step. A 3-hour STT + write + TTS fits in this cap. */
export const PIPELINE_MAX_HOPS = 80;
/** Cold Preview starts often exceed 8s. Aborting before 202 kills continue+after(). */
export const HOP_ACK_MS = 25_000;

export type PipelineHopResult = {
  remaining?: number;
  generated?: number;
  inProgress?: number;
  progressed?: boolean;
  reason?: string | null;
  errors?: string[];
};

export function pipelineShouldHop(result: PipelineHopResult): boolean {
  if (result.reason === "missing-xai-key") return false;
  if (result.reason === "no-full-transcript" && !result.progressed) return false;
  const remaining = result.remaining ?? 0;
  if (remaining <= 0) return false;
  if (result.progressed) return true;
  if ((result.generated ?? 0) > 0) return true;
  if (result.errors && result.errors.length > 0) return true;
  return false;
}

export function pipelineHopUrl(input: {
  origin: string;
  hop: number;
  userId?: string;
  showId?: string;
}): string {
  const url = new URL("/api/pipeline/continue", input.origin);
  url.searchParams.set("hop", String(input.hop));
  if (input.userId) url.searchParams.set("userId", input.userId);
  if (input.showId) url.searchParams.set("showId", input.showId);
  return url.toString();
}

/** Preview often has AUTH_SECRET but not a usable CRON_SECRET on non-cron invocations. */
export function pipelineHopSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || null;
}

export function pipelineHopHeaders(): HeadersInit {
  const secret = pipelineHopSecret();
  return secret ? { authorization: `Bearer ${secret}` } : {};
}

export function isPipelineHopAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization");
  const secrets = [process.env.CRON_SECRET, process.env.AUTH_SECRET]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (secrets.length > 0) {
    return secrets.some((secret) => header === `Bearer ${secret}`);
  }
  return isCronRequestAuthorized(request);
}

export function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

/** Start the next invocation. Wait for the 202 ACK. Do not abort — that kills continue+after(). */
export async function dispatchPipelineHop(input: {
  origin: string;
  hop: number;
  userId?: string;
  showId?: string;
}): Promise<void> {
  if (input.hop > PIPELINE_MAX_HOPS) {
    console.warn("[pipeline] hop cap reached", input.hop);
    return;
  }
  const url = pipelineHopUrl(input);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: pipelineHopHeaders(),
      cache: "no-store",
    });
    if (response.status === 202 || response.ok) {
      return;
    }
    console.error("[pipeline] hop rejected", response.status, await response.text().catch(() => ""));
  } catch (error) {
    console.error("[pipeline] hop failed", error instanceof Error ? error.message : error);
  }
}

/** Fire the next 300s step after this response. Does not replace awaiting the current step. */
export function schedulePipelineHop(input: {
  origin: string;
  hop: number;
  userId?: string;
  showId?: string;
}): void {
  if (input.hop > PIPELINE_MAX_HOPS) {
    console.warn("[pipeline] hop cap reached", input.hop);
    return;
  }
  after(() => {
    void dispatchPipelineHop(input);
  });
}

export function schedulePipelineHopIfNeeded(
  result: PipelineHopResult,
  input: { origin: string; hop: number; userId?: string; showId?: string },
): boolean {
  if (!pipelineShouldHop(result) || input.hop >= PIPELINE_MAX_HOPS) return false;
  schedulePipelineHop({ ...input, hop: input.hop + 1 });
  return true;
}
