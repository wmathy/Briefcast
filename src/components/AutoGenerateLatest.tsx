"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshStatusLabel, type RefreshResult } from "@/lib/refresh-status";

/** When a followed show's latest episode has no spoken brief, write it without a click. */
export function AutoGenerateLatest({ needed }: { needed: boolean }) {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<string | null>(needed ? "Writing the latest brief…" : null);

  useEffect(() => {
    if (!needed || started.current) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/queue/refresh", { method: "POST" });
      const data = (await response.json()) as RefreshResult;
      if (cancelled) return;
      if (!response.ok) {
        setStatus(data.error ?? "Could not write the latest brief.");
        return;
      }
      setStatus(refreshStatusLabel(data));
      router.refresh();
    })().catch(() => {
      if (!cancelled) setStatus("Could not write the latest brief.");
    });
    return () => {
      cancelled = true;
    };
  }, [needed, router]);

  if (!status) return null;
  return <p className="text-sm text-muted">{status}</p>;
}
