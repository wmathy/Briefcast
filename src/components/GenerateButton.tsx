"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateButton({ episodeId, hasXaiKey }: { episodeId: string; hasXaiKey: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(
    hasXaiKey ? null : "Add XAI_API_KEY to generate written briefs and spoken recaps.",
  );
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const response = await fetch(`/api/episodes/${episodeId}/generate`, { method: "POST" });
          const data = (await response.json()) as { error?: string };
          setPending(false);
          if (!response.ok) {
            setError(data.error ?? "Generate failed.");
            return;
          }
          router.refresh();
        }}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-deep disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate brief + voice"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
