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
        const response = await fetch("/api/queue/refresh", { method: "POST" });
        const data = (await response.json()) as RefreshResult;
        setPending(false);
        if (!response.ok) {
          setLabel(data.error ?? "Refresh failed");
          return;
        }
        setLabel(refreshStatusLabel(data));
        router.refresh();
      }}
      className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent disabled:opacity-60"
    >
      {pending ? "Checking…" : label}
    </button>
  );
}
