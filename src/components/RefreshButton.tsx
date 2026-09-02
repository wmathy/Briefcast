"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton({ showId }: { showId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("Check for new episodes");
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const response = await fetch(`/api/shows/${showId}/refresh`, { method: "POST" });
        const data = (await response.json()) as {
          created?: number;
          generating?: number;
          canGenerate?: boolean;
          error?: string;
        };
        setPending(false);
        if (!response.ok) {
          setLabel(data.error ?? "Refresh failed");
          return;
        }
        if (data.generating && !data.canGenerate) {
          setLabel(
            data.created
              ? `Added ${data.created} · add XAI_API_KEY to write briefs`
              : "New episode found · add XAI_API_KEY",
          );
        } else if (data.generating) {
          setLabel(data.created ? `Added ${data.created} · writing brief` : "Writing brief…");
        } else {
          setLabel(data.created ? `Added ${data.created} new` : "No new episodes");
        }
        router.refresh();
      }}
      className="rounded-full border border-line px-4 py-2 text-sm hover:border-accent disabled:opacity-60"
    >
      {pending ? "Checking…" : label}
    </button>
  );
}
