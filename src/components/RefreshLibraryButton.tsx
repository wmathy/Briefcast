"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refreshStatusLabel, type RefreshResult } from "@/lib/refresh-status";

export function RefreshLibraryButton() {
  const router = useRouter();
  const [label, setLabel] = useState("Check");
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const response = await fetch("/api/queue/refresh", { method: "POST" });
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
      className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent disabled:opacity-60"
    >
      {pending ? "Checking…" : label}
    </button>
  );
}
