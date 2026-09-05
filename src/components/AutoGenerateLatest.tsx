"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  refreshContinueDelayMs,
  refreshShouldContinue,
  refreshStatusLabel,
  type RefreshResult,
} from "@/lib/refresh-status";

/** Keeps writing the single newest unbriefed followed episode until it finishes or auth fails. */
export function AutoGenerateLatest({ needed }: { needed: boolean }) {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<string | null>(needed ? "Writing…" : null);

  useEffect(() => {
    if (!needed || started.current) return;
    started.current = true;
    let cancelled = false;

    (async () => {
      let more = true;
      let turns = 0;
      while (more && !cancelled && turns < 200) {
        turns += 1;
        try {
          const response = await fetch("/api/queue/refresh?continue=1", { method: "POST" });
          const data = (await response.json().catch(() => ({}))) as RefreshResult;
          if (cancelled) return;
          if (response.status === 401) {
            setStatus(data.error ?? "Sign in required.");
            return;
          }
          if (!response.ok) {
            setStatus(
              response.status === 504 || response.status === 502 ? "Continuing…" : refreshStatusLabel(data),
            );
            more = refreshShouldContinue(response.status, data);
            if (more) {
              await new Promise((resolve) => setTimeout(resolve, refreshContinueDelayMs(data) || 20_000));
            }
            continue;
          }
          setStatus(refreshStatusLabel(data));
          more = refreshShouldContinue(response.status, data);
          const delayMs = refreshContinueDelayMs(data);
          if (more && delayMs > 0 && !cancelled) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        } catch {
          if (cancelled) return;
          setStatus("Continuing…");
          more = true;
          await new Promise((resolve) => setTimeout(resolve, 20_000));
        }
      }
      if (!cancelled) router.refresh();
    })().catch(() => {
      if (!cancelled) setStatus("Continuing…");
    });

    return () => {
      cancelled = true;
    };
  }, [needed, router]);

  if (!status) return null;
  return <p className="text-sm text-muted">{status}</p>;
}
