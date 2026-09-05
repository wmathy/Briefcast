"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refreshStatusLabel, type RefreshResult } from "@/lib/refresh-status";

export function RefreshButton({ showId }: { showId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("Check");
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={async () => {
        setPending(true);
        try {
          const response = await fetch(`/api/shows/${showId}/refresh`, { method: "POST" });
          const data = (await response.json().catch(() => ({}))) as RefreshResult;
          if (!response.ok) {
            setLabel(
              response.status === 504 || response.status === 502
                ? "Continuing…"
                : (data.error ?? "Refresh failed"),
            );
            router.refresh();
            return;
          }
          setLabel(refreshStatusLabel(data));
          router.refresh();
        } catch {
          setLabel("Continuing…");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      className="tap pressable rounded-full border border-line px-4 text-sm disabled:opacity-60"
    >
      {pending ? "Checking…" : label}
    </button>
  );
}
