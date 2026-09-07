"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BriefLength } from "@/lib/brief-length";
import {
  FULL_TRANSCRIPT_UNAVAILABLE,
  FULL_TRANSCRIPT_UNAVAILABLE_SHORT,
} from "@/lib/transcript-complete";

function displayError(message: string): string {
  if (message === FULL_TRANSCRIPT_UNAVAILABLE || message.includes("Full transcript not available")) {
    return FULL_TRANSCRIPT_UNAVAILABLE_SHORT;
  }
  return message;
}

export function GenerateButton({
  episodeId,
  hasXaiKey,
  briefLength,
  retryUnavailable,
}: {
  episodeId: string;
  hasXaiKey: boolean;
  briefLength?: BriefLength;
  retryUnavailable?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(hasXaiKey ? null : "Add XAI_API_KEY.");
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const response = await fetch(`/api/episodes/${episodeId}/generate`, { method: "POST" });
            const data = (await response.json().catch(() => ({}))) as {
              error?: string;
              message?: string;
              published?: boolean;
            };
            if (!response.ok) {
              setError(displayError(data.error ?? "Generate failed."));
              return;
            }
            if (data.published === false) {
              setError(displayError(data.message ?? data.error ?? FULL_TRANSCRIPT_UNAVAILABLE));
              router.refresh();
              return;
            }
            router.refresh();
          } catch {
            setError("Could not reach Briefcast. Try again.");
          } finally {
            setPending(false);
          }
        }}
        className="tap pressable rounded-full bg-accent px-4 text-sm font-medium text-bg disabled:opacity-60"
      >
        {pending ? "Working…" : retryUnavailable ? "Retry" : briefLength ? "Rewrite" : "Generate"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
