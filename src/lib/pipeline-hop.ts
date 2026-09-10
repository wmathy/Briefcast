import { after } from "next/server";
import { isCronRequestAuthorized } from "@/lib/auto-brief-policy";
import { runPipelineTurn } from "@/lib/pipeline-turn";

/** One hop is one 300s step. A 3-hour STT + write + TTS fits in this cap. */
export const PIPELINE_MAX_HOPS = 80;
/** Cold Preview starts often exceed 8s. Aborting before 202 kills continue+after(). */
export const HOP_ACK_MS = 25_000;

export type PipelineHopResult = {
  remaining?: number;
  generated?: number;
  inProgress?: number;
  progressed?: boolean;
  skippedBusy?: boolean;
  reason?: string | null;
  errors?: string[];
};

export function pipelineShouldHop(result: PipelineHopResult): boolean {
  if (result.reason === "missing-xai-key") return false;
  const remaining = result.remaining ?? 0;
  if (remaining <= 0) return false;
  if (result.progressed) return true;
  if (result.skippedBusy) return true;
  if ((result.generated ?? 0) > 0) return true;
  // Another follow’s newest is still queued after this one had no usable transcript.
  if (result.reason === "no-full-transcript") return true;
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
  const headers: Record<string, string> = {};
  const secret = pipelineHopSecret();
  if (secret) headers.authorization = `Bearer ${secret}`;
  // Preview Deployment Protection 401s server-to-server hops unless we send the
  // automation bypass. Production leaves this unset and hops on the public URL.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass;
    headers["x-vercel-set-bypass-cookie"] = "true";
  }
  return headers;
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
  after(() => dispatchPipelineHop(input));
}

export function schedulePipelineHopIfNeeded(
  result: PipelineHopResult,
  input: { origin: string; hop: number; userId?: string; showId?: string },
): boolean {
  if (!pipelineShouldHop(result) || input.hop >= PIPELINE_MAX_HOPS) return false;
  schedulePipelineHop({ ...input, hop: input.hop + 1 });
  return true;
}

/** Same-isolate guard so Library Check + AutoGenerate do not stampede after(). */
export const REFRESH_DEBOUNCE_MS = 45_000;
const refreshStartedAt = new Map<string, number>();

export function resetRefreshPipelineDebounceForTests(): void {
  refreshStartedAt.clear();
}

function refreshDebounceKey(input: { userId?: string; showId?: string }): string {
  return `${input.userId ?? "*"}:${input.showId ?? "*"}`;
}

/**
 * ACK the browser immediately, then run a refresh turn in `after()` and hop.
 * Waiting in the Check request is what made the button sit on Checking… for 300s.
 */
export function scheduleRefreshPipeline(input: {
  origin: string;
  hop?: number;
  userId?: string;
  showId?: string;
  skipFeedSync?: boolean;
}): boolean {
  const key = refreshDebounceKey(input);
  const now = Date.now();
  if (now - (refreshStartedAt.get(key) ?? 0) < REFRESH_DEBOUNCE_MS) {
    return false;
  }
  refreshStartedAt.set(key, now);

  const hop = input.hop ?? 0;
  after(() =>
    runPipelineTurn(async () => {
      try {
        const { refreshFollowedBriefs } = await import("@/lib/auto-brief");
        const result = await refreshFollowedBriefs({
          userId: input.userId,
          showId: input.showId,
          skipFeedSync: input.skipFeedSync,
        });
        console.info("[pipeline] refresh turn", {
          hop,
          progressed: result.progressed,
          remaining: result.remaining,
          reason: result.reason,
          generated: result.generated,
        });
        if (pipelineShouldHop(result) && hop < PIPELINE_MAX_HOPS) {
          await dispatchPipelineHop({
            origin: input.origin,
            hop: hop + 1,
            userId: input.userId,
            showId: input.showId,
          });
        }
      } catch (error) {
        console.error("[pipeline] refresh start failed", error instanceof Error ? error.message : error);
        if (hop < PIPELINE_MAX_HOPS) {
          await dispatchPipelineHop({
            origin: input.origin,
            hop: hop + 1,
            userId: input.userId,
            showId: input.showId,
          });
        }
      }
    }),
  );
  return true;
}
