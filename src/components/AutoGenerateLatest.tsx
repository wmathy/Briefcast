"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshShouldContinue, refreshStatusLabel, type RefreshResult } from "@/lib/refresh-status";

/** Keeps writing the latest unbriefed followed episode until none remain or a write fails. */
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
    while (more && !cancelled && turns < 80) {
      turns += 1;
        const response = await fetch("/api/queue/refresh?continue=1", { method: "POST" });
        const data = (await response.json().catch(() => ({}))) as RefreshResult;
        if (cancelled) return;
        if (!response.ok) {
          if (refreshShouldContinue(response.status, data) && turns < 80) {
            setStatus(response.status === 504 || response.status === 502 ? "Continuing…" : refreshStatusLabel(data));
            more = true;
            continue;
          }
          setStatus(data.error ?? "Could not write.");
          return;
        }
        setStatus(refreshStatusLabel(data));
        more = refreshShouldContinue(response.status, data);
        if (
          data.errors &&
          data.errors.length > 0 &&
          !data.generated &&
          !more
        ) {
          return;
        }
      }
      if (!cancelled) router.refresh();
    })().catch(() => {
      if (!cancelled) setStatus("Could not write.");
    });

    return () => {
      cancelled = true;
    };
  }, [needed, router]);

  if (!status) return null;
  return <p className="text-sm text-muted">{status}</p>;
}
